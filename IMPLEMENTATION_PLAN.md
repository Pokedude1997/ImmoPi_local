# ImmoPi Multi-User Authentication Implementation Plan

## Overview

**Objective**: Convert ImmoPi from a single-user application (using a single `APP_PASSWORD` from `.env`) to a multi-user system where each user has their own credentials and can only access their own data.

**Current State**:
- Single-password authentication via `APP_PASSWORD` in `.env`
- No user table in SQLite database
- All data tables have no user association (global data)
- Session storage is in-memory (not persistent)

**Target State**:
- User table with username/password (hashed)
- All existing tables have `user_id` foreign key
- Row-level security: users can only see/modify their own data
- Admin user can see all data (optional)
- Existing data migrated to a default user

---

## Technical Decisions

### 1. Authentication Strategy
- **Password Hashing**: Use `bcrypt` with salt rounds = 12 (industry standard balance of security/performance)
- **Session Management**: Use **JWT (JSON Web Tokens)** stored in HTTP-only cookies for stateless authentication
  - Alternative considered: Server-side sessions in SQLite (rejected due to scalability and complexity)
  - JWT benefits: Stateless, scales horizontally, works well with Express middleware
- **Token Expiry**: Access token: 15 minutes, Refresh token: 7 days (stored in HTTP-only cookie)

### 2. Database Schema Changes
- **New Table**: `users` with columns: `id (PK)`, `username (UNIQUE)`, `password_hash`, `is_admin (BOOLEAN)`, `created_at`, `updated_at`
- **Existing Tables**: Add `user_id` column (FOREIGN KEY to `users.id`) to ALL tables:
  - properties, tenants, categories, counterparties, transactions, documents
  - recurring_payments, tenant_contracts, rent_payments, settings, automation_state, idempotency_keys
- **Indexing**: Add index on `user_id` for all tables to optimize queries
- **Cascading**: ON DELETE CASCADE for user_id foreign keys (when user is deleted, their data is deleted)

### 3. Data Isolation Strategy
- **Middleware Approach**: Create a `userScope` middleware that:
  1. Extracts `user_id` from the JWT token
  2. Adds `WHERE user_id = ?` clause to all queries automatically
  3. For admin users, skip the filtering (or use `WHERE user_id = ? OR ? = admin_id`)
- **Alternative Considered**: Row-level security in SQLite (not natively supported, requires triggers - too complex)

### 4. Migration Strategy
- **Step 1**: Create `users` table
- **Step 2**: Add `user_id` columns to all tables (nullable initially)
- **Step 3**: Create a **migration script** that:
  - Creates an admin user from the current `APP_PASSWORD`
  - Assigns all existing data to this admin user
  - Sets `user_id` to the admin user's ID for all existing rows
- **Step 4**: Make `user_id` NOT NULL with default to admin user
- **Step 5**: Remove `APP_PASSWORD` from `.env` and authentication logic

### 5. Existing Data Handling
- All existing data will be assigned to a **default admin user** created during migration
- The admin user's username will be derived from an environment variable (e.g., `ADMIN_USERNAME`) or default to `admin`
- The admin user's password will be set from `APP_PASSWORD` (migrated)
- This ensures zero data loss during transition

### 6. Frontend Changes
- Update `Login.tsx` to collect both username and password
- Add user registration page (or admin-only user creation)
- Update `api.ts` to include credentials in login request
- Store JWT token in HTTP-only cookie (handled by backend)
- Add user context to track current user in frontend

### 7. Admin User Capabilities
- Admin users (where `is_admin = true`) bypass the `user_id` filter
- Admin can see all users and their data
- Admin can create/edit/delete users
- Admin can impersonate users for support

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data loss during migration | Medium | High | Full backup before migration, test migration on copy |
| Broken queries due to missing user_id | High | High | Comprehensive test coverage, phased rollout |
| Performance degradation from user_id joins | Medium | Medium | Add indexes on user_id, query optimization |
| Session hijacking | Low | High | Use HTTPS, HTTP-only cookies, short token expiry |
| Password hash leakage | Low | High | Use bcrypt, never store plaintext, environment variable for secret |

---

## Implementation Phases

---

## Phase 1: Preparation & Setup (Effort: 2-4 hours)

**Goal**: Set up the foundation for multi-user implementation without breaking existing functionality.

### Tasks

- [ ] Create backup of current database (`cp database.sqlite database.sqlite.backup-$(date +%Y%m%d)`)
- [ ] Create new branch: `git checkout -b feature/multi-user-auth`
- [ ] Install required dependencies:
  - [ ] Backend: `npm install bcrypt jsonwebtoken cookie-parser`
  - [ ] Backend: `npm install --save-dev @types/bcrypt @types/jsonwebtoken` (if using TS)
  - [ ] Frontend: Verify `react-router-dom` is installed (for protected routes)
