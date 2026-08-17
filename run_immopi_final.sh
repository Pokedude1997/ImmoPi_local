#!/bin/bash

# ImmoPi Local Automation Script - Final Version
# This script starts the ImmoPi application with proper error handling

echo "🚀 Starting ImmoPi Local Application..."

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "⚠️  Main dependencies not found. Running npm install..."
    npm install || { echo "❌ Failed to install main dependencies"; exit 1; }
fi

if [ ! -d "server/node_modules" ]; then
    echo "⚠️  Server dependencies not found. Running server npm install..."
    cd server && npm install && cd .. || { echo "❌ Failed to install server dependencies"; exit 1; }
fi

# Create necessary directories
mkdir -p server/logs
mkdir -p server/uploads

# Check for environment files
echo "🔍 Checking environment files..."
[ ! -f ".env" ] && cp .env.example .env && echo "📝 Created .env from example"
[ ! -f "server/.env" ] && cp server/.env.example server/.env && echo "📝 Created server/.env from example"

# Start the backend server
echo "🌐 Starting backend server..."
cd server
npm start > ../server.log 2>&1 &
SERVER_PID=$!
cd ..

# Wait for server to start
echo "⏳ Waiting for server to start (checking port 8000)..."
for i in {1..10}; do
    if nc -z 192.168.1.18 8000; then
        echo "✅ Backend server is running on port 8000"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Backend server failed to start. Check server.log for details."
        kill $SERVER_PID
        exit 1
    fi
    sleep 1
    echo "   Attempt $i/10 - waiting..."
done

# Start the frontend
echo "🎨 Starting frontend..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to start (checking port 3000)..."
for i in {1..15}; do
    if nc -z 192.168.1.18 3000; then
        echo "✅ Frontend is running on port 3000"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️  Frontend may still be compiling. Check frontend.log for progress."
        break
    fi
    sleep 2
    echo "   Attempt $i/15 - waiting..."
done

echo ""
echo "🎉 ImmoPi application is now running!"
echo "📌 Backend: http://192.168.1.18:8000 (PID: $SERVER_PID)"
echo "📌 Frontend: http://192.168.1.18:3000 (PID: $FRONTEND_PID)"
echo "📝 Logs: server.log and frontend.log"
echo ""
echo "💡 Press Ctrl+C to stop the application"

# Cleanup function
trap cleanup INT TERM EXIT

cleanup() {
    echo ""
    echo "🧹 Stopping ImmoPi application..."
    kill $SERVER_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Application stopped"
}

# Keep the script running
wait