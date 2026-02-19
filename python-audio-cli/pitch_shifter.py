import os
import logging
import soundfile as sf
import pyrubberband as pyrb
from utils import ensure_dir

logger = logging.getLogger('PitchShifter')

class PitchShifter:
    def __init__(self, output_dir="output/processed"):
        self.output_dir = output_dir
        ensure_dir(self.output_dir)

    def shift_pitch(self, input_path, semitones, output_filename=None):
        """
        Shifts the pitch of an audio file by a number of semitones.
        
        Args:
            input_path (str): Path to the input audio file.
            semitones (float): Number of semitones to shift (positive or negative).
            output_filename (str, optional): Name of the output file. If None, derived from input.
            
        Returns:
            str: Path to the processed output file.
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        try:
            # Read audio file
            y, sr = sf.read(input_path)
            
            # Shift pitch
            # pyrb.pitch_shift arguments: y, sr, n_steps (semitones)
            y_shifted = pyrb.pitch_shift(y, sr, semitones)
            
            # Determine output path
            if output_filename:
                output_path = os.path.join(self.output_dir, output_filename)
            else:
                base_name = os.path.splitext(os.path.basename(input_path))[0]
                output_path = os.path.join(self.output_dir, f"{base_name}_pitch_{semitones}.wav")
            
            # Save processed audio
            sf.write(output_path, y_shifted, sr)
            
            logger.info(f"Pitch shifted by {semitones} semitones: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Pitch shifting failed: {e}")
            raise
