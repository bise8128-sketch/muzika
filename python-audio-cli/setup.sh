#!/bin/bash
set -e

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

echo "Setup complete!"
echo "To use the tool:"
echo "  source venv/bin/activate"
echo "  python cli.py <youtube_url> [--separate]"
