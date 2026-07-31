# Prioritized Action Plan - Code Review Findings

**Total: 18 Findings | Status: P0 Tasks In Progress**

This document outlines the prioritized action plan to address all findings from the code review report (`REVIEW.md`).
Tasks are organized by severity and dependency order.

---

## 🚨 Phase 1: Critical Security Issues (P0) - IMMEDIATE ACTION REQUIRED

*These issues pose significant security risks and must be fixed first.*

### SQL Injection Vulnerabilities
- [x] **Fix SQL Injection in recurring-automation.js (Line 98-100)** ✅ COMPLETED
  - Replace string interpolation with parameter binding in `updateRecurringPayment` function
  - **File:** `server/recurring-automation.js`
  - **Effort:** S | **Priority:** P0 | **Depends on:** None
  - **Status:** ✅ Parameter binding implemented (line 98-99)

- [x] **Fix SQL Injection in mortgage-automation.js (Line 267-278)** ✅ COMPLETED
  - Replace string interpolation with parameter binding in `createTransaction` function
  - **File:** `server/mortgage-automation.js`
  - **Effort:** S | **Priority:** P0 | **Depends on:** None
  - **Status:** ✅ Parameter binding implemented (line 269-273)

### Input Validation & Sanitization
- [x] **Implement input validation for /api/properties endpoints (Line 366-395)** ✅ COMPLETED
  - Validate date formats, numeric ranges, string lengths for mortgage_loanAmount, mortgage_startDate, etc.
  - Use Joi or express-validator library
  - **File:** `server/server.js`
  - **Effort:** M | **Priority:** P0 | **Depends on:** None
  - **Status:** ✅ Validation implemented in server/utils/validation.js with Zod schemas. Middleware applied to POST/PUT /api/properties endpoints.

- [ ] **Fix XSS vulnerability in Dashboard.tsx (Line 164)** ⚠️ NOT COMPLETED
  - Sanitize automationLog before rendering in JSX
  - Use DOMPurify library: `sanitize(automationLog[0])`
  - **Files:** `pages/Dashboard.tsx`
  - **Effort:** S | **Priority:** P0 | **Depends on:** None
  - **Note:** Install DOMPurify package first
  - **Status:** ❌ Line 163 still renders automationLog[0] directly without sanitization

### Error Handling
- [x] **Add error handling to API endpoints (Line 366-395)** ✅ COMPLETED
  - Wrap all database operations in try-catch blocks
  - Return generic error messages: `res.status(500).json({ error: 'Internal server error' })`
  - **File:** `server/server.js`
  - **Effort:** M | **Priority:** P0 | **Depends on:** None
  - **Status:** ✅ All database error responses now use generic messages. logError() function implemented in server/utils/validation.js. ⚠️ Note: Automation endpoints still need updating.

---

## ⚠️ Phase 2: Medium Severity Issues (P1) - HIGH PRIORITY

*These issues can cause data corruption, instability, or inconsistencies.*

### Concurrency & Data Integrity
- [ ] **Fix race condition in mortgage-automation.js (Line 177-258)**
  - Wait for transaction promises to complete before next iteration
  - Use `await Promise.all(transactionPromises)` in `processMortgageTransactions`
  - **File:** `server/mortgage-automation.js`
  - **Effort:** M | **Priority:** P1 | **Depends on:** P0 tasks

- [ ] **Standardize date handling in mortgage-automation.js**
  - Consistent use of UTC for all date operations
  - Review and align date comparisons (Line 55-68, Line 107)
  - **File:** `server/mortgage-automation.js`
  - **Effort:** M | **Priority:** P1 | **Depends on:** None

### Resource Management
- [ ] **Fix memory leak from unclosed database connections**
  - Implement cleanup function for DB connections
  - Close connections when module used as library
  - Or implement connection pooling
  - **Files:** `server/mortgage-automation.js` (Line 17), `server/recurring-automation.js` (Line 18)
  - **Effort:** M | **Priority:** P1 | **Depends on:** None

