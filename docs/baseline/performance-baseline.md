# Performance Baseline Documentation

**Project:** ImmoPi - Event-Driven Architecture Refactoring  
**Created:** 2026-08-01  
**Phase:** Phase 1 - Foundation   
**Status:** Measured - Actual baseline recorded
**Measurement Time:** 2026-08-01 14:00 UTC
**Environment:** Development machine, Node.js v18.20.8, SQLite

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
- **Hardware**: Development machine (Linux)
- **Node.js Version**: v18.20.8
- **Test Time**: Measured during low system load
- **Data Volume**: 2 properties, 90 transactions, 3 tenant contracts, 33 rent payments, 2 recurring payments

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
| Total Properties | 2 | Number of properties with mortgages |
| Transactions Created | 24 | Number of new transactions (Säntis property) |
| Execution Time | 410.73 ms | Total time to process all properties |
| Avg Time per Property | 205.37 ms | Execution Time / Total Properties |
| Avg Time per Transaction | 17.11 ms | Execution Time / Transactions Created |
| Peak Memory Usage | 0.46 MB | Memory delta during execution |

**Measurement Code:**
```javascript
const { runMortgageAutomation } = require('./server/mortgage-automation');
const start = process.hrtime.bigint();
const result = await runMortgageAutomation(true);
const end = process.hrtime.bigint();
const durationMs = Number(end - start) / 1_000_000;
console.log(`Mortgage automation: ${durationMs}ms, ${result.count} transactions`);
```

**Results:**
- Total Properties: 2
- Transactions Created: 24
- Execution Time: 410.73 ms
- Avg Time per Property: 205.37 ms
- Avg Time per Transaction: 17.11 ms
- Peak Memory: 0.46 MB

**Notes:**
- Measurement includes both mortgage interest and principal transactions
- Huttenstrasse property already had recent transactions, so only Säntis generated new ones
- Memory delta is positive indicating memory allocation during processing

---

### 2. Recurring Payment Automation

**Test**: Run full recurring payment automation via `runRecurringAutomation()`

| Metric | Measurement | Notes |
|--------|-------------|-------|
| Total Recurring Payments | 2 | Number of recurring payments |
| Transactions Created | 0 | Number of new transactions (all duplicates) |
| Execution Time | 28.94 ms | Total time to process all |
| Avg Time per Payment | 14.47 ms | Execution Time / Total Recurring Payments |

**Measurement Code:**
```javascript
const { runRecurringAutomation } = require('./server/recurring-automation');
const start = process.hrtime.bigint();
const result = await runRecurringAutomation();
const end = process.hrtime.bigint();
const durationMs = Number(end - start) / 1_000_000;
console.log(`Recurring automation: ${durationMs}ms, ${result.count} transactions`);
```

**Results:**
- Total Recurring Payments: 2
- Transactions Created: 0 (all were duplicates)
- Execution Time: 28.94 ms
- Avg Time per Payment: 14.47 ms

**Notes:**
- All transactions were duplicates, indicating existing data is current
- Processing still occurs to check for new transactions
- Fast execution time shows efficient duplicate detection

---

### 3. Rent Payment Automation

**Test**: Run full rent payment automation via `triggerRentAutomation()`

| Metric | Measurement | Notes |
|--------|-------------|-------|
| Total Tenant Contracts | 3 | Number of active contracts |
| Payments Created | 0 | Number of new payments |
| Transactions Created | 0 | Number of new transactions |
| Execution Time | 29.46 ms | Total time to process all |
| Avg Time per Contract | 9.82 ms | Execution Time / Total Contracts |

**Measurement Code:**
```javascript
const { triggerRentAutomation } = require('./server/rent-automation');
const start = process.hrtime.bigint();
const result = await triggerRentAutomation();
const end = process.hrtime.bigint();
const durationMs = Number(end - start) / 1_000_000;
console.log(`Rent automation: ${durationMs}ms, ${result.count} payments`);
```

**Results:**
- Total Tenant Contracts: 3
- Payments Created: 0
- Transactions Created: 0
- Execution Time: 29.46 ms
- Avg Time per Contract: 9.82 ms

**Notes:**
- 2 contracts were processed (1 may be inactive or have no payment terms)
- No new payments/transactions created (existing data is current)
- Very fast execution time for rent automation

---

## 📈 Database Query Performance

### Individual Query Times

**Test**: Measure time for common automation queries

| Query | Description | Avg Time (ms) | Rows |
|-------|-------------|---------------|------|
| Get all properties | `SELECT * FROM properties` | 0.71 | 2 |
| Get all transactions | `SELECT * FROM transactions` | 1.04 | 90 |
| Get all tenant contracts | `SELECT * FROM tenant_contracts` | 0.30 | 3 |
| Get all rent payments | `SELECT * FROM rent_payments` | 0.57 | 33 |
| Get all recurring payments | `SELECT * FROM recurring_payments` | 0.40 | 2 |
| Insert transaction | `INSERT INTO transactions (...)` | Failed | N/A |

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

**Notes:**
- Insert test failed because current schema doesn't have `source` column yet
- This will be added during event-driven refactoring
- All SELECT queries perform very well (< 2ms) with current data volume

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

**Document Status**: ✅ Complete - Baseline measurements recorded for Phase 1
