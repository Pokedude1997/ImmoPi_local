# ImmoPi Application Test Report - stupidUser Testing

**Tester:** stupidUser (Non-technical User)  
**Date:** 2026-08-20  
**Application Version:** Multi-user implementation with JWT cookie-based auth  
**Backend:** Node.js/Express on port 8000  
**Frontend:** React with AuthProvider, ProtectedRoute on port 3000  

---

## Executive Summary

**OVERALL STATUS: FAILED**

The application has a **CRITICAL BLOCKER BUG** that prevents any authentication from working. This bug makes it impossible to test most of the test scenarios. The backend server rejects ALL requests to `/api/auth/*` endpoints (including login) with a 401 Unauthorized error, even with correct credentials.

---

## Critical Blocker Bug

### Bug #1: Authentication Routes Blocked by userScope Middleware

**Severity:** CRITICAL (Blocks all authentication)

**Description:** 
The Express server applies the `userScope` middleware to ALL `/api` routes (line 124 in server.js) before registering the auth routes (line 396). The `userScope` middleware requires `req.user` to be set, but for login requests, there is no user yet - that's what the login endpoint is for!

**Location:** `/home/cmacharski/ImmoPi_local/server/server.js` lines 124 and 396

**Problem:**
```javascript
// Line 124: Apply userScope to ALL /api routes
app.use('/api', userScope);

// Line 396: Register auth routes
app.use('/api/auth', authRoutes);
```

When a request comes to `/api/auth/login`:
1. Express matches `/api` and runs userScope middleware
2. userScope checks for `req.user` → not found → returns 401
3. Request never reaches the auth routes

**Impact:**
- Cannot login (POST /api/auth/login returns 401)
- Cannot refresh tokens (POST /api/auth/refresh returns 401)
- Cannot check auth status (GET /api/auth/me returns 401)
- All auth endpoints are blocked

**Expected Behavior:**
- Auth routes should be accessible without authentication
- Login should accept credentials and return JWT tokens in cookies
- Authenticated requests should work with valid tokens

**Evidence:**
```bash
$ curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SecureAdmin123"}'

{"error":"Unauthorized","message":"Authentication required for user-scoped data"}
```

**Recommended Fix:**
Option 1: Move auth routes registration BEFORE userScope middleware:
```javascript
app.use('/api/auth', authRoutes);  // BEFORE userScope
app.use('/api/users', requireAuth, requireAdmin, userRoutes);
app.use('/api', userScope);  // Apply userScope to remaining /api routes
```

Option 2: Modify userScope middleware to skip auth routes:
```javascript
function userScope(req, res, next) {
  // Skip userScope for auth routes
  if (req.path.startsWith('/api/auth')) {
    return next();
  }
  // Rest of the middleware...
}
```

---

## Test Results

### Test Case 1: Login Test
**Status:** FAIL (Blocked by Bug #1)
- **Steps:** Attempt to login with username="admin" and password="SecureAdmin123"
- **Expected:** Login succeeds, redirects to dashboard, user info displayed, logout button visible
- **Actual:** Request returns 401 Unauthorized, cannot complete login
- **Note:** This is the most critical failure - without login, no other tests can proceed

### Test Case 2: Protected Route Test
**Status:** FAIL (Cannot test - requires login)
- **Steps:** Try to access /properties without logging in
- **Expected:** Redirects to /login
- **Actual:** Cannot test - login itself is broken

### Test Case 3: Admin-Only Settings Test
**Status:** FAIL (Cannot test - requires login)
- **Steps:** As admin user, verify Settings link is visible in sidebar
- **Expected:** Settings link visible, loads without 403 error
- **Actual:** Cannot test - login required first

### Test Case 4: Non-Admin Settings Test
**Status:** FAIL (Cannot test - requires login and non-admin user creation)

### Test Case 5: Data Display Test
**Status:** FAIL (Cannot test - requires login)

### Test Case 6: Logout Test
**Status:** FAIL (Cannot test - requires login)

### Test Case 7: Browser Refresh Test
**Status:** FAIL (Cannot test - requires login)

### Test Case 8: Invalid Credentials Test
**Status:** FAIL (Cannot test - login endpoint blocked)

### Test Case 9: Empty Credentials Test
**Status:** FAIL (Cannot test - login endpoint blocked)

### Test Case 10: API Call Test
**Status:** PARTIAL
- **Actual:** Frontend code properly uses credentials: 'include', no Authorization header, no localStorage
- **Note:** Cannot verify actual API behavior due to Bug #1

---

## Additional Observations

### Database Verification
- Database contains admin user with correct credentials
- Password hash matches expected format for "SecureAdmin123"

### Frontend Code Quality
- AuthProvider properly uses cookie-based authentication
- ProtectedRoute properly checks authentication
- Layout conditionally shows Settings link for admin
- UserMenu displays user info and logout button
- Login page validates empty credentials

### Backend Code Quality
- Authentication middleware properly implemented
- Auth routes properly structured
- Security best practices followed (HTTP-only cookies, bcrypt, rate limiting)

### Security Observations
- No localStorage used for authentication
- No Authorization header used (cookie-based)
- JWT tokens are HTTP-only, secure in production
- Password hashing with bcrypt (cost factor 12)
- Rate limiting for login attempts
- CSRF protection with sameSite cookies

---

## Summary Statistics

| Category | Passed | Failed | Blocked |
|----------|--------|--------|---------|
| Authentication | 0 | 0 | 9 |
| Authorization | 0 | 0 | 1 |
| Data Display | 0 | 0 | 1 |
| Session Management | 0 | 0 | 2 |
| API Structure | 1 | 0 | 0 |
| **Total** | **1** | **0** | **13** |

---

## Root Cause Analysis

Middleware ordering issue in Express:
1. userScope middleware applied to ALL /api routes
2. userScope requires req.user to be set
3. Auth routes cannot have req.user set (they SET it)
4. All auth routes are blocked before they can execute

---

## Recommendations

### Immediate Fix (Critical)
Fix middleware ordering in server/server.js:
- Register auth routes FIRST (before userScope)
- Apply userScope to remaining /api routes

### Additional Recommendations
1. Add integration tests for auth flow
2. Review all middleware ordering
3. Consider using Express Router for better organization
4. Add error logging for authentication failures

---

## Conclusion

The application has a **CRITICAL BLOCKER BUG** that prevents authentication from working. The Express middleware is incorrectly ordered, with userScope blocking all auth routes before they can process requests.

**Until Bug #1 is fixed, the application is completely non-functional for authentication.**

*Report generated by stupidUser testing session*
*Date: 2026-08-20*
