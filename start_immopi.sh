#!/bin/bash

# ImmoPi Local Start Script
# Simple script to start both frontend and backend

echo "🚀 Starting ImmoPi Local Application..."

# Start the backend server in the background
echo "🌐 Starting backend server on port 8000..."
cd server && npm start > server.log 2>&1 &
SERVER_PID=$!
cd ..

# Give the server a moment to start
echo "⏳ Waiting for server to initialize..."
sleep 3

# Start the frontend
echo "🎨 Starting frontend on port 3000..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "✅ ImmoPi application is now running!"
echo "📌 Backend server PID: $SERVER_PID (port 8000)"
echo "📌 Frontend PID: $FRONTEND_PID (port 3000)"
echo "🌐 Access the application at: http://localhost:3000"
echo "📝 Logs are being written to server.log and frontend.log"

# Function to cleanup on script exit
trap cleanup EXIT

cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    kill $SERVER_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Processes stopped."
}

# Keep the script running
wait