#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
SERVICE_DIR="$DIR/scrapling-service"
VENV_DIR="$SERVICE_DIR/venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment at $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install --upgrade pip
    "$VENV_DIR/bin/pip" install -r "$SERVICE_DIR/requirements.txt"
fi

echo "Starting Scrapling Parsing Service on http://127.0.0.1:8787..."
cd "$SERVICE_DIR"
exec "$VENV_DIR/bin/uvicorn" app:app --host 127.0.0.1 --port 8787