- [ ] Create directory structure for new auth system:
  - [ ] `/server/models/User.js` (user model and DB operations)
  - [ ] `/server/middleware/auth.js` (new auth middleware - don't overwrite existing yet)
  - [ ] `/server/routes/auth.js` (auth routes: login, logout, refresh)
  - [ ] `/server/routes/users.js` (user management routes - admin only)
  - [ ] `/server/utils/jwt.js` (JWT utility functions)
  - [ ] `/migrations/` (migration scripts)
- [ ] Create `IMPLEMENTATION_PLAN.md` (this document) and commit

### Deliverables
- New branch with initial structure
- Installed dependencies
- Backup of database

### Dependencies
- None (can start immediately)

---

## Phase 2: Database Schema Changes (Effort: 4-6 hours)

**Goal**: Modify database schema to support multi-user system while maintaining data integrity.

### Tasks

- [ ] Create migration script `migrations/001_create_users_table.sql`:
  - [ ] Create `users` table with all required columns
  - [ ] Create indexes on `username` (unique) and `id`
- [ ] Create migration script `migrations/002_add_user_id_columns.sql`:
  - [ ] Add `user_id INTEGER` column to ALL existing tables (nullable initially)
  - [ ] Add foreign key constraints: `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
  - [ ] Add indexes on `user_id` for all tables
- [ ] Create migration script `migrations/003_create_admin_user.sql`:
  - [ ] Insert admin user with username from `ADMIN_USERNAME` env var (default: 'admin')
  - [ ] Insert hashed password from `APP_PASSWORD` env var (use bcrypt)
  - [ ] Set `is_admin = true`
- [ ] Create migration script `migrations/004_migrate_existing_data.sql`:
  - [ ] Update ALL tables to set `user_id = 1` (admin user ID)
- [ ] Create migration script `migrations/005_make_user_id_not_null.sql`:
  - [ ] Alter all tables to make `user_id` NOT NULL with default = 1
  - [ ] Remove default constraint after migration
- [ ] Create Node.js migration runner script (`migrations/run.js`):
  - [ ] Reads all SQL files in order
  - [ ] Executes them sequentially against the database
  - [ ] Logs each migration step
  - [ ] Creates `migrations_applied` table to track which migrations ran
- [ ] Test migrations on a COPY of the production database:
  - [ ] Copy database: `cp database.sqlite database.sqlite.test`
  - [ ] Run migration runner against test database
  - [ ] Verify all data is intact
  - [ ] Verify admin user can be authenticated
  - [ ] Verify existing data is assigned to admin user

### Technical Notes
- Use `ALTER TABLE` for adding columns
- SQLite doesn't support `ALTER TABLE ... DROP COLUMN` easily, so plan carefully
- Foreign key constraints require `PRAGMA foreign_keys = ON` in SQLite
- Migration scripts should be idempotent (can run multiple times safely)

### Deliverables
- All migration scripts in `/migrations/`
- Migration runner script
- Verified migration on test database

### Dependencies
- Phase 1 completion

---

## Phase 3: Backend Authentication System (Effort: 6-8 hours)

**Goal**: Implement new JWT-based authentication system.

### Tasks

#### JWT Utilities (`/server/utils/jwt.js`)
- [ ] Create `generateAccessToken(userId, username, isAdmin)` function
- [ ] Create `generateRefreshToken(userId)` function
- [ ] Create `verifyToken(token, secret, callback)` function
- [ ] Export JWT secrets from `.env`: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- [ ] Set token expiries: Access = 15m, Refresh = 7d

#### User Model (`/server/models/User.js`)
- [ ] Create User class with methods:
  - [ ] `findByUsername(username)` - find user by username
  - [ ] `create(username, password, isAdmin = false)` - create new user
  - [ ] `validatePassword(password)` - compare password with hash
  - [ ] `getById(id)` - get user by ID
  - [ ] `getAll()` - get all users (admin only)
  - [ ] `update(id, updates)` - update user
  - [ ] `delete(id)` - delete user (and their data via CASCADE)

#### Auth Middleware (`/server/middleware/auth.js`)
- [ ] Create `authenticate` middleware:
  - [ ] Extract JWT from HTTP-only cookie
  - [ ] Verify token
  - [ ] Attach user object to `req.user` (with id, username, isAdmin)
  - [ ] Handle token refresh if access token expired but refresh token valid
  - [ ] Return 401 if no valid token
- [ ] Create `requireAuth` middleware (wrapper that calls `authenticate` and ensures auth)
- [ ] Create `requireAdmin` middleware (checks `req.user.isAdmin`)
- [ ] Create `userScope` middleware:
    - [ ] If user is admin, call `next()` without filtering
    - [ ] If user is regular, add `userId` to `req.filter` or similar
    - [ ] This will be used by individual route handlers

#### Auth Routes (`/server/routes/auth.js`)
- [ ] POST `/api/auth/login`:
  - [ ] Accept username and password
  - [ ] Validate credentials
  - [ ] Generate access and refresh tokens
  - [ ] Set tokens in HTTP-only cookies
  - [ ] Return user info (id, username, isAdmin) - NOT password or tokens
- [ ] POST `/api/auth/logout`:
  - [ ] Clear HTTP-only cookies
  - [ ] Add refresh token to blacklist (optional, for extra security)
  - [ ] Return success
- [ ] POST `/api/auth/refresh`:
  - [ ] Verify refresh token
  - [ ] Generate new access token
  - [ ] Set new access token in cookie
  - [ ] Return success
- [ ] GET `/api/auth/me`:
  - [ ] Return current user info (from JWT)
  - [ ] Requires valid auth

#### User Routes (`/server/routes/users.js`) - Admin Only
- [ ] GET `/api/users`:
  - [ ] List all users (admin only)
  - [ ] Use `requireAdmin` middleware
- [ ] POST `/api/users`:
  - [ ] Create new user (admin only)
  - [ ] Accept: username, password, isAdmin (optional, default false)
  - [ ] Return created user (without password hash)
- [ ] GET `/api/users/:id`:
  - [ ] Get user by ID (admin only, or self)
  - [ ] Regular users can only access their own ID
- [ ] PUT `/api/users/:id`:
  - [ ] Update user (admin only, or self for profile updates)
  - [ ] Prevent changing isAdmin unless requester is admin
- [ ] DELETE `/api/users/:id`:
  - [ ] Delete user (admin only)
  - [ ] CASCADE will delete all user data

### Deliverables
- Complete JWT authentication system
- User model with all CRUD operations
- Auth and user routes
- New auth middleware

### Dependencies
- Phase 2 completion (database schema ready)

---

## Phase 4: Backend Data Isolation (Effort: 8-12 hours)

**Goal**: Ensure all API endpoints filter data by user_id to maintain data isolation.

### Tasks

#### General Approach
- [ ] Decision: Use **middleware-based filtering** vs **query builder pattern**
  - **Chosen**: Middleware adds `userId` to request, each route handler uses it in queries
  - Reason: More explicit, easier to audit, works with existing code structure

#### Update All Route Handlers
For each existing route in `/server/server.js`:

**Properties Routes**
- [ ] GET `/api/properties` - Add `WHERE user_id = ?` with req.user.id
- [ ] POST `/api/properties` - Add `user_id` to INSERT values
- [ ] GET `/api/properties/:id` - Add `AND user_id = ?` to query
- [ ] PUT `/api/properties/:id` - Verify property belongs to user before update
- [ ] DELETE `/api/properties/:id` - Verify property belongs to user before delete

**Tenants Routes**
- [ ] GET `/api/tenants` - Filter by user_id
- [ ] POST `/api/tenants` - Add user_id to INSERT
- [ ] GET `/api/tenants/:id` - Filter by user_id
- [ ] PUT `/api/tenants/:id` - Verify ownership
- [ ] DELETE `/api/tenants/:id` - Verify ownership

**Categories Routes**
- [ ] GET `/api/categories` - Filter by user_id
- [ ] POST `/api/categories` - Add user_id
- [ ] PUT `/api/categories/:id` - Verify ownership
- [ ] DELETE `/api/categories/:id` - Verify ownership

**Counterparties Routes**
- [ ] GET `/api/counterparties` - Filter by user_id
- [ ] POST `/api/counterparties` - Add user_id
- [ ] GET `/api/counterparties/:id` - Filter by user_id
- [ ] PUT `/api/counterparties/:id` - Verify ownership
- [ ] DELETE `/api/counterparties/:id` - Verify ownership

**Transactions Routes**
- [ ] GET `/api/transactions` - Filter by user_id
- [ ] POST `/api/transactions` - Add user_id
- [ ] GET `/api/transactions/:id` - Filter by user_id
- [ ] PUT `/api/transactions/:id` - Verify ownership
- [ ] DELETE `/api/transactions/:id` - Verify ownership

**Documents Routes**
- [ ] GET `/api/documents` - Filter by user_id
- [ ] POST `/api/documents` - Add user_id
- [ ] GET `/api/documents/:id` - Filter by user_id
- [ ] DELETE `/api/documents/:id` - Verify ownership

**Recurring Payments Routes**
- [ ] GET `/api/recurring-payments` - Filter by user_id
- [ ] POST `/api/recurring-payments` - Add user_id
- [ ] PUT `/api/recurring-payments/:id` - Verify ownership
- [ ] DELETE `/api/recurring-payments/:id` - Verify ownership

**Tenant Contracts Routes**
- [ ] GET `/api/tenant-contracts` - Filter by user_id
- [ ] POST `/api/tenant-contracts` - Add user_id
- [ ] GET `/api/tenant-contracts/:id` - Filter by user_id
- [ ] PUT `/api/tenant-contracts/:id` - Verify ownership
- [ ] DELETE `/api/tenant-contracts/:id` - Verify ownership

**Rent Payments Routes**
- [ ] GET `/api/rent-payments` - Filter by user_id
- [ ] POST `/api/rent-payments` - Add user_id
- [ ] GET `/api/rent-payments/:id` - Filter by user_id
- [ ] PUT `/api/rent-payments/:id` - Verify ownership
- [ ] DELETE `/api/rent-payments/:id` - Verify ownership

**Settings Routes**
- [ ] GET `/api/settings` - Filter by user_id (each user has their own settings)
- [ ] PUT `/api/settings` - Upsert with user_id

**Automation State & Idempotency Keys**
- [ ] GET `/api/automation-state` - Filter by user_id
- [ ] POST `/api/automation-state` - Add user_id
- [ ] GET `/api/idempotency-keys` - Filter by user_id (if exposed via API)
- [ ] POST `/api/idempotency-keys` - Add user_id

#### Admin Override
- [ ] Modify all queries to include admin bypass logic:
  ```sql
  WHERE user_id = ? OR (? = 1)  -- Assuming admin has is_admin = true (1)
  ```
  - OR better: Skip WHERE clause entirely if user is admin
  - Implementation: Check `req.user.isAdmin` before adding WHERE clause

#### Helper Functions
- [ ] Create utility function to add user_id filter to queries:
  ```javascript
  function addUserFilter(query, user) {
    if (!user.isAdmin) {
      return query + ` WHERE user_id = ${user.id}`;
    }
    return query;
  }
  ```
- [ ] Create utility for prepared statements with user_id:
  ```javascript
  function getUserFilterParams(user) {
    return user.isAdmin ? [] : [user.id];
  }
  ```

### Deliverables
- All existing routes modified with user_id filtering
- Admin bypass implemented for all queries
- Helper functions for consistent filtering

### Dependencies
- Phase 3 completion (auth system in place)

---

## Phase 5: Backend Integration & Refactoring (Effort: 4-6 hours)

**Goal**: Integrate new auth system with existing server and refactor for maintainability.

### Tasks

- [ ] Update `/server/server.js`:
  - [ ] Import new auth middleware (`requireAuth`, `requireAdmin`, `userScope`)
  - [ ] Add cookie-parser middleware: `app.use(cookieParser())`
  - [ ] Replace old `requireAuth` middleware with new one
  - [ ] Import and mount new routes:
    - [ ] `/api/auth` routes
    - [ ] `/api/users` routes
  - [ ] Add JWT verification to all protected routes
- [ ] Update CORS configuration:
  - [ ] Ensure credentials are allowed: `cors({ origin: true, credentials: true })`
- [ ] Update error handling:
  - [ ] Add 401 Unauthorized handler for invalid/expired tokens
  - [ ] Add 403 Forbidden handler for insufficient permissions
- [ ] Refactor existing middleware:
  - [ ] Rename old `/server/auth-middleware.js` to `/server/auth-middleware.old.js` (backup)
  - [ ] Or delete it after verifying new system works
- [ ] Add rate limiting to auth endpoints (optional but recommended):
  - [ ] Login attempts: 5 per minute per IP
  - [ ] Use `express-rate-limit` package

### Deliverables
- Fully integrated backend with new auth system
- All routes protected and filtering correctly
- Old auth system removed/backed up

### Dependencies
- Phase 4 completion

---

## Phase 6: Frontend Changes (Effort: 6-8 hours)

**Goal**: Update frontend to support multi-user authentication and user context.

### Tasks

#### API Client Updates (`/services/api.ts`)
- [ ] Add login function:
  ```typescript
  export async function login(username: string, password: string): Promise<User> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include', // Important for cookies
    });
    // Handle response
  }
  ```
- [ ] Add logout function:
  ```typescript
  export async function logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  }
  ```
- [ ] Add getCurrentUser function:
  ```typescript
  export async function getCurrentUser(): Promise<User | null> {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    // Handle response
  }
  ```
- [ ] Update all existing API functions:
  - [ ] Ensure `credentials: 'include'` is set on all requests
  - [ ] This ensures cookies (JWT) are sent with each request
- [ ] Add User type to `/types.ts`:
  ```typescript
  export interface User {
    id: number;
    username: string;
    isAdmin: boolean;
    createdAt?: string;
    updatedAt?: string;
  }
  ```

#### Login Page (`/pages/Login.tsx`)
- [ ] Update form to include username field:
  - [ ] Add `username` state
  - [ ] Add username input field with label
  - [ ] Update login call to use both username and password
- [ ] Update error handling:
  - [ ] Show specific error for invalid credentials
  - [ ] Show error for network issues
- [ ] Redirect to dashboard on successful login

#### User Context
- [ ] Create new context: `/contexts/UserContext.tsx`:
  ```typescript
  interface UserContextType {
    user: User | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
  }
  ```
- [ ] Create UserProvider component:
  - [ ] Manage user state
  - [ ] Call `getCurrentUser()` on mount to check existing session
  - [ ] Provide login/logout functions
  - [ ] Handle auth state persistence
- [ ] Wrap entire app with UserProvider

#### Protected Routes
- [ ] Create `/components/ProtectedRoute.tsx`:
  ```typescript
  interface ProtectedRouteProps {
    children: ReactNode;
    adminOnly?: boolean;
  }
  ```
- [ ] Implement route protection:
  - [ ] Redirect to login if not authenticated
  - [ ] For adminOnly, check `user.isAdmin` and redirect to unauthorized page if false
- [ ] Update route configuration:
  - [ ] Wrap all protected pages with ProtectedRoute
  - [ ] Mark admin-only pages with `adminOnly={true}`

#### Navigation & UI
- [ ] Update navigation bar:
  - [ ] Show username when logged in
  - [ ] Add logout button
  - [ ] Hide login link when authenticated
- [ ] Create account/profile page:
  - [ ] Show user information
  - [ ] Allow password change (if implementing)
- [ ] Create admin users management page:
  - [ ] List all users (admin only)
  - [ ] Add new user form (admin only)
  - [ ] Edit/delete users (admin only)
- [ ] Update all data tables/displays:
  - [ ] Ensure all data fetching respects user context
  - [ ] No changes needed to display logic (data already filtered by backend)

#### Settings & Configuration
- [ ] Update settings page:
  - [ ] Note: Settings are now per-user
  - [ ] No code changes needed (backend handles filtering)

### Deliverables
- Complete frontend authentication flow
- User context throughout the app
- Protected routes working correctly
- Admin user management UI

### Dependencies
- Phase 5 completion (backend API ready)

---

## Phase 7: User Registration & Self-Service (Effort: 2-4 hours)

**Goal**: Enable user registration and self-service features.

### Tasks

#### Backend
- [ ] Add registration route: POST `/api/auth/register`
  - [ ] Accept username, password, (optionally email)
  - [ ] Validate username uniqueness
  - [ ] Hash password
  - [ ] Create user with `isAdmin = false`
  - [ ] Auto-login after registration (optional)
  - [ ] Rate limit: 3 registrations per hour per IP
- [ ] Add password reset flow (optional for v1):
  - [ ] Generate reset token
  - [ ] Store in database with expiry
  - [ ] Send email (if email configured)
  - [ ] Reset password endpoint

#### Frontend
- [ ] Create registration page: `/pages/Register.tsx`
  - [ ] Form with username, password, confirm password
  - [ ] Validation: username length, password strength
  - [ ] Call registration API
  - [ ] Redirect to login or dashboard on success
- [ ] Add link to registration page from login page
- [ ] Add password reset page (optional):
  - [ ] Request reset form (email/username)
  - [ ] Reset password form (token from email)

### Deliverables
- User registration functionality
- Optional: Password reset flow

### Dependencies
- Phase 6 completion

---

## Phase 8: Migration Execution (Effort: 2-4 hours)

**Goal**: Safely migrate existing data to multi-user system.

### Tasks

#### Pre-Migration
- [ ] Create full backup:
  - [ ] Backup database: `cp database.sqlite database.sqlite.pre-multiuser-$(date +%Y%m%d-%H%M%S)`
  - [ ] Backup entire project directory
  - [ ] Commit all changes to git
  - [ ] Create git tag: `git tag pre-multiuser-migration`
- [ ] Notify all users of upcoming maintenance window
- [ ] Stop the ImmoPi server

#### Migration Script
- [ ] Create `/scripts/migrate-to-multiuser.js`:
  ```javascript
  // Pseudocode:
  const db = new Database();
  const env = require('./env'); // Or use process.env
  
  // 1. Create users table
  await db.exec(fs.readFileSync('migrations/001_create_users_table.sql', 'utf8'));
  
  // 2. Add user_id columns
  await db.exec(fs.readFileSync('migrations/002_add_user_id_columns.sql', 'utf8'));
  
  // 3. Create admin user
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.APP_PASSWORD; // Migrate existing password
  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  await db.run(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, true)',
    [adminUsername, hashedPassword]
  );
  
  // 4. Migrate existing data
  await db.exec(fs.readFileSync('migrations/004_migrate_existing_data.sql', 'utf8'));
  
  // 5. Make user_id not null
  await db.exec(fs.readFileSync('migrations/005_make_user_id_not_null.sql', 'utf8'));
  
  // 6. Remove APP_PASSWORD from .env (or comment it out)
  
  console.log('Migration complete! Admin username:', adminUsername);
  ```
- [ ] Test migration script on backup database:
  - [ ] Run script against test database
  - [ ] Verify admin user created
  - [ ] Verify all data assigned to admin
  - [ ] Verify login works with admin credentials

#### Post-Migration
- [ ] Update `.env`:
  - [ ] Comment out or remove `APP_PASSWORD`
  - [ ] Add `JWT_ACCESS_SECRET` (generate with `openssl rand -hex 32`)
  - [ ] Add `JWT_REFRESH_SECRET` (generate with `openssl rand -hex 32`)
  - [ ] Add `ADMIN_USERNAME` (optional, for reference)
  - [ ] Add `COOKIE_SECRET` for cookie signing (if using signed cookies)
- [ ] Start the server and verify:
  - [ ] Admin can login with migrated credentials
  - [ ] All existing data visible to admin
  - [ ] New user registration works
  - [ ] New user can only see their own data (empty initially)

### Deliverables
- Successfully migrated database
- Working multi-user system
- Admin access to all existing data

### Dependencies
- All previous phases completed and tested

---

## Phase 9: Testing (Effort: 4-6 hours)

**Goal**: Comprehensive testing to ensure data isolation and all functionality works correctly.

### Tasks

#### Unit Tests
- [ ] Backend:
  - [ ] Test JWT token generation and verification
  - [ ] Test password hashing and validation
  - [ ] Test user model methods
  - [ ] Test auth middleware with valid/invalid tokens
  - [ ] Test userScope middleware filtering
  - [ ] Test admin bypass in all routes
- [ ] Frontend:
  - [ ] Test login with valid/invalid credentials
  - [ ] Test user context updates
  - [ ] Test protected route redirection

#### Integration Tests
- [ ] Test full authentication flow:
  - [ ] Register new user
  - [ ] Login with new user
  - [ ] Verify JWT token set in cookies
  - [ ] Verify /me endpoint returns correct user
  - [ ] Logout and verify token cleared
- [ ] Test data isolation:
  - [ ] Create property as User A
  - [ ] Login as User B
  - [ ] Verify User B cannot see User A's property
  - [ ] Create property as User B
  - [ ] Verify User A cannot see User B's property
- [ ] Test admin privileges:
  - [ ] Login as admin
  - [ ] Verify admin can see all users' data
  - [ ] Verify admin can create users
  - [ ] Verify admin can delete users

#### End-to-End Tests
- [ ] Manual testing:
  - [ ] Open two browser windows (or incognito)
  - [ ] Login as User A in window 1, User B in window 2
  - [ ] Add data in both windows
  - [ ] Verify data isolation between windows
  - [ ] Test logout in one window doesn't affect the other
- [ ] Test edge cases:
  - [ ] Token expiry and refresh
  - [ ] Concurrent requests
  - [ ] Network interruption during requests
  - [ ] Invalid token handling
  - [ ] Expired token handling

#### Performance Testing
- [ ] Test with 10+ users and 100+ properties per user
- [ ] Verify query performance with user_id filtering
- [ ] Check for N+1 query problems

### Deliverables
- Comprehensive test suite
- Test results documentation
- All critical paths verified

### Dependencies
- Phase 8 completion

---

## Phase 10: Deployment & Rollback (Effort: 2-3 hours)

**Goal**: Deploy the multi-user system with a safe rollback plan.

### Tasks

#### Deployment
- [ ] Create deployment checklist:
  - [ ] Database backup verified
  - [ ] Migration scripts tested
  - [ ] All tests passing
  - [ ] `.env` updated with new secrets
  - [ ] Server stopped
  - [ ] Migration executed
  - [ ] Server started
  - [ ] Smoke tests passed
- [ ] Deploy to production:
  - [ ] `git checkout feature/multi-user-auth`
  - [ ] `npm install` (install new dependencies)
  - [ ] Stop server
  - [ ] Run migration script
  - [ ] Update `.env`
  - [ ] Start server
  - [ ] Verify health

#### Rollback Plan
- [ ] Document rollback steps:
  ```bash
  # Step 1: Stop the server
  pm2 stop immopi
  
  # Step 2: Restore database backup
  cp database.sqlite.backup database.sqlite
  
  # Step 3: Restore old code
  git checkout main
  npm install
  
  # Step 4: Restore old .env
  git checkout .env
  
  # Step 5: Start old server
  pm2 start immopi
  ```
- [ ] Test rollback procedure on staging:
  - [ ] Perform full migration
  - [ ] Simulate issue
  - [ ] Execute rollback
  - [ ] Verify system restored to original state

#### Post-Deployment
- [ ] Monitor logs for errors:
  - [ ] Authentication failures
  - [ ] Database errors
  - [ ] Permission errors
- [ ] Verify with real users:
  - [ ] Admin can access all data
  - [ ] Regular users see only their data
  - [ ] Login/logout works
- [ ] Create admin guide:
  - [ ] How to create new users
  - [ ] How to reset passwords
  - [ ] How to manage users

### Deliverables
- Successfully deployed multi-user system
- Rollback procedure documented and tested
- All users can access their data

### Dependencies
- Phase 9 completion (all tests passing)

---

## Timeline Summary

| Phase | Description | Effort | Priority |
|-------|-------------|--------|----------|
| 1 | Preparation & Setup | 2-4 hours | High |
| 2 | Database Schema Changes | 4-6 hours | High |
| 3 | Backend Authentication System | 6-8 hours | High |
| 4 | Backend Data Isolation | 8-12 hours | High |
| 5 | Backend Integration & Refactoring | 4-6 hours | High |
| 6 | Frontend Changes | 6-8 hours | High |
| 7 | User Registration & Self-Service | 2-4 hours | Medium |
| 8 | Migration Execution | 2-4 hours | High |
| 9 | Testing | 4-6 hours | High |
| 10 | Deployment & Rollback | 2-3 hours | High |
| | **Total** | **40-61 hours** | |

**Note**: Effort estimates are for a single experienced developer. Can be parallelized (e.g., Phase 3 & 4 can be worked on simultaneously after Phase 2).

---

## File Changes Summary

### New Files
```
/server/models/User.js
/server/middleware/auth.js
/server/routes/auth.js
/server/routes/users.js
/server/utils/jwt.js
/migrations/001_create_users_table.sql
/migrations/002_add_user_id_columns.sql
/migrations/003_create_admin_user.sql
/migrations/004_migrate_existing_data.sql
/migrations/005_make_user_id_not_null.sql
/migrations/run.js
/scripts/migrate-to-multiuser.js
/contexts/UserContext.tsx
/components/ProtectedRoute.tsx
/pages/Register.tsx
/pages/Login.tsx (modified)
/pages/AdminUsers.tsx (optional)
/pages/Profile.tsx (optional)
/types.ts (modified)
/services/api.ts (modified)
IMPLEMENTATION_PLAN.md (this file)
```

### Modified Files
```
/server/server.js (major changes)
/server/auth-middleware.js (deprecated/removed)
.env (add JWT secrets, remove APP_PASSWORD)
package.json (new dependencies)
```

### Deprecated Files (Backup)
```
/server/auth-middleware.js -> /server/auth-middleware.old.js
```

---

## Environment Variables

### Add to `.env`:
```bash
# JWT Secrets (generate with: openssl rand -hex 32)
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Cookie settings
COOKIE_SECRET=your_cookie_secret_here
COOKIE_MAX_AGE=900000  # 15 minutes for access token

