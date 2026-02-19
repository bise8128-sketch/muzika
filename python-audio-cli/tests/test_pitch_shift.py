import numpy as np
import soundfile as sf
import os
import sys

# Add parent directory to path to import PitchShifter
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pitch_shifter import PitchShifter

def generate_sine_wave(freq, duration, sr=44100):
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    return 0.5 * np.sin(2 * np.pi * freq * t)

def estimate_pitch(audio, sr):
    # Simple zero-crossing rate or FFT based estimation
    # For a pure sine wave, FFT is reliable
    spectrum = np.fft.fft(audio)
    freqs = np.fft.fftfreq(len(audio), 1/sr)
    idx = np.argmax(np.abs(spectrum))
    return np.abs(freqs[idx])

def test_pitch_shift():
    print("Testing Pitch Shifter...")
    sr = 44100
    duration = 2.0
    base_freq = 440.0 # A4
    
    # 1. Generate Sine Wave
    audio = generate_sine_wave(base_freq, duration, sr)
    input_path = "tests/test_sine.wav"
    sf.write(input_path, audio, sr)
    print(f"Generated {input_path} at {base_freq}Hz")

    # 2. Shift +12 Semitones (Octave Up) -> Should be 880Hz
    shifter = PitchShifter(output_dir="tests/output")
    output_path = shifter.shift_pitch(input_path, 12, "test_sine_octave_up.wav")
    
    # 3. Verify
    y_shifted, sr_shifted = sf.read(output_path)
    shifted_freq = estimate_pitch(y_shifted, sr_shifted)
    
    print(f"Shifted Frequency: {shifted_freq:.2f} Hz")
    expected_freq = base_freq * 2
    
    # Allow small margin of error for FFT resolution and artifacting
    if abs(shifted_freq - expected_freq) < 10: 
        print("✅ SUCCESS: Pitch doubled (approx 880Hz)")
    else:
        print(f"❌ FAILURE: Expected ~{expected_freq}Hz, got {shifted_freq}Hz")
        
    # Cleanup
    os.remove(input_path)
    # os.remove(output_path) # Keep output for manual inspection if needed

if __name__ == "__main__":
    test_pitch_shift()
