#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}[Python Backend]${NC} Starting server..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[Python Backend]${NC} Error: Python 3 is not installed"
    echo -e "${YELLOW}[Python Backend]${NC} Please install Python 3.8+ to use the backend features"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}[Python Backend]${NC} Virtual environment not found. Creating..."
    python3 -m venv venv
    source venv/bin/activate
    echo -e "${YELLOW}[Python Backend]${NC} Installing dependencies..."
    pip install --quiet fastapi uvicorn[standard] yt-dlp
    pip install --quiet -r requirements.txt 2>/dev/null || echo -e "${YELLOW}[Python Backend]${NC} Some dependencies may have failed to install"
else
    source venv/bin/activate
fi

# Check if FastAPI is installed
if ! python -c "import fastapi" &> /dev/null; then
    echo -e "${YELLOW}[Python Backend]${NC} Installing FastAPI..."
    pip install --quiet fastapi uvicorn[standard]
fi

# Create output directories
mkdir -p output/downloads output/stems

# Start the server
echo -e "${GREEN}[Python Backend]${NC} Server starting on http://localhost:8000"
uvicorn api:app --reload --port 8000 --log-level warning
