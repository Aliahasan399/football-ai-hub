#!/bin/bash
# Football AI Hub — Start All Services
BASE="/home/ali-ahasan/mybot_coder/football-ai-hub"
echo "Starting AI Engine..."
cd "$BASE" && ai-engine/.venv/bin/python -m uvicorn ai-engine.main:app --host 0.0.0.0 --port 8000 &
echo "Starting Backend..."
cd "$BASE/backend" && node src/server.js &
echo "Starting Proxy..."
cd "$BASE/backend" && node src/proxy-server.js &
echo ""
echo "AI Engine:  http://localhost:8000"
echo "Backend:    http://localhost:4000"
echo "Proxy:      http://localhost:3000"
wait
