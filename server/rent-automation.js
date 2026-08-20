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
const { SOURCE_TAGS } = require('./automation-utils');
const { hasPaymentTermsChanged } = require('./event-detector');

// Database connection - environment aware
const dbPath = process.env.NODE_ENV === 'test'
  ? path.join(__dirname, '..', 'databases', 'test.db')
  : path.join(__dirname, '..', 'databases', 'production.db');
const db = new sqlite3.Database(dbPath);

// Logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log rent automation actions with optional source tag
 * @param {string} message - Log message
 * @param {string} [source] - Source tag (e.g., 'event-driven-rent', 'batch-rent')
 */
function logRentAction(message, source) {
  const timestamp = new Date().toISOString();
  const sourceStr = source ? `[${source}]` : 'RENT';
  const logEntry = `${timestamp} | ${sourceStr} | ${message}\n`;
  fs.appendFileSync(path.join(logsDir, 'rent-automation.log'), logEntry);
}

/**
 * Log rent automation errors with optional source tag
 * @param {Error} error - Error object
 * @param {object} [details] - Additional details
 * @param {string} [source] - Source tag
 */
function logRentError(error, details = {}, source) {
  const timestamp = new Date().toISOString();
  const sourceStr = source ? `[${source}]` : 'RENT';
  const logEntry = `${timestamp} | ${sourceStr} | ERROR | ${error.message} | ${JSON.stringify(details)}\n`;
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
 * Get the last day of a given month
 * @param {Date} date - Any date in the target month
 * @returns {Date} Date set to the last day of the month at 00:00:00 UTC
 */
function getLastDayOfMonth(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = getDaysInMonth(year, month);
  return new Date(Date.UTC(year, month, lastDay));
}

/**
 * Calculate the first payment date for a contract
 * Rent is paid in advance at the end of the preceding month
 * According to German rental practice, rent is paid "in advance" (im Voraus)
 * at the end of the preceding month. For example:
 * - Contract starts 2026-06-01
 * - First payment is due on 2026-05-31 (end of May, BEFORE the contract starts)
 * 
 * ALWAYS uses the last day of the month, regardless of paymentDayOfMonth setting
 * 
 * @param {object} contract - The tenant contract with startDate
 * @returns {Date} The first payment date (at or before contract start date)
 */
function calculateFirstPaymentDate(contract) {
  // Start from contract start date
  const startDate = new Date((contract.startDate || contract.start_date) + 'T00:00:00Z');
  
  // For "paid in advance at end of preceding month", 
  // the first payment should be at the end of the month BEFORE the contract starts
  // Calculate the preceding month
  const firstPaymentMonth = new Date(startDate);
  firstPaymentMonth.setUTCMonth(firstPaymentMonth.getUTCMonth() - 1);
  
  // Always set to the last day of the preceding month
  return getLastDayOfMonth(firstPaymentMonth);
}

/**
 * Get number of days in a month
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @returns {number} Number of days in the month
 */
function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Parse a database ID from string to integer
 * Central helper for consistent ID conversion across the module
 * @param {string|number} id - The ID to parse
 * @returns {number|null} The parsed integer ID or null if undefined
 */
function parseDbId(id) {
  if (id === undefined || id === null) {
    return null;
  }
  return parseInt(id, 10);
}

/**
 * Calculate the next payment date for a contract
 * Always advances exactly one month and uses the last day of that month
 * to ensure rent is always paid at end of month regardless of month length
 * @param {object} contract - The tenant contract
 * @param {Date} fromDate - Calculate from this date
 * @returns {Date|null} Next payment date or null if contract is not active
 */
function calculateNextPaymentDate(contract, fromDate) {
  // Handle both snake_case (is_active) and camelCase (isActive) field names
  const isActive = contract.isActive || contract.is_active;
  if (!isActive) {
    return null;
  }

  // Always work from the provided fromDate, normalized to midnight UTC
  const calcFrom = new Date(fromDate);
  calcFrom.setUTCHours(0, 0, 0, 0);

  // Move to the first day of the next month from the FIRST day of current month
  // This ensures we always advance exactly one month, regardless of the current day
  const nextMonthBase = new Date(calcFrom);
  nextMonthBase.setUTCDate(1); // Go to first day of current month
  nextMonthBase.setUTCMonth(nextMonthBase.getUTCMonth() + 1); // Add one month
  
  // Always set to the last day of the next month
  return getLastDayOfMonth(nextMonthBase);
}

/**
 * Check if contract is active on a specific date
 * @param {object} contract - The tenant contract
 * @param {Date} date - The date to check
 * @returns {boolean} True if contract is active on the date
 */
function isContractActiveOnDate(contract, date) {
  // Handle both snake_case (start_date, end_date, is_active) and camelCase (startDate, endDate, isActive)
  const startDate = new Date((contract.startDate || contract.start_date) + 'T00:00:00Z');
  const endDate = (contract.endDate || contract.end_date) ? new Date((contract.endDate || contract.end_date) + 'T00:00:00Z') : null;
  const checkDate = new Date(date);
  checkDate.setUTCHours(0, 0, 0, 0);

  if (checkDate < startDate) {
    return false;
  }

  if (endDate && checkDate > endDate) {
    return false;
  }

  // Handle both snake_case (is_active) and camelCase (isActive) field names
  const isActive = contract.isActive || contract.is_active;
  return isActive === 1 || isActive === true;
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
 * @param {string} [tx.source] - Source tag for tracking
 * @returns {Promise<number>} The transaction ID
 */
function createTransaction(tx) {
  return new Promise((resolve, reject) => {
    // Always use static query with all columns including user_id
    // Missing values are set to NULL
    const userId = tx.user_id || null;
    
    db.run(
      `INSERT INTO transactions (date, amount, currency, description, type, property_id, category_id, counterparty_id, document_id, isAutoGenerated, source, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        tx.isAutoGenerated || 1,
        tx.source || null,
        userId
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
 * @param {string} [payment.source] - Source tag for tracking
 * @returns {Promise<number>} The rent payment ID
 */
function createRentPayment(payment) {
  return new Promise((resolve, reject) => {
    // Always use static query with all columns including user_id
    // Missing values are set to NULL
    const userId = payment.user_id || null;
    
    db.run(
      `INSERT INTO rent_payments (tenant_contract_id, date, amount, cold_rent_amount, side_costs_amount, status, payment_method, transaction_id, notes, source, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.tenantContractId ? parseInt(payment.tenantContractId, 10) : null,
        payment.date,
        payment.amount,
        payment.coldRentAmount,
        payment.sideCostsAmount,
        payment.status || 'PENDING',
        payment.paymentMethod || null,
        payment.transactionId || null,
        payment.notes || null,
        payment.source || null,
        userId
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

  // For rent paid in advance, the payment date can be before the contract start date
  // as long as it's for the first month of the contract
  const startDate = new Date((contract.startDate || contract.start_date) + 'T00:00:00Z');
  const paymentDateNormalized = new Date(paymentDate);
  paymentDateNormalized.setUTCHours(0, 0, 0, 0);
  
  // If payment date is before contract start, check if it's the first payment (end of preceding month)
  if (paymentDateNormalized < startDate) {
    // Calculate what the first payment date should be
    const firstPaymentMonth = new Date(startDate);
    firstPaymentMonth.setUTCMonth(firstPaymentMonth.getUTCMonth() - 1);
    const expectedFirstPaymentDate = getLastDayOfMonth(firstPaymentMonth);
    
    // Only allow if this is the expected first payment date
    if (paymentDateNormalized.getTime() !== expectedFirstPaymentDate.getTime()) {
      return false;
    }
    // For first payment, contract doesn't need to be active on payment date
    return true;
  }

  // Check if contract is active on payment date for subsequent payments
  if (!isContractActiveOnDate(contract, paymentDate)) {
    return false;
  }

  return true;
}

/**
 * Create a transaction for a rent payment
 * @param {object} param0 - Parameters for transaction creation
 * @param {object} param0.contract - The tenant contract
 * @param {Date} param0.date - The payment date
 * @param {number} param0.warmRent - The warm rent amount
 * @param {object} param0.rentCategory - The rent category
 * @param {Array} param0.categories - List of all categories (for auto-creation if needed)
 * @param {boolean} param0.isAutoGenerated - Whether the transaction is auto-generated
 * @param {string} [param0.source] - Source tag for tracking
 * @returns {Promise<object>} The created transaction info
 */
async function createRentTransaction({ contract, date, warmRent, rentCategory, categories, isAutoGenerated = true, source = null }) {
  const dateStr = date.toISOString().split('T')[0];
  
  // If no rent category provided, find or create "Rent (Warm)" category
  if (!rentCategory) {
    rentCategory = categories.find(c => c.name === 'Rent (Warm)');
    
    if (!rentCategory) {
      logRentAction(`Creating "Rent (Warm)" category for contract ${contract.id}`);
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
  }

  // Get property name for description
  const propertyIdInt = parseDbId(contract.propertyId);
  const propertyName = await new Promise((resolve) => {
    db.get('SELECT name FROM properties WHERE id = ?', [propertyIdInt], (err, row) => {
      resolve(row ? row.name : `Property ${contract.propertyId || 'unknown'}`);
    });
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const description = `Rent Payment: ${propertyName} - ${month} ${year}`;

  // Create transaction with source tag and user_id from contract
  const userId = contract.user_id || contract.userId;
  const transactionId = await createTransaction({
    date: dateStr,
    amount: warmRent,
    currency: 'EUR',
    description: description,
    type: 'INCOME',
    property_id: propertyIdInt,
    category_id: rentCategory.id,
    counterparty_id: null,
    document_id: null,
    isAutoGenerated: isAutoGenerated ? 1 : 0,
    source: source,
    user_id: userId
  });

  return {
    transactionId,
    date: dateStr,
    amount: warmRent,
    description
  };
}

/**
 * Create a rent payment record
 * @param {object} param0 - Parameters for payment creation
 * @param {object} param0.contract - The tenant contract
 * @param {Date} param0.date - The payment date
 * @param {number} param0.warmRent - The warm rent amount
 * @param {object} param0.rentCategory - The rent category
 * @param {Array} param0.categories - List of all categories
 * @param {string} param0.status - Payment status
 * @param {boolean} param0.isAutoGenerated - Whether the payment is auto-generated
 * @param {string} [param0.source] - Source tag for tracking
 * @returns {Promise<object>} The created payment and transaction info
 */
async function createRentPaymentAndTransaction({ contract, date, warmRent, rentCategory, categories, status = 'PENDING', isAutoGenerated = true, source = null }) {
  // Validate contract ID exists
  if (!contract || !contract.id) {
    throw new Error('Contract ID is required to create rent payment and transaction');
  }

  // Create transaction with source tag
  const { transactionId } = await createRentTransaction({
    contract,
    date,
    warmRent,
    rentCategory,
    categories,
    isAutoGenerated,
    source
  });

  // Calculate payment date string
  const dateStr = date.toISOString().split('T')[0];
  
  // Create rent payment linked to transaction with source tag and user_id
  const contractIdInt = parseDbId(contract.id);
  const userId = contract.user_id || contract.userId;
  const rentPaymentId = await createRentPayment({
    tenantContractId: contractIdInt,
    date: dateStr,
    amount: warmRent,
    coldRentAmount: contract.coldRent || contract.cold_rent,
    sideCostsAmount: contract.sideCosts || contract.side_costs,
    status: status,
    paymentMethod: null,
    transactionId: transactionId,
    notes: isAutoGenerated ? `Auto-generated by rent automation` : `Manual payment`,
    source: source,
    user_id: userId
  });

  return {
    paymentId: rentPaymentId,
    transactionId: transactionId,
    date: dateStr,
    amount: warmRent,
    contractId: contract.id,
    source: source
  };
}

/**
 * Create rent payment and linked transaction for a specific date
 * @param {object} contract - The tenant contract
 * @param {Date} date - The payment date
 * @param {Array} categories - List of categories
 * @param {string} [source] - Source tag for tracking
 * @returns {Promise<object>} The created payment and transaction info
 */
async function createRentPaymentForDate(contract, date, categories, source = null) {
  // Calculate warm rent
  const warmRent = calculateWarmRent(contract.coldRent || contract.cold_rent, contract.sideCosts || contract.side_costs);
  
  // Find rent category (pass null to let createRentPaymentAndTransaction handle it)
  return await createRentPaymentAndTransaction({
    contract,
    date,
    warmRent,
    rentCategory: null,
    categories,
    status: 'PENDING',
    isAutoGenerated: true,
    source: source
  });
}

/**
 * Process a single tenant contract and create payments as needed
 * @param {object} contract - The tenant contract (in database snake_case format)
 * @param {Date} today - The current date
 * @param {Array} existingPayments - Already existing rent payments
 * @param {Array} categories - List of categories
 * @param {string} [source] - Source tag for tracking (e.g., 'event-driven-rent', 'batch-rent')
 * @returns {Promise<Array>} List of created payment info objects
 */
async function processTenantContract(contract, today, existingPayments, categories, source = null) {
  const results = [];
  
  try {
    // Start from the first payment date (which may be before contract start for advance payments)
    let currentDate = calculateFirstPaymentDate(contract);
    const todayStart = new Date(today);
    todayStart.setUTCHours(0, 0, 0, 0);

    // Process payments from first payment date, covering past dates
    const maxIterations = 24; // Max 24 months to handle old contracts
    for (let i = 0; i < maxIterations; i++) {
      if (!currentDate) {
        break;
      }

      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Check if payment already exists for this date using the helper function
      const contractIdInt = parseDbId(contract.id);
      const isDuplicate = await checkRentPaymentDuplicate(contractIdInt, dateStr);
      if (isDuplicate) {
        currentDate = calculateNextPaymentDate(contract, currentDate);
        continue;
      }

      // Check if we should create payment
      if (shouldCreatePayment(contract, currentDate, todayStart)) {
        try {
          const result = await createRentPaymentForDate(contract, currentDate, categories, source);
          
          // Validate that transaction was created successfully
          if (!result.transactionId) {
            throw new Error(`Failed to create linked transaction for payment on ${dateStr}`);
          }
          
          results.push(result);
          logRentAction(`Created rent payment ${result.paymentId} for contract ${contract.id || 'unknown'} on ${dateStr}`, source);
        } catch (error) {
          logRentError(error, { contractId: contract.id, date: dateStr, context: 'createRentPaymentForDate' }, source);
          // Continue with next payment date even if this one failed
        }
      }

      // Move to next payment date
      currentDate = calculateNextPaymentDate(contract, currentDate);
      
      // Note: 12-month restriction removed to allow processing all relevant dates
    }

  } catch (error) {
    logRentError(error, { contractId: contract.id, contractName: contract.id }, source);
    // Continue processing other contracts even if one fails
  }

  return results;
}

// ============================================================================
// EVENT HANDLER
// ============================================================================

/**
 * Handle tenant contract event and create rent payments automatically
 * @param {object} contract - New/updated tenant contract data (from database, snake_case)
 * @param {object} [oldContract] - Previous tenant contract data (for updates, from database, snake_case)
 * @param {object} [options] - Additional options
 * @param {string} [options.source] - Override source tag
 * @returns {Promise<object>} Result with success status, logs, and count
 */
async function handleTenantContractEvent(contract, oldContract = null, options = {}) {
  const source = options.source || SOURCE_TAGS.EVENT_DRIVEN_RENT;
  const logs = [];
  
  try {
    // For updates: check if payment terms actually changed
    if (oldContract && !hasPaymentTermsChanged(contract, oldContract)) {
      return { 
        success: true, 
        logs: [`⏭️  Contract payment terms unchanged for contract ${contract.id} - skipping`], 
        count: 0 
      };
    }
    
    // Only process active contracts
    // Handle both snake_case (is_active) and camelCase (isActive) field names
    const isActive = contract.isActive || contract.is_active;
    if (isActive !== 1 && isActive !== true) {
      return { 
        success: true, 
        logs: [`⏭️  Contract ${contract.id} is not active - skipping`], 
        count: 0 
      };
    }
    
    // Get all necessary data from database
    const [existingPayments, categories] = await Promise.all([
      new Promise((resolve, reject) => {
        db.all('SELECT * FROM rent_payments', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      getAllCategories()
    ]);
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // Process tenant contract payments
    const paymentResults = await processTenantContract(
      contract,
      today,
      existingPayments,
      categories,
      source
    );
    
    logs.push(`✅ Processed contract ${contract.id}: ${paymentResults.length} payments created`);
    
    return { 
      success: true, 
      logs, 
      count: paymentResults.length,
      contractId: contract.id
    };
    
  } catch (error) {
    logRentError(error, { contractId: contract.id, source, context: 'handleTenantContractEvent' });
    return { 
      success: false, 
      error: error.message,
      logs: [`❌ Error processing contract ${contract.id}: ${error.message}`],
      count: 0,
      contractId: contract.id
    };
  }
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Main function to process all tenant contracts and create rent payments
 * @param {string} [source] - Source tag for tracking (defaults to BATCH_RENT)
 * @returns {Promise<object>} Processing results
 */
async function processRentPayments(source = SOURCE_TAGS.BATCH_RENT) {
  logRentAction('Starting rent payment automation...', source);
  
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  try {
    // Get all active contracts
    const contractRows = await getActiveTenantContracts();
    logRentAction(`Found ${contractRows.length} active tenant contracts`, source);
    
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
    for (const contract of contractRows) {
      const results = await processTenantContract(contract, today, existingPayments, categories, source);
      allResults.push(...results);
    }

    logRentAction(`Rent payment automation completed. Created ${allResults.length} rent payments.`, source);
    
    return {
      success: true,
      count: allResults.length,
      contractsProcessed: contracts.length,
      results: allResults
    };

  } catch (error) {
    logRentError(error, { context: 'processRentPayments' }, source);
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
  processTenantContract,
  handleTenantContractEvent,
  getActiveTenantContracts,
  getTenantContractById,
  getRentPaymentsForContract,
  getAllCategories,
  getCategoryByName,
  getAllTransactions,
  createTransaction,
  createRentPayment,
  createRentTransaction,
  createRentPaymentAndTransaction,
  createRentPaymentForDate,
  checkRentPaymentDuplicate,
  calculateNextPaymentDate,
  calculateFirstPaymentDate,
  getLastDayOfMonth,
  parseDbId,
  isContractActiveOnDate,
  calculateWarmRent,
  getDaysInMonth,
  shouldCreatePayment,
  logRentAction,
  logRentError,
  SOURCE_TAGS
};
