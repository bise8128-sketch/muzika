from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import logging
import torch
from downloader import AudioDownloader
from separator import AudioSeparator
from utils import setup_logging

# Setup logging
logger = setup_logging(level=logging.INFO)
logger.name = "API"

app = FastAPI(title="Audio Processing API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
OUTPUT_DIR = "output"
DOWNLOADS_DIR = os.path.join(OUTPUT_DIR, "downloads")
STEMS_DIR = os.path.join(OUTPUT_DIR, "stems")

downloader = AudioDownloader(output_dir=DOWNLOADS_DIR)
# Initialize separator lazily or globally depending on memory usage preference. 
# For now, let's keep it global but handle potential load issues.
try:
    separator = AudioSeparator(output_dir=STEMS_DIR)
except Exception as e:
    logger.error(f"Failed to initialize separator: {e}")
    separator = None

class DownloadRequest(BaseModel):
    url: str
    format: str = "mp3"

class SeparateRequest(BaseModel):
    filename: str

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "separator_initialized": separator is not None
    }

@app.post("/api/download")
async def download_audio(request: DownloadRequest):
    try:
        logger.info(f"Received download request for: {request.url}")
        file_path = downloader.download(request.url, format=request.format)
        filename = os.path.basename(file_path)
        relative_path = os.path.relpath(file_path, OUTPUT_DIR)
        return {"status": "success", "filename": filename, "path": relative_path}
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/separate")
async def separate_audio(request: SeparateRequest):
    if separator is None:
        raise HTTPException(status_code=503, detail="Separator model not initialized")
    
    file_path = os.path.join(DOWNLOADS_DIR, request.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        logger.info(f"Starting separation for: {file_path}")
        stems = separator.separate(file_path)
        
        # Make paths relative for the response
        relative_stems = {k: os.path.relpath(v, OUTPUT_DIR) for k, v in stems.items()}
        
        return {"status": "success", "stems": relative_stems}
    except Exception as e:
        logger.error(f"Separation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/library")
async def get_library():
    songs = []
    if os.path.exists(DOWNLOADS_DIR):
        try:
            # Sort by modification time (newest first)
            files = sorted(
                [f for f in os.listdir(DOWNLOADS_DIR) if f.endswith(('.mp3', '.wav'))],
                key=lambda x: os.path.getmtime(os.path.join(DOWNLOADS_DIR, x)),
                reverse=True
            )
            
            for f in files:
                song = {
                    "filename": f,
                    "path": f"downloads/{f}",
                    "stems": {}
                }
                
                # Check for stems
                base_name = os.path.splitext(f)[0]
                stem_path = os.path.join(STEMS_DIR, base_name)
                
                if os.path.exists(stem_path) and os.path.isdir(stem_path):
                    for stem in ["vocals", "drums", "bass", "other"]:
                        stem_file = os.path.join(stem_path, f"{stem}.wav")
                        if os.path.exists(stem_file):
                            song["stems"][stem] = os.path.relpath(stem_file, OUTPUT_DIR)
                
                songs.append(song)
        except Exception as e:
            logger.error(f"Error scanning library: {e}")
            
    return {"songs": songs}

@app.get("/files/{path:path}")
async def get_file(path: str):
    file_path = os.path.join(OUTPUT_DIR, path)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

# Serve static files for frontend
app.mount("/", StaticFiles(directory="static", html=True), name="static")
