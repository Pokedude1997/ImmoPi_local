# ImmoPi - Multi-User Production Deployment Plan

**Goal:** Make ImmoPi fully production-ready with multi-user authentication, data isolation, and proper access controls.

**Status:** Backend 95% complete, Frontend 0% Multi-User compatible, Production DB not migrated

---

## Architecture Overview

```
+-------------------+     +-------------------+     +-------------------
|   Frontend        |     |   Backend         |     |   Database        |
|   React+TS+Vite   |--->|   Node+Express    |--->|   SQLite3         |
+-------------------+     +-------------------+     +-------------------
        |                        |                        |
        v                        v                        v
+-------------------+     +-------------------+     +-------------------
| HTTP-only JWT     |     | JWT Cookies       |     | production.db    |
| Cookie Auth       |     | (access+refresh)  |     | (migrated)       |
+-------------------+     +-------------------+     +-------------------
```

**Key Changes Required:**
1. Production database migration (5 migrations)
2. Frontend auth system: localStorage -> HTTP-only cookies
3. Login form: password-only -> username+password
4. User context: Add username, isAdmin to auth state
5. ProtectedRoute: Add adminOnly support
6. Settings: Admin-only access in frontend

---

## Implementation Phases

### Phase 0: Preparation & Analysis (1-2 hours)

**Objective:** Verify current state and prepare for migration

- [ ] Review all 5 migration scripts for production compatibility
- [ ] Verify production.db backup exists (databases/production.db.backup)
- [ ] Document existing production data (2 properties, 3 tenants, 152 transactions)
- [ ] Verify APP_PASSWORD=SecureAdmin123 is available for admin user creation
- [ ] Check node_modules are installed in server/ directory
- [ ] Verify all migration dependencies (sqlite3, bcrypt, etc.) are available
- [ ] Create migration execution script for production
- [ ] Review backend auth routes (/api/auth/login, /api/auth/logout, /api/auth/me, /api/auth/check)
- [ ] Review backend middleware (authenticate, requireAuth, requireAdmin)
- [ ] Document current frontend auth flow (localStorage-based)
- [ ] Document new backend auth flow (cookie-based)

### Phase 1: Production Database Migration (1-2 hours)

**Objective:** Migrate production.db with all 5 migrations while preserving existing data

**Prerequisites:** Phase 0 complete

- [ ] Create backup of production.db before migration
  - [ ] Copy production.db to production.db.backup-$(date +%Y%m%d-%H%M%S)
  - [ ] Verify backup integrity (sqlite3 production.db.backup-*.db ".tables")
- [ ] Create migrations_applied table in production.db if not exists
  - [ ] Run: CREATE TABLE IF NOT EXISTS migrations_applied (migration_name TEXT PRIMARY KEY, applied_at DATETIME)
- [ ] Execute migration 001: Create users table
  - [ ] Run 001_create_users_table.sql against production.db
  - [ ] Verify users table created with correct schema
- [ ] Execute migration 002: Add user_id columns to data tables
  - [ ] Run 002_add_user_id_columns.cjs with NODE_ENV=production
  - [ ] Verify user_id columns added to all tables (properties, tenants, categories, counterparties, transactions, documents, recurring_payments, tenant_contracts, rent_payments, idempotency_keys)
  - [ ] Verify indexes created (idx_*_user_id)
- [ ] Execute migration 003: Create admin user
  - [ ] Run 003_create_admin_user.cjs with NODE_ENV=production
  - [ ] Verify admin user created with username="admin", password_hash from APP_PASSWORD
  - [ ] Verify admin user has is_admin=TRUE
- [ ] Execute migration 004: Migrate existing data to admin user
  - [ ] Run 004_migrate_existing_data.cjs with NODE_ENV=production
  - [ ] Verify all existing data (2 properties, 3 tenants, 152 transactions) assigned to user_id=1
- [ ] Execute migration 005: Make user_id NOT NULL (optional)
  - [ ] Run 005_make_user_id_not_null.cjs with NODE_ENV=production
  - [ ] Note: SQLite limitations may require application-level enforcement
- [ ] Verify migration completion
  - [ ] Check migrations_applied table has all 5 migrations recorded
  - [ ] Run SELECT COUNT(*) FROM properties WHERE user_id IS NULL (should be 0)
  - [ ] Run SELECT COUNT(*) FROM tenants WHERE user_id IS NULL (should be 0)
  - [ ] Run SELECT COUNT(*) FROM transactions WHERE user_id IS NULL (should be 0)
  - [ ] Verify all existing data preserved and accessible

