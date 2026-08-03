#!/bin/bash

# Stop Production Environment
# Stops both backend and frontend processes

echo "⏹️  Stopping Production Environment..."
echo "   Looking for backend and frontend processes..."

# Kill backend process
if [ -f .pids/server.pid ]; then
    SERVER_PID=$(cat .pids/server.pid)
    if kill $SERVER_PID 2>/dev/null; then
        echo "   ✅ Backend server (PID: $SERVER_PID) stopped"
    else
        echo "   ⚠️  No backend process found with PID: $SERVER_PID"
    fi
    rm -f .pids/server.pid
else
    echo "   ⚠️  No backend PID file found, trying pkill..."
    pkill -f "NODE_ENV=production.*node server/server.js" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "   ✅ Backend process killed via pkill"
    else
        echo "   ⚠️  No backend process found"
    fi
fi

# Kill frontend process
if [ -f .pids/frontend.pid ]; then
    FRONTEND_PID=$(cat .pids/frontend.pid)
    if kill $FRONTEND_PID 2>/dev/null; then
        echo "   ✅ Frontend (PID: $FRONTEND_PID) stopped"
    else
        echo "   ⚠️  No frontend process found with PID: $FRONTEND_PID"
    fi
    rm -f .pids/frontend.pid
else
    echo "   ⚠️  No frontend PID file found, trying pkill..."
    pkill -f "vite" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "   ✅ Frontend process killed via pkill"
    else
        echo "   ⚠️  No frontend process found"
    fi
fi

echo ""
echo "✅ Production Environment stopped"

# Clean up any remaining processes
pkill -f "NODE_ENV=production.*node" 2>/dev/null
pkill -f "vite" 2>/dev/null