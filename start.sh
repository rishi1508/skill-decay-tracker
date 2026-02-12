#!/bin/bash
cd "$(dirname "$0")"

# Start server in background
echo "Starting server..."
(cd server && node index.js) &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Start client
echo "Starting client..."
(cd client && npm run dev) &
CLIENT_PID=$!

echo ""
echo "🧠 Skill Decay Tracker"
echo "======================"
echo "Server: http://localhost:3003"
echo "Client: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"

# Handle cleanup
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM

wait
