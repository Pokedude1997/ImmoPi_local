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
