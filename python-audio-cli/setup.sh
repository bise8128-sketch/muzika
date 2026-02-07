#!/bin/bash
set -e

# Change directory to script location
cd "$(dirname "$0")"

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
echo "  cd $(pwd)"
echo "  source venv/bin/activate"
echo "  python cli.py <youtube_url> [--separate]"
echo ""
echo "To run the GUI:"
echo "  streamlit run streamlit_app.py"
