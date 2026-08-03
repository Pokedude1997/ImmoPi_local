#!/bin/bash

# Start Production Environment
# Starts both backend (port 8000) and frontend (port 3000)
# Backend uses production.db

echo "🚀 Starting Production Environment..."
echo "   Backend: NODE_ENV=production, Port: 8000, DB: databases/production.db"
echo "   Frontend: Port: 3000, API: http://192.168.1.18:8000"
echo ""

# Set environment for frontend to connect to production backend
export VITE_API_URL=http://192.168.1.18:8000

# Start backend server
echo "🌐 Starting backend server..."
cd ..
cd server
NODE_ENV=production npm start > ../server.log 2>&1 &
SERVER_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to start on port 8000..."
for i in {1..10}; do
    if nc -z 192.168.1.18 8000; then
        echo "✅ Backend server is running on port 8000 (PID: $SERVER_PID)"
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

# Start frontend
echo "🎨 Starting frontend..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to start on port 3000..."
for i in {1..15}; do
    if nc -z 192.168.1.18 3000; then
        echo "✅ Frontend is running on port 3000 (PID: $FRONTEND_PID)"
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
echo "🎉 Production Environment is now running!"
echo "📌 Backend: http://192.168.1.18:8000 (PID: $SERVER_PID)"
echo "📌 Frontend: http://192.168.1.18:3000 (PID: $FRONTEND_PID)"
echo "📝 Logs: server.log and frontend.log"
echo ""
echo "💡 Press Ctrl+C to stop the application"
echo ""

# Save PIDs for stop script
mkdir -p .pids
echo $SERVER_PID > .pids/server.pid
echo $FRONTEND_PID > .pids/frontend.pid

# Cleanup function
trap cleanup INT TERM EXIT

cleanup() {
    echo ""
    echo "🧹 Stopping Production Environment..."
    kill $SERVER_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    rm -f .pids/server.pid .pids/frontend.pid
    echo "✅ Production Environment stopped"
}

# Keep the script running
wait