### Authentication & Configuration
- [ ] **Verify authentication for automation endpoints**
  - Ensure `/api/automation/run-all` endpoints protected with `requireAuth`
  - Verify scheduler functions not externally triggerable
  - **File:** `server/server.js` (Line 901-920)
  - **Effort:** S | **Priority:** P1 | **Depends on:** None

- [ ] **Replace hardcoded IP address in api.ts (Line 18)**
  - Use environment variables: `import.meta.env.VITE_API_URL || process.env.API_URL || 'http://localhost:8000/api'`
  - **File:** `services/api.ts`
  - **Effort:** S | **Priority:** P1 | **Depends on:** None

### Data Consistency
- [ ] **Standardize field naming convention between frontend and backend**
  - Implement central serializer/deserializer
  - Or change backend to use camelCase consistently
  - Address snake_case vs camelCase mismatch (property_id vs propertyId, category_id vs categoryId)
  - **Files:** `server/server.js`, `services/api.ts`, and all related files
  - **Effort:** L | **Priority:** P1 | **Depends on:** P0 tasks

---

## 📋 Phase 3: Low Severity Improvements (P2) - MEDIUM PRIORITY

*These improvements enhance security, usability, and maintainability.*

### Testing & Observability
- [ ] **Implement comprehensive unit tests for automation modules**
  - Add Jest tests for mortgage-automation.js and recurring-automation.js
  - Test: amortization calculations, date logic, duplicate checking
  - Replace manual test files (test-mortgage.js, test-mortgage2.js, test-check.js) with proper unit tests
  - **Files:** New test files in `server/__tests__/`, update package.json
  - **Effort:** XL | **Priority:** P2 | **Depends on:** P0, P1 tasks

- [ ] **Improve error visibility in Dashboard.tsx (Line 75-76)**
  - Display errors in notification/modal instead of only console logging
  - Use `setError(error.message || 'Automation failed')` and render error message
  - **File:** `pages/Dashboard.tsx`
  - **Effort:** S | **Priority:** P2 | **Depends on:** P0 tasks

### API Improvements
- [ ] **Implement pagination for large datasets**
  - Add limit/offset parameters to `/api/transactions` and `/api/recurring-payments`
  - Default: limit=50, offset=0
  - **File:** `server/server.js`
  - **Effort:** M | **Priority:** P2 | **Depends on:** None

- [ ] **Add rate limiting for API endpoints**
  - Implement express-rate-limit middleware
  - Configuration: windowMs=15min, max=100 requests
  - **File:** `server/server.js`
  - **Effort:** S | **Priority:** P2 | **Depends on:** None

### Security Hardening
- [ ] **Restrict CORS configuration (Line 29-43)**
  - Add security headers
  - Restrict allowed methods to: GET, POST, PUT, DELETE
  - Restrict allowed headers to: Content-Type, Authorization
  - **File:** `server/server.js`
  - **Effort:** S | **Priority:** P2 | **Depends on:** None

- [ ] **Implement CSRF protection for authenticated endpoints**
  - Add csurf middleware or similar
  - Protect POST/PUT/DELETE endpoints using cookies
  - **File:** `server/server.js`
  - **Effort:** M | **Priority:** P2 | **Depends on:** None

- [ ] **Secure session cookie configuration (Line 276-280)**
  - Set `secure: true` flag for HTTPS in production
  - Set `sameSite: 'strict'` or `'lax'`
  - **File:** `server/server.js`
  - **Effort:** S | **Priority:** P2 | **Depends on:** None

---

## 🏗️ Phase 4: Architectural Improvements (P1/P2) - LONG TERM

*These improvements enhance code maintainability, deployment, and documentation.*

### Code Quality
- [ ] **Extract common code between mortgage-automation.js and recurring-automation.js**
  - Identify and extract duplicate logic (createTransaction, logging)
  - Create shared modules for common functionality
  - **Files:** New shared modules in `server/common/`, update `server/mortgage-automation.js`, `server/recurring-automation.js`
  - **Effort:** L | **Priority:** P1 | **Depends on:** P0, P1 tasks

