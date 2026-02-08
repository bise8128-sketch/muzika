# Python Audio CLI Tool

A robust CLI and API server for downloading YouTube audio and separating it into stems (vocals, drums, bass, other) using AI.

## Features

- **High-Quality Download**: Uses `yt-dlp` to fetch the best audio
- **AI Separation**: Uses `Demucs` (via `torchaudio`) for state-of-the-art source separation
- **Formats**: Supports MP3 and WAV
- **Optimized**: GPU acceleration if available
- **API Server**: FastAPI backend for integration with web applications

## Quick Setup

```bash
# Automatic setup (recommended)
bash setup.sh
```

Or manual setup:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

*Note: This requires `ffmpeg` to be installed on your system.*

## Running as Backend Server

The backend server is **automatically started** when you run `npm run dev` from the main application (`audio-karaoke-app`).

### Manual Start

```bash
bash start-backend.sh
```

The API will be available at <http://localhost:8000>

### API Endpoints

- `POST /api/download` - Download YouTube audio

  ```json
  {
    "url": "https://youtube.com/watch?v=...",
    "format": "mp3"
  }
  ```

- `POST /api/separate` - Separate audio into stems

  ```json
  {
    "filename": "song.mp3"
  }
  ```

- `GET /api/library` - List downloaded songs and their stems

- `GET /files/{path}` - Retrieve audio files
  - Example: `/files/downloads/song.mp3`

## CLI Usage

Run the tool directly via python:

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

A simple Streamlit interface is included:

```bash
streamlit run streamlit_app.py
```

## Project Structure

- `cli.py` - Main CLI entry point
- `api.py` - FastAPI server
- `start-backend.sh` - Automatic startup script with environment validation
- `streamlit_app.py` - Simple GUI
- `downloader.py` - Handles YouTube downloads
- `separator.py` - Handles AI source separation
- `utils.py` - Helper functions

## Output Structure

```
output/
├── downloads/     # Downloaded audio files
└── stems/         # Separated audio stems
    └── song_name/
        ├── vocals.wav
        ├── drums.wav
        ├── bass.wav
        └── other.wav
```

## Troubleshooting

### Out of Memory

Source separation is memory intensive. If you run out of RAM/VRAM, try a shorter song or close other applications.

### Missing ffmpeg

Ensure `ffmpeg` is in your PATH:

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

### Virtual Environment Issues

If the automatic startup fails to create the virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Port Already in Use

If port 8000 is already in use, stop the conflicting process:

```bash
lsof -i :8000
kill -9 <PID>
```

## Requirements

- Python 3.8+
- ffmpeg
- 4GB+ RAM (8GB+ recommended for separation)
- GPU optional but recommended for faster processing