# Admin user (for migration)
ADMIN_USERNAME=admin

# Optional: App settings
NODE_ENV=production
PORT=3001
```

### Remove/Comment from `.env`:
```bash
# Old single-user auth (comment out after migration)
# APP_PASSWORD=your_old_password
```

---

## Testing Checklist

### Authentication
- [ ] User can register with valid credentials
- [ ] User cannot register with duplicate username
- [ ] User can login with valid credentials
- [ ] User cannot login with invalid credentials
- [ ] JWT token is set in HTTP-only cookie
- [ ] `/api/auth/me` returns correct user info
- [ ] Logout clears cookies
- [ ] Expired token is refreshed automatically
- [ ] Invalid token returns 401

### Data Isolation
- [ ] User A creates property, User B cannot see it
- [ ] User A creates tenant, User B cannot see it
- [ ] User A updates property, User B's view unchanged
- [ ] User A deletes property, User B's data unchanged
- [ ] Admin can see all users' data
- [ ] Admin can see all users in user list

### Edge Cases
- [ ] Token expiry during request
- [ ] Concurrent requests from same user
- [ ] Network interruption during login
- [ ] Browser refresh maintains session
- [ ] Multiple tabs share session
- [ ] Logout in one tab affects all tabs

---

## Rollback Checklist

If deployment fails:

1. **Stop the server immediately**
   ```bash
   pm2 stop immopi
   ```

2. **Restore database**
   ```bash
   cp database.sqlite.pre-multiuser-$(date) database.sqlite
   ```

3. **Restore code**
   ```bash
   git checkout main
   git reset --hard HEAD
   npm install
   ```

4. **Restore environment**
   ```bash
   git checkout .env
   ```

5. **Start old server**
   ```bash
   pm2 start immopi
   ```

6. **Verify**
   - [ ] Login with old APP_PASSWORD works
   - [ ] All data is visible
   - [ ] No errors in logs

---

## Success Criteria

The implementation is considered successful when:

1. ✅ All existing data is accessible to the admin user
2. ✅ New users can register and login
3. ✅ Users can only see and modify their own data
4. ✅ Admin users can see and modify all data
5. ✅ All API endpoints work with the new auth system
6. ✅ Frontend authentication flow is smooth
7. ✅ No data loss occurred during migration
8. ✅ All tests pass
9. ✅ Performance is acceptable (no significant degradation)

---

## Next Steps

After completing this implementation:

1. Consider adding email verification for registration
2. Implement password reset via email
3. Add user profile management (change username, password)
4. Add audit logging for user actions
5. Implement user activity tracking
6. Add two-factor authentication (2FA)
7. Consider adding user roles (beyond just admin/regular)

---

## Appendix A: Database Schema (After Migration)

```sql
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);

