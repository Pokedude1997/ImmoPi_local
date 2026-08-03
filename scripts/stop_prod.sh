#!/bin/bash

# Stop Production Server
# Kills the production Node.js process

echo "⏹️  Stopping Production Server..."
echo "   Looking for process: NODE_ENV=production node server/server.js"

pkill -f "NODE_ENV=production.*node server/server.js"

if [ $? -eq 0 ]; then
    echo "   ✅ Production server stopped successfully"
else
    echo "   ⚠️  No production server process found"
fi