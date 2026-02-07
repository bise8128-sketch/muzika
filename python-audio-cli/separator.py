import torch
import torchaudio
from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS
import os
import logging
from utils import ensure_dir

logger = logging.getLogger('Separator')

class AudioSeparator:
    def __init__(self, output_dir="separated"):
        self.output_dir = output_dir
        ensure_dir(self.output_dir)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Initializing Demucs on {self.device}...")
        
        try:
            self.bundle = HDEMUCS_HIGH_MUSDB_PLUS
            self.model = self.bundle.get_model().to(self.device)
            self.sample_rate = self.bundle.sample_rate
            self.model.eval()
            logger.info("Model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    def separate(self, audio_path):
        """
        Separates audio into stems.
        Returns a dictionary of stem paths.
        """
        logger.info(f"Separating: {audio_path}")
        try:
            # Load audio
            waveform, sr = torchaudio.load(audio_path)
            
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
            try:
                with torch.no_grad():
                    # Add batch dimension: (1, channels, time)
                    input_tensor = waveform.unsqueeze(0)
                    sources = self.model(input_tensor)
            except RuntimeError as e:
                if "out of memory" in str(e):
                    logger.error("Out of memory. Try a shorter song or a machine with more RAM/VRAM.")
                    raise
                else:
                    raise

            # Sources shape: (1, sources, channels, time)
            # Remove batch dim
            sources = sources.squeeze(0).cpu()
            
            # Save stems
            stem_names = ["drums", "bass", "other", "vocals"] # Standard Demucs order
            results = {}
            
            track_name = os.path.splitext(os.path.basename(audio_path))[0]
            track_dir = os.path.join(self.output_dir, track_name)
            ensure_dir(track_dir)
            
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
