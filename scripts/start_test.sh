#!/bin/bash

# Start Test Server
# Uses NODE_ENV=test to select test.db on port 8001

export NODE_ENV=test

echo "🧪 Starting Test Server..."
echo "   Environment: $NODE_ENV"
echo "   Port: 8001"
echo "   Database: databases/test.db"
echo ""

cd "$(dirname "$0")/.."
node server/server.js