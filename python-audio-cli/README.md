# Python Audio CLI Tool

A robust CLI tool for downloading YouTube audio and separating it into stems (vocals, drums, bass, other) using AI.

## Features

- **High-Quality Download**: Uses `yt-dlp` to fetch the best audio.
- **AI Separation**: Uses `Demucs` (via `torchaudio`) for state-of-the-art source separation.
- **Formats**: Supports MP3 and WAV.
- **Optimized**: GPU acceleration if available.

## Installation

1. Create a virtual environment:

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

   *Note: This requires `ffmpeg` to be installed on your system.*

## Usage

Run the tool using the wrapper script (if created) or directly via python:

```bash
# Basic download (MP3)
python cli.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Download and Separate
python cli.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --separate

# Output to specific directory
python cli.py "URL" --output my_songs

# Keep original file and separate
python cli.py "URL" --separate --keep-original
```

## GUI Interface

A simple Streamlit interface is included.

```bash
streamlit run streamlit_app.py
```

## Structure

- `cli.py`: Main entry point.
- `streamlit_app.py`: Simple GUI.
- `downloader.py`: Handles YouTube downloads.
- `separator.py`: Handles AI source separation.
- `utils.py`: Helper functions.

## Troubleshooting

- **Out of Memory**: Source separation is memory intensive. If you run out of RAM/VRAM, try a shorter song or close other applications.
- **Missing ffmpeg**: Ensure `ffmpeg` is in your PATH.
