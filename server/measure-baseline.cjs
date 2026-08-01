/**
 * Performance Baseline Measurement Script
 * 
 * Measures current batch processing performance for documentation
 */

const { runMortgageAutomation } = require('./mortgage-automation');
const { runRecurringAutomation } = require('./recurring-automation');
const { triggerRentAutomation } = require('./rent-automation');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'immopi.db');

// Measure execution time for a function
async function measureExecution(name, fn) {
  console.log(`\n📊 Measuring: ${name}`);
  console.log('─'.repeat(40));
  
  const start = process.hrtime.bigint();
  const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024; // MB
  
  try {
    const result = await fn();
    const end = process.hrtime.bigint();
    const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    
    const durationMs = Number(end - start) / 1_000_000;
    const memoryDelta = (memoryAfter - memoryBefore).toFixed(2);
    
    console.log(`   ✅ Completed successfully`);
    console.log(`   ⏱️  Execution Time: ${durationMs.toFixed(2)} ms`);
    console.log(`   💾 Memory Delta: ${memoryDelta} MB`);
    if (result && typeof result === 'object') {
      console.log(`   📋 Result: ${JSON.stringify(result)}`);
    }
    
    return {
      name,
      durationMs: durationMs.toFixed(2),
      memoryDelta: memoryDelta + ' MB',
      result
    };
  } catch (error) {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    
    console.log(`   ❌ Failed: ${error.message}`);
    console.log(`   ⏱️  Execution Time: ${durationMs.toFixed(2)} ms (until failure)`);
    
    return {
      name,
      durationMs: durationMs.toFixed(2),
      memoryDelta: 'N/A',
      error: error.message
    };
  }
}

// Measure individual query performance
async function measureQueryPerformance() {
  console.log(`\n🔍 Measuring Individual Query Performance`);
  console.log('─'.repeat(50));
  
  const db = new sqlite3.Database(dbPath);
  const results = [];
  
  const queries = [
    { name: 'Get all properties', query: 'SELECT * FROM properties' },
    { name: 'Get all transactions', query: 'SELECT * FROM transactions' },
    { name: 'Get all tenant contracts', query: 'SELECT * FROM tenant_contracts' },
    { name: 'Get all rent payments', query: 'SELECT * FROM rent_payments' },
    { name: 'Get all recurring payments', query: 'SELECT * FROM recurring_payments' }
  ];
  
  for (const q of queries) {
    try {
      const start = process.hrtime.bigint();
      const rows = await new Promise((resolve, reject) => {
        db.all(q.query, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      
      console.log(`   ${q.name}: ${durationMs.toFixed(2)} ms (${rows.length} rows)`);
      results.push({
        query: q.name,
        durationMs: durationMs.toFixed(2),
        rowCount: rows.length
      });
    } catch (error) {
      console.log(`   ❌ ${q.name}: Failed - ${error.message}`);
    }
  }
  
  // Test insert performance
  try {
    const start = process.hrtime.bigint();
    await new Promise((resolve, reject) => {
      db.run('INSERT OR IGNORE INTO transactions (id, description, date, amount, property_id, category_id, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [-1, 'Test Transaction', '2025-01-01', 100.00, 1, 1, 'test'],
        (err) => err ? reject(err) : resolve()
      );
    });
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    
    console.log(`   Insert test transaction: ${durationMs.toFixed(2)} ms`);
    
    // Clean up test insert
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM transactions WHERE description = ? AND source = ?', ['Test Transaction', 'test'], 
        (err) => err ? reject(err) : resolve()
      );
    });
  } catch (error) {
    console.log(`   ❌ Insert test: Failed - ${error.message}`);
  }
  
  db.close();
  return results;
}

// Count records in tables
async function getDatabaseStats() {
  const db = new sqlite3.Database(dbPath);
  const stats = {};
  
  const tables = [
    'properties',
    'transactions', 
    'tenant_contracts',
    'rent_payments',
    'recurring_payments',
    'tenants'
  ];
  
  console.log(`\n📈 Database Statistics`);
  console.log('─'.repeat(30));
  
  for (const table of tables) {
    try {
      const count = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM ${table}`, [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      stats[table] = count;
      console.log(`   ${table}: ${count} records`);
    } catch (error) {
      stats[table] = 'Error: ' + error.message;
      console.log(`   ${table}: Error - ${error.message}`);
    }
  }
  
  // Count properties with mortgages
  try {
    const count = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM properties WHERE mortgage_loanAmount IS NOT NULL', [], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    stats.propertiesWithMortgages = count;
    console.log(`   properties_with_mortgages: ${count} records`);
  } catch (error) {
    console.log(`   properties_with_mortgages: Error - ${error.message}`);
  }
  
  db.close();
  return stats;
}

// Main measurement function
async function measureAll() {
  console.log('🚀 Starting Performance Baseline Measurement');
  console.log('='.repeat(60));
  
  try {
    // Get database statistics first
    const dbStats = await getDatabaseStats();
    
    // Measure individual query performance
    const queryResults = await measureQueryPerformance();
    
    // Measure automation functions
    console.log(`\n🏗️  Measuring Batch Automation Performance`);
    console.log('─'.repeat(50));
    
    const measurements = [];
    
    // Mortgage automation
    if (dbStats.propertiesWithMortgages && dbStats.propertiesWithMortgages > 0) {
      const mortgageResult = await measureExecution(
        'Mortgage Automation',
        () => runMortgageAutomation(true)
      );
      measurements.push(mortgageResult);
    } else {
      console.log('\n⚠️  Skipping Mortgage Automation - No properties with mortgages found');
    }
    
    // Recurring automation
    if (dbStats.recurring_payments && dbStats.recurring_payments > 0) {
      const recurringResult = await measureExecution(
        'Recurring Payment Automation',
        () => runRecurringAutomation()
      );
      measurements.push(recurringResult);
    } else {
      console.log('\n⚠️  Skipping Recurring Automation - No recurring payments found');
    }
    
    // Rent automation
    if (dbStats.tenant_contracts && dbStats.tenant_contracts > 0) {
      const rentResult = await measureExecution(
        'Rent Payment Automation',
        () => triggerRentAutomation()
      );
      measurements.push(rentResult);
    } else {
      console.log('\n⚠️  Skipping Rent Automation - No tenant contracts found');
    }
    
    // Summary
    console.log(`\n📋 Measurement Summary`);
    console.log('='.repeat(40));
    
    measurements.forEach(m => {
      console.log(`   ${m.name}: ${m.durationMs} ms, Memory: ${m.memoryDelta}`);
      if (m.error) {
        console.log(`      ❌ Error: ${m.error}`);
      }
    });
    
    console.log(`\n✅ Performance baseline measurement completed!`);
    
    return {
      timestamp: new Date().toISOString(),
      databaseStats: dbStats,
      queryPerformance: queryResults,
      automationPerformance: measurements
    };
    
  } catch (error) {
    console.error(`❌ Measurement failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  measureAll().then(results => {
    console.log(`\n💾 Results saved to console. Copy to performance-baseline.md`);
  }).catch(console.error);
}

module.exports = { measureAll, measureExecution, getDatabaseStats, measureQueryPerformance };