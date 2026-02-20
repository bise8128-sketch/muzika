
import os
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Set environment variable for testing before importing app
os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000"

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app

client = TestClient(app)

def test_cors_allowed_origin():
    response = client.options("/api/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"

def test_cors_denied_origin():
    # FastAPI's CORSMiddleware doesn't explicitly reject OPTIONS with 403 by default for unlisted origins, 
    # but it won't send the Allow-Origin header back.
    response = client.options("/api/health", headers={"Origin": "http://evil.com", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in response.headers

def test_upload_sanitization():
    # Test path traversal attempt
    filename = "../../etc/passwd"
    files = {'file': (filename, b"test content", "text/plain")}
    
    # We need to mock os.makedirs and open/shutil to avoid actual file system writes
    with patch("os.makedirs"), patch("builtins.open", MagicMock()) as mock_open, patch("shutil.copyfileobj"):
        response = client.post("/api/upload", files=files)
        
    assert response.status_code == 200
    # The filename in the response should be sanitized
    assert response.json()["filename"] == "etc_passwd" # werkzeug's secure_filename behavior for ../../etc/passwd

def test_file_proxy_path_traversal():
    response = client.get("/files/../../../../etc/passwd")
    assert response.status_code == 403
    assert response.json()["detail"] == "Access denied"
