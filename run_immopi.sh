#!/bin/bash

# ImmoPi Local Automation Script
# This script automates the setup and running of the ImmoPi application locally

# Exit on error and print commands for debugging
echo "🚀 Starting ImmoPi Local Setup..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if .env file exists, if not copy from example
echo "🔍 Checking for .env file..."
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please configure your environment variables."
else
    echo "✅ .env file already exists."
fi

# Check if server/.env file exists, if not copy from example
echo "🔍 Checking for server/.env file..."
if [ ! -f "server/.env" ]; then
    echo "📝 Creating server/.env from server/.env.example..."
    cp server/.env.example server/.env
    echo "✅ server/.env file created. Please configure your server environment variables."
else
    echo "✅ server/.env file already exists."
fi

# Install dependencies for the main application
echo "📦 Installing main application dependencies..."
npm install

# Install dependencies for the server
echo "📦 Installing server dependencies..."
cd server && npm install && cd ..

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p server/logs
mkdir -p server/uploads

# Start the server in the background
echo "🌐 Starting backend server..."
cd server && npm start &
SERVER_PID=$!
cd ..

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Start the frontend
echo "🎨 Starting frontend..."
npm run dev &
FRONTEND_PID=$!

echo "✅ ImmoPi application is now running!"
echo "📌 Backend server PID: $SERVER_PID"
echo "📌 Frontend PID: $FRONTEND_PID"
echo "🌐 Access the application at: http://localhost:3000"
echo "🔑 Server API is running at: http://localhost:8000"

# Function to cleanup on script exit
trap cleanup EXIT

cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    kill $SERVER_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Processes stopped."
}

# Keep the script running to maintain the processes
wait