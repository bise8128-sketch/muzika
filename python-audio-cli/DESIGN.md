# YouTube-to-Audio CLI Tool Design

## Overview

A Python CLI tool to download audio from YouTube and separate it into stems (vocals, drums, bass, etc.) using Demucs.

## Project Structure

```
python-audio-cli/
├── cli.py              # Main entry point
├── downloader.py       # yt-dlp wrapper
├── separator.py        # Demucs wrapper
├── utils.py            # Helpers (logging, paths)
├── requirements.txt    # Dependencies
└── venv/               # Virtual environment
```

## Modules

### 1. `cli.py`

- Uses `argparse` to handle user input.
- **Arguments**:
  - `url`: YouTube URL (required).
  - `--format`: `mp3` or `wav` (default: `mp3`).
  - `--separate`: Boolean flag to trigger separation (default: False).
  - `--model`: Demucs model (default: `htdemucs`).
  - `--output`: Output directory.
- Orchestrates the workflow: Download -> Separate.

### 2. `downloader.py`

- Class `AudioDownloader`:
  - `download(url, output_format='mp3', output_dir='downloads') -> str`
  - Returns path to downloaded file.
  - Uses `yt_dlp.YoutubeDL` with options for high quality audio.
  - Handles exceptions (DownloadError).

### 3. `separator.py`

- Class `AudioSeparator`:
  - `separate(audio_path, output_dir='separated', model='htdemucs') -> dict`
  - Returns paths to separated stems.
  - Uses `demucs.separate` API or calls `demucs` via subprocess if API is complex to integrate directly (subprocess is often more stable for CLI tools wrapping other CLIs).
  - **Optimization**: Check for GPU availability (`torch.cuda.is_available()`).

### 4. `utils.py`

- Logging setup (colorized output).
- File path sanitization.
- Temporary directory management.

## Dependencies

- `yt-dlp`: For downloading.
- `demucs`: For separation.
- `torch`, `torchaudio`: Required by Demucs.
- `ffmpeg-python` (optional, or just rely on system ffmpeg).

## Error Handling

- Invalid URLs.
- Network issues.
- Missing ffmpeg.
- CUDA out of memory (fallback to CPU).

## Optimization

- Use `yt-dlp`'s concurrent fragment downloading if applicable.
- Use GPU for Demucs if available.
- Async `cli.py` is likely unnecessary for a linear script, but `asyncio` can be used for concurrent downloads if batch processing is added later. For single URL, synchronous is fine, but we will structure it to be async-ready.
