# ImmoPi - Rent Payment Automation Fixes

**Project:** ImmoPi - Fix rent payment automation issues  
**Created:** 2025-01-XX  
**Priority:** P0 (Critical)  
**Status:** Planning Phase

---

## 🎯 Issues to Fix

### Issue 1: Automation creates payments on wrong dates
- **Current:** `processTenantContract` starts from `contract.startDate` and iterates forward
- **Problem:** For contracts with "paid in advance at end of preceding month", the first payment should be BEFORE the contract start date
- **Example:** Contract starts 2026-06-01, payment day 31. First payment should be 2026-05-31 (end of May), not 2026-06-01
- **Root Cause:** The automation is using contract dates instead of payment dates

### Issue 2: Manual rent payment creation doesn't create linked transaction
- **Current:** POST `/api/rent-payments` only creates the rent payment record
- **Problem:** According to requirements, each rent payment should have a linked transaction
- **Note:** The automation (`createRentPaymentForDate`) DOES create linked transactions, but manual creation doesn't

---

## 📋 Requirements

1. Rent is paid in advance at end of preceding month (paymentDayOfMonth default 31)
2. Each rent payment should have a linked transaction
3. Manual payments should also create transactions
4. Don't break existing functionality
5. Maintain consistency between auto-generated and manual payments
6. Don't break existing data

---

## 🏗️ Solution Architecture

### Issue 1: Fix Payment Date Calculation
- Create `calculateFirstPaymentDate(contract)` to calculate first payment date BEFORE contract start
- Update `processTenantContract` to use `calculateFirstPaymentDate` instead of `contract.startDate`

### Issue 2: Extract Transaction Creation Logic
- Extract transaction creation from `createRentPaymentForDate` into reusable functions:
  - `getRentCategory(categories)` - Find or create "Rent (Warm)" category
  - `getPropertyName(propertyId)` - Get property name from database
  - `buildRentTransactionDescription(contract, paymentDate)` - Build description string
  - `createRentTransaction(contract, paymentDate, categories)` - Create transaction in DB
- Update POST `/api/rent-payments` to create linked transactions

---

## ✅ Implementation Plan

---

### Phase 1: Fix Payment Date Calculation (Issue 1)

- [ ] **Create calculateFirstPaymentDate function**
  - Calculate first payment date based on contract.startDate and contract.paymentDayOfMonth
  - For paid-in-advance: first payment = last day of preceding month before startDate
  - Handle edge case: if paymentDay > days in preceding month, use last day of that month
  - Add JSDoc documentation
  - **File:** `server/rent-automation.js` (After line 164, before "Core Automation Logic")
  - **Effort:** M | **Priority:** P0

- [ ] **Update processTenantContract to use calculateFirstPaymentDate**
  - Replace line 532: `let currentDate = new Date(contract.startDate + 'T00:00:00Z');`
  - With: `let currentDate = calculateFirstPaymentDate(contract);`
  - **File:** `server/rent-automation.js` (Line 532)
  - **Effort:** S | **Priority:** P0 | **Depends on:** calculateFirstPaymentDate

---

### Phase 2: Extract Transaction Creation Logic (Issue 2)

- [ ] **Create getRentCategory function**
  - Extract category lookup/creation logic from createRentPaymentForDate
  - Find or create "Rent (Warm)" category in the provided categories array
  - If not found, create it in database and add to array
  - Add JSDoc documentation
  - **File:** `server/rent-automation.js` (In Database Helpers section, after line 304)
  - **Effort:** S | **Priority:** P0

- [ ] **Create getPropertyName function**
  - Extract property name retrieval logic (lines 469-474)
  - Get property name from database by propertyId
  - Add JSDoc documentation
  - **File:** `server/rent-automation.js` (After getRentCategory)
  - **Effort:** S | **Priority:** P0

- [ ] **Create buildRentTransactionDescription function**
  - Extract description building logic (lines 476-480)
  - Format: "Rent Payment: {propertyName} - {month} {year}"
  - Add JSDoc documentation
  - **File:** `server/rent-automation.js` (After getPropertyName)
  - **Effort:** XS | **Priority:** P0