### Infrastructure & Deployment
- [ ] **Add Docker configuration for deployment**
  - Create Dockerfile for backend and frontend
  - Create docker-compose.yml for multi-container setup
  - **Files:** New `Dockerfile`, `docker-compose.yml`, `.dockerignore`
  - **Effort:** M | **Priority:** P2 | **Depends on:** None

- [ ] **Define CI/CD pipeline**
  - Setup GitHub Actions or similar
  - Automate testing, building, and deployment
  - **Files:** New `.github/workflows/` configuration
  - **Effort:** M | **Priority:** P2 | **Depends on:** Docker configuration

### Documentation
- [ ] **Add API documentation (Swagger/OpenAPI)**
  - Document all API endpoints
  - Add request/response schemas
  - **Files:** New `server/docs/` or integrate swagger-ui-express
  - **Effort:** L | **Priority:** P2 | **Depends on:** None

---

## 📊 Implementation Order Summary

```
Phase 1 (P0 - Critical Security) → 3/5 tasks completed
    ↓
Phase 2 (P1 - Medium Severity) → All tasks pending
    ↓
Phase 3 (P2 - Low Severity) → All tasks pending
    ↓
Phase 4 (Architectural) → All tasks pending
```

## 🎯 P0 Completion Status

| Task | Status | Verification |
|------|--------|--------------|
| SQL Injection - recurring-automation.js | ✅ COMPLETE | Parameter binding verified (line 98-99) |
| SQL Injection - mortgage-automation.js | ✅ COMPLETE | Parameter binding verified (line 269-273) |
| Input Validation - /api/properties | ✅ COMPLETE | Zod schemas + middleware verified |
| XSS - Dashboard.tsx | ❌ NOT COMPLETED | automationLog[0] still unescaped |
| Error Handling - API endpoints | ✅ COMPLETE | Generic messages verified (automation endpoints need update) |

**P0 Progress: 4/5 tasks completed (80%)**

## ✅ Completion Checklist

- [ ] All P0 (Critical Security) tasks completed and verified
- [ ] All P1 (Medium Severity) tasks completed and verified
- [ ] All P2 (Low Severity) tasks completed and verified
- [ ] Architectural improvements implemented
- [ ] Full regression testing performed
- [ ] Security audit completed
- [ ] Documentation updated

---

# 🎯 NEW FEATURE: Rent Payment Recording for Tenants Tab

**Project:** ImmoPi - Rent Payment Recording Feature  
**Created:** 2025-01-XX  
**Priority:** High  
**Status:** Planning Phase

---

## 📋 Feature Overview

### Requirements
1. Add ability to record rent paid by each tenant per contract in Tenants tab UI
2. Auto-calculate warm rent = cold rent + side costs
3. Default: rent paid in advance at end of preceding month
4. Automatically add rent payments monthly as rent payment date passes
5. Integrate with existing event-driven architecture
6. Integrate with existing transaction system

---

## 🏗️ Architecture Design

### System Components
```
FRONTEND (React)
├── pages/Tenants.tsx (Extended)
├── components/RentPaymentForm.tsx (NEW)
├── components/RentPaymentList.tsx (NEW)
├── components/RentPaymentDetail.tsx (NEW)
├── components/TenantContractForm.tsx (NEW)
├── components/TenantContractList.tsx (NEW)
└── services/api.ts (Extended)

BACKEND (Node.js/Express)
├── server.js (Extended - new API endpoints)
├── server/rent-automation.js (NEW - automation module)
└── server/migrations/002_add_rent_payment_tables.js (NEW)

DATABASE (SQLite)
├── tenant_contracts (NEW TABLE)
├── rent_payments (NEW TABLE)
├── tenants (EXISTING)
└── transactions (EXISTING - link rent payments)
```

### Data Model

**tenant_contracts** table:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- tenant_id (INTEGER, FK to tenants)
- property_id (INTEGER, FK to properties)
- startDate (TEXT, ISO date)
- endDate (TEXT, ISO date, nullable)
- coldRent (REAL, NOT NULL)
- sideCosts (REAL, NOT NULL, DEFAULT 0)
- paymentDayOfMonth (INTEGER, 1-31, DEFAULT last day of previous month)
- isActive (INTEGER, DEFAULT 1)
- notes (TEXT)
- createdAt (TEXT, DEFAULT CURRENT_TIMESTAMP)
- updatedAt (TEXT, DEFAULT CURRENT_TIMESTAMP)

