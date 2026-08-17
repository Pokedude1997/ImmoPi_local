# ImmoPi Application - Multi-User Implementation Context

## Overview
ImmoPi is a property management application with a React frontend and Node.js/Express backend using SQLite. Currently, it has a **single-user authentication system** (one password in .env) and needs to be converted to a **multi-user system** where each user has their own account and can only see their own properties and related data.

## Current Architecture

### Frontend (React + TypeScript + Vite)
- **Pages**: Dashboard, Properties, Tenants, Transactions, Documents, RecurringPayments, Settings, Reports, Login
- **API Client**: `/services/api.ts` - Centralized API communication with auth token handling
- **Types**: `/types.ts` - TypeScript interfaces for all data models
- **Auth Flow**: 
  - Login page at `/pages/Login.tsx`
  - Sends password to `/api/auth/login`
  - Stores token in localStorage (`authToken`, `authExpiry`)
  - Token sent via Authorization header on all API requests

### Backend (Node.js + Express + SQLite3)
- **Server**: `/server/server.js` - Main server with ~1700 lines
- **Auth**: `/server/auth-middleware.js` - Simple session-based auth
  - Single password from environment (APP_PASSWORD or APP_PASSWORD_HASH)
  - In-memory session storage (Map)
  - Session tokens with 24-hour expiry
  - Middleware `requireAuth` protects all API routes
- **Database**: SQLite at `/databases/production.db` and `/databases/test.db`

### Current Database Schema
```sql
-- No users table exists!
-- All tables are "global" with no user association

CREATE TABLE properties (id, name, address, type, purchasePrice, ...)
CREATE TABLE tenants (id, firstName, lastName, email, phone, property_id, ...)
CREATE TABLE categories (id, name, type, isTaxRelevant)
CREATE TABLE counterparties (id, name, type, contactPerson, ...)
CREATE TABLE transactions (id, date, amount, type, property_id, category_id, counterparty_id, ...)
CREATE TABLE documents (id, file_name, property_id, category_id, counterparty_id, ...)
CREATE TABLE recurring_payments (id, name, amount, property_id, category_id, counterparty_id, ...)
CREATE TABLE tenant_contracts (id, tenant_id, property_id, start_date, cold_rent, ...)
CREATE TABLE rent_payments (id, tenant_contract_id, date, amount, status, ...)
CREATE TABLE settings (id=1, currency, taxYear) -- Global settings
CREATE TABLE automation_state (id=1, lastMortgageRun)
CREATE TABLE idempotency_keys (id, key, source, processed_at)
```

### Current Auth Endpoints
- `POST /api/auth/login` - Verify password, create session
- `POST /api/auth/logout` - Invalidate session
- `GET /api/auth/check` - Check if session is valid

### Current Data Endpoints
All CRUD endpoints follow pattern: `/api/{entity}` and `/api/{entity}/:id`
- Properties, Tenants, Categories, Counterparties, Transactions, Documents, Recurring Payments, Tenant Contracts, Rent Payments, Settings
- All protected by `requireAuth` middleware
- No user filtering - all users see all data

## Requirements for Multi-User System

### 1. User Management
- Each user has: username, password (hashed), email (optional)
- Users can be created (registration or admin creation)
- Users can log in with username+password

### 2. Data Isolation
- All data entities (properties, tenants, transactions, etc.) must be associated with a user
- Users can ONLY see and modify their own data
- Admin user (optional) can see all data

### 3. Database Changes Required
- Add `users` table with id, username, password_hash, email, role, created_at, updated_at
- Add `user_id` foreign key to ALL entity tables:
  - properties
  - tenants
  - categories
  - counterparties
  - transactions
  - documents
  - recurring_payments
  - tenant_contracts
  - rent_payments
- Settings table: decide if per-user or global
- Modify existing data to belong to an admin user during migration

### 4. Backend Changes Required
- Replace current single-password auth with username/password auth
- Modify `auth-middleware.js`:
  - Add user registration endpoint
  - Add login with username+password
  - Store user_id in session
  - Modify `requireAuth` to attach user to request
- Modify all CRUD endpoints to:
  - Filter queries by user_id
  - Add user_id to new entities
  - Verify user ownership before updates/deletes

### 5. Frontend Changes Required
- Update Login page to accept username+password
- Add User registration page (or admin user creation)
- Add User profile/management page
- Update API client to handle new auth endpoints
- Update all data displays to only show user's data

### 6. Migration Strategy
- Create migration script to:
  1. Create users table
  2. Add user_id columns to all tables
  3. Create initial admin user
  4. Assign existing data to admin user
  5. Or prompt users to claim their data

## Technical Stack
- **Frontend**: React 19, TypeScript, Vite, react-router-dom
- **Backend**: Node.js, Express, SQLite3, bcrypt
- **Auth**: Currently in-memory sessions, should move to database for persistence
- **Environment**: Development uses 192.168.1.18:8000 for API

## Security Considerations
- Passwords must be hashed with bcrypt (already implemented in auth-middleware)
- Sessions should be stored in database, not memory
- All queries must filter by user_id to prevent data leakage
- API must reject requests for data that doesn't belong to the user
- Consider rate limiting for login attempts

## Edge Cases
- Existing single-user data migration
- What happens to global settings? (Make per-user or keep global)
- Admin user creation (first user)
- Session management across server restarts
- Password reset functionality

## Current Test Data
Production database has:
- 2 properties (Huttenstrasse, Säntis)
- Various related entities
- No users table currently

---

*Context gathered by Mistral Vibe on 2026-08-17 for multi-user implementation planning*