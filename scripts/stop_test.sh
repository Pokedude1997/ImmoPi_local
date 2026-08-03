#!/bin/bash

# Stop Test Server
# Kills the test Node.js process

echo "⏹️  Stopping Test Server..."
echo "   Looking for process: NODE_ENV=test node server/server.js"

pkill -f "NODE_ENV=test.*node server/server.js"

if [ $? -eq 0 ]; then
    echo "   ✅ Test server stopped successfully"
else
    echo "   ⚠️  No test server process found"
fi