### Phase 2: Frontend Authentication System Update (4-8 hours)

**Objective:** Update frontend to use HTTP-only JWT cookies instead of localStorage tokens

**Prerequisites:** Phase 1 complete

#### 2.1: Auth Context Expansion
- [ ] Update AuthContext type definition
  - [ ] Add username: string
  - [ ] Add userId: number
  - [ ] Add isAdmin: boolean
  - [ ] Add isAuthenticated: boolean
  - [ ] Add logout: () => void
  - [ ] Add checkAuth: () => Promise<void>
- [ ] Create new AuthProvider component
  - [ ] Manage auth state (user info + isAuthenticated)
  - [ ] Handle initial auth check on mount
  - [ ] Provide logout functionality
  - [ ] Handle token refresh if needed

#### 2.2: API Service Layer Updates
- [ ] Create api.ts service module for centralized API calls
- [ ] Add default credentials: 'include' for all fetch calls
- [ ] Add default headers: remove Authorization header (use cookies instead)
- [ ] Create authAPI.ts for auth-specific endpoints
  - [ ] POST /api/auth/login (username, password) -> returns user info
  - [ ] POST /api/auth/logout () -> returns success
  - [ ] GET /api/auth/me () -> returns current user info
  - [ ] GET /api/auth/check () -> returns auth status (backward compatibility)

#### 2.3: Login Page Update
- [ ] Update Login form state
  - [ ] Add username state: const [username, setUsername] = useState('')
  - [ ] Keep password state
- [ ] Update Login form UI
  - [ ] Add username input field above password field
  - [ ] Update labels: "Username" and "Password"
  - [ ] Update placeholders: "Enter your username" and "Enter your password"
- [ ] Update handleSubmit function
  - [ ] Send { username, password } instead of { password }
  - [ ] Remove localStorage.setItem('authToken', ...) calls
  - [ ] Remove localStorage.setItem('authExpiry', ...) calls
  - [ ] On success, store user info in context/state
  - [ ] On success, redirect to '/'

#### 2.4: ProtectedRoute Component Update
- [ ] Update ProtectedRoute to use cookie-based auth
  - [ ] Remove localStorage token checks
  - [ ] Remove Authorization header usage
  - [ ] Use fetch with credentials: 'include' only
  - [ ] Call /api/auth/me to check authentication
  - [ ] On 401, redirect to /login
  - [ ] Store user info from response in context
- [ ] Update auth check logic
  - [ ] Replace /api/auth/check with /api/auth/me
  - [ ] Extract user info from response (id, username, isAdmin)
  - [ ] Store user info in AuthContext

#### 2.5: AuthContext Integration
- [ ] Wrap entire app with AuthProvider
- [ ] Update all components to use AuthContext
- [ ] Remove localStorage token management from all components
- [ ] Remove Authorization header from all API calls
- [ ] Add credentials: 'include' to all fetch calls

#### 2.6: Logout Functionality Update
- [ ] Update logout function in AuthContext
  - [ ] Call POST /api/auth/logout (no body needed)
  - [ ] Clear user state
  - [ ] Redirect to /login
  - [ ] Remove any localStorage cleanup (not needed with cookies)

#### 2.7: Token Refresh Handling (Optional - Nice to have)
- [ ] Implement automatic token refresh
  - [ ] Listen for 401 responses
  - [ ] Call /api/auth/refresh on 401
  - [ ] Retry original request after refresh
  - [ ] Redirect to login if refresh fails

### Phase 3: User Context & UI Updates (2-4 hours)

**Objective:** Add user context and update UI to reflect current user

**Prerequisites:** Phase 2 complete

- [ ] Add user info display in Layout
  - [ ] Show username in sidebar header or footer
  - [ ] Show user role (Admin/User) indicator
  - [ ] Add logout button in sidebar or header
- [ ] Create UserMenu component
  - [ ] Display current username
  - [ ] Display user role
  - [ ] Logout button
- [ ] Update Layout component
  - [ ] Add UserMenu to sidebar or header
  - [ ] Show user info in mobile header