-- Example of modified table (all tables follow same pattern)
CREATE TABLE properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  -- ... other columns
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_properties_user_id ON properties(user_id);
```

---

## Appendix B: Example JWT Middleware

```javascript
// /server/middleware/auth.js
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  // Get token from cookies
  const token = req.cookies.accessToken;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, user) => {
    if (err) {
      // Token expired - check for refresh token
      if (err.name === 'TokenExpiredError') {
        return handleRefreshToken(req, res, next);
      }
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  });
}

function handleRefreshToken(req, res, next) {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }
  
  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }
    
    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: user.userId, username: user.username, isAdmin: user.isAdmin },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
    
    // Set new access token in cookie
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000
    });
    
    req.user = user;
    next();
  });
}

function requireAuth(req, res, next) {
  authenticate(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

function userScope(req, res, next) {
  requireAuth(req, res, () => {
    // If admin, no filtering needed
    if (req.user.isAdmin) {
      return next();
    }
    
    // Add user_id to request for filtering
    req.userId = req.user.userId;
    next();
  });
}

module.exports = { authenticate, requireAuth, requireAdmin, userScope };
```

---

## Appendix C: Example User Model

```javascript
// /server/models/User.js
const db = require('../database');
const bcrypt = require('bcrypt');

class User {
  static async findByUsername(username) {
    const row = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    return row;
  }
  
  static async findById(id) {
    const row = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    return row;
  }
  
  static async create(username, password, isAdmin = false) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db.run(
      'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
      [username, hashedPassword, isAdmin]
    );
    return this.findById(result.lastID);
  }
  
  static async validatePassword(user, password) {
    return await bcrypt.compare(password, user.password_hash);
  }
  
  static async getAll() {
    return await db.all('SELECT id, username, is_admin, created_at, updated_at FROM users');
  }
  
  static async update(id, updates) {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'password_hash') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (updates.password) {
      const hashedPassword = await bcrypt.hash(updates.password, 12);
      fields.push('password_hash = ?');
      values.push(hashedPassword);
    }
    
    values.push(id);
    
    await db.run(`UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
    return this.findById(id);
  }
  
  static async delete(id) {
    // CASCADE will delete all user data
    await db.run('DELETE FROM users WHERE id = ?', [id]);
  }
}

module.exports = User;
```

---

## Appendix D: Source Context Information

This implementation plan was created based on the following context gathered from the ImmoPi codebase:

### Codebase Structure
- **Frontend**: React 19 + TypeScript + Vite
  - Entry: `index.tsx`
  - Pages: `pages/` directory (Dashboard, Properties, Tenants, Transactions, Documents, RecurringPayments, Settings, Reports, Login)
  - API Client: `services/api.ts` (centralized, handles auth tokens)
  - Types: `types.ts` (TypeScript interfaces for all models)

### Backend Structure
- **Server**: `server/server.js` (~1700 lines)
  - Express.js with CORS, cookie-parser, multer
  - SQLite3 database connection
  - All API routes defined directly in server.js
  - Uses `requireAuth` middleware from auth-middleware.js

### Current Authentication (auth-middleware.js)
- Single password from environment (APP_PASSWORD or APP_PASSWORD_HASH)
- In-memory session storage using Map
- Session tokens with 24-hour expiry
- Functions: login(), logout(), isValidSession(), requireAuth(), hashPassword()
- Exports CLI utility for generating password hashes

### Current Database Schema (production.db)
No users table exists. All tables are global with no user association:
- properties (id, name, address, type, purchasePrice, purchaseDate, rentAmount, size, mortgage_*, notes)
- tenants (id, firstName, lastName, email, phone, property_id, leaseStart, leaseEnd, rentAmount, deposit, notes, isCurrent)
- categories (id, name, type, isTaxRelevant)
- counterparties (id, name, type, contactPerson, email, phone, address, notes)
- transactions (id, date, amount, currency, description, type, property_id, category_id, counterparty_id, document_id, isAutoGenerated, source)
- documents (id, file_name, original_name, mime_type, upload_date, document_date, document_type, amount, currency, property_id, category_id, counterparty_id, notes)
- recurring_payments (id, name, amount, currency, frequency, startDate, endDate, nextDueDate, category_id, property_id, counterparty_id, isActive)
- settings (id=1, currency, taxYear)
- automation_state (id=1, lastMortgageRun)
- tenant_contracts (id, tenant_id, property_id, start_date, end_date, cold_rent, side_costs, payment_day_of_month, is_active, notes, created_at, updated_at)
- rent_payments (id, tenant_contract_id, date, amount, cold_rent_amount, side_costs_amount, status, payment_method, transaction_id, notes, created_at, updated_at, source)
- idempotency_keys (id, key, source, processed_at)

### Current Test Data
Production database contains:
- 2 properties (Huttenstrasse, Säntis)
- Various related entities (tenants, transactions, etc.)
- All data currently has no user association

### File Dependencies
- `App.tsx`: Main React component with routing
- `constants.ts`: Application constants
- `index.tsx`: React entry point
- `vite.config.ts`: Vite configuration
- `.env`: Environment variables including API URLs
- `ecosystem.config.js`: PM2 configuration for server

### Current Environment Variables
- `VITE_API_URL`: Frontend API URL (defaults to http://192.168.1.18:8000/api)
- `APP_PASSWORD` / `APP_PASSWORD_HASH`: Current single-user authentication
- `CORS_ORIGIN`: Allowed origins for CORS
- `PORT`: Server port (8000 default)
- `NODE_ENV`: Environment (test, production, development)

---

*Implementation plan generated by Mistral Vibe with planner subagent on 2026-08-17*
