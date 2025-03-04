#!/bin/bash

# Kill any existing Vite processes
pkill -f vite || true

# Clear terminal
clear

echo "==========================="
echo "Starting Analytica App"
echo "==========================="
echo ""
echo "The app will be available at:"
echo "Frontend: http://localhost:3333"
echo "Backend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the servers"
echo "==========================="
echo ""

# Start both servers in parallel
(node server.js) &
(npx vite --port 3333) &

# Wait for both processes
wait