- [ ] **Create createRentTransaction function**
  - Extract transaction creation logic from createRentPaymentForDate
  - Create transaction in database with proper fields
  - Uses: getRentCategory, getPropertyName, buildRentTransactionDescription
  - Add JSDoc documentation
  - **File:** `server/rent-automation.js` (After buildRentTransactionDescription)
  - **Effort:** M | **Priority:** P0 | **Depends on:** getRentCategory, getPropertyName, buildRentTransactionDescription

- [ ] **Refactor createRentPaymentForDate to use new functions**
  - Replace category lookup with await getRentCategory(categories)
  - Replace property name retrieval with await getPropertyName(contract.propertyId)
  - Replace description building with buildRentTransactionDescription(contract, date)
  - Replace transaction creation with await createRentTransaction(contract, date, categories)
  - Ensure behavior remains identical
  - **File:** `server/rent-automation.js` (Line 439-517)
  - **Effort:** M | **Priority:** P0 | **Depends on:** All new helper functions

---

### Phase 3: Update Manual Payment Endpoint (Issue 2)

- [ ] **Export new functions from rent-automation.js**
  - Export createRentTransaction, getRentCategory, getPropertyName, buildRentTransactionDescription
  - **File:** `server/rent-automation.js` (Module Exports section, line 699-720)
  - **Effort:** XS | **Priority:** P0

- [ ] **Import required functions in server.js**
  - Import getTenantContractById, getAllCategories, createRentTransaction from rent-automation.js
  - **File:** `server/server.js` (Top imports section)
  - **Effort:** XS | **Priority:** P0

- [ ] **Add transaction creation logic to POST /api/rent-payments**
  - If transactionId is NOT provided in request body:
    - Get tenant contract: `const contract = await getTenantContractById(tenantContractId)`
    - Return 404 if contract not found
    - Get categories: `const categories = await getAllCategories()`
    - Create transaction: `const txId = await createRentTransaction(contract, new Date(date), categories)`
    - Use txId as transactionId for payment
  - Pass transactionId to db.run call
  - **File:** `server/server.js` (Line 1438-1455)
  - **Effort:** M | **Priority:** P0 | **Depends on:** All Phase 2 tasks

- [ ] **Add error handling for transaction creation**
  - Wrap transaction creation in try-catch
  - If transaction creation fails, don't create payment
  - Return appropriate error message
  - **File:** `server/server.js` (Line 1438-1479)
  - **Effort:** S | **Priority:** P0 | **Depends on:** Transaction creation logic

