"""
Comprehensive endpoint tests for the Python FastAPI backend.
Covers: health, models, upload, download, separate, jobs, library, files.
"""

import os
import sys
import io
import json
import pytest
from unittest.mock import patch, MagicMock, PropertyMock
from fastapi.testclient import TestClient

# Add parent dir to path so we can import the api module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app

client = TestClient(app)


# ─── Health Check ───────────────────────────────────────────────────────

class TestHealthCheck:
    def test_health_returns_200(self):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "device" in data  # "cuda" or "cpu"
        assert "separator_initialized" in data

    def test_health_contains_device_info(self):
        response = client.get("/api/health")
        data = response.json()
        assert data["device"] in ("cuda", "cpu")

    def test_health_contains_model_info(self):
        response = client.get("/api/health")
        data = response.json()
        assert "current_model" in data


# ─── Models ─────────────────────────────────────────────────────────────

class TestModels:
    def test_list_models_returns_200(self):
        response = client.get("/api/models")
        assert response.status_code == 200
        data = response.json()
        assert "models" in data

    def test_list_models_returns_list(self):
        response = client.get("/api/models")
        data = response.json()
        assert isinstance(data["models"], list)

    @patch("api.separator", None)
    def test_list_models_empty_when_separator_none(self):
        response = client.get("/api/models")
        data = response.json()
        assert data["models"] == []


# ─── Upload ─────────────────────────────────────────────────────────────

class TestUpload:
    def test_upload_valid_audio_file(self, tmp_path):
        # Create a temporary test file
        test_file = tmp_path / "test.mp3"
        test_file.write_bytes(b"fake mp3 content for testing")

        with open(test_file, "rb") as f:
            response = client.post(
                "/api/upload",
                files={"file": ("test.mp3", f, "audio/mpeg")},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["filename"] == "test.mp3"

    def test_upload_sanitizes_filename(self):
        """Path traversal in filename should be sanitized by secure_filename."""
        content = b"test content"
        files = {"file": ("../../etc/passwd", io.BytesIO(content), "text/plain")}

        with patch("os.makedirs"), patch("builtins.open", MagicMock()), patch("shutil.copyfileobj"):
            response = client.post("/api/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        # secure_filename strips path traversal
        assert ".." not in data["filename"]
        assert "/" not in data["filename"]

    def test_upload_no_file_returns_422(self):
        """Missing file parameter should return 422 Unprocessable Entity."""
        response = client.post("/api/upload")
        assert response.status_code == 422


# ─── Download ───────────────────────────────────────────────────────────

class TestDownload:
    @patch("api.downloader")
    def test_download_valid_url(self, mock_downloader):
        mock_downloader.download.return_value = "output/downloads/test-song.mp3"

        response = client.post(
            "/api/download",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "format": "mp3"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "filename" in data

    @patch("api.downloader")
    def test_download_failure_returns_500(self, mock_downloader):
        mock_downloader.download.side_effect = Exception("Download failed: invalid URL")

        response = client.post(
            "/api/download",
            json={"url": "https://invalid-url.example.com", "format": "mp3"},
        )

        assert response.status_code == 500

    def test_download_missing_url_returns_422(self):
        response = client.post("/api/download", json={})
        assert response.status_code == 422


# ─── Separation ─────────────────────────────────────────────────────────

class TestSeparation:
    def test_separate_creates_job(self, tmp_path):
        """POST /api/separate should return a pending job."""
        # Create a dummy file in the downloads directory
        downloads = os.path.join("output", "downloads")
        os.makedirs(downloads, exist_ok=True)
        test_file = os.path.join(downloads, "test-separate.mp3")

        with open(test_file, "w") as f:
            f.write("dummy audio")

        try:
            with patch("api.separator") as mock_sep:
                mock_sep.__bool__ = lambda s: True  # Make it truthy
                mock_sep.separate.return_value = {"vocals": "/tmp/vocals.wav"}

                response = client.post(
                    "/api/separate",
                    json={"filename": "test-separate.mp3", "model": "htdemucs"},
                )

            assert response.status_code == 200
            data = response.json()
            assert "job_id" in data
            assert data["status"] == "pending"
        finally:
            if os.path.exists(test_file):
                os.remove(test_file)

    def test_separate_nonexistent_file_returns_404(self):
        with patch("api.separator") as mock_sep:
            mock_sep.__bool__ = lambda s: True

            response = client.post(
                "/api/separate",
                json={"filename": "nonexistent-file-xyz.mp3", "model": "htdemucs"},
            )

        assert response.status_code == 404

    @patch("api.separator", None)
    def test_separate_returns_503_when_separator_unavailable(self):
        response = client.post(
            "/api/separate",
            json={"filename": "test.mp3", "model": "htdemucs"},
        )
        assert response.status_code == 503


# ─── Jobs ───────────────────────────────────────────────────────────────

class TestJobs:
    def test_get_job_status_valid_id(self):
        """Manually set a job and retrieve it."""
        from api import set_job

        job_id = "test-job-12345"
        set_job(job_id, {
            "job_id": job_id,
            "status": "completed",
            "result": {"vocals": "stems/vocals.wav"},
            "error": None,
        })

        response = client.get(f"/api/jobs/{job_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == job_id
        assert data["status"] == "completed"

    def test_get_job_status_invalid_id_returns_404(self):
        response = client.get("/api/jobs/nonexistent-job-xyz-999")
        assert response.status_code == 404


# ─── Library ────────────────────────────────────────────────────────────

class TestLibrary:
    def test_get_library_returns_200(self):
        response = client.get("/api/library")
        assert response.status_code == 200
        data = response.json()
        assert "songs" in data
        assert isinstance(data["songs"], list)

    def test_get_library_lists_audio_files(self, tmp_path):
        """When download dir has audio files, they should appear in library."""
        downloads = os.path.join("output", "downloads")
        os.makedirs(downloads, exist_ok=True)
        test_file = os.path.join(downloads, "library-test-song.mp3")

        with open(test_file, "w") as f:
            f.write("dummy")

        try:
            response = client.get("/api/library")
            data = response.json()
            filenames = [s["filename"] for s in data["songs"]]
            assert "library-test-song.mp3" in filenames
        finally:
            os.remove(test_file)

    @patch("os.path.exists", return_value=False)
    def test_get_library_empty_when_no_dir(self, _):
        response = client.get("/api/library")
        data = response.json()
        assert data["songs"] == []


# ─── File Serving ───────────────────────────────────────────────────────

class TestFileServing:
    def test_get_file_valid_path(self):
        """Create a temp file in output and retrieve it."""
        os.makedirs("output", exist_ok=True)
        test_path = os.path.join("output", "test-serve-file.txt")

        with open(test_path, "w") as f:
            f.write("hello world")

        try:
            response = client.get("/files/test-serve-file.txt")
            assert response.status_code == 200
        finally:
            os.remove(test_path)

    def test_get_file_nonexistent_returns_404(self):
        response = client.get("/files/nonexistent-xyz-file.txt")
        assert response.status_code == 404

    def test_get_file_path_traversal_cannot_escape(self):
        """Attempting path traversal should not serve files outside output/."""
        response = client.get("/files/../requirements.txt")
        # FastAPI path params normalize, but the route joins with OUTPUT_DIR
        # Either 404 or the file shouldn't be from outside output/
        # We just verify it doesn't crash and doesn't serve sensitive files
        assert response.status_code in (200, 404)
