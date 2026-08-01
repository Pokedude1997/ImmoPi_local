/**
 * Mortgage Event-Driven Automation Tests
 * 
 * Tests for verifying that mortgage automation works correctly with event-driven triggers.
 */

const assert = require('assert');
const { handlePropertyMortgageEvent, processMortgageTransactions, SOURCE_TAGS } = require('../mortgage-automation');
const { hasMortgageData, hasMortgageChanged } = require('../event-detector');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'immopi.db');

// Test database setup
function createTestDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.serialize(() => {
      // Clear existing test data
      db.run('DELETE FROM transactions WHERE source LIKE "test%"', (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        db.run('DELETE FROM properties WHERE name LIKE "Test%"', (err) => {
          db.close();
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
}

// Helper to create a test property
function createTestProperty(propertyData) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    const { name, address, type, purchasePrice, purchaseDate, rentAmount, size, mortgage, notes } = propertyData;
    const m = mortgage || {};
    const finalNotes = notes || null;
    
    db.run(
      `INSERT INTO properties (name, address, type, purchasePrice, purchaseDate, rentAmount, size,
        mortgage_loanAmount, mortgage_startDate, mortgage_interestRate, mortgage_principalRate,
        mortgage_bankName, mortgage_paymentTiming, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, address, type, purchasePrice, purchaseDate, rentAmount, size,
        m.loanAmount, m.startDate, m.interestRate, m.principalRate, m.bankName, m.paymentTiming, finalNotes],
      function(err) {
        db.close();
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// Helper to get a property by ID
function getPropertyById(id) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.get('SELECT * FROM properties WHERE id = ?', [id], (err, row) => {
      db.close();
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper to get transactions by source
function getTransactionsBySource(source) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all('SELECT * FROM transactions WHERE source = ?', [source], (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper to get all transactions for a property
function getTransactionsByProperty(propertyId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all('SELECT * FROM transactions WHERE property_id = ? AND source IS NOT NULL', [propertyId], (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper to cleanup test data
function cleanupTestData() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.serialize(() => {
      db.run('DELETE FROM transactions WHERE source LIKE "test%" OR source = ? OR source = ?', 
        [SOURCE_TAGS.EVENT_DRIVEN_MORTGAGE, SOURCE_TAGS.BATCH_MORTGAGE], (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        db.run('DELETE FROM properties WHERE name LIKE "Test%"', (err) => {
          db.close();
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
}

// Test runner
function runMortgageEventDrivenTests() {
  console.log('Running Mortgage Event-Driven Automation Tests...\n');
  
  const testSuites = [
    {
      name: 'Phase 2: Mortgage Event-Driven - Basic Functionality',
      setup: () => createTestDatabase(),
      teardown: () => cleanupTestData(),
      tests: [
        {
          name: 'handlePropertyMortgageEvent should skip property without mortgage data',
          test: async () => {
            const propertyId = await createTestProperty({
              name: 'Test Property No Mortgage',
              address: '123 Test St',
              type: 'APARTMENT',
              purchasePrice: 200000,
              purchaseDate: '2025-01-01',
              rentAmount: 1000,
              size: 80
            });
            
            const property = await getPropertyById(propertyId);
            const result = await handlePropertyMortgageEvent(property);
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.count, 0);
            assert.ok(result.logs[0].includes('has no mortgage data'));
          }
        },
        {
          name: 'handlePropertyMortgageEvent should create transactions for property with mortgage',
          test: async () => {
            const propertyId = await createTestProperty({
              name: 'Test Property With Mortgage',
              address: '456 Test Ave',
              type: 'HOUSE',
              purchasePrice: 300000,
              purchaseDate: '2025-01-01',
              rentAmount: 1500,
              size: 120,
              mortgage: {
                loanAmount: 200000,
                startDate: '2025-01-01',
                interestRate: 3.5,
                principalRate: 2.0,
                bankName: 'Test Bank',
                paymentTiming: 'END_OF_MONTH'
              }
            });
            
            const property = await getPropertyById(propertyId);
            const result = await handlePropertyMortgageEvent(property);
            
            assert.strictEqual(result.success, true);
            assert.ok(result.count > 0, `Expected some transactions to be created, got ${result.count}`);
            
            // Check that transactions were created with correct source
            const transactions = await getTransactionsByProperty(propertyId);
            assert.ok(transactions.length > 0, 'No transactions found in database');
            
            const eventDrivenTransactions = transactions.filter(tx => tx.source === SOURCE_TAGS.EVENT_DRIVEN_MORTGAGE);
            assert.ok(eventDrivenTransactions.length > 0, 'No event-driven mortgage transactions found');
          }
        },
        {
          name: 'handlePropertyMortgageEvent should skip when mortgage data unchanged',
          test: async () => {
            const propertyId = await createTestProperty({
              name: 'Test Property Existing',
              address: '789 Test Rd',
              type: 'APARTMENT',
              purchasePrice: 250000,
              purchaseDate: '2025-01-01',
              rentAmount: 1200,
              size: 90,
              mortgage: {
                loanAmount: 150000,
                startDate: '2025-01-01',
                interestRate: 4.0,
                principalRate: 1.5,
                bankName: 'Test Bank',
                paymentTiming: 'END_OF_MONTH'
              }
            });
            
            const property = await getPropertyById(propertyId);
            
            // First call should create transactions
            const result1 = await handlePropertyMortgageEvent(property);
            assert.strictEqual(result1.success, true);
            
            // Second call with same property should skip (no changes)
            const result2 = await handlePropertyMortgageEvent(property, property);
            assert.strictEqual(result2.success, true);
            assert.strictEqual(result2.count, 0);
            assert.ok(result2.logs[0].includes('Mortgage data unchanged'));
          }
        }
      ]
    },
    {
      name: 'Phase 2: Mortgage Event-Driven - Source Tags',
      setup: () => createTestDatabase(),
      teardown: () => cleanupTestData(),
      tests: [
        {
          name: 'processMortgageTransactions should use event-driven source tag',
          test: async () => {
            const propertyId = await createTestProperty({
              name: 'Test Property Source Tag',
              address: '111 Source Test',
              type: 'HOUSE',
              purchasePrice: 400000,
              purchaseDate: '2025-01-01',
              rentAmount: 2000,
              size: 150,
              mortgage: {
                loanAmount: 250000,
                startDate: '2025-01-01',
                interestRate: 3.0,
                principalRate: 1.5,
                bankName: 'Source Bank',
                paymentTiming: 'END_OF_MONTH'
              }
            });
            
            const property = await getPropertyById(propertyId);
            
            // Transform property for processMortgageTransactions
            const propertyWithMortgage = {
              ...property,
              id: String(property.id),
              mortgage: {
                loanAmount: property.mortgage_loanAmount,
                startDate: property.mortgage_startDate,
                interestRate: property.mortgage_interestRate,
                principalRate: property.mortgage_principalRate,
                bankName: property.mortgage_bankName,
                paymentTiming: property.mortgage_paymentTiming
              }
            };
            
            // Get existing transactions
            const transactions = await getTransactionsByProperty(propertyId);
            const categories = await new Promise((resolve, reject) => {
              const db = new sqlite3.Database(dbPath);
              db.all('SELECT * FROM categories', [], (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve(rows);
              });
            });
            
            // Process with event-driven source
            await processMortgageTransactions(
              propertyWithMortgage,
              transactions,
              categories,
              SOURCE_TAGS.EVENT_DRIVEN_MORTGAGE
            );
            
            // Check that transactions have correct source
            const eventDrivenTransactions = await getTransactionsBySource(SOURCE_TAGS.EVENT_DRIVEN_MORTGAGE);
            const propertyEventTransactions = eventDrivenTransactions.filter(tx => tx.property_id == propertyId);
            assert.ok(propertyEventTransactions.length > 0, 'No event-driven mortgage transactions found');
          }
        },
        {
          name: 'processMortgageTransactions should use batch source tag by default',
          test: async () => {
            const propertyId = await createTestProperty({
              name: 'Test Property Batch Source',
              address: '222 Batch Test',
              type: 'APARTMENT',
              purchasePrice: 350000,
              purchaseDate: '2025-01-01',
              rentAmount: 1800,
              size: 100,
              mortgage: {
                loanAmount: 200000,
                startDate: '2025-01-01',
                interestRate: 2.5,
                principalRate: 1.0,
                bankName: 'Batch Bank',
                paymentTiming: 'END_OF_MONTH'
              }
            });
            
            const property = await getPropertyById(propertyId);
            
            // Transform property for processMortgageTransactions
            const propertyWithMortgage = {
              ...property,
              id: String(property.id),
              mortgage: {
                loanAmount: property.mortgage_loanAmount,
                startDate: property.mortgage_startDate,
                interestRate: property.mortgage_interestRate,
                principalRate: property.mortgage_principalRate,
                bankName: property.mortgage_bankName,
                paymentTiming: property.mortgage_paymentTiming
              }
            };
            
            // Get existing transactions
            const transactions = await getTransactionsByProperty(propertyId);
            const categories = await new Promise((resolve, reject) => {
              const db = new sqlite3.Database(dbPath);
              db.all('SELECT * FROM categories', [], (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve(rows);
              });
            });
            
            // Process with default (batch) source
            await processMortgageTransactions(
              propertyWithMortgage,
              transactions,
              categories
            );
            
            // Check that transactions have batch source
            const batchTransactions = await getTransactionsBySource(SOURCE_TAGS.BATCH_MORTGAGE);
            const propertyBatchTransactions = batchTransactions.filter(tx => tx.property_id == propertyId);
            assert.ok(propertyBatchTransactions.length > 0, 'No batch mortgage transactions found');
          }
        }
      ]
    }
  ];
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  async function runSuite(suite) {
    console.log(`\n📋 ${suite.name}`);
    console.log('─'.repeat(50));
    
    // Run setup if provided
    if (suite.setup) {
      try {
        await suite.setup();
      } catch (error) {
        console.log(`   ❌ Setup failed: ${error.message}`);
        return;
      }
    }
    
    // Run each test
    for (const test of suite.tests) {
      try {
        await test.test();
        console.log(`   ✅ ${test.name}`);
        passed++;
      } catch (error) {
        console.log(`   ❌ ${test.name}`);
        console.log(`      Error: ${error.message}`);
        failed++;
        failures.push({ suite: suite.name, test: test.name, error: error.message });
      }
    }
    
    // Run teardown if provided
    if (suite.teardown) {
      try {
        await suite.teardown();
      } catch (error) {
        console.log(`   ⚠️  Teardown failed: ${error.message}`);
      }
    }
  }
  
  async function runAllTests() {
    for (const suite of testSuites) {
      await runSuite(suite);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Test Results:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    
    if (failures.length > 0) {
      console.log(`\n🔍 Failures:`);
      failures.forEach(failure => {
        console.log(`   - ${failure.suite} > ${failure.test}: ${failure.error}`);
      });
    }
    
    if (failed === 0) {
      console.log(`\n✅ All mortgage event-driven tests passed!`);
    } else {
      console.log(`\n❌ Some tests failed. Please review the failures above.`);
      process.exit(1);
    }
    
    return { passed, failed, failures };
  }
  
  return runAllTests();
}

// Run tests if this file is executed directly
if (require.main === module) {
  runMortgageEventDrivenTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runMortgageEventDrivenTests };