**rent_payments** table:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- tenant_contract_id (INTEGER, FK to tenant_contracts)
- date (TEXT, ISO date, NOT NULL)
- amount (REAL, warm rent amount)
- coldRentAmount (REAL)
- sideCostsAmount (REAL)
- status (TEXT, DEFAULT 'PENDING')
- paymentMethod (TEXT)
- transaction_id (INTEGER, FK to transactions)
- notes (TEXT)
- createdAt (TEXT, DEFAULT CURRENT_TIMESTAMP)
- updatedAt (TEXT, DEFAULT CURRENT_TIMESTAMP)

---

## 📊 Phase 5: Database Schema & Types (P0)
*Estimated Effort: 2-4 hours | Dependencies: None*

### Tasks
- [ ] Create migration file `server/migrations/002_add_rent_payment_tables.js`
- [ ] Define `tenant_contracts` table with all fields
- [ ] Define `rent_payments` table with all fields
- [ ] Add proper indexes for performance:
  - [ ] INDEX idx_tenant_contracts_tenant ON tenant_contracts(tenant_id)
  - [ ] INDEX idx_tenant_contracts_property ON tenant_contracts(property_id)
  - [ ] INDEX idx_tenant_contracts_active ON tenant_contracts(isActive)
  - [ ] INDEX idx_rent_payments_contract ON rent_payments(tenant_contract_id)
  - [ ] INDEX idx_rent_payments_date ON rent_payments(date)
  - [ ] INDEX idx_rent_payments_status ON rent_payments(status)
- [ ] Add foreign key constraints
- [ ] Add to `types.ts`:
  - [ ] `export enum RentPaymentStatus { PAID = 'PAID', PENDING = 'PENDING', OVERDUE = 'OVERDUE' }`
  - [ ] `export enum PaymentMethod { BANK_TRANSFER = 'BANK_TRANSFER', CASH = 'CASH', OTHER = 'OTHER' }`
  - [ ] `export interface TenantContract { id: EntityId; tenantId: EntityId; propertyId: EntityId; startDate: string; endDate?: string; coldRent: number; sideCosts: number; warmRent: number; paymentDayOfMonth: number; isActive: boolean; notes?: string; createdAt: string; updatedAt: string; }`
  - [ ] `export interface RentPayment { id: EntityId; tenantContractId: EntityId; date: string; amount: number; coldRentAmount: number; sideCostsAmount: number; status: RentPaymentStatus; paymentMethod?: PaymentMethod; transactionId?: EntityId; notes?: string; createdAt: string; updatedAt: string; }`
- [ ] Implement migration up() and down() functions
- [ ] Test migration on development database

---

## 🔌 Phase 6: Backend API Development (P0)
*Estimated Effort: 4-6 hours | Dependencies: Phase 5*

### API Endpoints

**Tenant Contracts:**
- [ ] GET `/api/tenant-contracts` - List all contracts
- [ ] GET `/api/tenant-contracts/:id` - Get specific contract
- [ ] POST `/api/tenant-contracts` - Create contract
- [ ] PUT `/api/tenant-contracts/:id` - Update contract
- [ ] DELETE `/api/tenant-contracts/:id` - Delete contract
- [ ] GET `/api/tenants/:tenantId/contracts` - Contracts for tenant

**Rent Payments:**
- [ ] GET `/api/rent-payments` - List all payments with optional filters
- [ ] GET `/api/rent-payments/:id` - Get specific payment
- [ ] POST `/api/rent-payments` - Record manual payment
- [ ] PUT `/api/rent-payments/:id` - Update payment
- [ ] DELETE `/api/rent-payments/:id` - Delete payment
- [ ] GET `/api/tenants/:tenantId/rent-payments` - Payments for tenant
- [ ] GET `/api/tenant-contracts/:contractId/rent-payments` - Payments for contract