- [ ] Update ProtectedRoute to pass user info to children
- [ ] Verify user info is accessible in all protected pages

### Phase 4: Admin-Only Access Control (2-3 hours)

**Objective:** Implement admin-only restrictions in frontend

**Prerequisites:** Phase 3 complete

- [ ] Update ProtectedRoute component
  - [ ] Add adminOnly prop: { adminOnly?: boolean }
  - [ ] If adminOnly=true and user is not admin, redirect to '/' or show 403
  - [ ] Pass user info to child components
- [ ] Update Route configuration in App.tsx
  - [ ] Wrap Settings route with ProtectedRoute with adminOnly={true}
  - [ ] Example: <Route path="/settings" element={<ProtectedRoute adminOnly={true}><Settings /></ProtectedRoute>} />
- [ ] Update Layout component
  - [ ] Hide Settings nav item for non-admin users
  - [ ] Add visibility check: {user?.isAdmin && <NavItem to="/settings" ... />}
- [ ] Update Settings page
  - [ ] Add admin verification (redundant but safe)
  - [ ] Show error if non-admin somehow accesses the page

### Phase 5: Backend Verification & Testing (2-4 hours)

**Objective:** Verify all backend routes work with new auth system

**Prerequisites:** Phase 4 complete

- [ ] Test all auth endpoints
  - [ ] POST /api/auth/login with username+password
  - [ ] POST /api/auth/logout
  - [ ] GET /api/auth/me with valid session
  - [ ] GET /api/auth/check with valid session
  - [ ] GET /api/auth/refresh with valid refresh token
- [ ] Test data isolation for admin user (user_id=1)
  - [ ] GET /api/properties - verify returns all 2 properties
  - [ ] GET /api/tenants - verify returns all 3 tenants
  - [ ] GET /api/transactions - verify returns all 152 transactions
- [ ] Test ownership verification
  - [ ] PUT /api/properties/:id - verify works for admin (bypass)
  - [ ] DELETE /api/properties/:id - verify works for admin (bypass)
- [ ] Test all protected routes
  - [ ] Verify 401 returned when not authenticated
  - [ ] Verify 403 returned when authenticated but not owner (for non-admin)
- [ ] Test cookie settings
  - [ ] Verify httpOnly flag set
  - [ ] Verify secure flag set in production
  - [ ] Verify sameSite=strict

### Phase 6: Frontend Testing (2-3 hours)

**Objective:** Test all frontend functionality with new auth system

**Prerequisites:** Phase 5 complete

- [ ] Test login flow
  - [ ] Login with admin credentials (admin/SecureAdmin123)
  - [ ] Verify redirect to dashboard
  - [ ] Verify user info displayed in UI
  - [ ] Verify Settings link visible in sidebar
- [ ] Test protected routes
  - [ ] Access /dashboard - should work
  - [ ] Access /properties - should work
  - [ ] Access /transactions - should work
  - [ ] Access /settings - should work for admin
- [ ] Test logout flow
  - [ ] Click logout
  - [ ] Verify redirect to /login
  - [ ] Verify can't access protected routes
  - [ ] Verify Settings link hidden
- [ ] Test data display
  - [ ] Verify all properties displayed
  - [ ] Verify all tenants displayed
  - [ ] Verify all transactions displayed
- [ ] Test browser refresh
  - [ ] Refresh on dashboard - should maintain auth
  - [ ] Refresh on properties - should maintain auth
  - [ ] Refresh on settings - should maintain auth for admin
- [ ] Test back button after logout
  - [ ] Logout and click back - should redirect to login

### Phase 7: User Management (Optional - 2-4 hours)

**Objective:** Add user management functionality

- [ ] Create Users page (admin-only)
  - [ ] List all users
  - [ ] Add new user form
  - [ ] Edit user form
  - [ ] Delete user functionality
- [ ] Add user creation endpoint
  - [ ] POST /api/users (admin-only)
  - [ ] Include username, password, isAdmin fields
- [ ] Add user update endpoint
  - [ ] PUT /api/users/:id (admin-only)
- [ ] Add user deletion endpoint
  - [ ] DELETE /api/users/:id (admin-only)
- [ ] Update backend routes with user CRUD operations
- [ ] Add frontend forms for user management

### Phase 8: Legacy Cleanup (1-2 hours)

**Objective:** Remove old auth system and clean up

