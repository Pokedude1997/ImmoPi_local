# Performance Baseline Documentation

**Project:** ImmoPi - Event-Driven Architecture Refactoring  
**Created:** 2025-08-01  
**Phase:** Phase 1 - Foundation  
**Status:** To be measured before implementation

---

## 📊 Purpose

This document establishes performance baselines for the existing batch-oriented automation system. These metrics will be used to:

1. Compare performance before and after event-driven refactoring
2. Identify any performance regressions
3. Set performance expectations for the new system
4. Validate that event-driven approach meets or exceeds batch performance

---

## 📋 Measurement Methodology

### Test Environment
- **Database**: SQLite (immopi.db)
- **Hardware**: Development machine specifications
- **Node.js Version**: v18.x
- **Test Time**: Measured during low system load

### Measurement Tools
- Node.js `performance` API
- SQLite query timing
- Manual timing with `console.time()`

### Test Scenarios
All tests performed on the **main production database** with existing data.

---

## 🏃 Batch Processing Performance

### 1. Mortgage Automation

**Test**: Run full mortgage automation via `runMortgageAutomation()`

| Metric | Measurement | Notes |
|--------|-------------|-------|
| Total Properties | | Number of properties with mortgages |
| Transactions Created | | Number of new transactions |
| Execution Time | | Total time to process all properties |
| Avg Time per Property | | Execution Time / Total Properties |
| Avg Time per Transaction | | Execution Time / Transactions Created |
| Peak Memory Usage | | Max memory during execution |

**Measurement Code:**
```javascript
const { runMortgageAutomation } = require('./server/mortgage-automation');
const start = process.hrtime.bigint();
const result = await runMortgageAutomation(true);
const end = process.hrtime.bigint();
const durationMs = Number(end - start) / 1_000_000;
console.log(`Mortgage automation: ${durationMs}ms, ${result.count} transactions`);
```

**Results (To be measured):**
- Total Properties: [TBD]
- Transactions Created: [TBD]
- Execution Time: [TBD] ms
- Avg Time per Property: [TBD] ms
- Avg Time per Transaction: [TBD] ms
- Peak Memory: [TBD] MB

---

### 2. Recurring Payment Automation

**Test**: Run full recurring payment automation via `runRecurringAutomation()`

| Metric | Measurement | Notes |
|--------|-------------|-------|
| Total Recurring Payments | | Number of recurring payments |
| Transactions Created | | Number of new transactions |
| Execution Time | | Total time to process all |
| Avg Time per Payment | | Execution Time / Total Recurring Payments |

**Measurement Code:**
```javascript
const { runRecurringAutomation } = require('./server/recurring-automation');
const start = process.hrtime.bigint();
const result = await runRecurringAutomation();
const end = process.hrtime.bigint();
const durationMs = Number(end - start) / 1_000_000;
console.log(`Recurring automation: ${durationMs}ms, ${result.count} transactions`);
```

**Results (To be measured):**
- Total Recurring Payments: [TBD]
- Transactions Created: [TBD]
- Execution Time: [TBD] ms
- Avg Time per Payment: [TBD] ms

---

### 3. Rent Payment Automation

**Test**: Run full rent payment automation via `triggerRentAutomation()`

| Metric | Measurement | Notes |
|--------|-------------|-------|
| Total Tenant Contracts | | Number of active contracts |
| Payments Created | | Number of new payments |
| Transactions Created | | Number of new transactions |
| Execution Time | | Total time to process all |
| Avg Time per Contract | | Execution Time / Total Contracts |

**Measurement Code:**
```javascript
const { triggerRentAutomation } = require('./server/rent-automation');
const start = process.hrtime.bigint();
const result = await triggerRentAutomation();
const end = process.hrtime.bigint();
const durationMs = Number(end - start) / 1_000_000;
console.log(`Rent automation: ${durationMs}ms, ${result.count} payments`);
```