### Implementation Tasks
- [ ] Add all endpoints to `server/server.js` with requireAuth
- [ ] Add input validation using existing validation utilities
- [ ] Add proper error handling with logError
- [ ] Map snake_case database fields to camelCase for frontend
- [ ] Map camelCase frontend fields to snake_case for database
- [ ] Implement helper functions:
  - [ ] `calculateWarmRent(coldRent, sideCosts)`
  - [ ] `getDefaultPaymentDay()` - returns last day of previous month
  - [ ] `checkRentPaymentDuplicate(tenantContractId, date)`

---

## ⚡ Phase 7: Automation Module (P0)
*Estimated Effort: 4-6 hours | Dependencies: Phase 5, Phase 6*

### File: server/rent-automation.js

**Setup:**
- [ ] Add file header and documentation
- [ ] Set up database connection to immopi.db
- [ ] Set up logs directory and log files
- [ ] Create logging functions: `logRentAction(message)`, `logRentError(error, details)`

**Database Helpers:**
- [ ] `getActiveTenantContracts()` - get all active contracts
- [ ] `getTenantContractById(id)` - get specific contract
- [ ] `getRentPaymentsForContract(contractId)` - get payments for contract
- [ ] `getAllTransactions()` - for duplicate checking
- [ ] `getAllCategories()` - for category lookup
- [ ] `createTransaction(tx)` - create transaction in DB
- [ ] `createRentPayment(payment)` - create rent payment record

**Date Utilities:**
- [ ] `getLastDayOfPreviousMonth(baseDate)` - returns last day of previous month
- [ ] `calculateNextPaymentDate(contract, fromDate)` - calculates next payment date
- [ ] `isContractActiveOnDate(contract, date)` - checks if contract is active
- [ ] `getDaysInMonth(year, month)` - helper for date calculations

**Core Automation:**
- [ ] `shouldCreatePayment(contract, paymentDate, today)` - determine if payment should be created
- [ ] `createRentPaymentForDate(contract, date, categories)` - create payment and transaction
- [ ] `processTenantContract(contract, today, existingTransactions, existingPayments, categories)` - process single contract
- [ ] `processRentPayments()` - main processing function
- [ ] `runRentAutomation()` - entry point for automation

**Scheduler:**
- [ ] `startRentScheduler()` - schedule daily at 1:00 AM Europe/Berlin
- [ ] Use node-cron for scheduling
- [ ] Add error handling for scheduler
- [ ] Log scheduler start/stop

**Integration:**
- [ ] Find "Rent (Warm)" category or fallback
- [ ] Create transaction with proper fields:
  - [ ] date: payment date
  - [ ] amount: warm rent
  - [ ] type: INCOME
  - [ ] category_id: Rent (Warm) category
  - [ ] property_id: from contract
  - [ ] description: "Rent Payment: {property name} - {month/year}"
  - [ ] isAutoGenerated: 1
- [ ] Link rent_payment to transaction via transaction_id
- [ ] Set payment status to PENDING for auto-generated
- [ ] Prevent duplicate checking

**Server Integration:**
- [ ] Import rent-automation in server.js
- [ ] Call startRentScheduler() when server starts
- [ ] Export runRentAutomation for manual triggering

**Testing:**
- [ ] Test automation independently
- [ ] Test with various contract configurations

---

## 🎨 Phase 8: Frontend Development (P0)
*Estimated Effort: 6-8 hours | Dependencies: Phase 6*

### API Client Extension (services/api.ts)

**Tenant Contract Methods:**
- [ ] `async getTenantContracts(): Promise<TenantContract[]>`
- [ ] `async getTenantContract(id: string): Promise<TenantContract>`
- [ ] `async createTenantContract(data: Omit<TenantContract, 'id'>): Promise<TenantContract>`
- [ ] `async updateTenantContract(id: string, data: Partial<TenantContract>): Promise<TenantContract>`
- [ ] `async deleteTenantContract(id: string): Promise<void>`
- [ ] `async getTenantContractsByTenant(tenantId: string): Promise<TenantContract[]>`

