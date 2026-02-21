import re
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
import os
import json
import logging
import torch
from downloader import AudioDownloader
from separator import AudioSeparator
from pitch_shifter import PitchShifter
from utils import setup_logging
import asyncio
import uuid
import time
from typing import Dict, Optional, Any, List
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from werkzeug.utils import secure_filename

# Setup logging
logger = setup_logging(level=logging.INFO)
logger.name = "API"

# Setup rate limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Audio Processing API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
# CORS
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# Initialize components
OUTPUT_DIR = "output"
DOWNLOADS_DIR = os.path.join(OUTPUT_DIR, "downloads")
STEMS_DIR = os.path.join(OUTPUT_DIR, "stems")
PROCESSED_DIR = os.path.join(OUTPUT_DIR, "processed")

downloader = AudioDownloader(output_dir=DOWNLOADS_DIR)
# Initialize separator lazily or globally depending on memory usage preference. 
# For now, let's keep it global but handle potential load issues.
try:
    separator = AudioSeparator(output_dir=STEMS_DIR)
except Exception as e:
    logger.error(f"Failed to initialize separator: {e}")
    separator = None

try:
    pitch_shifter = PitchShifter(output_dir=PROCESSED_DIR)
except Exception as e:
    logger.error(f"Failed to initialize pitch shifter: {e}")
    pitch_shifter = None

YOUTUBE_URL_REGEX = re.compile(
    r'^https?://(www\.)?(youtube\.com/(watch\?v=|embed/|v/|shorts/)|youtu\.be/)[a-zA-Z0-9_-]{11}'
)

class DownloadRequest(BaseModel):
    url: str
    format: str = "mp3"

class SeparateRequest(BaseModel):
    filename: str
    model: str = "htdemucs"

class PitchShiftRequest(BaseModel):
    filename: str
    semitones: float

class JobStatus(BaseModel):
    job_id: str
    status: str
    result: Optional[Dict[str, str]] = None
    error: Optional[str] = None

# Global state
separation_lock = asyncio.Lock()

# ── Redis-backed job storage (with in-memory fallback) ──────────
try:
    import redis
    _redis = redis.Redis(
        host=os.environ.get("REDIS_HOST", "localhost"),
        port=int(os.environ.get("REDIS_PORT", 6379)),
        db=0,
        decode_responses=True,
    )
    _redis.ping()
    _use_redis = True
    logger.info("Redis connected — using persistent job storage")
except Exception as e:
    logger.warning(f"Redis unavailable ({e}) — falling back to in-memory job storage")
    _use_redis = False
    _redis = None

_jobs_fallback: Dict[str, Dict[str, Any]] = {}
_JOB_TTL = 3600  # 1 hour


def set_job(job_id: str, data: Dict[str, Any]) -> None:
    if _use_redis and _redis:
        _redis.setex(f"job:{job_id}", _JOB_TTL, json.dumps(data))
    else:
        _jobs_fallback[job_id] = data


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    if _use_redis and _redis:
        raw = _redis.get(f"job:{job_id}")
        return json.loads(raw) if raw else None
    return _jobs_fallback.get(job_id)


def update_job(job_id: str, **kwargs: Any) -> None:
    job = get_job(job_id)
    if job:
        job.update(kwargs)
        set_job(job_id, job)

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
@limiter.limit("10/minute")
async def upload_file(request: Request, file: UploadFile = File(...)):
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
@limiter.limit("10/minute")
async def download_audio(request: Request, payload: DownloadRequest):
    # Validate YouTube URL server-side
    if not YOUTUBE_URL_REGEX.match(payload.url.strip()):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    try:
        logger.info(f"Received download request for: {payload.url}")
        file_path = downloader.download(payload.url, format=payload.format)
        filename = os.path.basename(file_path)
        relative_path = os.path.relpath(file_path, OUTPUT_DIR)
        return {"status": "success", "filename": filename, "path": relative_path}
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def run_separation_job(job_id: str, filename: str, model: str):
    async with separation_lock:
        try:
            update_job(job_id, status="processing")
            file_path = os.path.join(DOWNLOADS_DIR, filename)
            
            if not os.path.exists(file_path):
                raise FileNotFoundError("File not found")

            # Blocking call offloaded to threadpool
            logger.info(f"Starting separation for: {file_path} with model {model}")
            stems = await run_in_threadpool(separator.separate, file_path, model_name=model)
            
            # Make paths relative
            relative_stems = {k: os.path.relpath(v, OUTPUT_DIR) for k, v in stems.items()}
            
            update_job(job_id, result=relative_stems, status="completed")
            logger.info(f"Job {job_id} completed")
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            update_job(job_id, status="failed", error=str(e))

@app.post("/api/separate", response_model=JobStatus)
@limiter.limit("20/minute")
async def separate_audio(request: Request, payload: SeparateRequest, background_tasks: BackgroundTasks):
    if separator is None:
        raise HTTPException(status_code=503, detail="Separator model not initialized")
    
    # Verify file exists synchronously to fail fast
    file_path = os.path.join(DOWNLOADS_DIR, secure_filename(payload.filename))
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    job_id = str(uuid.uuid4())
    job_data = {
        "job_id": job_id,
        "status": "pending",
        "result": None,
        "error": None
    }
    set_job(job_id, job_data)
    
    background_tasks.add_task(run_separation_job, job_id, secure_filename(payload.filename), payload.model)
    return job_data