**Results (To be measured):**
- Total Tenant Contracts: [TBD]
- Payments Created: [TBD]
- Transactions Created: [TBD]
- Execution Time: [TBD] ms
- Avg Time per Contract: [TBD] ms

---

## 📈 Database Query Performance

### Individual Query Times

**Test**: Measure time for common automation queries

| Query | Description | Avg Time (ms) |
|-------|-------------|---------------|
| Get all properties | `SELECT * FROM properties` | [TBD] |
| Get property by ID | `SELECT * FROM properties WHERE id = ?` | [TBD] |
| Get all transactions | `SELECT * FROM transactions` | [TBD] |
| Insert transaction | `INSERT INTO transactions (...)` | [TBD] |
| Check duplicate | `SELECT id FROM transactions WHERE ...` | [TBD] |
| Get contracts by tenant | `SELECT * FROM tenant_contracts WHERE tenant_id = ?` | [TBD] |
| Get payments by contract | `SELECT * FROM rent_payments WHERE tenant_contract_id = ?` | [TBD] |

**Measurement Code:**
```javascript
const db = require('sqlite3').verbose().Database('immopi.db');
const start = process.hrtime.bigint();
db.all('SELECT * FROM properties', [], (err, rows) => {
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1_000_000;
  console.log(`Query took ${durationMs}ms, returned ${rows.length} rows`);
});
```

---

## 🎯 Success Criteria for Event-Driven System

The event-driven system should meet or exceed the following criteria:

### 1. Single Entity Processing
- **Mortgage**: Process one property in < 500ms
- **Recurring**: Process one payment in < 200ms
- **Rent**: Process one contract in < 300ms

### 2. Idempotency Check Performance
- Duplicate check should take < 50ms

### 3. Concurrent Processing
- Handle 5+ simultaneous event triggers without errors
- No deadlocks or race conditions

### 4. Memory Usage
- Memory usage should not exceed batch processing by >20%

### 5. Database Load
- No significant increase in database query volume
- Index usage should be optimal

---

## 📅 Measurement Timeline

| Phase | Measurement Activity | Owner |
|-------|---------------------|-------|
| Before Phase 1 | Record current baselines | Developer |
| After Phase 2 | Measure mortgage event-driven performance | Developer |
| After Phase 3 | Measure recurring event-driven performance | Developer |
| After Phase 4A | Measure rent event-driven performance | Developer |
| After Phase 6 | Full performance comparison report | Developer |

---

## 📝 Baseline Recording Instructions

1. **Before starting Phase 1**, run all measurement tests
2. Record results in the tables above
3. Save a copy of the database for reference
4. Document hardware specifications
5. Note any unusual conditions (high system load, etc.)

---

## 🔄 Comparison Report Template

After completing all phases, create a comparison report:

```markdown
# Performance Comparison: Batch vs Event-Driven

## Summary
- Overall performance: [Improved/Degraded/Same]
- Average transaction creation time: [X]ms → [Y]ms ([Z]% change)

## Detailed Comparison

### Mortgage Automation
| Metric | Batch | Event-Driven | Change |
|--------|-------|--------------|--------|
| Avg Time | [TBD]ms | [TBD]ms | [TBD]% |

### Recurring Payment Automation
| Metric | Batch | Event-Driven | Change |
|--------|-------|--------------|--------|
| Avg Time | [TBD]ms | [TBD]ms | [TBD]% |

### Rent Payment Automation
| Metric | Batch | Event-Driven | Change |
|--------|-------|--------------|--------|
| Avg Time | [TBD]ms | [TBD]ms | [TBD]% |

## Conclusion
[Summarize findings and recommendations]
```

---

## 💡 Notes

- All measurements should be taken under similar conditions
- Test with production-like data volumes
- Note that event-driven may have higher per-transaction overhead but better user experience
- The goal is **real-time responsiveness**, not necessarily raw throughput
- Batch processing can still run as fallback for missed events

---

**Document Status**: Template - To be completed before Phase 1 implementation