**Rent Payment Methods:**
- [ ] `async getRentPayments(): Promise<RentPayment[]>`
- [ ] `async getRentPayment(id: string): Promise<RentPayment>`
- [ ] `async createRentPayment(data: Omit<RentPayment, 'id'>): Promise<RentPayment>`
- [ ] `async updateRentPayment(id: string, data: Partial<RentPayment>): Promise<RentPayment>`
- [ ] `async deleteRentPayment(id: string): Promise<void>`
- [ ] `async getRentPaymentsByTenant(tenantId: string): Promise<RentPayment[]>`
- [ ] `async getRentPaymentsByContract(contractId: string): Promise<RentPayment[]>`

### New Components

**components/RentPaymentForm.tsx**
- [ ] Create form component
- [ ] Props: contract, payment?, onSubmit, onCancel
- [ ] Display contract info (tenant, property, rent amounts)
- [ ] Date picker for payment date (default: today)
- [ ] Display warm rent amount (read-only, from contract)
- [ ] Status selector (PAID/PENDING/OVERDUE)
- [ ] Payment method selector (BANK_TRANSFER/CASH/OTHER)
- [ ] Notes text area
- [ ] Submit and cancel buttons
- [ ] Form validation (required fields, valid dates)
- [ ] Loading state
- [ ] Error display

**components/RentPaymentList.tsx**
- [ ] Create list component
- [ ] Props: payments, onEdit, onDelete, onRefresh
- [ ] Table with columns: Date, Tenant, Property, Amount, Status, Payment Method, Actions
- [ ] Status badge with color coding (PAID=green, PENDING=yellow, OVERDUE=red)
- [ ] Sort by date (descending default)
- [ ] Filter by status
- [ ] Filter by date range
- [ ] Pagination support
- [ ] Empty state message
- [ ] Loading state

**components/RentPaymentDetail.tsx**
- [ ] Create detail modal
- [ ] Props: payment, contract, onClose, onEdit, onDelete
- [ ] Display all payment details
- [ ] Show linked transaction if exists
- [ ] Show calculation breakdown (cold rent + side costs = warm rent)
- [ ] Edit button
- [ ] Delete button with confirmation
- [ ] Close button

**components/TenantContractForm.tsx**
- [ ] Create form component
- [ ] Props: tenant, contract?, onSubmit, onCancel
- [ ] Property selector (from existing properties)
- [ ] Start date picker (required)
- [ ] End date picker (optional)
- [ ] Cold rent input (number, required)
- [ ] Side costs input (number, default 0)
- [ ] Warm rent display (auto-calculated: coldRent + sideCosts)
- [ ] Payment day of month selector (1-31, default: last day of previous month)
- [ ] Active toggle (default: true)
- [ ] Notes text area
- [ ] Form validation
- [ ] Loading state

**components/TenantContractList.tsx**
- [ ] Create list component
- [ ] Props: contracts, onEdit, onDelete, onViewPayments
- [ ] Card-based or table layout
- [ ] Show property name
- [ ] Show date range
- [ ] Show rent amounts (cold, side costs, warm)
- [ ] Show active status badge
- [ ] Action buttons (edit, delete, view payments)
- [ ] Empty state message

### Tenants.tsx Extension
- [ ] Add state:
  - [ ] `const [contracts, setContracts] = useState<TenantContract[]>([])`
  - [ ] `const [rentPayments, setRentPayments] = useState<RentPayment[]>([])`
  - [ ] `const [selectedTenantForRent, setSelectedTenantForRent] = useState<Tenant | null>(null)`
  - [ ] `const [selectedContract, setSelectedContract] = useState<TenantContract | null>(null)`
  - [ ] `const [loadingRent, setLoadingRent] = useState(false)`
  - [ ] `const [showContractModal, setShowContractModal] = useState(false)`
  - [ ] `const [showPaymentModal, setShowPaymentModal] = useState(false)`
  - [ ] `const [showPaymentListModal, setShowPaymentListModal] = useState(false)`
- [ ] Add useEffect hooks:
  - [ ] Load contracts when selectedTenantForRent changes
  - [ ] Load rent payments when selectedContract changes
