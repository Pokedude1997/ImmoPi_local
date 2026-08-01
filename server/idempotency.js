/**
 * Idempotency Module
 * 
 * Provides duplicate prevention functions for event-driven automation.
 * Ensures that multiple triggers don't create duplicate transactions or payments.
 */

const path = require('path');
const dbPath = path.join(__dirname, 'immopi.db');
const sqlite3 = require('sqlite3').verbose();

/**
 * Get a database connection for idempotency checks
 * @returns {object} SQLite database connection
 */
function getDatabaseConnection() {
  return new sqlite3.Database(dbPath);
}

/**
 * Check if a transaction already exists based on key attributes
 * @param {object} params - Transaction parameters
 * @param {string} params.description - Transaction description
 * @param {string} params.date - Transaction date (ISO format)
 * @param {number} params.amount - Transaction amount
 * @param {number} params.propertyId - Property ID
 * @param {number} params.categoryId - Category ID
 * @param {string} [params.source] - Source tag ('event-driven-*', 'batch-*')
 * @returns {Promise<boolean>} True if duplicate exists
 */
async function checkTransactionExists({ description, date, amount, propertyId, categoryId, source }) {
  const db = getDatabaseConnection();
  return new Promise((resolve, reject) => {
    let query = `
      SELECT id FROM transactions 
      WHERE description = ? 
        AND date = ? 
        AND amount = ? 
        AND property_id = ? 
        AND category_id = ?
    `;
    const params = [description, date, amount, propertyId, categoryId];
    
    // If source is provided, include it in the check
    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }
    
    db.get(query, params, (err, row) => {
      try {
        db.close();
      } catch (closeErr) {
        // Ignore close errors
      }
      if (err) {
        return reject(err);
      }
      resolve(!!row);
    });
  });
}

/**
 * Check if a rent payment already exists for a contract on a specific date
 * @param {number} tenantContractId - Tenant contract ID
 * @param {string} date - Payment date (ISO format)
 * @param {string} [source] - Source tag to filter by
 * @returns {Promise<boolean>} True if duplicate exists
 */
async function checkRentPaymentExists(tenantContractId, date, source) {
  const db = getDatabaseConnection();
  return new Promise((resolve, reject) => {
    let query = `
      SELECT id FROM rent_payments 
      WHERE tenant_contract_id = ? 
        AND date = ?
    `;
    const params = [tenantContractId, date];
    
    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }
    
    db.get(query, params, (err, row) => {
      try {
        db.close();
      } catch (closeErr) {
        // Ignore close errors
      }
      if (err) {
        return reject(err);
      }
      resolve(!!row);
    });
  });
}

/**
 * Check if a recurring payment transaction already exists
 * @param {object} params - Recurring payment transaction parameters
 * @param {string} params.description - Transaction description
 * @param {string} params.date - Transaction date (ISO format)
 * @param {number} params.amount - Transaction amount
 * @param {number} params.propertyId - Property ID
 * @param {number} params.categoryId - Category ID
 * @param {string} [params.source] - Source tag
 * @returns {Promise<boolean>} True if duplicate exists
 */
async function checkRecurringPaymentExists({ description, date, amount, propertyId, categoryId, source }) {
  const db = getDatabaseConnection();
  return new Promise((resolve, reject) => {
    let query = `
      SELECT id FROM transactions 
      WHERE description = ? 
        AND date = ? 
        AND amount = ? 
        AND property_id = ? 
        AND category_id = ?
    `;
    const params = [description, date, amount, propertyId, categoryId];
    
    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }
    
    db.get(query, params, (err, row) => {
      try {
        db.close();
      } catch (closeErr) {
        // Ignore close errors
      }
      if (err) {
        return reject(err);
      }
      resolve(!!row);
    });
  });
}

/**
 * Check if automation has already run for a specific entity and date range
 * @param {string} entityType - Type of entity: 'mortgage', 'recurring', 'rent'
 * @param {number} entityId - Entity ID
 * @param {string} startDate - Start date of the range
 * @param {string} endDate - End date of the range
 * @param {string} source - Source tag
 * @returns {Promise<boolean>} True if already processed
 */
