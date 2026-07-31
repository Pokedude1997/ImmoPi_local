/**
 * Rent Automation Module
 * 
 * Independent backend service that:
 * - Runs on a schedule (daily at 1:00 AM Europe/Berlin timezone)
 * - Creates rent payment records automatically for active tenant contracts
 * - Creates linked transactions for each rent payment
 * - Tracks last execution to prevent duplicates
 * - Does NOT depend on frontend page loads
 * 
 * Features:
 * - Auto-generates rent payments based on contract terms
 * - Calculates warm rent = cold rent + side costs
 * - Default payment day: end of preceding month (day 31)
 * - Creates PENDING status payments that can be marked as PAID later
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

// Database connection
const dbPath = path.join(__dirname, 'immopi.db');
const db = new sqlite3.Database(dbPath);

// Logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log rent automation actions
 */
function logRentAction(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | RENT | ${message}\n`;
  fs.appendFileSync(path.join(logsDir, 'rent-automation.log'), logEntry);
}

/**
 * Log rent automation errors
 */
function logRentError(error, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | RENT | ERROR | ${error.message} | ${JSON.stringify(details)}\n`;
  fs.appendFileSync(path.join(logsDir, 'rent-automation-errors.log'), logEntry);
}

// ============================================================================
// Mapping Functions (DB snake_case → Frontend camelCase)
// ============================================================================

/**
 * Map tenant contract from DB (snake_case) to frontend (camelCase)
 * @param {object} row - Database row with snake_case properties
 * @returns {object} Mapped object with camelCase properties
 */