- [ ] Add handlers:
  - [ ] `handleOpenRentManagement(tenant)`
  - [ ] `handleOpenPaymentForm(contract, payment?)`
  - [ ] `handleOpenPaymentList(contract)`
  - [ ] `handleCreateContract(data)`
  - [ ] `handleUpdateContract(id, data)`
  - [ ] `handleDeleteContract(id)`
  - [ ] `handleCreatePayment(data)`
  - [ ] `handleUpdatePayment(id, data)`
  - [ ] `handleDeletePayment(id)`
- [ ] Update tenant card:
  - [ ] Add "Manage Rent" button
  - [ ] Add rent payment status indicator
  - [ ] Show overdue payments count if any
- [ ] Add modals to Tenants.tsx:
  - [ ] Contract management modal
  - [ ] Payment recording modal
  - [ ] Payment list modal

### UI/UX
- [ ] Style new components to match existing design
- [ ] Add appropriate Lucide icons
- [ ] Ensure responsive design
- [ ] Add animations/transitions
- [ ] Add tooltips for calculated fields

---

## 🔗 Phase 9: Integration & Testing (P1)
*Estimated Effort: 4-6 hours | Dependencies: Phase 7, Phase 8*

### Backend Tests
- [ ] Test all API endpoints with Postman/curl
- [ ] Test each endpoint:
  - [ ] Happy path
  - [ ] Error cases (invalid input, not found, unauthorized)
  - [ ] Edge cases (empty results, special dates)
- [ ] Test automation module:
  - [ ] Run independently with test data
  - [ ] Test with contracts starting in past
  - [ ] Test with contracts ending
  - [ ] Test payment day edge cases
  - [ ] Verify no duplicates
- [ ] Test transaction integration:
  - [ ] Verify transactions created
  - [ ] Verify correct category
  - [ ] Verify correct amounts

### Frontend Tests
- [ ] Test API client methods
- [ ] Test data flow from backend to frontend
- [ ] Test form submissions
- [ ] Test form validation
- [ ] Test error handling display
- [ ] Verify authentication for all new endpoints
- [ ] Test UI responsiveness
- [ ] Test modal interactions

### End-to-End Tests
- [ ] Test complete workflows:
  - [ ] Create tenant → Create contract → View in list
  - [ ] Create contract → Wait/trigger automation → Verify payment created
  - [ ] Create contract → Record manual payment → View in list
  - [ ] View tenant → See rent summary
  - [ ] View payment list → Edit payment → Verify changes
  - [ ] View payment list → Mark as paid → Verify transaction linked
- [ ] Test multiple tenants:
  - [ ] Verify data isolation
  - [ ] Test switching between tenants
- [ ] Test contract lifecycle:
  - [ ] Active contract → payments generated
  - [ ] End contract → no more payments generated
- [ ] Test overdue detection:
  - [ ] Set payment date in past → verify OVERDUE status

---

## ✅ Phase 10: Validation & Finalization (P1)
*Estimated Effort: 2-4 hours | Dependencies: Phase 9*

### Code Review
- [ ] Self-review all new code
- [ ] Security review:
  - [ ] SQL injection prevention
  - [ ] XSS prevention in UI
  - [ ] Input validation
  - [ ] Authentication/authorization
- [ ] Performance review:
  - [ ] Database query optimization
  - [ ] Index usage
  - [ ] Memory usage in automation
- [ ] Code quality:
  - [ ] Consistent naming conventions
  - [ ] Proper error handling
  - [ ] Type safety
  - [ ] Code comments

### Testing
- [ ] Final manual testing
- [ ] Test automation overnight (if possible)
- [ ] Test with production-like data
- [ ] Test edge cases again
- [ ] Performance test with many contracts

### Documentation
- [ ] Update readme.md:
  - [ ] Add feature description
  - [ ] Explain rent payment workflow
  - [ ] Explain automation schedule
  - [ ] Add configuration options
- [ ] Add JSDoc comments to all new functions
- [ ] Add inline comments for complex logic
- [ ] Document API endpoints (if no Swagger)

