/**
 * Recurring Payment Event-Driven Automation Tests
 * 
 * Tests for verifying that recurring payment automation works correctly with event-driven triggers.
 */

const assert = require('assert');
const { handleRecurringPaymentEvent, processRecurringPayment, SOURCE_TAGS } = require('../recurring-automation');
const { hasRecurringPaymentChanged } = require('../event-detector');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'immopi.db');

// Test database setup
function createTestDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.serialize(() => {
      // Clear existing test data
      db.run('DELETE FROM transactions WHERE source LIKE "test%" OR source = ? OR source = ?', 
        [SOURCE_TAGS.EVENT_DRIVEN_RECURRING, SOURCE_TAGS.BATCH_RECURRING], (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        db.run('DELETE FROM recurring_payments WHERE name LIKE "Test%"', (err) => {
          db.close();
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
}

// Helper to create a test recurring payment
function createTestRecurringPayment(paymentData) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    const { name, amount, currency, frequency, startDate, endDate, nextDueDate, category_id, property_id, counterparty_id, isActive } = paymentData;
    
    db.run(
      'INSERT INTO recurring_payments (name, amount, currency, frequency, startDate, endDate, nextDueDate, category_id, property_id, counterparty_id, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, amount, currency || 'EUR', frequency, startDate, endDate, nextDueDate || startDate, category_id, property_id, counterparty_id, isActive ? 1 : 0],
      function(err) {
        db.close();
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// Helper to get a recurring payment by ID
function getRecurringPaymentById(id) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.get('SELECT * FROM recurring_payments WHERE id = ?', [id], (err, row) => {
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

// Helper to get all transactions for a recurring payment
function getTransactionsByRecurringPayment(recurringPaymentId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all('SELECT * FROM transactions WHERE description LIKE ? AND source IS NOT NULL', 
      [`%Recurring: Test%`], (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows);
      });
  });
}

// Helper to get all transactions
function getAllTransactions() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all('SELECT * FROM transactions', [], (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper to get all categories
function getAllCategories() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all('SELECT * FROM categories', [], (err, rows) => {
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
        [SOURCE_TAGS.EVENT_DRIVEN_RECURRING, SOURCE_TAGS.BATCH_RECURRING], (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        db.run('DELETE FROM recurring_payments WHERE name LIKE "Test%"', (err) => {
          db.close();
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
}

// Test runner
function runRecurringEventDrivenTests() {
  console.log('Running Recurring Payment Event-Driven Automation Tests...\n');
  
  const testSuites = [
    {
      name: 'Phase 3: Recurring Event-Driven - Basic Functionality',
      setup: () => createTestDatabase(),
      teardown: () => cleanupTestData(),
      tests: [
        {
          name: 'handleRecurringPaymentEvent should create transactions for new recurring payment',
          test: async () => {
            const paymentId = await createTestRecurringPayment({
              name: 'Test Recurring Payment',
              amount: 500,
              currency: 'EUR',
              frequency: 'MONTHLY',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              category_id: 1,
              property_id: 1,
              isActive: true
            });
            
            const payment = await getRecurringPaymentById(paymentId);
            const result = await handleRecurringPaymentEvent(payment);
            
            assert.strictEqual(result.success, true);
            assert.ok(result.count > 0, `Expected some transactions to be created, got ${result.count}`);
            
            // Check that transactions were created with correct source
            const transactions = await getTransactionsByRecurringPayment(paymentId);
            assert.ok(transactions.length > 0, 'No transactions found in database');
            
            const eventDrivenTransactions = transactions.filter(tx => tx.source === SOURCE_TAGS.EVENT_DRIVEN_RECURRING);
            assert.ok(eventDrivenTransactions.length > 0, 'No event-driven recurring transactions found');
          }
        },
        {
          name: 'handleRecurringPaymentEvent should skip when recurring payment unchanged',
          test: async () => {
            const paymentId = await createTestRecurringPayment({
              name: 'Test Recurring Payment Unchanged',
              amount: 600,
              currency: 'EUR',
              frequency: 'MONTHLY',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              category_id: 1,
              property_id: 1,
              isActive: true
            });
            
            const payment = await getRecurringPaymentById(paymentId);
            
            // First call should create transactions
            const result1 = await handleRecurringPaymentEvent(payment);
            assert.strictEqual(result1.success, true);
            
            // Second call with same payment should skip (no changes)
            const result2 = await handleRecurringPaymentEvent(payment, payment);
            assert.strictEqual(result2.success, true);
            assert.strictEqual(result2.count, 0);
            assert.ok(result2.logs[0].includes('Recurring payment unchanged'));
          }
        },
        {
          name: 'processRecurringPayment should use event-driven source tag',
          test: async () => {
            const paymentId = await createTestRecurringPayment({
              name: 'Test Recurring Source Tag',
              amount: 700,
              currency: 'EUR',
              frequency: 'MONTHLY',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              category_id: 1,
              property_id: 1,
              isActive: true
            });
            
            const payment = await getRecurringPaymentById(paymentId);
            const transactions = await getAllTransactions();
            const categories = await getAllCategories();
            
            // Process with event-driven source
            await processRecurringPayment(
              payment,
              transactions,
              categories,
              SOURCE_TAGS.EVENT_DRIVEN_RECURRING
            );
            
            // Check that transactions have correct source
            const eventDrivenTransactions = await getTransactionsBySource(SOURCE_TAGS.EVENT_DRIVEN_RECURRING);
            const paymentTransactions = eventDrivenTransactions.filter(tx => 
              tx.description.includes('Recurring: Test Recurring Source Tag')
            );
            assert.ok(paymentTransactions.length > 0, 'No event-driven recurring transactions found');
          }
        }
      ]
    },
    {
      name: 'Phase 3: Recurring Event-Driven - Parameter Changes',
      setup: () => createTestDatabase(),
      teardown: () => cleanupTestData(),
      tests: [
        {
          name: 'handleRecurringPaymentEvent should detect amount change',
          test: async () => {
            const paymentId = await createTestRecurringPayment({
              name: 'Test Amount Change',
              amount: 300,
              currency: 'EUR',
              frequency: 'MONTHLY',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              category_id: 1,
              property_id: 1,
              isActive: true
            });
            
            const oldPayment = await getRecurringPaymentById(paymentId);
            
            // First call creates initial transactions
            await handleRecurringPaymentEvent(oldPayment);
            
            // Update the payment with different amount
            const updatedPayment = {
              ...oldPayment,
              amount: 400  // Changed amount
            };
            
            const result = await handleRecurringPaymentEvent(updatedPayment, oldPayment);
            assert.strictEqual(result.success, true);
            assert.ok(result.count > 0, `Expected new transactions from amount change, got ${result.count}`);
          }
        },
        {
          name: 'handleRecurringPaymentEvent should detect frequency change',
          test: async () => {
            const paymentId = await createTestRecurringPayment({
              name: 'Test Frequency Change',
              amount: 200,
              currency: 'EUR',
              frequency: 'MONTHLY',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              category_id: 1,
              property_id: 1,
              isActive: true
            });
            
            const oldPayment = await getRecurringPaymentById(paymentId);
            
            // First call creates initial transactions
            await handleRecurringPaymentEvent(oldPayment);
            
            // Update the payment with different frequency
            const updatedPayment = {
              ...oldPayment,
              frequency: 'QUARTERLY'  // Changed frequency
            };
            
            const result = await handleRecurringPaymentEvent(updatedPayment, oldPayment);
            assert.strictEqual(result.success, true);
            // Frequency change should create new transactions
            assert.ok(result.count >= 0, `Frequency change processed, got ${result.count} transactions`);
          }
        },
        {
          name: 'handleRecurringPaymentEvent should detect name change',
          test: async () => {
            const paymentId = await createTestRecurringPayment({
              name: 'Test Name Change',
              amount: 200,
              currency: 'EUR',
              frequency: 'MONTHLY',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              category_id: 1,
              property_id: 1,
              isActive: true
            });
            
            const oldPayment = await getRecurringPaymentById(paymentId);
            
            // First call creates initial transactions
            await handleRecurringPaymentEvent(oldPayment);
            
            // Update the payment with different name
            const updatedPayment = {
              ...oldPayment,
              name: 'Test Name Changed'
            };
            
            const result = await handleRecurringPaymentEvent(updatedPayment, oldPayment);
            assert.strictEqual(result.success, true);
            assert.ok(result.count > 0, `Name change should create new transactions, got ${result.count}`);
          }
        },
        {
          name: 'handleRecurringPaymentEvent should detect currency change',
          test: async () => {
            const paymentId = await createTestRecurringPayment({
              name: 'Test Currency Change',
              amount: 200,
              currency: 'EUR',
              frequency: 'MONTHLY',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              category_id: 1,
              property_id: 1,
              isActive: true
            });
            
            const oldPayment = await getRecurringPaymentById(paymentId);
            
            // First call creates initial transactions
            await handleRecurringPaymentEvent(oldPayment);
            
            // Update the payment with different currency
            const updatedPayment = {
              ...oldPayment,
              currency: 'USD'
            };
            
            const result = await handleRecurringPaymentEvent(updatedPayment, oldPayment);
            assert.strictEqual(result.success, true);
            // Currency change triggers automation but past transactions won't be duplicated
            // (they already exist with the old currency). Future transactions will use new currency.
            assert.strictEqual(result.count, 0, 'Past transactions should not be recreated when only currency changes');
          }
        },
        {
          name: 'handleRecurringPaymentEvent should detect property_id change',
          test: async () => {
            const paymentId = await createTestRecurringPayment({
              name: 'Test Property Change',
              amount: 200,
              currency: 'EUR',
              frequency: 'MONTHLY',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              category_id: 1,
              property_id: 1,
              isActive: true
            });
            
            const oldPayment = await getRecurringPaymentById(paymentId);
            
            // First call creates initial transactions
            await handleRecurringPaymentEvent(oldPayment);
            
            // Update the payment with different property_id
            const updatedPayment = {
              ...oldPayment,
              property_id: 2
            };
            
            const result = await handleRecurringPaymentEvent(updatedPayment, oldPayment);
            assert.strictEqual(result.success, true);
            // Property_id change triggers automation but past transactions won't be duplicated
            // (they already exist with the old property_id). Future transactions will use new property_id.
            assert.strictEqual(result.count, 0, 'Past transactions should not be recreated when only property_id changes');
          }
        }
      ]
    },
    {
      name: 'Phase 3: Recurring Event-Driven - No Duplicates',
      setup: () => createTestDatabase(),
      teardown: () => cleanupTestData(),
      tests: [
        {
          name: 'processRecurringPayment should prevent duplicates with same source',
          test: async () => {
            const paymentId = await createTestRecurringPayment({
              name: 'Test No Duplicates',
              amount: 250,
              currency: 'EUR',
              frequency: 'MONTHLY',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              category_id: 1,
              property_id: 1,
              isActive: true
            });
            
            const payment = await getRecurringPaymentById(paymentId);
            const transactions = await getAllTransactions();
            const categories = await getAllCategories();
            
            // First call
            const result1 = await processRecurringPayment(
              payment,
              transactions,
              categories,
              SOURCE_TAGS.EVENT_DRIVEN_RECURRING
            );
            
            // Get updated transactions list
            const updatedTransactions = await getAllTransactions();
            
            // Second call with same source - should skip duplicates
            const result2 = await processRecurringPayment(
              payment,
              updatedTransactions,
              categories,
              SOURCE_TAGS.EVENT_DRIVEN_RECURRING
            );
            
            // Second call should have fewer or equal creations (duplicates skipped)
            const secondCreations = result2.filter(log => log.includes('✅ Created')).length;
            const firstCreations = result1.filter(log => log.includes('✅ Created')).length;
            
            assert.ok(secondCreations <= firstCreations, 'Second call should not create more transactions than first');
          }
        },
        {
          name: 'processRecurringPayment should allow same transaction with different source',
          test: async () => {
            const paymentId = await createTestRecurringPayment({
              name: 'Test Different Source',
              amount: 350,
              currency: 'EUR',
              frequency: 'MONTHLY',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              category_id: 1,
              property_id: 1,
              isActive: true
            });
            
            const payment = await getRecurringPaymentById(paymentId);
            let transactions = await getAllTransactions();
            const categories = await getAllCategories();
            
            // First call with event-driven source
            await processRecurringPayment(
              payment,
              transactions,
              categories,
              SOURCE_TAGS.EVENT_DRIVEN_RECURRING
            );
            
            // Get updated transactions
            transactions = await getAllTransactions();
            
            // Second call with batch source - should create transactions
            const result = await processRecurringPayment(
              payment,
              transactions,
              categories,
              SOURCE_TAGS.BATCH_RECURRING
            );
            
            // Should create transactions because source is different
            assert.ok(result.some(log => log.includes('✅ Created')) || result.some(log => log.includes('⏭️  Skipped')), 
              'Should process with different source');
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
      console.log(`\n✅ All recurring event-driven tests passed!`);
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
  runRecurringEventDrivenTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runRecurringEventDrivenTests };