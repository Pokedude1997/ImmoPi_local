#!/bin/bash

# Start Production Server
# Uses NODE_ENV=production to select production.db on port 8000

export NODE_ENV=production

echo "🚀 Starting Production Server..."
echo "   Environment: $NODE_ENV"
echo "   Port: 8000"
echo "   Database: databases/production.db"
echo ""

cd "$(dirname "$0")/.."
node server/server.js