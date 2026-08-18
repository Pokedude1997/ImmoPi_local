# Code Review Report

- **Status:** FAILED
- **Datum/Zeit:** 2026-08-18 09:00:00 UTC

## Gefundene Probleme & Bugs

### 1. **[Schweregrad: Hoch]** SQL Injection Vulnerability in addUserFilter() (server/server.js:51, 61)
   - *Problem:* Direct string interpolation of req.userId into SQL query enables SQL injection attacks. A malicious user could potentially execute arbitrary SQL commands.
   - *Empfohlener Fix:* Use parameterized queries. Return {query, params} object from addUserFilter() and update all route handlers to use parameterized queries.

### 2. **[Schweregrad: Hoch]** Missing ownership verification in PUT routes (server/server.js:543, 673, etc.)
   - *Problem:* PUT, DELETE routes for properties, tenants, and other entities do not verify that the resource belongs to the authenticated user. Any authenticated user can modify or delete any resource.
   - *Empfohlener Fix:* Add verifyOwnership() checks before processing updates/deletes. Fetch the resource first, verify ownership using verifyOwnership(resource, req), return 403 if not owner.

### 3. **[Schweregrad: Hoch]** Incomplete user filtering across routes (server/server.js)
   - *Problem:* Only 2 out of ~30+ data routes (GET /api/properties, GET /api/tenants) have user filtering applied. All other routes expose all users' data.
   - *Empfohlener Fix:* Apply user filtering to ALL data routes. Use addUserFilter() for GET routes, addUserIdToData() for POST routes, and verifyOwnership() for PUT/DELETE routes.

### 4. **[Schweregrad: Hoch]** SQL Injection in dataIsolation.cjs (server/middleware/dataIsolation.cjs:71, 80)
   - *Problem:* Same SQL injection vulnerability exists in applyUserFilterToSelect() function.
   - *Empfohlener Fix:* Update to use parameterized queries returning {query, params} object.

### 5. **[Schweregrad: Mittel]** Frontend Settings page not admin-restricted (frontend/App.tsx)
   - *Problem:* Frontend ProtectedRoute for Settings page does not specify adminOnly={true}. Non-admin users can navigate to settings page (though backend will block).
   - *Empfohlener Fix:* Update Settings route in App.tsx: <Route path="/settings" element={<ProtectedRoute adminOnly={true}><Settings /></ProtectedRoute>} />

### 6. **[Schweregrad: Mittel]** Frontend authentication not updated (frontend/pages/Login.tsx, services/api.ts)
   - *Problem:* Frontend still uses old single-password authentication. Needs update to collect username/password and use new JWT auth endpoints.
   - *Empfohlener Fix:* Update Login.tsx to collect username and password, POST to /api/auth/login. Update api.ts to use /api/auth/me for current user info.

## Test-Ergebnisse
- No automated test suite executed (no pytest, npm test, jest found in root)
- Server module loads successfully
- Migration scripts syntactically valid
- Manual verification: Code review of authentication flow and data isolation

---
*Review durchgeführt durch kompromisslosen QA-Ingenieur und Security Auditor*
