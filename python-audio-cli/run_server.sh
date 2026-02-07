#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
uvicorn api:app --reload --port 8000
