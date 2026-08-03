#!/bin/bash

echo "🔍 Testing ImmoPi Connectivity..."
echo "================================"
echo ""

# Test 1: Check if server is running on port 8000
echo "📡 Test 1: Checking if backend server is running on port 8000..."
if nc -z 192.168.1.18 8000 2>/dev/null; then
    echo "✅ Backend server is accessible on 192.168.1.18:8000"
else
    echo "❌ Backend server is NOT accessible on 192.168.1.18:8000"
    echo "   Try: cd server && NODE_ENV=production npm start"
fi
echo ""

# Test 2: Check if server is running on port 8001 (test)
echo "📡 Test 2: Checking if test backend server is running on port 8001..."
if nc -z 192.168.1.18 8001 2>/dev/null; then
    echo "✅ Test backend server is accessible on 192.168.1.18:8001"
else
    echo "❌ Test backend server is NOT accessible on 192.168.1.18:8001"
    echo "   Try: cd server && NODE_ENV=test npm start"
fi
echo ""

# Test 3: Check if frontend is running on port 3000
echo "📡 Test 3: Checking if frontend server is running on port 3000..."
if nc -z 192.168.1.18 3000 2>/dev/null; then
    echo "✅ Frontend server is accessible on 192.168.1.18:3000"
else
    echo "❌ Frontend server is NOT accessible on 192.168.1.18:3000"
    echo "   Try: npm run dev"
fi
echo ""

# Test 4: Try to reach the API directly
echo "📡 Test 4: Testing API endpoint directly..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://192.168.1.18:8000/api/auth/check 2>/dev/null)
if [ "$API_RESPONSE" = "200" ] || [ "$API_RESPONSE" = "401" ]; then
    echo "✅ API endpoint is reachable (HTTP $API_RESPONSE)"
else
    echo "❌ API endpoint is NOT reachable (HTTP $API_RESPONSE)"
    echo "   This could be a server issue or network issue"
fi
echo ""

# Test 5: Check environment variables
echo "📡 Test 5: Checking VITE_API_URL environment variable..."
if [ -n "$VITE_API_URL" ]; then
    echo "✅ VITE_API_URL is set to: $VITE_API_URL"
else
    echo "❌ VITE_API_URL is NOT set"
    echo "   Make sure to export it before starting: export VITE_API_URL=http://192.168.1.18:8000/api"
fi
echo ""

# Test 6: Check .env file
echo "📡 Test 6: Checking .env file for VITE_API_URL..."
if grep -q "VITE_API_URL" .env; then
    echo "✅ VITE_API_URL found in .env file"
    grep "VITE_API_URL" .env
else
    echo "❌ VITE_API_URL NOT found in .env file"
    echo "   Add: VITE_API_URL=http://192.168.1.18:8000/api"
fi
echo ""

# Test 7: CORS test
echo "📡 Test 7: Testing CORS headers..."
CORS_TEST=$(curl -s -I -H "Origin: http://192.168.1.18:3000" -H "Access-Control-Request-Method: GET" http://192.168.1.18:8000/api/auth/check 2>/dev/null | grep -i "access-control-allow-origin")
if [ -n "$CORS_TEST" ]; then
    echo "✅ CORS headers present: $CORS_TEST"
else
    echo "❌ CORS headers missing or server not responding"
fi
echo ""

echo "================================"
echo "🎯 RECOMMENDATIONS:"
echo "1. Start production: ./scripts/start_prod.sh"
echo "2. Start test: ./scripts/start_test.sh"
echo "3. Access frontend at: http://192.168.1.18:3000"
echo "4. API should be at: http://192.168.1.18:8000/api"
echo "5. Check server logs: tail -f server.log"
echo "6. Check frontend logs: tail -f frontend.log"