async function checkAutomationAlreadyRan(entityType, entityId, startDate, endDate, source) {
  const db = getDatabaseConnection();
  return new Promise((resolve, reject) => {
    // Different queries based on entity type
    let query;
    let params;
    
    switch (entityType) {
      case 'mortgage':
        query = `
          SELECT id FROM transactions 
          WHERE property_id = ? 
            AND date >= ? 
            AND date <= ? 
            AND source = ?
          LIMIT 1
        `;
        params = [entityId, startDate, endDate, source];
        break;
        
      case 'recurring':
        query = `
          SELECT id FROM transactions 
          WHERE property_id = ? 
            AND date >= ? 
            AND date <= ? 
            AND source = ?
          LIMIT 1
        `;
        params = [entityId, startDate, endDate, source];
        break;
        
      case 'rent':
        query = `
          SELECT id FROM rent_payments 
          WHERE tenant_contract_id = ? 
            AND date >= ? 
            AND date <= ? 
            AND source = ?
          LIMIT 1
        `;
        params = [entityId, startDate, endDate, source];
        break;
        
      default:
        try {
          db.close();
        } catch (closeErr) {
          // Ignore close errors
        }
        return resolve(false);
    }
    
    db.get(query, params, (err, row) => {
      try {
        db.close();
      } catch (closeErr) {
        // Ignore close errors
      }
      if (err) {
        return reject(err);
      }
      resolve(!!row);
    });
  });
}

/**
 * Create a unique key for idempotency checking
 * @param {string} type - Entity type
 * @param {number} entityId - Entity ID
 * @param {string} date - Date
 * @param {string} action - Action type
 * @returns {string} Unique idempotency key
 */
function createIdempotencyKey(type, entityId, date, action) {
  return `${type}:${entityId}:${date}:${action}`;
}

/**
 * Check if an idempotency key has been processed
 * @param {string} key - Idempotency key
 * @returns {Promise<boolean>} True if already processed
 */
async function isIdempotencyKeyProcessed(key) {
  const db = getDatabaseConnection();
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM idempotency_keys WHERE key = ?', [key], (err, row) => {
      try {
        db.close();
      } catch (closeErr) {
        // Ignore close errors
      }
      if (err) {
        return reject(err);
      }
      resolve(!!row);
    });
  });
}

/**
 * Mark an idempotency key as processed
 * @param {string} key - Idempotency key
 * @param {string} [source] - Source tag
 * @returns {Promise<void>}
 */
async function markIdempotencyKeyProcessed(key, source) {
  const db = getDatabaseConnection();
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO idempotency_keys (key, source, processed_at) VALUES (?, ?, datetime("now"))',
      [key, source || 'unknown'],
      (err) => {
        try {
          db.close();
        } catch (closeErr) {
          // Ignore close errors
        }
        if (err) {
          return reject(err);
        }
        resolve();
      }
    );
  });
}

/**
 * Ensure idempotency_keys table exists
 * @returns {Promise<void>}
 */
async function ensureIdempotencyTable() {
  const db = getDatabaseConnection();
  try {
    await new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS idempotency_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          source TEXT,
          processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
    
    // Create index for faster lookups
    await new Promise((resolve, reject) => {
      db.run(
        'CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys(key)',
        (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  } finally {
    try {
      db.close();
    } catch (closeErr) {
      // Ignore close errors - connection might already be closed
      console.debug('Error closing idempotency table connection:', closeErr.message);
    }
  }
}

// Initialize the idempotency table when module is loaded
ensureIdempotencyTable().catch(err => {
  console.error('Failed to initialize idempotency table:', err.message);
});

module.exports = {
  checkTransactionExists,
  checkRentPaymentExists,
  checkRecurringPaymentExists,
  checkAutomationAlreadyRan,
  createIdempotencyKey,
  isIdempotencyKeyProcessed,
  markIdempotencyKeyProcessed,
  ensureIdempotencyTable
};
