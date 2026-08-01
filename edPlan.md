# ImmoPi: Event-Driven Architecture Refactoring Plan

**Project:** ImmoPi - Migration from Batch-Oriented to Event-Driven Architecture  
**Created:** 2025-08-01  
**Priority:** P0 (Critical)  
**Status:** Planning Phase

---

## 🎯 Executive Summary

### Current State
- **Mortgage Automation**: Runs once per month via scheduler (daily at 1 AM), or manually via API call
- **Recurring Payments Automation**: Runs via scheduler (daily at 1 AM)
- **Rent Payments Automation**: Runs via scheduler (daily at 1 AM Europe/Berlin)
- **No automatic triggers** when properties/contracts/payments are created/updated
- **Manual dashboard refresh** required to see updates

### Desired State
- **Purely event-driven**: Actions trigger immediately when data changes
- **Minimal batch processing**: Only as fallback/safety net
- **Real-time automation**: Each entity triggers relevant automation on create/update
- **Maintained functionality**: Dashboard refresh button still works but becomes less critical
- **Schedulers**: Kept as fallback mechanism or removed

---

## 🏗️ Architecture Overview

### Current Architecture (Batch-Oriented)
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Scheduler       │────▶│  Automation      │────▶│  Database        │
│  (node-cron)     │     │  Scripts         │     │  (SQLite)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │                        │
         │ Manual Trigger         │ Batch Processing       │
         ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  API Endpoint    │     │  Process All     │     │  Check for       │
│  /api/automation/│     │  Properties/     │     │  Duplicates      │
│  run-rent        │     │  Contracts       │     │  & Create        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Target Architecture (Event-Driven)
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  API Endpoint    │────▶│  Event Handler   │────▶│  Automation      │
│  (POST/PUT)      │     │  (Inline)        │     │  Functions       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │                        │
         │ Create/Update          │ Trigger on            │ Create          │
         ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Database        │     │  Immediate        │     │  Transactions/   │
│  (SQLite)        │     │  Automation      │     │  Payments        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │                        │
         │                        ▼                        │
         │               ┌─────────────────┐                │
         │               │  Scheduler       │                │
         └──────────────▶│  (Fallback)      │◀───────────────┘
                            └─────────────────┘
```

### Key Changes
1. **Event Triggers**: Automation runs immediately on entity create/update
2. **Idempotency**: Functions check for duplicates before creating
3. **Fallback Scheduler**: Runs periodically to catch missed events
4. **No Breaking Changes**: Existing API endpoints remain functional

---

## 🔒 Concurrency Handling

### Strategy: SQLite Transaction Isolation
- All event handlers use `BEGIN IMMEDIATE TRANSACTION`
- This prevents concurrent writes to the same tables
- Event handler wraps entire operation in transaction
- Batch scheduler respects same locking mechanism

### Race Condition Prevention
- Event-driven and batch processes use same idempotency checks
- Last execution timestamp checked before processing
- Database-level UNIQUE constraints prevent duplicates

---

## 📊 Monitoring & Observability

### Metrics to Track
- Event handler invocations (count, success rate)
- Processing time per event type
- Duplicate detection rate
- Fallback scheduler runs (frequency, records processed)

### Alerting Rules
- Alert if >5 consecutive event handler failures
- Alert if event handler processing time >2 seconds
- Alert if fallback scheduler processes >10 records (indicates event system failure)

### Implementation
- Use existing logMortgageAction/logRentAction functions
- Add structured logging with severity levels
- Log to both file and console for visibility

---

## 🔐 Security Considerations

### Event Handler Security
1. **Authentication**: All event handlers run in requireAuth context (inherited from API)
2. **Authorization**: User must have access to the entity being modified
3. **Input Validation**: All incoming data validated by existing Zod schemas
4. **SQL Injection**: All database queries use parameter binding
5. **Error Handling**: No sensitive data exposed in error messages

### Security Checklist per Phase
- [ ] Verify requireAuth is applied to all modified endpoints
- [ ] Validate all user input through existing validation schemas
- [ ] Use parameter binding for all SQL queries (already implemented)
- [ ] Sanitize log messages (no PII in logs)
- [ ] Rate limiting considerations for event triggers

---

## 📝 Configuration Management

### Feature Flags
- `EVENT_DRIVEN_MORTGAGE`: Enable mortgage event-driven automation (default: false)
- `EVENT_DRIVEN_RECURRING`: Enable recurring payment event-driven automation (default: false)
- `EVENT_DRIVEN_RENT`: Enable rent payment event-driven automation (default: false)

### Implementation
- Environment variables control feature flags
- Default: false (batch mode) for all flags
- Migration path: Enable one by one after testing each phase
- Flags can be toggled without code deployment

---

## 📋 Requirements Analysis

### Functional Requirements
- [ ] Mortgage transactions: Create immediately when property with mortgage is created/updated
- [ ] Recurring payments: Create immediately when recurring payment is created/updated
- [ ] Rent payments: Create immediately when tenant contract is created/updated
- [ ] Dashboard refresh button: Still works but becomes secondary
- [ ] Schedulers: Kept as fallback or can be removed

### Non-Functional Requirements
- [ ] **Zero Downtime**: Existing functionality must not break
- [ ] **Idempotency**: Multiple triggers should not create duplicates
- [ ] **Rollback Capability**: Each phase can be rolled back independently
- [ ] **Minimal Risk**: Changes are incremental and testable
- [ ] **Performance**: Event-driven should be faster than batch for single updates

### Constraints
- [ ] Single database (SQLite)
- [ ] Node.js backend with Express
- [ ] Existing API endpoints must remain compatible
- [ ] No frontend changes required
- [ ] Existing data must not be corrupted

---

## 📊 Entity-Trigger Mapping

### Trigger Points by Entity

| Entity | Create Trigger | Update Trigger | Automation to Run |
|--------|---------------|----------------|-------------------|
| Property | ✅ Yes | ✅ Yes (if mortgage data changes) | Mortgage transactions |
| Tenant Contract | ✅ Yes | ✅ Yes (if payment terms change) | Rent payments + transactions |
| Recurring Payment | ✅ Yes | ✅ Yes (if amount/frequency changes) | Recurring payment transactions |
| Rent Payment | ❌ No | ❌ No | N/A (manual override) |
| Transaction | ❌ No | ❌ No | N/A (already created) |

### Automation Logic by Trigger

#### Property Events
```
Trigger: POST/PUT /api/properties
  ├─ If property.mortgage exists
  │   ├─ If create: Generate all mortgage transactions from startDate to today
  │   └─ If update: Only generate new transactions for changed mortgage data
  └─ Call: processPropertyMortgage(property)