- [ ] **Handle explicit transactionId provided**
  - If transactionId IS provided in request, use it as-is (don't create new transaction)
  - Maintains backward compatibility
  - **File:** `server/server.js` (Line 1438-1455)
  - **Effort:** XS | **Priority:** P0 | **Depends on:** Transaction creation logic

---

### Phase 4: Verify Consistency

- [ ] **Compare transaction fields between automation and manual creation**
  - Verify same fields are set (date, amount, currency, description, type, property_id, category_id)
  - **Files:** `server/rent-automation.js`, `server/server.js`
  - **Effort:** S | **Priority:** P0 | **Depends on:** Phase 1, Phase 2, Phase 3

- [ ] **Verify transaction linking consistency**
  - Both should set transaction_id on rent_payment record
  - **Files:** `server/rent-automation.js`, `server/server.js`
  - **Effort:** S | **Priority:** P0 | **Depends on:** Phase 1, Phase 2, Phase 3

---

### Phase 5: Testing

- [ ] **Test Issue 1 fix - Payment date calculation**
  - Contract starts 2026-06-01, paymentDay=31 → expect first payment 2026-05-31
  - Contract starts 2026-03-01, paymentDay=31 → expect first payment 2026-02-28
  - Contract starts 2026-01-01, paymentDay=31 → expect first payment 2025-12-31
  - Contract starts 2026-04-15, paymentDay=31 → expect first payment 2026-03-31
  - Contract starts 2026-05-01, paymentDay=30 → expect first payment 2026-04-30
  - **Effort:** M | **Priority:** P0 | **Depends on:** Phase 1

- [ ] **Test Issue 2 fix - Manual payment creates transaction**
  - POST to /api/rent-payments with tenantContractId, date, amount
  - Verify rent payment is created
  - Verify transaction is created
  - Verify rent payment has transaction_id set
  - Verify transaction has correct fields
  - **Effort:** M | **Priority:** P0 | **Depends on:** Phase 3

- [ ] **Test with explicit transactionId**
  - Create transaction manually first
  - POST to /api/rent-payments with tenantContractId, date, amount, transactionId
  - Verify rent payment is created with provided transactionId
  - Verify no new transaction is created
  - **Effort:** S | **Priority:** P0 | **Depends on:** Phase 3

- [ ] **Test backward compatibility**
  - Verify existing rent payments still work
  - Verify existing automation still works
  - Verify existing transactions still linked correctly
  - **Effort:** M | **Priority:** P0 | **Depends on:** All previous phases

- [ ] **Test error handling**
  - POST with invalid tenantContractId → expect 404
  - POST with missing required fields → expect 400
  - **Effort:** S | **Priority:** P0 | **Depends on:** Phase 3

- [ ] **Test automation end-to-end**
  - Create new contract
  - Trigger automation
  - Verify payments and transactions created correctly
  - **Effort:** M | **Priority:** P0 | **Depends on:** All previous phases

---

### Phase 6: Code Quality

- [ ] **Add JSDoc comments to all new functions**
  - calculateFirstPaymentDate, getRentCategory, getPropertyName, buildRentTransactionDescription, createRentTransaction
  - **File:** `server/rent-automation.js`
  - **Effort:** S | **Priority:** P1 | **Depends on:** All implementation phases

- [ ] **Clean up code**
  - Remove debug console.log statements
  - Ensure consistent code style
  - Verify proper error handling
  - **Files:** `server/rent-automation.js`, `server/server.js`
  - **Effort:** S | **Priority:** P1 | **Depends on:** All implementation phases

- [ ] **Verify no breaking changes**
  - Check existing function signatures preserved
  - Check existing exports still exported
  - Check existing functionality still works
  - **Files:** All modified files
  - **Effort:** M | **Priority:** P0 | **Depends on:** All implementation phases

---

## 📊 Implementation Order

```
Phase 1: Fix Payment Date Calculation (Issue 1)
    ↓
Phase 2: Extract Transaction Creation Logic (Issue 2)
    ↓
Phase 3: Update Manual Payment Endpoint (Issue 2)
    ↓
Phase 4: Verify Consistency
    ↓
Phase 5: Testing
    ↓
Phase 6: Code Quality
```

---

## 🎯 Success Criteria

- [ ] Automation creates first payment on correct date (before contract start)
- [ ] All subsequent payments have correct dates
- [ ] Manual payment creation creates linked transaction
- [ ] Auto-generated and manual payments are consistent
- [ ] No existing functionality is broken
- [ ] All edge cases handled correctly
- [ ] All tests pass
- [ ] Code follows project standards
- [ ] No breaking changes to existing data

---

## ⚠️ Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing automation | Medium | High | Extensive testing. Database backup before changes. |
| Inconsistent payment/transaction data | Medium | High | Verify all fields set consistently. Add validation. |
| Date calculation errors | High | Medium | Test all edge cases. Use existing date utilities. |
| Transaction creation fails silently | Medium | Medium | Add proper error handling and logging. |
| Performance degradation | Low | Medium | Profile before/after. Optimize if needed. |

---

## 📝 Files to Modify

- `server/rent-automation.js` - Fix payment date calculation, extract transaction creation logic
- `server/server.js` - Update POST /api/rent-payments endpoint

---

## 🏷️ Tags

#rent-payments #automation #bugfix #p0 #payment-dates #transactions #date-calculation
