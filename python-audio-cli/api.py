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
import asyncio
import uuid
from typing import Dict, Optional
from fastapi.concurrency import run_in_threadpool
from werkzeug.utils import secure_filename

# Setup logging
logger = setup_logging(level=logging.INFO)
logger.name = "API"

app = FastAPI(title="Audio Processing API")

# CORS
# CORS
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
    model: str = "htdemucs"

class JobStatus(BaseModel):
    job_id: str
    status: str
    result: Optional[Dict[str, str]] = None
    error: Optional[str] = None

# Global state
jobs: Dict[str, Dict[str, Any]] = {}
separation_lock = asyncio.Lock()

@app.get("/api/models")
async def list_models():
    if separator is None:
        return {"models": []}
    return {"models": separator.get_available_models()}

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "separator_initialized": separator is not None,
        "current_model": separator.current_model_name if separator else None
    }

from fastapi import UploadFile, File
import shutil

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        filename = secure_filename(file.filename)
        file_path = os.path.join(DOWNLOADS_DIR, filename)
        # Ensure dir exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"status": "success", "filename": filename}
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

async def run_separation_job(job_id: str, filename: str, model: str):
    async with separation_lock:
        try:
            jobs[job_id]["status"] = "processing"
            file_path = os.path.join(DOWNLOADS_DIR, filename)
            
            if not os.path.exists(file_path):
                raise FileNotFoundError("File not found")

            # Blocking call offloaded to threadpool
            logger.info(f"Starting separation for: {file_path} with model {model}")
            stems = await run_in_threadpool(separator.separate, file_path, model_name=model)
            
            # Make paths relative
            relative_stems = {k: os.path.relpath(v, OUTPUT_DIR) for k, v in stems.items()}
            
            jobs[job_id]["result"] = relative_stems
            jobs[job_id]["status"] = "completed"
            logger.info(f"Job {job_id} completed")
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = str(e)

@app.post("/api/separate", response_model=JobStatus)
async def separate_audio(request: SeparateRequest, background_tasks: BackgroundTasks):
    if separator is None:
        raise HTTPException(status_code=503, detail="Separator model not initialized")
    
    # Verify file exists synchronously to fail fast
    file_path = os.path.join(DOWNLOADS_DIR, secure_filename(request.filename))
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "result": None,
        "error": None
    }
    
    background_tasks.add_task(run_separation_job, job_id, secure_filename(request.filename), request.model)
    return jobs[job_id]

@app.get("/api/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

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
