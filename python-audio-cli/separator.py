import torch
import torchaudio
from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS, HDEMUCS_HIGH_MUSDB
import os
import logging
import gc
from utils import ensure_dir

logger = logging.getLogger('Separator')

# Configurable model mapping
# format: key -> (pipeline_bundle, display_name, description)
MODEL_REGISTRY = {
    "htdemucs": {
        "bundle": HDEMUCS_HIGH_MUSDB_PLUS,
        "name": "Demucs v4 High Quality",
        "description": "High fidelity separation (slower)",
        "type": "demucs"
    },
    "htdemucs_ft": {
        "bundle": HDEMUCS_HIGH_MUSDB,
        "name": "Demucs v4 Fine-Tuned",
        "description": "Balanced speed and quality",
        "type": "demucs"
    },
    "bs_roformer": {
        "bundle": None, # Placeholder for future implementation
        "name": "BS-Roformer",
        "description": "State of the art (requires external weights)",
        "type": "custom"
    }
}

class AudioSeparator:
    def __init__(self, output_dir="separated"):
        self.output_dir = output_dir
        ensure_dir(self.output_dir)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.mock_mode = os.environ.get("MOCK_SEPARATION", "false").lower() == "true"
        
        self.current_model_name = None
        self.model = None
        self.sample_rate = 44100
        
        logger.info(f"Separator initialized on {self.device}. Mock mode: {self.mock_mode}")

    def get_available_models(self):
        return [
            {"id": k, "name": v["name"], "description": v["description"]} 
            for k, v in MODEL_REGISTRY.items()
        ]

    def load_model(self, model_name):
        if self.mock_mode:
            logger.info("Mock mode: skipping model load")
            return

        if model_name not in MODEL_REGISTRY:
            # Fallback for unknown models (e.g. if frontend sends something else)
            logger.warning(f"Unknown model: {model_name}, falling back to htdemucs")
            model_name = "htdemucs"
            
        if self.current_model_name == model_name and self.model is not None:
            return # Already loaded

        # Unload previous model
        if self.model is not None:
            logger.info(f"Unloading {self.current_model_name}...")
            del self.model
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        logger.info(f"Loading model: {model_name}...")
        config = MODEL_REGISTRY[model_name]
        
        try:
            if config["type"] == "demucs":
                bundle = config["bundle"]
                self.model = bundle.get_model().to(self.device)
                self.sample_rate = bundle.sample_rate
                self.model.eval()
            elif config["type"] == "custom" and model_name == "bs_roformer":
                 raise NotImplementedError("BS-Roformer support not yet installed.")
            
            self.current_model_name = model_name
            logger.info(f"Model {model_name} loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            self.current_model_name = None
            self.model = None
            raise

    def separate(self, audio_path, model_name="htdemucs"):
        """
        Separates audio into stems using the specified model.
        Returns a dictionary of stem paths.
        
        WARNING: This method is CPU/GPU intensive and BLOCKING. 
        It should not be called directly from an async event loop without running in a threadpool.
        It is also not thread-safe regarding GPU memory; typically only one separation should run at a time.
        """
        logger.info(f"Separating: {audio_path} using {model_name}")
        
        # Use subfolder for model to differentiate results
        track_name = os.path.splitext(os.path.basename(audio_path))[0]
        track_dir = os.path.join(self.output_dir, model_name, track_name)
        ensure_dir(track_dir)
        
        stem_names = ["drums", "bass", "other", "vocals"]
        results = {}

        # MOCK MODE
        if self.mock_mode:
            logger.warning("Running in MOCK SEPARATION mode.")
            import shutil
            for name in stem_names:
                dst = os.path.join(track_dir, f"{name}.wav")
                if not os.path.exists(dst):
                     shutil.copy2(audio_path, dst)
                results[name] = dst
            return results

        try:
            # Ensure correct model is loaded
            self.load_model(model_name)
            
            # Real separation logic
            import soundfile as sf
            data, samplerate = sf.read(audio_path)
            
            if data.ndim == 1:
                waveform = torch.from_numpy(data).unsqueeze(0).float()
            else:
                waveform = torch.from_numpy(data.T).float()
            sr = samplerate
            
            # Resample if needed
            if sr != self.sample_rate:
                transform = torchaudio.transforms.Resample(sr, self.sample_rate).to(waveform.device)
                waveform = transform(waveform)
            
            # Ensure stereo
            if waveform.shape[0] == 1:
                waveform = waveform.repeat(2, 1)
            elif waveform.shape[0] > 2:
                waveform = waveform[:2]

            # Prepare for inference
            waveform = waveform.to(self.device)
            ref = waveform.mean(0)
            waveform = (waveform - ref.mean()) / (waveform.std() + 1e-8)
            
            # Run inference
            with torch.no_grad():
                input_tensor = waveform.unsqueeze(0)
                sources = self.model(input_tensor)
            
            sources = sources.squeeze(0).cpu()
            
            for i, name in enumerate(stem_names):
                stem = sources[i]
                path = os.path.join(track_dir, f"{name}.wav")
                torchaudio.save(path, stem, self.sample_rate)
                results[name] = path
            
            logger.info(f"Separation complete. Results in {track_dir}")
            return results

        except Exception as e:
            logger.error(f"Separation failed: {e}")
            raise