### Cleanup
- [ ] Remove all debug console.log statements
- [ ] Remove commented-out code
- [ ] Fix any linting errors
- [ ] Verify all type annotations
- [ ] Verify all TODOs addressed or converted to issues

### Deployment Preparation
- [ ] Verify migration works on fresh database
- [ ] Create backup of production database
- [ ] Test migration on staging if available
- [ ] Prepare rollback plan

---

## 📊 Feature Implementation Summary

| Phase | Description | Effort | Priority | Dependencies |
|-------|-------------|--------|----------|--------------|
| 5 | Database Schema & Types | 2-4 hours | P0 | None |
| 6 | Backend API Development | 4-6 hours | P0 | Phase 5 |
| 7 | Automation Module | 4-6 hours | P0 | Phase 5, 6 |
| 8 | Frontend Development | 6-8 hours | P0 | Phase 6 |
| 9 | Integration & Testing | 4-6 hours | P1 | Phase 7, 8 |
| 10 | Validation & Finalization | 2-4 hours | P1 | Phase 9 |
| **Total** | | **22-34 hours** | | |

---

## 🎯 Feature Success Criteria

- [ ] Rent payments can be recorded manually in Tenants tab
- [ ] Warm rent is auto-calculated as cold rent + side costs
- [ ] Rent is by default paid in advance at end of preceding month
- [ ] Monthly rent payments are created automatically as dates pass
- [ ] Feature integrates seamlessly with existing event-driven architecture
- [ ] Feature integrates with existing transaction system
- [ ] All data is consistent between tables
- [ ] No duplicate transactions are created
- [ ] UI is intuitive and user-friendly
- [ ] All edge cases are handled gracefully

---

## ⚠️ Feature Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Database migration issues on production | Medium | High | Test migration on staging first. Create database backup before migration. Have rollback plan. |
| Automation creates duplicate transactions | Medium | High | Implement robust duplicate checking using tenant_contract_id + date. Test with historical data. |
| Date handling edge cases cause errors | High | Medium | Implement comprehensive date utility functions. Test all edge cases: Feb 30, year boundaries, month transitions. |
| Frontend-Backend data mismatch | Medium | Medium | Use TypeScript interfaces consistently. Add runtime validation in API layer. |
| Transaction linking breaks | Medium | Medium | Implement proper foreign key constraints. Test linking thoroughly. Add null checks. |
| Performance issues with many contracts | Low | Medium | Add proper indexes. Use efficient queries. Test with production-scale data. |
| Scheduler conflicts with existing schedulers | Low | Low | Follow existing scheduler pattern. Use separate cron job if needed. |

---

## 📝 Feature File Changes

### Files to Create (NEW)
- [ ] `server/migrations/002_add_rent_payment_tables.js` - Database migration
- [ ] `server/rent-automation.js` - Automation module
- [ ] `components/RentPaymentForm.tsx` - Manual payment form
- [ ] `components/RentPaymentList.tsx` - Payment list view
- [ ] `components/RentPaymentDetail.tsx` - Payment detail view
- [ ] `components/TenantContractForm.tsx` - Contract form
- [ ] `components/TenantContractList.tsx` - Contract list view

### Files to Modify (EXISTING)
- [ ] `types.ts` - Add RentPaymentStatus, PaymentMethod enums and TenantContract, RentPayment interfaces
- [ ] `server/server.js` - Add tenant contract and rent payment API endpoints
- [ ] `server/server.js` - Integrate rent-automation module
- [ ] `pages/Tenants.tsx` - Extend with rent payment UI and functionality
- [ ] `services/api.ts` - Add API client methods for contracts and payments

### Reference Files (for patterns)
- `server/mortgage-automation.js` - Automation pattern reference
- `server/recurring-automation.js` - Automation pattern reference
- `pages/Properties.tsx` - Complex entity management pattern
- `pages/RecurringPayments.tsx` - Similar functionality pattern
- `components/ui.tsx` - UI component patterns
- `server/utils/validation.js` - Validation utilities

---

## 🏷️ Tags

#rent-payments #tenants #automation #feature #p0 #p1