function mapTenantContract(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    propertyId: String(row.property_id),
    startDate: row.start_date,
    endDate: row.end_date,
    coldRent: row.cold_rent,
    sideCosts: row.side_costs,
    paymentDayOfMonth: row.payment_day_of_month,
    isActive: Boolean(row.is_active),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map rent payment from DB (snake_case) to frontend (camelCase)
 * @param {object} row - Database row with snake_case properties
 * @returns {object} Mapped object with camelCase properties
 */
function mapRentPayment(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    tenantContractId: String(row.tenant_contract_id),
    date: row.date,
    amount: row.amount,
    coldRentAmount: row.cold_rent_amount,
    sideCostsAmount: row.side_costs_amount,
    status: row.status,
    paymentMethod: row.payment_method,
    transactionId: row.transaction_id ? String(row.transaction_id) : undefined,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get the last day of the previous month
 * @param {Date} baseDate - The base date to calculate from
 * @returns {Date} The last day of the previous month
 */
function getLastDayOfPreviousMonth(baseDate) {
  const date = new Date(baseDate);
  date.setUTCMonth(date.getUTCMonth());
  date.setUTCDate(0); // Move to last day of previous month
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * Get number of days in a month
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @returns {number} Number of days in the month
 */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getUTCDate();
}

/**
 * Calculate the next payment date for a contract
 * @param {object} contract - The tenant contract
 * @param {Date} fromDate - Calculate from this date
 * @returns {Date|null} Next payment date or null if contract is not active
 */
function calculateNextPaymentDate(contract, fromDate) {
  if (!contract.isActive) {
    return null;
  }

  const paymentDay = contract.paymentDayOfMonth || 31;
  const startDate = new Date(contract.startDate + 'T00:00:00Z');
  
  // If fromDate is before startDate, use startDate
  const calcFrom = fromDate < startDate ? startDate : new Date(fromDate);
  calcFrom.setUTCHours(0, 0, 0, 0);

  // Move to the next month
  const nextMonth = new Date(calcFrom);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  
  // Set to the payment day
  const paymentDate = new Date(nextMonth);
  
  // Handle edge case: if payment day is 31 and month doesn't have 31 days
  const daysInMonth = getDaysInMonth(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth());
  if (paymentDay > daysInMonth) {
    paymentDate.setUTCDate(daysInMonth);
  } else {
    paymentDate.setUTCDate(paymentDay);
  }
  
  paymentDate.setUTCHours(0, 0, 0, 0);
  
  return paymentDate;
}

/**
 * Check if contract is active on a specific date
 * @param {object} contract - The tenant contract
 * @param {Date} date - The date to check
 * @returns {boolean} True if contract is active on the date
 */
function isContractActiveOnDate(contract, date) {
  const startDate = new Date(contract.startDate + 'T00:00:00Z');
  const endDate = contract.endDate ? new Date(contract.endDate + 'T00:00:00Z') : null;
  const checkDate = new Date(date);
  checkDate.setUTCHours(0, 0, 0, 0);

  if (checkDate < startDate) {
    return false;
  }

  if (endDate && checkDate > endDate) {
    return false;
  }

  return contract.isActive === 1 || contract.isActive === true;
}

/**
 * Calculate warm rent from cold rent and side costs
 * @param {number} coldRent - The cold rent amount
 * @param {number} sideCosts - The side costs amount
 * @returns {number} The warm rent amount
 */
function calculateWarmRent(coldRent, sideCosts) {
  return coldRent + sideCosts;
}

// ============================================================================
// Database Helpers
// ============================================================================

/**
 * Get all active tenant contracts
 * @returns {Promise<Array>} List of active contracts
 */
function getActiveTenantContracts() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM tenant_contracts WHERE is_active = 1`,
      [],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

/**
 * Get a specific tenant contract by ID
 * @param {number} id - The contract ID
 * @returns {Promise<object|null>} The contract or null if not found
 */
function getTenantContractById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM tenant_contracts WHERE id = ?`,
      [id],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
}

/**
 * Get all rent payments for a specific contract
 * @param {number} contractId - The contract ID
 * @returns {Promise<Array>} List of rent payments
 */
function getRentPaymentsForContract(contractId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM rent_payments WHERE tenant_contract_id = ?`,
      [contractId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

/**
 * Get all categories
 * @returns {Promise<Array>} List of categories
 */
function getAllCategories() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM categories`,
      [],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

/**
 * Get a category by name
 * @param {string} name - The category name
 * @returns {Promise<object|null>} The category or null if not found
 */
function getCategoryByName(name) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM categories WHERE name = ?`,
      [name],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
}

/**
 * Get all transactions
 * @returns {Promise<Array>} List of transactions
 */
function getAllTransactions() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM transactions`,
      [],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

/**
 * Create a transaction in the database
 * @param {object} tx - The transaction data
 * @returns {Promise<number>} The transaction ID
 */
function createTransaction(tx) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO transactions (
        date, amount, currency, description, type, property_id, category_id, 
        counterparty_id, document_id, isAutoGenerated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.date, 
        tx.amount, 
        tx.currency || 'EUR',
        tx.description,
        tx.type,
        tx.property_id,
        tx.category_id,
        tx.counterparty_id || null,
        tx.document_id || null,
        tx.isAutoGenerated || 1
      ],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

/**
 * Create a rent payment record
 * @param {object} payment - The rent payment data
 * @returns {Promise<number>} The rent payment ID
 */
function createRentPayment(payment) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO rent_payments (
        tenant_contract_id, date, amount, cold_rent_amount, side_costs_amount,
        status, payment_method, transaction_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.tenantContractId,
        payment.date,
        payment.amount,
        payment.coldRentAmount,
        payment.sideCostsAmount,
        payment.status || 'PENDING',
        payment.paymentMethod || null,
        payment.transactionId || null,
        payment.notes || null
      ],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

/**
 * Check if a rent payment already exists for a contract on a specific date
 * @param {number} tenantContractId - The contract ID
 * @param {string} date - The payment date (ISO format)
 * @returns {Promise<boolean>} True if duplicate exists
 */
async function checkRentPaymentDuplicate(tenantContractId, date) {
  const existing = await getRentPaymentsForContract(tenantContractId);
  return existing.some(p => p.date === date);
}

// ============================================================================
// Core Automation Logic
// ============================================================================

/**
 * Determine if a payment should be created for a contract on a specific date
 * @param {object} contract - The tenant contract
 * @param {Date} paymentDate - The proposed payment date
 * @param {Date} today - The current date
 * @returns {boolean} True if payment should be created
 */
function shouldCreatePayment(contract, paymentDate, today) {
  // Don't create payments for future dates (only past and today)
  // Rent is paid in advance at end of preceding month, so we create when the date passes
  if (paymentDate > today) {
    return false;
  }

  // Check if contract is active on payment date
  if (!isContractActiveOnDate(contract, paymentDate)) {
    return false;
  }

  return true;
}

/**
 * Create rent payment and linked transaction for a specific date
 * @param {object} contract - The tenant contract
 * @param {Date} date - The payment date
 * @param {Array} categories - List of categories
 * @returns {Promise<object>} The created payment and transaction info
 */
async function createRentPaymentForDate(contract, date, categories) {
  const dateStr = date.toISOString().split('T')[0];
  
  // Find or create "Rent (Warm)" category
  let rentCategory = categories.find(c => c.name === 'Rent (Warm)');
  
  if (!rentCategory) {
    logRentAction(`Creating "Rent (Warm)" category for contract ${contract.id}`);
    // Create the category
    const categoryId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO categories (name, type, isTaxRelevant) VALUES (?, ?, ?)`,
        ['Rent (Warm)', 'INCOME', 1],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
    rentCategory = { id: categoryId, name: 'Rent (Warm)', type: 'INCOME', isTaxRelevant: 1 };
    categories.push(rentCategory);
  }

  // Calculate warm rent
  const warmRent = calculateWarmRent(contract.coldRent, contract.sideCosts);
  
  // Get property name for description
  const propertyName = await new Promise((resolve) => {
    db.get('SELECT name FROM properties WHERE id = ?', [contract.propertyId], (err, row) => {
      resolve(row ? row.name : `Property ${contract.propertyId}`);
    });
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const description = `Rent Payment: ${propertyName} - ${month} ${year}`;

  // Create transaction
  const transactionId = await createTransaction({
    date: dateStr,
    amount: warmRent,
    currency: 'EUR',
    description: description,
    type: 'INCOME',
    property_id: contract.propertyId,
    category_id: rentCategory.id,
    counterparty_id: null,
    document_id: null,
    isAutoGenerated: 1
  });

  // Create rent payment linked to transaction
  const rentPaymentId = await createRentPayment({
    tenantContractId: contract.id,
    date: dateStr,
    amount: warmRent,
    coldRentAmount: contract.coldRent,
    sideCostsAmount: contract.sideCosts,
    status: 'PENDING',
    paymentMethod: null,
    transactionId: transactionId,
    notes: `Auto-generated by rent automation`
  });

  return {
    paymentId: rentPaymentId,
    transactionId: transactionId,
    date: dateStr,
    amount: warmRent,
    contractId: contract.id
  };
}

/**
 * Process a single tenant contract and create payments as needed
 * @param {object} contract - The tenant contract
 * @param {Date} today - The current date
 * @param {Array} existingPayments - Already existing rent payments
 * @param {Array} categories - List of categories
 * @returns {Promise<Array>} List of created payment info objects
 */
async function processTenantContract(contract, today, existingPayments, categories) {
  const results = [];
  
  try {
    // Start from contract start date
    let currentDate = new Date(contract.startDate + 'T00:00:00Z');
    const todayStart = new Date(today);
    todayStart.setUTCHours(0, 0, 0, 0);

    // Process payments from start date, covering past dates and up to 12 months into the future
    const maxIterations = 24; // Max 24 months to handle old contracts
    for (let i = 0; i < maxIterations; i++) {
      if (!currentDate) {
        break;
      }

      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Check if payment already exists for this date using the helper function
      const isDuplicate = await checkRentPaymentDuplicate(contract.id, dateStr);
      if (isDuplicate) {
        currentDate = calculateNextPaymentDate(contract, currentDate);
        continue;
      }

      // Check if we should create payment
      if (shouldCreatePayment(contract, currentDate, todayStart)) {
        const result = await createRentPaymentForDate(contract, currentDate, categories);
        results.push(result);
        logRentAction(`Created rent payment ${result.paymentId} for contract ${contract.id} on ${dateStr}`);
      }

      // Move to next payment date
      currentDate = calculateNextPaymentDate(contract, currentDate);
      
      // Stop if we've gone beyond 12 months into the future
      if (currentDate && currentDate > todayStart) {
        const monthsAhead = Math.ceil((currentDate - todayStart) / (30 * 24 * 60 * 60 * 1000));
        if (monthsAhead > 12) {
          break;
        }
      }
    }

  } catch (error) {
    logRentError(error, { contractId: contract.id, contractName: contract.id });
    // Continue processing other contracts even if one fails
  }

  return results;
}

/**
 * Main function to process all tenant contracts and create rent payments
 * @returns {Promise<object>} Processing results
 */
async function processRentPayments() {
  logRentAction('Starting rent payment automation...');
  
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  try {
    // Get all active contracts
    const contractRows = await getActiveTenantContracts();
    logRentAction(`Found ${contractRows.length} active tenant contracts`);
    
    // Map database rows to frontend format
    const contracts = contractRows.map(mapTenantContract);

    // Get all existing rent payments
    const existingPaymentRows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM rent_payments', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    const existingPayments = existingPaymentRows.map(mapRentPayment);
    
    // Get all categories
    const categories = await getAllCategories();

    // Process each contract
    const allResults = [];
    for (const contract of contracts) {
      const results = await processTenantContract(contract, today, existingPayments, categories);
      allResults.push(...results);
    }

    logRentAction(`Rent payment automation completed. Created ${allResults.length} rent payments.`);
    
    return {
      success: true,
      count: allResults.length,
      contractsProcessed: contracts.length,
      results: allResults
    };

  } catch (error) {
    logRentError(error, { context: 'processRentPayments' });
    return {
      success: false,
      error: error.message,
      contractsProcessed: 0,
      count: 0
    };
  }
}

/**
 * Entry point for rent automation - runs the full process
 * @returns {Promise<object>} Processing results
 */
async function runRentAutomation() {
  const result = await processRentPayments();
  return result;
}

// ============================================================================
// Scheduler
// ============================================================================

let rentScheduler = null;

/**
 * Start the rent automation scheduler
 * Runs daily at 1:00 AM Europe/Berlin timezone
 */
function startRentScheduler() {
  // Stop existing scheduler if running
  if (rentScheduler) {
    rentScheduler.stop();
    logRentAction('Stopped existing rent scheduler');
  }

  try {
    // Schedule to run daily at 1:00 AM Europe/Berlin timezone
    // Cron expression: minute hour day-of-month month day-of-week
    // '0 1 * * *' = At 01:00 (1:00 AM) every day
    // With timezone "Europe/Berlin", this ensures 1:00 AM local time
    rentScheduler = cron.schedule(
      '0 1 * * *', // 1:00 AM in the specified timezone
      async () => {
        logRentAction('Rent scheduler triggered at ' + new Date().toISOString());
        const result = await runRentAutomation();
        logRentAction(`Rent automation run: ${result.count} payments created, ${result.contractsProcessed} contracts processed`);
      },
      {
        scheduled: true,
        timezone: "Europe/Berlin"
      }
    );

    logRentAction('Rent automation scheduler started. Runs daily at 1:00 AM Europe/Berlin');
  } catch (error) {
    logRentError(error, { context: 'startRentScheduler' });
  }
}

/**
 * Manually trigger rent automation (for testing/debugging)
 * @returns {Promise<object>} Processing results
 */
function triggerRentAutomation() {
  return runRentAutomation();
}

// ============================================================================
// Module Exports
// ============================================================================

module.exports = {
  startRentScheduler,
  triggerRentAutomation,
  runRentAutomation,
  processRentPayments,
  getActiveTenantContracts,
  getTenantContractById,
  getRentPaymentsForContract,
  getAllCategories,
  getCategoryByName,
  getAllTransactions,
  createTransaction,
  createRentPayment,
  checkRentPaymentDuplicate,
  getLastDayOfPreviousMonth,
  calculateNextPaymentDate,
  isContractActiveOnDate,
  calculateWarmRent,
  getDaysInMonth,
  logRentAction,
  logRentError,
};
