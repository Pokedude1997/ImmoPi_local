#!/bin/bash

# StupidUser Test Scenarios
# Tests all 8 authentication scenarios

SERVER_URL="http://localhost:8000"

ECHO="echo"

$ECHO "=== StupidUser Test Scenarios ==="
$ECHO ""

# Test 1: Login with admin/SecureAdmin123
$ECHO "Test 1: Login with admin/SecureAdmin123"
RESPONSE=$(curl -s -i -X POST "$SERVER_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SecureAdmin123"}')
RESPONSE_BODY=$(echo "$RESPONSE" | tail -1)
$ECHO "Response: $RESPONSE_BODY"
if echo "$RESPONSE_BODY" | grep -q '"success":true'; then
  $ECHO "Status: ✅ PASSED"
else
  $ECHO "Status: ❌ FAILED"
fi
$ECHO ""

# Extract cookies from Set-Cookie headers - get the actual cookie values
ACCESS_TOKEN=$(echo "$RESPONSE" | grep -i '^Set-Cookie:' | grep 'accessToken' | sed 's/^Set-Cookie: //' | sed 's/;.*//' | head -1 | tr -d ' ' | sed 's/^accessToken=//')
REFRESH_TOKEN=$(echo "$RESPONSE" | grep -i '^Set-Cookie:' | grep 'refreshToken' | sed 's/^Set-Cookie: //' | sed 's/;.*//' | head -1 | tr -d ' ' | sed 's/^refreshToken=//')
COOKIES="accessToken=$ACCESS_TOKEN; refreshToken=$REFRESH_TOKEN"
$ECHO "Extracted Cookies: $COOKIES"
$ECHO ""

# Test 2: Protected route access without auth
$ECHO "Test 2: Protected route access without auth"
RESPONSE=$(curl -s -i -X GET "$SERVER_URL/api/properties" | head -20)
HTTP_STATUS=$(echo "$RESPONSE" | grep -oP '\d{3}' | head -1)
$ECHO "HTTP Status: $HTTP_STATUS"
if [ "$HTTP_STATUS" = "401" ]; then
  $ECHO "Status: ✅ PASSED (expected 401)"
else
  $ECHO "Status: ❌ FAILED (expected 401, got $HTTP_STATUS)"
fi
$ECHO ""

# Test 3: Get current user info (/api/auth/me)
$ECHO "Test 3: Get current user info (/api/auth/me)"
RESPONSE=$(curl -s -X GET "$SERVER_URL/api/auth/me" \
  -H "Cookie: $COOKIES")
$ECHO "Response: $RESPONSE"
if echo "$RESPONSE" | grep -q '"success":true'; then
  $ECHO "Status: ✅ PASSED"
else
  $ECHO "Status: ❌ FAILED (expected 200 with user info)"
fi
$ECHO ""

# Test 4: Check auth status (/api/auth/check)
$ECHO "Test 4: Check auth status (/api/auth/check)"
RESPONSE=$(curl -s -X GET "$SERVER_URL/api/auth/check" \
  -H "Cookie: $COOKIES")
$ECHO "Response: $RESPONSE"
if echo "$RESPONSE" | grep -q '"authenticated":true'; then
  $ECHO "Status: ✅ PASSED"
else
  $ECHO "Status: ❌ FAILED (expected 200 with authenticated:true)"
fi
$ECHO ""

# Test 5: Logout
$ECHO "Test 5: Logout"
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/logout" \
  -H "Cookie: $COOKIES")
$ECHO "Response: $RESPONSE"
if echo "$RESPONSE" | grep -q '"success":true'; then
  $ECHO "Status: ✅ PASSED"
else
  $ECHO "Status: ❌ FAILED"
fi
$ECHO ""

# Test 6: Invalid credentials
$ECHO "Test 6: Invalid credentials"
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}')
$ECHO "Response: $RESPONSE"
if echo "$RESPONSE" | grep -q '"error":"Unauthorized"'; then
  $ECHO "Status: ✅ PASSED (expected 401)"
else
  $ECHO "Status: ❌ FAILED (expected 401)"
fi
$ECHO ""

# Test 7: Empty credentials
$ECHO "Test 7: Empty credentials"
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"","password":""}')
$ECHO "Response: $RESPONSE"
if echo "$RESPONSE" | grep -q '"error":"Bad Request"'; then
  $ECHO "Status: ✅ PASSED (expected 400)"
else
  $ECHO "Status: ❌ FAILED (expected 400)"
fi
$ECHO ""

# Test 8: Check users endpoint (/api/users) - need to login again first
$ECHO "Test 8: Check users endpoint (/api/users)"
LOGIN_RESPONSE=$(curl -s -i -X POST "$SERVER_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SecureAdmin123"}')
USER_ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -i '^Set-Cookie:' | grep 'accessToken' | sed 's/^Set-Cookie: //' | sed 's/;.*//' | head -1 | tr -d ' ' | sed 's/^accessToken=//')
USER_REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -i '^Set-Cookie:' | grep 'refreshToken' | sed 's/^Set-Cookie: //' | sed 's/;.*//' | head -1 | tr -d ' ' | sed 's/^refreshToken=//')
USER_COOKIES="accessToken=$USER_ACCESS_TOKEN; refreshToken=$USER_REFRESH_TOKEN"
RESPONSE=$(curl -s -X GET "$SERVER_URL/api/users" \
  -H "Cookie: $USER_COOKIES")
$ECHO "Response: $RESPONSE"
if echo "$RESPONSE" | grep -q '"success":true' || echo "$RESPONSE" | grep -q '\['; then
  $ECHO "Status: ✅ PASSED"
else
  $ECHO "Status: ❌ FAILED (expected 200 with user list)"
fi
$ECHO ""

$ECHO "=== All tests completed ==="