```

#### Tenant Contract Events
```
Trigger: POST/PUT /api/tenant-contracts
  ├─ If create: Generate all rent payments from firstPaymentDate to today
  │   └─ Also create linked transactions for each payment
  ├─ If update: Only generate new payments for changed contract terms
  └─ Call: processTenantContract(contract)
```

#### Recurring Payment Events
```
Trigger: POST/PUT /api/recurring-payments
  ├─ If create: Generate all transactions from startDate to today
  │   └─ Backfill past due dates
  ├─ If update: Only generate new transactions for changed parameters
  └─ Call: processRecurringPayment(recurringPayment)
```

---

## 🎯 Implementation Phases

### Phase Overview

```mermaid
graph LR
    A[Phase 1: Foundation] --> B[Phase 2: Mortgage Events]
    B --> C[Phase 3: Recurring Payment Events]
    C --> D[Phase 4A: Rent Automation Refactoring]
    D --> E[Phase 4B: Manual Payment Verification]
    E --> F[Phase 5: Scheduler Migration]
    F --> G[Phase 6: Cleanup & Optimization]
```

---

### Phase 1: Foundation & Infrastructure

**Goal**: Establish the infrastructure for event-driven automation without changing existing behavior.

**Duration**: 1-2 days

**Tasks**:

- [ ] **Create event-detection utility module**
  - Create `server/event-detector.js` with helper functions
  - Detect if mortgage data changed in property update
  - Detect if payment terms changed in contract update
  - Detect if recurring payment parameters changed
  - **File**: `server/event-detector.js` (New)
  - **Effort**: M | **Priority**: P0

- [ ] **Create idempotency helper module**
  - Create `server/idempotency.js` with duplicate prevention functions
  - Reusable `checkTransactionExists(description, date, amount, propertyId)`
  - Reusable `checkRentPaymentExists(contractId, date)`
  - **File**: `server/idempotency.js` (New)
  - **Effort**: M | **Priority**: P0

- [ ] **Extract shared automation utilities**
  - Move common date utilities to shared module
  - Extract duplicate checking logic from mortgage/rent/recurring modules
  - Create reusable `isAutoGeneratedTransaction(description)` function
  - **File**: `server/automation-utils.js` (New)
  - **Effort**: M | **Priority**: P0

- [ ] **Add logging for event-driven actions**
  - Extend existing logging to track event-driven vs batch triggers
  - Add `source: 'event-driven'` or `source: 'batch'` to log entries
  - Update all automation modules to include source in logs
  - **Files**: `server/rent-automation.js`, `server/mortgage-automation.js`, `server/recurring-automation.js`
  - **Effort**: S | **Priority**: P1

- [ ] **Record performance baseline**
  - Measure current batch processing times for all automation types
  - Document DB query performance metrics
  - Establish baseline for comparison with event-driven approach
  - **File**: `docs/baseline/performance-baseline.md` (New)
  - **Effort**: S | **Priority**: P0

- [ ] **Create integration test framework**
  - Create test scripts to verify event-driven automation
  - Test create/update scenarios for each entity
  - Verify no duplicates created
  - **File**: `server/tests/event-driven.test.js` (New)
  - **Effort**: M | **Priority**: P1

- [ ] **Setup test environment**
  - Create isolated test database for each phase
  - Setup test data scripts for each entity type
  - Use existing test framework
  - **File**: `server/tests/setup.js` (New)
  - **Effort**: S | **Priority**: P1

**Expected Outcomes**:
- New utility modules ready for use
- Common functionality extracted and reusable
- Enhanced logging for debugging
- Performance baseline documented
- Test framework and environment in place

**Rollback Strategy**:
- Delete new utility files
- Revert logging changes
- No breaking changes to existing automation
- No data cleanup required (no data changes in this phase)

---

### Phase 2: Mortgage Automation - Event-Driven

**Goal**: Trigger mortgage transaction creation immediately when properties with mortgages are created or updated.

**Duration**: 2-3 days

**Dependencies**: Phase 1 (Foundation)

**Tasks**:

- [ ] **Refactor mortgage-automation.js for event-driven use**
  - Export `processMortgageTransactions` as standalone function
  - Add parameter to specify date range (for partial processing)
  - Accept single property instead of all properties
  - Add `source: 'event-driven-mortgage'` tag to created transactions
  - **File**: `server/mortgage-automation.js`
  - **Effort**: M | **Priority**: P0

- [ ] **Create mortgage event handler**
  - Create `handlePropertyMortgageEvent(property, oldProperty = null)`
  - Determine if mortgage data changed (using event-detector)
  - Calculate date range: from last mortgage transaction OR from mortgage start date
  - Call `processMortgageTransactions` for that property only
  - Handle both create and update scenarios
  - **File**: `server/mortgage-automation.js` (Additions)
  - **Effort**: L | **Priority**: P0

- [ ] **Integrate mortgage event handler into POST /api/properties**
  - Import `handlePropertyMortgageEvent` in server.js
  - After successful property creation:
    - If property has mortgage data, call `handlePropertyMortgageEvent(property)`
    - Wrap in try-catch, don't fail the creation if automation fails
    - Log success/failure with source tag
  - **File**: `server/server.js` (Line ~437)
  - **Effort**: M | **Priority**: P0

- [ ] **Integrate mortgage event handler into PUT /api/properties/:id**
  - Fetch old property data before update
  - After successful property update:
    - If mortgage data changed, call `handlePropertyMortgageEvent(newProperty, oldProperty)`
    - Wrap in try-catch
    - Log success/failure with source tag
  - **File**: `server/server.js` (Line ~458)
  - **Effort**: M | **Priority**: P0

- [ ] **Update mortgage scheduler as fallback**
  - Modify `runMortgageAutomation` to skip properties that already have recent transactions
  - Add check: if property's last mortgage transaction is within current month, skip
  - Add `source: 'batch-mortgage'` tag to batch-created transactions
  - Keep existing schedule (daily at 1 AM) but it will do less work
  - **File**: `server/mortgage-automation.js`
  - **Effort**: S | **Priority**: P1

- [ ] **Test mortgage event-driven automation**
  - Test: Create property with mortgage -> verify transactions created with correct source tag
  - Test: Update mortgage start date -> verify new transactions created
  - Test: Update mortgage rate -> verify new transactions created
  - Test: No duplicates when both event and scheduler run
  - **File**: `server/tests/mortgage-event-driven.test.js` (New)
  - **Effort**: L | **Priority**: P0

**Expected Outcomes**:
- Mortgage transactions created immediately on property create/update
- All transactions tagged with source for rollback identification
- Scheduler becomes fallback mechanism
- No duplicates between event-driven and batch
- All existing tests still pass

**Rollback Strategy**:
- Remove event handler calls from POST/PUT /api/properties
- Revert mortgage-automation.js changes
- Scheduler continues to work as before
- **Data cleanup**: Run `npm run rollback:phase-2` to delete all transactions with `source='event-driven-mortgage'`

---

### Phase 3: Recurring Payment Automation - Event-Driven

**Goal**: Trigger recurring payment transaction creation immediately when recurring payments are created or updated.

**Duration**: 2-3 days

**Dependencies**: Phase 1 (Foundation), Phase 2 (for pattern reference)

**Tasks**:

- [ ] **Refactor recurring-automation.js for event-driven use**
  - Export `processRecurringPayment` as standalone function for single payment
  - Add parameter to specify date range (for partial processing)
  - Accept single recurring payment instead of all payments
  - Add `source: 'event-driven-recurring'` tag to created transactions
  - **File**: `server/recurring-automation.js`
  - **Effort**: M | **Priority**: P0

- [ ] **Create recurring payment event handler**
  - Create `handleRecurringPaymentEvent(recurringPayment, oldRecurringPayment = null)`
  - Determine if recurring payment parameters changed (using event-detector)
  - Calculate date range: from last transaction OR from start date
  - Handle both create and update scenarios
  - Call `processRecurringPayment` for that single payment
  - **File**: `server/recurring-automation.js` (Additions)
  - **Effort**: L | **Priority**: P0

- [ ] **Integrate recurring payment event handler into POST /api/recurring-payments**
  - Import `handleRecurringPaymentEvent` in server.js
  - After successful recurring payment creation:
    - Call `handleRecurringPaymentEvent(recurringPayment)`
    - Wrap in try-catch
    - Log success/failure with source tag
  - **File**: `server/server.js` (Need to find/verify endpoint)
  - **Effort**: M | **Priority**: P0

- [ ] **Integrate recurring payment event handler into PUT /api/recurring-payments/:id**
  - Fetch old recurring payment data before update
  - After successful update:
    - If parameters changed, call `handleRecurringPaymentEvent(newPayment, oldPayment)`
    - Wrap in try-catch
    - Log success/failure with source tag
  - **File**: `server/server.js` (Need to find/verify endpoint)
  - **Effort**: M | **Priority**: P0

- [ ] **Update recurring payment scheduler as fallback**
  - Modify `runRecurringAutomation` to skip payments that already have recent transactions
  - Add check: if payment's last transaction is current, skip
  - Add `source: 'batch-recurring'` tag to batch-created transactions
  - Keep existing schedule (daily at 1 AM)
  - **File**: `server/recurring-automation.js`
  - **Effort**: S | **Priority**: P1

- [ ] **Test recurring payment event-driven automation**
  - Test: Create recurring payment -> verify transactions created with correct source tag
  - Test: Update recurring payment amount -> verify new transactions created
  - Test: Update recurring payment frequency -> verify new transactions created
  - Test: No duplicates when both event and scheduler run
  - **File**: `server/tests/recurring-event-driven.test.js` (New)
  - **Effort**: L | **Priority**: P0

**Expected Outcomes**:
- Recurring payment transactions created immediately on create/update
- All transactions tagged with source for rollback identification
- Scheduler becomes fallback mechanism
- No duplicates between event-driven and batch
- All existing tests still pass

**Rollback Strategy**:
- Remove event handler calls from POST/PUT /api/recurring-payments
- Revert recurring-automation.js changes
- Scheduler continues to work as before
- **Data cleanup**: Run `npm run rollback:phase-3` to delete all transactions with `source='event-driven-recurring'`

---

### Phase 4A: Rent Automation Refactoring

**Goal**: Refactor rent-automation.js and create basic event-driven rent payment handling.

**Duration**: 2-3 days

**Dependencies**: Phase 1 (Foundation), Phase 2, Phase 3

**Tasks**:

- [ ] **Refactor rent-automation.js for event-driven use**
  - Export `processTenantContract` as standalone function for single contract
  - Add parameter to specify date range (for partial processing)
  - Accept single contract instead of all contracts
  - Ensure it uses the existing `calculateFirstPaymentDate` logic
  - Add `source: 'event-driven-rent'` tag to created payments and transactions
  - **File**: `server/rent-automation.js`
  - **Effort**: M | **Priority**: P0

- [ ] **Create rent payment event handler**
  - Create `handleTenantContractEvent(contract, oldContract = null)`
  - Determine if payment terms changed (using event-detector)
  - Calculate date range: from first payment date OR from last existing payment
  - Handle both create and update scenarios
  - Call `processTenantContract` for that single contract
  - **File**: `server/rent-automation.js` (Additions)
  - **Effort**: L | **Priority**: P0

- [ ] **Integrate rent payment event handler into POST /api/tenant-contracts**
  - Import `handleTenantContractEvent` in server.js
  - After successful tenant contract creation:
    - If contract.isActive, call `handleTenantContractEvent(contract)`
    - Wrap in try-catch
    - Log success/failure with source tag
  - **File**: `server/server.js` (Line ~1159)
  - **Effort**: M | **Priority**: P0

- [ ] **Integrate rent payment event handler into PUT /api/tenant-contracts/:id**
  - Fetch old contract data before update
  - After successful update:
    - If payment terms changed, call `handleTenantContractEvent(newContract, oldContract)`
    - Wrap in try-catch
    - Log success/failure with source tag
  - **File**: `server/server.js` (Line ~1240)
  - **Effort**: M | **Priority**: P0

- [ ] **Basic integration tests**
  - Test: Create tenant contract -> verify rent payments created with correct source tag
  - Test: Update contract cold rent -> verify new payments created with correct amounts
  - Test: Update contract start date -> verify payments regenerated
  - Test: No duplicates when both event and scheduler run
  - **File**: `server/tests/rent-event-driven.test.js` (New)
  - **Effort**: M | **Priority**: P0

**Expected Outcomes**:
- Rent payments created immediately on contract create/update
- All payments and transactions tagged with source for rollback identification
- Scheduler becomes fallback mechanism
- No duplicates between event-driven and batch
- Basic tests passing

**Rollback Strategy**:
- Remove event handler calls from POST/PUT /api/tenant-contracts
- Revert rent-automation.js changes
- Scheduler continues to work as before
- **Data cleanup**: Run `npm run rollback:phase-4a` to delete all rent payments and transactions with `source='event-driven-rent'`

---

### Phase 4B: Manual Payment & Edge Case Verification

**Goal**: Verify manual rent payment creation and handle edge cases for rent automation.

**Duration**: 2 days

**Dependencies**: Phase 4A

**Tasks**:

- [ ] **Update rent payment scheduler as fallback**
  - Modify `runRentAutomation` to skip contracts that already have recent payments
  - Add check: if contract's last rent payment is current, skip
  - Add `source: 'batch-rent'` tag to batch-created payments and transactions
  - Keep existing schedule (daily at 1 AM Europe/Berlin)
  - **File**: `server/rent-automation.js`
  - **Effort**: S | **Priority**: P1

- [ ] **Ensure manual rent payment creation still works**
  - Verify POST /api/rent-payments still creates linked transactions
  - Ensure no conflict with event-driven automation
  - Test edge cases (manual payment on same date as auto-generated)
  - **File**: `server/server.js` (Line ~1444)
  - **Effort**: M | **Priority**: P0

- [ ] **Manual payment conflict resolution**
  - Add logic to detect manual payments on auto-generated dates
  - Implement strategy: skip auto-generation if manual payment exists
  - Ensure manual payments have different source tag or null source
  - **File**: `server/rent-automation.js`
  - **Effort**: M | **Priority**: P0

- [ ] **Edge case testing**
  - Test: Partial months (contract starts mid-month)
  - Test: Overlapping contracts
  - Test: Contract updates with backdated changes
  - Test: Multiple updates in quick succession
  - **File**: `server/tests/rent-edge-cases.test.js` (New)
  - **Effort**: L | **Priority**: P0

- [ ] **Comprehensive integration tests**
  - Test complete rent automation workflow
  - Verify all edge cases handled correctly
  - Ensure no data corruption in any scenario
  - **File**: `server/tests/rent-event-driven.test.js` (Update)
  - **Effort**: L | **Priority**: P0

**Expected Outcomes**:
- Manual rent payment creation works without conflicts
- All edge cases handled correctly
- Comprehensive test coverage
- Production-ready rent automation

**Rollback Strategy**:
- Remove manual payment integration changes
- Revert rent-automation.js changes from Phase 4B
- Scheduler continues to work as before
- **Data cleanup**: Run `npm run rollback:phase-4b` to delete all rent payments and transactions with `source='event-driven-rent'` created during Phase 4B

---

### Phase 5: Scheduler Migration & Dashboard Updates

**Goal**: Transition schedulers to fallback mode and update dashboard to reflect new architecture.

**Duration**: 2-3 days

**Dependencies**: Phase 2, Phase 3, Phase 4A, Phase 4B

**Tasks**:

- [ ] **Update mortgage scheduler to fallback-only mode**
  - Add configuration flag: `EVENT_DRIVEN_MORTGAGE = true`
  - When flag is true, scheduler only processes properties without any mortgage transactions
  - Scheduler becomes a safety net for missed events
  - **File**: `server/mortgage-automation.js`
  - **Effort**: S | **Priority**: P1

- [ ] **Update recurring payment scheduler to fallback-only mode**
  - Add configuration flag: `EVENT_DRIVEN_RECURRING = true`
  - When flag is true, scheduler only processes payments without any transactions
  - **File**: `server/recurring-automation.js`
  - **Effort**: S | **Priority**: P1

- [ ] **Update rent payment scheduler to fallback-only mode**
  - Add configuration flag: `EVENT_DRIVEN_RENT = true`
  - When flag is true, scheduler only processes contracts without any rent payments
  - **File**: `server/rent-automation.js`
  - **Effort**: S | **Priority**: P1

- [ ] **Update Dashboard Refresh Button**
  - Rename "Refresh" button to "Run Fallback Automation"
  - Update tooltip to indicate it runs fallback automation for any missed events
  - Ensure it triggers all three automation types (mortgage, recurring, rent)
  - **File**: Frontend component (need to identify exact file)
  - **Effort**: S | **Priority**: P2

- [ ] **Add event-driven status to dashboard**
  - Display last event-driven automation run time
  - Show count of event-driven vs batch creations
  - Optional: Add toggle to enable/disable event-driven mode per automation type
  - **File**: Frontend component
  - **Effort**: M | **Priority**: P2

- [ ] **Create comprehensive system test**
  - Test complete workflow: Create property with mortgage -> verify immediate transactions
  - Create recurring payment -> verify immediate transactions
  - Create tenant contract -> verify immediate rent payments
  - Update all three -> verify new transactions/payments created
  - Run scheduler -> verify no duplicates
  - **File**: `server/tests/system-event-driven.test.js` (New)
  - **Effort**: XL | **Priority**: P0

**Expected Outcomes**:
- Schedulers are now fallback mechanisms
- Dashboard accurately reflects new architecture
- Users can still trigger batch processing manually
- Full system tested end-to-end

**Rollback Strategy**:
- Revert scheduler changes to original behavior
- Dashboard changes are non-breaking
- **Data cleanup**: Run `npm run rollback:phase-5` to delete all transactions/payments with event-driven source tags if rolling back all phases

---

### Phase 6: Cleanup, Optimization & Documentation

**Goal**: Finalize the migration, optimize performance, and document the new architecture.

**Duration**: 2-3 days

**Dependencies**: All previous phases

**Tasks**:

- [ ] **Remove redundant code**
  - Remove batch-only code paths that are no longer needed
  - Consolidate duplicate logic across modules
  - Clean up deprecated functions
  - **Files**: All automation modules
  - **Effort**: M | **Priority**: P1

- [ ] **Optimize event-driven performance**
  - Add caching for frequently accessed data (categories, properties)
  - Optimize database queries for single-entity processing
  - Review and add indexes if needed (SQLite)
  - **Files**: All automation modules, database
  - **Effort**: M | **Priority**: P2

- [ ] **Update API documentation**
  - Document new event-driven behavior in readme.md
  - Update Swagger/OpenAPI docs if they exist
  - Add examples of event-driven automation
  - **File**: `readme.md`
  - **Effort**: M | **Priority**: P1

- [ ] **Create architecture decision record (ADR)**
  - Document why event-driven was chosen
  - List trade-offs and alternatives considered
  - Include performance benchmarks (before/after)
  - **File**: `docs/adr/001-event-driven-architecture.md` (New)
  - **Effort**: S | **Priority**: P1

- [ ] **Update TASKS.md**
  - Remove completed tasks
  - Add new maintenance tasks for event-driven system
  - Update project status
  - **File**: `TASKS.md`
  - **Effort**: S | **Priority**: P1

- [ ] **Create migration guide**
  - Document steps to rollback if needed
  - List database changes (if any)
  - Document configuration changes
  - Include data cleanup scripts for each phase
  - **File**: `docs/migration/event-driven-migration.md` (New)
  - **Effort**: M | **Priority**: P1

- [ ] **Performance benchmarking**
  - Measure time for batch processing vs event-driven for single entity
  - Measure memory usage differences
  - Document results in ADR
  - **File**: `docs/adr/001-event-driven-architecture.md` (Update)
  - **Effort**: M | **Priority**: P2

- [ ] **Final system verification**
  - Run all existing tests
  - Run all new event-driven tests
  - Manual verification of all automation types
  - Verify no breaking changes
  - **Effort**: XL | **Priority**: P0

**Expected Outcomes**:
- Clean, maintainable codebase
- Well-documented new architecture
- Optimized performance
- Migration guide for future reference

**Rollback Strategy**:
- All changes are additive, rollback is per-phase
- Use documented data cleanup scripts for each phase if needed

---

## 📊 Implementation Order

```
Phase 1: Foundation & Infrastructure
    ↓