- [ ] Remove old auth-middleware.js usage
- [ ] Remove localStorage token references from all components
- [ ] Remove Authorization header usage from all API calls
- [ ] Update all API calls to use credentials: 'include'
- [ ] Verify all auth goes through new /api/auth/login (username+password)
- [ ] Remove old token validation logic
- [ ] Clean up unused imports

### Phase 9: Deployment Checklist (1-2 hours)

**Objective:** Prepare comprehensive deployment checklist

- [ ] Create DEPLOYMENT_CHECKLIST.md
- [ ] Document production environment requirements
  - [ ] Node.js version
  - [ ] SQLite3 version
  - [ ] Required environment variables
  - [ ] Database file locations
- [ ] Document deployment steps
  - [ ] Copy production.db to server
  - [ ] Install dependencies
  - [ ] Set environment variables
  - [ ] Run database migrations
  - [ ] Create admin user
  - [ ] Start server
- [ ] Document startup scripts
  - [ ] Create start-prod.sh with NODE_ENV=production
  - [ ] Create stop-prod.sh
  - [ ] Add to package.json scripts
- [ ] Document security considerations
  - [ ] HTTPS requirement for production
  - [ ] Cookie security flags
  - [ ] JWT secret requirements
  - [ ] Password hashing
- [ ] Document backup strategy
  - [ ] Database backup frequency
  - [ ] Backup location
  - [ ] Recovery procedure

---

## Dependencies Map

```
Phase 0: Preparation & Analysis
    |
    v
Phase 1: Production Database Migration
    |
    v
Phase 2: Frontend Authentication System Update
    |
    v
Phase 3: User Context & UI Updates
    |
    v
Phase 4: Admin-Only Access Control
    |
    v
Phase 5: Backend Verification & Testing
    |
    v
Phase 6: Frontend Testing
    |
    v
Phase 7: User Management (Optional)
    |
    v
Phase 8: Legacy Cleanup
    |
    v
Phase 9: Deployment Checklist
```

**Critical Path:** Phases 0-6 must be completed in order for production readiness.

**Optional Path:** Phases 7-9 can be done after core functionality is verified.

---

## Estimated Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 0 | 1-2 hours | High |
| Phase 1 | 1-2 hours | High |
| Phase 2 | 4-8 hours | High |
| Phase 3 | 2-4 hours | High |
| Phase 4 | 2-3 hours | High |
| Phase 5 | 2-4 hours | High |
| Phase 6 | 2-3 hours | High |
| Phase 7 | 2-4 hours | Medium |
| Phase 8 | 1-2 hours | Medium |
| Phase 9 | 1-2 hours | Medium |

**Total Estimated Time:** 18-35 hours (3-5 business days)

**Production-Ready:** After Phase 6

---

## Success Criteria

### Minimum Viable Production (MVP)
- [ ] Production database fully migrated (all 5 migrations applied)
- [ ] All existing data preserved and accessible
- [ ] Admin user created with APP_PASSWORD
- [ ] Frontend login accepts username+password
- [ ] Frontend uses HTTP-only cookies (not localStorage)
- [ ] User context available throughout app
- [ ] Settings page admin-only in frontend
- [ ] All routes properly protected with user scoping

### Full Production Ready
- [ ] All MVP criteria met
- [ ] Token refresh implemented
- [ ] User management functionality added
- [ ] Legacy auth system removed
- [ ] Deployment checklist completed
- [ ] Comprehensive testing passed

---

## Verification Checklist

Before declaring production-ready:

- [ ] Production database migrated with all 5 migrations
- [ ] Admin user (admin/SecureAdmin123) can login via frontend
- [ ] Admin user can access all data (2 properties, 3 tenants, 152 transactions)
- [ ] Admin user can access Settings page
- [ ] Non-admin user (if created) cannot access Settings page
- [ ] All API calls use credentials: 'include'
- [ ] No Authorization headers in frontend code
- [ ] No localStorage token management
- [ ] Logout works correctly and clears session
- [ ] Browser refresh maintains authentication

---

## Notes

- All backend security issues (SQL injection, ownership verification, user filtering) are already resolved
- Backend uses parameterized queries for all user-scoped operations
- Frontend is the main blocker for production deployment
- Test database (test.db) is fully migrated and can be used for testing frontend changes
- APP_PASSWORD=SecureAdmin123 will be used to create the initial admin user