async def run_pitch_shift_job(job_id: str, filename: str, semitones: float):
    # No lock needed for pitch shifting usually, as it's CPU bound and parallelizable
    # compared to GPU memory constraints of separation.
    try:
        update_job(job_id, status="processing")
        file_path = os.path.join(DOWNLOADS_DIR, filename)
        
        if not os.path.exists(file_path):
             # Try checking processed dir too, to allow chaining
            file_path = os.path.join(PROCESSED_DIR, filename)
            if not os.path.exists(file_path):
                raise FileNotFoundError("File not found")

        logger.info(f"Starting pitch shift for: {file_path} by {semitones} semitones")
        
        # Determine output filename
        base_name = os.path.splitext(filename)[0]
        # Clean previous suffixes to avoid accumulation
        base_name = re.sub(r'_pitch_[-]?\d+(\.\d+)?', '', base_name)
        output_filename = f"{base_name}_pitch_{semitones}.wav"
        
        output_path = await run_in_threadpool(
            pitch_shifter.shift_pitch, 
            file_path, 
            semitones, 
            output_filename=output_filename
        )
        
        relative_path = os.path.relpath(output_path, OUTPUT_DIR)
        
        update_job(job_id, result={"path": relative_path}, status="completed")
        logger.info(f"Job {job_id} completed")
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        update_job(job_id, status="failed", error=str(e))

@app.post("/api/process/pitch", response_model=JobStatus)
@limiter.limit("30/minute")
async def pitch_shift_audio(request: Request, payload: PitchShiftRequest, background_tasks: BackgroundTasks):
    if pitch_shifter is None:
        raise HTTPException(status_code=503, detail="Pitch shifter not initialized")

    # Verify original file exists in downloads or processed
    filename = secure_filename(payload.filename)
    path_in_downloads = os.path.join(DOWNLOADS_DIR, filename)
    path_in_processed = os.path.join(PROCESSED_DIR, filename)
    
    if not os.path.exists(path_in_downloads) and not os.path.exists(path_in_processed):
        raise HTTPException(status_code=404, detail="File not found")

    job_id = str(uuid.uuid4())
    job_data = {
        "job_id": job_id,
        "status": "pending",
        "result": None,
        "error": None
    }
    set_job(job_id, job_data)
    
    background_tasks.add_task(run_pitch_shift_job, job_id, filename, payload.semitones)
    return job_data

@app.get("/api/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

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

# ─── WebSocket Connection Manager ───────────────────────────────────

class ConnectionManager:
    def __init__(self):
        # room_id -> list of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # room_id -> room state (dict)
        self.room_states: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, participant: Dict[str, Any]):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
            # Initialize room state if new
            self.room_states[room_id] = {
                "id": room_id,
                "participants": [],
                "playbackState": {
                    "isPlaying": False, 
                    "currentTime": 0, 
                    "songId": None,
                    "updatedAt": time.time() * 1000
                }
            }
        
        self.active_connections[room_id].append(websocket)
        
        # Add participant to state
        # Check if already exists to avoid dupes
        exists = next((p for p in self.room_states[room_id]["participants"] if p["id"] == participant["id"]), None)
        if not exists:
            self.room_states[room_id]["participants"].append(participant)
            
        # Broadcast join message
        await self.broadcast(room_id, {
            "type": "join",
            "senderId": "system",
            "timestamp": time.time() * 1000,
            "payload": { "participant": participant }
        })
        
        # Send current room state to the new user
        await websocket.send_json({
            "type": "room-state",
            "senderId": "system",
            "timestamp": time.time() * 1000,
            "payload": { "room": self.room_states[room_id] }
        })

    def disconnect(self, websocket: WebSocket, room_id: str, participant_id: str):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            
            # Remove participant from state
            room = self.room_states.get(room_id)
            if room:
                room["participants"] = [p for p in room["participants"] if p["id"] != participant_id]
                
                # Cleanup empty rooms
                if len(self.active_connections[room_id]) == 0:
                    del self.active_connections[room_id]
                    del self.room_states[room_id]

    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            # Update state if it's a playback update
            if message.get("type") == "playback-update":
                room = self.room_states.get(room_id)
                if room:
                    room["playbackState"].update(message["payload"])
                    room["playbackState"]["updatedAt"] = message["timestamp"]

            disconnected = []
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(connection)
            
            for conn in disconnected:
                if conn in self.active_connections[room_id]:
                    self.active_connections[room_id].remove(conn)

manager = ConnectionManager()

@app.websocket("/ws/rooms/{room_id}/{participant_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, participant_id: str, name: str = "Guest"):
    participant = {
        "id": participant_id,
        "displayName": name,
        "isHost": False, # Logic to determine host can be improved
        "joinedAt": time.time() * 1000,
        "score": 0
    }
    
    # First user in room becomes host
    if room_id not in manager.room_states or len(manager.room_states[room_id]["participants"]) == 0:
        participant["isHost"] = True

    await manager.connect(websocket, room_id, participant)
    
    try:
        while True:
            data = await websocket.receive_json()
            # Relay message to everyone in the room
            # Ensure senderId matches
            data["senderId"] = participant_id
            data["timestamp"] = time.time() * 1000
            await manager.broadcast(room_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id, participant_id)
        # file_path = os.path.join(OUTPUT_DIR, path)
        await manager.broadcast(room_id, {
            "type": "leave",
            "senderId": "system",
            "timestamp": time.time() * 1000,
            "payload": { "participantId": participant_id }
        })

@app.get("/files/{path:path}")
async def get_file(path: str):
    base_dir = os.path.abspath(OUTPUT_DIR)
    file_path = os.path.abspath(os.path.join(base_dir, path))

    # Path traversal protection: ensure the target file is inside our allowed output dir
    if not file_path.startswith(base_dir):
        raise HTTPException(status_code=403, detail="Access denied")

    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

# Serve static files for frontend
app.mount("/", StaticFiles(directory="static", html=True), name="static")