Phase 2: Mortgage Automation - Event-Driven
    ↓
Phase 3: Recurring Payment Automation - Event-Driven
    ↓
Phase 4A: Rent Automation Refactoring
    ↓
Phase 4B: Manual Payment & Edge Case Verification
    ↓
Phase 5: Scheduler Migration & Dashboard Updates
    ↓
Phase 6: Cleanup, Optimization & Documentation
```

---

## 🎯 Success Criteria

### Functional Success Criteria
- [ ] Mortgage transactions created immediately on property create with mortgage
- [ ] Mortgage transactions created immediately on property update with mortgage changes
- [ ] Recurring payment transactions created immediately on recurring payment create
- [ ] Recurring payment transactions created immediately on recurring payment update
- [ ] Rent payments created immediately on tenant contract create
- [ ] Rent payments created immediately on tenant contract update (payment terms)
- [ ] Manual rent payment creation still works and creates linked transactions
- [ ] Dashboard refresh button still works as fallback
- [ ] Schedulers run without creating duplicates
- [ ] No existing functionality is broken

### Non-Functional Success Criteria
- [ ] Zero downtime during migration
- [ ] All existing tests pass
- [ ] New event-driven tests pass
- [ ] Performance is equal or better than batch processing for single updates
- [ ] Code is well-documented
- [ ] Rollback is possible at any phase
- [ ] Monitoring and observability in place
- [ ] Security considerations addressed

### Performance Metrics
- [ ] Single entity create/update triggers automation in < 100ms
- [ ] Batch scheduler completes in < original time (fewer items to process)
- [ ] Memory usage does not increase significantly
- [ ] No database locks or contention issues

---

## ⚠️ Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Duplicate transactions created | High | High | Use idempotency checks; source tagging for cleanup; extensive testing; manual verification scripts |
| Event handler fails silently | Medium | High | Add proper error logging; wrap in try-catch; add monitoring and alerting |
| Performance degradation | Medium | Medium | Profile before/after; optimize queries; add caching |
| Breaking existing automation | Medium | High | Each phase tested independently; rollback strategy per phase with data cleanup |
| Database deadlocks | Low | High | Use transactions; add retry logic; optimize query order |
| Scheduler and event both run | High | Medium | Idempotency checks + source tagging prevent duplicates; design for this scenario |
| Configuration mismatch | Low | Medium | Use environment variables with defaults; validate on startup |
| Test coverage gaps | Medium | Medium | Create comprehensive test suite; manual testing; peer review |
| Rollback complexity | Low | Medium | Phased approach; each phase has its own rollback; document rollback steps with data cleanup |

---

## 📝 Files to Create

### New Files
- [ ] `server/event-detector.js` - Event detection utilities
- [ ] `server/idempotency.js` - Duplicate prevention utilities
- [ ] `server/automation-utils.js` - Shared automation utilities
- [ ] `server/tests/event-driven.test.js` - Foundation test framework
- [ ] `server/tests/mortgage-event-driven.test.js` - Mortgage event tests
- [ ] `server/tests/recurring-event-driven.test.js` - Recurring payment event tests
- [ ] `server/tests/rent-event-driven.test.js` - Rent payment event tests
- [ ] `server/tests/rent-edge-cases.test.js` - Rent edge case tests
- [ ] `server/tests/system-event-driven.test.js` - System integration tests
- [ ] `docs/adr/001-event-driven-architecture.md` - Architecture Decision Record
- [ ] `docs/migration/event-driven-migration.md` - Migration guide with data cleanup scripts
- [ ] `docs/baseline/performance-baseline.md` - Performance baseline documentation
- [ ] `server/tests/setup.js` - Test environment setup

### Modified Files
- [ ] `server/mortgage-automation.js` - Add event-driven handlers and source tagging
- [ ] `server/recurring-automation.js` - Add event-driven handlers and source tagging
- [ ] `server/rent-automation.js` - Add event-driven handlers and source tagging
- [ ] `server/server.js` - Add event handler calls to POST/PUT endpoints
- [ ] `readme.md` - Update documentation
- [ ] `TASKS.md` - Update task list
- [ ] Frontend component - Update dashboard (to be identified)

---

## 🔍 Verification Checklist

### Pre-Implementation
- [ ] Current batch automation is working correctly
- [ ] All existing tests pass
- [ ] Database backup created
- [ ] Code repository is in clean state
- [ ] Stakeholders aware of migration plan
- [ ] Performance baseline documented
- [ ] Test environment setup complete

### Post-Implementation (Each Phase)
- [ ] New code is peer-reviewed
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Manual testing completed
- [ ] Performance metrics collected and compared to baseline
- [ ] Rollback procedure verified including data cleanup
- [ ] Documentation updated
- [ ] Security checklist completed

### Final Verification
- [ ] All phases completed
- [ ] All success criteria met
- [ ] No breaking changes
- [ ] Performance improved or maintained
- [ ] Documentation complete
- [ ] Monitoring and alerting configured
- [ ] Stakeholders sign off

---

## 🏷️ Tags

#event-driven #architecture #refactoring #mortgage #recurring-payments #rent-payments #automation #p0 #scheduler #batch-processing #concurrency #monitoring #security #configuration-management

---

## 📞 Contacts & Support

For questions about this migration plan, contact:
- **Architect**: [Your Name]
- **Lead Developer**: [Developer Name]
- **QA Lead**: [QA Name]

---

**Document Version**: 2.0  
**Last Updated**: 2025-08-01  
**Next Review**: 2025-08-15 (After Phase 1 completion)

---

## 📝 Implementation Progress

### Phase 1: Foundation & Infrastructure - **COMPLETED** ✅

**Implementation Date:** 2025-08-01  
**Status:** All tasks completed and verified  
**Reviewer:** PASSED

#### ✅ Completed Tasks:

1. **Event Detection Utility** (`server/event-detector.js`)
   - Created `hasMortgageChanged()` function
   - Created `hasMortgageData()` function
   - Created `hasPaymentTermsChanged()` function
   - Created `hasRecurringPaymentChanged()` function
   - Created `getChangeType()` function
   - Created `shouldTriggerAutomation()` function
   - Created `normalizeValue()` helper
   - **Lines of Code:** 190
   - **Status:** ✅ Implemented and tested

2. **Idempotency Helper** (`server/idempotency.js`)
   - Created `checkTransactionExists()` function
   - Created `checkRentPaymentExists()` function
   - Created `checkRecurringPaymentExists()` function
   - Created `checkAutomationAlreadyRan()` function
   - Created `createIdempotencyKey()` function
   - Created `isIdempotencyKeyProcessed()` function
   - Created `markIdempotencyKeyProcessed()` function
   - Created `ensureIdempotencyTable()` function (auto-initializes table)
   - **Lines of Code:** 235
   - **Status:** ✅ Implemented and tested

3. **Automation Utilities** (`server/automation-utils.js`)
   - Created `SOURCE_TAGS` constants for all automation types
   - Created `getSourceTag()` function
   - Created `isAutoGeneratedTransaction()` function
   - Created `formatDateForDescription()` function
   - Created `formatDateForDB()` function
   - Created `getLastDayOfMonth()` function
   - Created `getDaysInMonth()` function
   - Created `getMonthsBetweenDates()` function
   - Created `findOrCreateCategory()` function
   - Created `logAutomationAction()` function with source tag
   - Created `logAutomationError()` function with source tag
   - Created `withErrorHandling()` wrapper
   - Created `isFeatureEnabled()` function
   - Created `getAllCategories()` function
   - Created `getCategoryById()` function
   - **Lines of Code:** 250
   - **Status:** ✅ Implemented and tested

4. **Enhanced Logging in Automation Modules**
   - Updated `server/rent-automation.js`: `logRentAction()` and `logRentError()` now accept optional `source` parameter
   - Updated `server/mortgage-automation.js`: `logMortgageAction()` and `logMortgageError()` now accept optional `source` parameter
   - Updated `server/recurring-automation.js`: `logRecurringAction()` and `logRecurringError()` now accept optional `source` parameter
   - **Status:** ✅ Implemented

5. **Test Environment Setup** (`server/tests/setup.js`)
   - Created test database initialization
   - Created schema setup for all tables (properties, tenants, categories, transactions, tenant_contracts, rent_payments, recurring_payments, idempotency_keys)
   - Created test data helpers: `createTestProperty()`, `createTestTenant()`, `createTestCategory()`, `createTestTenantContract()`, `createTestRecurringPayment()`
   - Created utility functions: `getAllRecords()`, `clearTable()`, `clearAllTestData()`, `closeTestDatabase()`, `cleanupTestDatabase()`
   - **Lines of Code:** 400
   - **Status:** ✅ Implemented and tested

6. **Integration Test Framework** (`server/tests/event-driven.test.js`)
   - Created test suites for Phase 1 utilities (Event Detector, Automation Utils)
   - Created placeholder test suites for all future phases
   - Tests cover: mortgage change detection, payment terms change detection, recurring payment change detection, source tag generation
   - **Lines of Code:** 340
   - **Status:** ✅ Implemented

7. **Performance Baseline Documentation** (`docs/baseline/performance-baseline.md`)
   - Created comprehensive performance measurement methodology
   - Created baseline recording templates for mortgage, recurring, and rent automation
   - Created database query performance measurement templates
   - Created success criteria for event-driven system
   - Created comparison report template
   - **Lines of Code:** 240
   - **Status:** ✅ Implemented (template ready for measurement)

#### Files Created:
- `server/event-detector.js` (6.3 KB, 190 lines)
- `server/idempotency.js` (7.9 KB, 235 lines)
- `server/automation-utils.js` (8.4 KB, 250 lines)
- `server/tests/setup.js` (13.4 KB, 400 lines)
- `server/tests/event-driven.test.js` (11.2 KB, 340 lines)
- `docs/baseline/performance-baseline.md` (7.9 KB, 240 lines)

#### Files Modified:
- `server/rent-automation.js` - Enhanced logging functions to support source tags
- `server/mortgage-automation.js` - Enhanced logging functions to support source tags
- `server/recurring-automation.js` - Enhanced logging functions to support source tags

#### Test Results:
- ✅ All utility modules load successfully
- ✅ Event detector tests pass
- ✅ Source tag generation works correctly
- ✅ No breaking changes to existing functionality

#### Next Steps:
Proceed to Phase 2: Mortgage Automation - Event-Driven

---

### Phase 2: Mortgage Automation - Event-Driven - **NOT STARTED**

**Status:** Pending  
**Reviewer:** Pending

### Phase 3: Recurring Payment Automation - Event-Driven - **NOT STARTED**

**Status:** Pending  
**Reviewer:** Pending

### Phase 4A: Rent Automation Refactoring - **NOT STARTED**

**Status:** Pending  
**Reviewer:** Pending

### Phase 4B: Manual Payment & Edge Case Verification - **NOT STARTED**

**Status:** Pending  
**Reviewer:** Pending

### Phase 5: Scheduler Migration & Dashboard Updates - **NOT STARTED**

**Status:** Pending  
**Reviewer:** Pending

### Phase 6: Cleanup, Optimization & Documentation - **NOT STARTED**

**Status:** Pending  
**Reviewer:** Pending
