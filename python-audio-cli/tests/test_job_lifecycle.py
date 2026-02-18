"""
Job lifecycle tests for the Python FastAPI backend.
Tests the full job flow: pending → processing → completed/failed,
and storage mechanisms (in-memory fallback vs Redis).
"""

import os
import sys
import json
import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import set_job, get_job, update_job, _jobs_fallback


class TestJobStorageInMemory:
    """Tests for the in-memory job storage fallback."""

    def setup_method(self):
        """Clear in-memory jobs before each test."""
        _jobs_fallback.clear()

    def test_set_and_get_job(self):
        job_data = {"job_id": "j1", "status": "pending", "result": None, "error": None}
        set_job("j1", job_data)
        retrieved = get_job("j1")
        assert retrieved is not None
        assert retrieved["job_id"] == "j1"
        assert retrieved["status"] == "pending"

    def test_get_nonexistent_job_returns_none(self):
        assert get_job("nonexistent-xyz") is None

    def test_update_job_status(self):
        set_job("j2", {"job_id": "j2", "status": "pending", "result": None, "error": None})
        update_job("j2", status="processing")
        job = get_job("j2")
        assert job["status"] == "processing"

    def test_update_job_with_result(self):
        set_job("j3", {"job_id": "j3", "status": "processing", "result": None, "error": None})
        result = {"vocals": "stems/vocals.wav", "drums": "stems/drums.wav"}
        update_job("j3", status="completed", result=result)

        job = get_job("j3")
        assert job["status"] == "completed"
        assert job["result"]["vocals"] == "stems/vocals.wav"

    def test_update_job_with_error(self):
        set_job("j4", {"job_id": "j4", "status": "processing", "result": None, "error": None})
        update_job("j4", status="failed", error="Out of memory")

        job = get_job("j4")
        assert job["status"] == "failed"
        assert job["error"] == "Out of memory"

    def test_update_nonexistent_job_does_nothing(self):
        """Updating a non-existent job should not raise."""
        update_job("nonexistent-xyz", status="completed")
        assert get_job("nonexistent-xyz") is None

    def test_full_lifecycle_pending_to_completed(self):
        """Simulate the full job lifecycle."""
        job_id = "lifecycle-test"

        # 1. Create job in pending state
        set_job(job_id, {"job_id": job_id, "status": "pending", "result": None, "error": None})
        assert get_job(job_id)["status"] == "pending"

        # 2. Move to processing
        update_job(job_id, status="processing")
        assert get_job(job_id)["status"] == "processing"

        # 3. Complete with results
        stems = {"vocals": "stems/htdemucs/song/vocals.wav", "bass": "stems/htdemucs/song/bass.wav"}
        update_job(job_id, status="completed", result=stems)

        final = get_job(job_id)
        assert final["status"] == "completed"
        assert final["result"] == stems
        assert final["error"] is None

    def test_full_lifecycle_pending_to_failed(self):
        """Simulate a failed job lifecycle."""
        job_id = "fail-test"

        set_job(job_id, {"job_id": job_id, "status": "pending", "result": None, "error": None})
        update_job(job_id, status="processing")
        update_job(job_id, status="failed", error="File not found")

        final = get_job(job_id)
        assert final["status"] == "failed"
        assert final["error"] == "File not found"
        assert final["result"] is None


class TestJobStorageRedis:
    """Tests for Redis-backed job storage (mocked)."""

    @patch("api._use_redis", True)
    @patch("api._redis")
    def test_set_job_calls_redis_setex(self, mock_redis):
        mock_redis.__bool__ = lambda s: True
        job_data = {"job_id": "r1", "status": "pending"}
        set_job("r1", job_data)
        mock_redis.setex.assert_called_once()

    @patch("api._use_redis", True)
    @patch("api._redis")
    def test_get_job_from_redis(self, mock_redis):
        mock_redis.__bool__ = lambda s: True
        mock_redis.get.return_value = json.dumps(
            {"job_id": "r2", "status": "completed", "result": {"vocals": "v.wav"}, "error": None}
        )

        job = get_job("r2")
        assert job is not None
        assert job["status"] == "completed"

    @patch("api._use_redis", True)
    @patch("api._redis")
    def test_get_job_returns_none_when_key_missing(self, mock_redis):
        mock_redis.__bool__ = lambda s: True
        mock_redis.get.return_value = None

        job = get_job("missing-key")
        assert job is None


class TestSeparationJobExecution:
    """Tests for the run_separation_job async function."""

    @pytest.mark.asyncio
    async def test_run_separation_job_completes(self):
        from api import run_separation_job, set_job, get_job

        _jobs_fallback.clear()

        job_id = "exec-test-1"
        set_job(job_id, {"job_id": job_id, "status": "pending", "result": None, "error": None})

        # Create dummy file
        os.makedirs("output/downloads", exist_ok=True)
        test_file = "output/downloads/exec-test.mp3"
        with open(test_file, "w") as f:
            f.write("dummy")

        mock_separator = MagicMock()
        mock_separator.separate.return_value = {
            "vocals": "output/stems/htdemucs/exec-test/vocals.wav",
            "drums": "output/stems/htdemucs/exec-test/drums.wav",
        }

        try:
            with patch("api.separator", mock_separator):
                await run_separation_job(job_id, "exec-test.mp3", "htdemucs")

            job = get_job(job_id)
            assert job["status"] == "completed"
            assert job["result"] is not None
        finally:
            if os.path.exists(test_file):
                os.remove(test_file)

    @pytest.mark.asyncio
    async def test_run_separation_job_fails_file_not_found(self):
        from api import run_separation_job, set_job, get_job

        _jobs_fallback.clear()

        job_id = "exec-fail-1"
        set_job(job_id, {"job_id": job_id, "status": "pending", "result": None, "error": None})

        mock_separator = MagicMock()

        with patch("api.separator", mock_separator):
            await run_separation_job(job_id, "nonexistent-file-xyz.mp3", "htdemucs")

        job = get_job(job_id)
        assert job["status"] == "failed"
        assert "not found" in job["error"].lower() or "File not found" in job["error"]
