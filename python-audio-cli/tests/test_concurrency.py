
import pytest
import time
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app, jobs

client = TestClient(app)

# Mock separator to be slow
def slow_separation(*args, **kwargs):
    time.sleep(1) # Sleep for 1 second
    return {"vocals": "path/to/vocals.wav"}

@patch("separator.AudioSeparator")
def test_non_blocking_separation(MockSeparator):
    # Setup mock
    mock_instance = MockSeparator.return_value
    mock_instance.separate.side_effect = slow_separation
    
    # We need to patch the global 'separator' in api module
    with patch("api.separator", mock_instance):
        # Start separation
        response = client.post("/api/separate", json={"filename": "test.mp3", "model": "htdemucs"})
        assert response.status_code == 200
        job_id = response.json()["job_id"]
        
        # Immediately check health - should be fast
        start_time = time.time()
        health_response = client.get("/api/health")
        end_time = time.time()
        
        assert health_response.status_code == 200
        # If it was blocking, health check would wait for separation (approx 1s)
        # But since it's in background, it should return instantly
        assert (end_time - start_time) < 0.5 
        
        # Check job status initially
        status_response = client.get(f"/api/jobs/{job_id}")
        assert status_response.json()["status"] in ["pending", "processing", "completed"]

