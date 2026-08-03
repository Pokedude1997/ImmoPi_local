/**
 * ImmoPi Manager - Complete Backend API
 * 
 * Full REST API with CRUD operations for all entities
 * Frontend communicates exclusively through these endpoints
 */

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
// const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const rootEnvPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: rootEnvPath });

const { login, logout, requireAuth } = require('./auth-middleware');
const { startMortgageScheduler, handlePropertyMortgageEvent } = require('./mortgage-automation');
const { hasMortgageChanged, hasMortgageData, hasRecurringPaymentChanged } = require('./event-detector');
const { startRecurringScheduler, handleRecurringPaymentEvent } = require('./recurring-automation');
const { startRentScheduler, triggerRentAutomation, handleTenantContractEvent, checkRentPaymentDuplicate, createRentTransaction, createRentPaymentAndTransaction, getTenantContractById, SOURCE_TAGS: RENT_SOURCE_TAGS } = require('./rent-automation');
const { SOURCE_TAGS: AUTOMATION_SOURCE_TAGS } = require('./automation-utils');
const { 
  validatePropertyCreation, validatePropertyUpdate,
  validateTenantContractCreation, validateTenantContractUpdate,
  validateRentPaymentCreation, validateRentPaymentUpdate,
  calculateWarmRent, getDefaultPaymentDay,
  logError, databaseErrorHandler 
} = require('./utils/validation');
const { logRentAction, logRentError } = require('./rent-automation');
// const { performBackup, startBackupScheduler } = require('./backup');
// const { validateAndSanitize } = require('./ai-validator');
// const { uploadDocument, getDocumentLink, deleteDocument, initializeDriveClient } = require('./drive-storage');

const app = express();
// Set port based on environment (NODE_ENV takes priority over PORT)
const PORT = (process.env.NODE_ENV === 'test' ? 8001 : process.env.NODE_ENV === 'production' ? 8000 : process.env.PORT) || 8000;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes('*');

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS origin denied: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Serve static files from root directory for frontend, but exclude /api routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next(); // Skip static files for API routes
  }
  express.static(path.resolve(__dirname, '..'))(req, res, next);
});

// Handle root route by serving index.html
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'index.html'));
});

// Serve index.tsx as well since it's referenced in index.html
app.get('/index.tsx', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'index.tsx'));
});

const logsDir = path.join(__dirname, 'logs');
const uploadsDir = path.join(__dirname, 'uploads');
[logsDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Set database path based on environment
const dbPath = process.env.NODE_ENV === 'test' 
  ? path.join(__dirname, '..', 'databases', 'test.db') 
  : path.join(__dirname, '..', 'databases', 'production.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('❌ DB Error:', err.message);
  else console.log(`✅ Connected to SQLite database: ${path.basename(dbPath)}`);
});

// ============================================================================
// TYPE NORMALIZATION HELPERS
// Normalize between database format (INCOME/EXPENSE) and frontend format (Income/Expense)
// ============================================================================

/**
 * Normalize database type (uppercase) to frontend TypeScript enum format
 * @param {string} dbType - Database type value (INCOME, EXPENSE)
 * @returns {string} Normalized type (Income, Expense)
 */
function normalizeType(dbType) {
  if (!dbType) return dbType;
  const upper = String(dbType).toUpperCase();
  if (upper === 'INCOME') return 'Income';
  if (upper === 'EXPENSE') return 'Expense';
  return dbType;
}

/**
 * Normalize frontend TypeScript enum format to database format
 * @param {string} tsType - Frontend type value (Income, Expense, INCOME, EXPENSE)
 * @returns {string} Database type (INCOME, EXPENSE)
 */
function normalizeTypeForDB(tsType) {
  if (!tsType) return tsType;
  const upper = String(tsType).toUpperCase();
  if (upper === 'INCOME') return 'INCOME';
  if (upper === 'EXPENSE') return 'EXPENSE';
  return upper;
}

// Create all tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    type TEXT,
    purchasePrice REAL,
    purchaseDate TEXT,
    rentAmount REAL,
    size REAL,
    mortgage_loanAmount REAL,
    mortgage_startDate TEXT,
    mortgage_interestRate REAL,
    mortgage_principalRate REAL,
    mortgage_bankName TEXT,
    mortgage_paymentTiming TEXT,
    notes TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    property_id INTEGER,
    leaseStart TEXT,
    leaseEnd TEXT,
    rentAmount REAL,
    deposit REAL,
    notes TEXT,
    FOREIGN KEY (property_id) REFERENCES properties(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    isTaxRelevant INTEGER DEFAULT 0
  )`);

  // Seed default categories if empty
  db.get('SELECT COUNT(*) as count FROM categories', [], (err, row) => {
    if (!err && row.count === 0) {
      const defaultCategories = [
        ['Rent (Warm)', 'INCOME', 1],
        ['Rent (Cold)', 'INCOME', 1],
        ['Side Costs', 'INCOME', 1],
        ['Maintenance / Repairs', 'EXPENSE', 1],
        ['Hausgeld (HOA Fee)', 'EXPENSE', 1],
        ['Electricity', 'EXPENSE', 1],
        ['Internet/Phone', 'EXPENSE', 1],
        ['Property Tax', 'EXPENSE', 1],
        ['Insurance', 'EXPENSE', 1],
        ['Mortgage Interest', 'EXPENSE', 1],
        ['Mortgage Principal', 'EXPENSE', 0],
      ];
      const stmt = db.prepare('INSERT INTO categories (name, type, isTaxRelevant) VALUES (?, ?, ?)');
      defaultCategories.forEach(cat => stmt.run(cat));
      stmt.finalize();
      console.log('✅ Seeded default categories');
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS counterparties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    contactPerson TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    description TEXT,
    type TEXT NOT NULL,
    property_id INTEGER,
    category_id INTEGER,
    counterparty_id INTEGER,
    document_id INTEGER,
    isAutoGenerated INTEGER DEFAULT 0,
    source TEXT,
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (counterparty_id) REFERENCES counterparties(id),
    FOREIGN KEY (document_id) REFERENCES documents(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    upload_date TEXT NOT NULL,
    document_date TEXT,
    document_type TEXT,
    amount REAL,
    currency TEXT,
    property_id INTEGER,
    category_id INTEGER,
    counterparty_id INTEGER,
    notes TEXT,
    FOREIGN KEY (property_id) REFERENCES properties(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recurring_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'EUR',
    frequency TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT,
    nextDueDate TEXT,
    category_id INTEGER,
    property_id INTEGER,
    counterparty_id INTEGER,
    isActive INTEGER DEFAULT 1,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (counterparty_id) REFERENCES counterparties(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    currency TEXT DEFAULT 'EUR',
    taxYear INTEGER DEFAULT 2026
  )`);

  // Seed default settings
  db.get('SELECT * FROM settings WHERE id = 1', [], (err, row) => {
    if (!err && !row) {
      db.run("INSERT INTO settings (id, currency, taxYear) VALUES (1, 'EUR', 2026)");
    }
  });

  // Automation state table - tracks last run dates
  db.run(`CREATE TABLE IF NOT EXISTS automation_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    lastMortgageRun TEXT
  )`);

  // Seed default automation state
  db.get('SELECT * FROM automation_state WHERE id = 1', [], (err, row) => {
    if (!err && !row) {
      db.run("INSERT INTO automation_state (id) VALUES (1)");
    }
  });

  // Add isCurrent column to tenants table (SQLite doesn't support IF NOT EXISTS for ALTER TABLE)
  db.run(`ALTER TABLE tenants ADD COLUMN isCurrent INTEGER DEFAULT 1`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding isCurrent column:', err.message);
    }
  });

  // Tenant contracts table for rent management
  db.run(`CREATE TABLE IF NOT EXISTS tenant_contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    cold_rent REAL NOT NULL,
    side_costs REAL NOT NULL DEFAULT 0,
    payment_day_of_month INTEGER NOT NULL DEFAULT 31,
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (property_id) REFERENCES properties(id)
  )`);

  // Rent payments table
  db.run(`CREATE TABLE IF NOT EXISTS rent_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_contract_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    cold_rent_amount REAL NOT NULL,
    side_costs_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    payment_method TEXT,
    transaction_id INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_contract_id) REFERENCES tenant_contracts(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
  )`);
});

// ============================================================================
// AUTHENTICATION
// ============================================================================

app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  
  const result = await login(password);
  if (result.success) {
    res.cookie('sessionToken', result.token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'strict',
    });
    res.json({ success: true, token: result.token, expiresAt: result.expiresAt });
  } else {
    res.status(401).json({ error: result.error });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.sessionToken;
  logout(token);
  res.clearCookie('sessionToken');
  res.json({ success: true });
});

app.get('/api/auth/check', requireAuth, (req, res) => {
  res.json({ authenticated: true });
});

// ============================================================================
// PROPERTIES CRUD
// ============================================================================

app.get('/api/properties', requireAuth, (req, res) => {
  db.all('SELECT * FROM properties', [], (err, rows) => {
    if (err) {
      logError(err, { context: 'GET /api/properties', user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    // Normalize ID to string for frontend consistency
    // Transform flat mortgage columns to nested mortgage object
    const mappedRows = rows.map(row => {
      const hasMortgage = row.mortgage_loanAmount !== null && row.mortgage_loanAmount !== undefined;
      
      return {
        ...row,
        id: String(row.id),
        // Build mortgage object from flat columns
        mortgage: hasMortgage ? {
          loanAmount: row.mortgage_loanAmount,
          startDate: row.mortgage_startDate,
          interestRate: row.mortgage_interestRate,
          principalRate: row.mortgage_principalRate,
          bankName: row.mortgage_bankName,
          paymentTiming: row.mortgage_paymentTiming,
        } : undefined,
        // Remove flat mortgage columns from response to avoid confusion
        mortgage_loanAmount: undefined,
        mortgage_startDate: undefined,
        mortgage_interestRate: undefined,
        mortgage_principalRate: undefined,
        mortgage_bankName: undefined,
        mortgage_paymentTiming: undefined,
      };
    });
    res.json(mappedRows);
  });
});

app.get('/api/properties/:id', requireAuth, (req, res) => {
  db.get('SELECT * FROM properties WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      logError(err, { context: 'GET /api/properties/:id', propertyId: req.params.id, user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) return res.status(404).json({ error: 'Property not found' });
    
    // Transform flat mortgage columns to nested mortgage object
    const hasMortgage = row.mortgage_loanAmount !== null && row.mortgage_loanAmount !== undefined;
    const mappedRow = {
      ...row,
      id: String(row.id),
      mortgage: hasMortgage ? {
        loanAmount: row.mortgage_loanAmount,
        startDate: row.mortgage_startDate,
        interestRate: row.mortgage_interestRate,
        principalRate: row.mortgage_principalRate,
        bankName: row.mortgage_bankName,
        paymentTiming: row.mortgage_paymentTiming,
      } : undefined,
      // Remove flat mortgage columns
      mortgage_loanAmount: undefined,
      mortgage_startDate: undefined,
      mortgage_interestRate: undefined,
      mortgage_principalRate: undefined,
      mortgage_bankName: undefined,
      mortgage_paymentTiming: undefined,
    };
    
    res.json(mappedRow);
  });
});

app.post('/api/properties', requireAuth, validatePropertyCreation, (req, res) => {
  const { name, address, type, purchasePrice, purchaseDate, rentAmount, size, mortgage, notes } = req.validatedBody;
  const m = mortgage || {};
  
  db.run(
    `INSERT INTO properties (name, address, type, purchasePrice, purchaseDate, rentAmount, size,
      mortgage_loanAmount, mortgage_startDate, mortgage_interestRate, mortgage_principalRate,
      mortgage_bankName, mortgage_paymentTiming, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, address, type, purchasePrice, purchaseDate, rentAmount, size,
      m.loanAmount, m.startDate, m.interestRate, m.principalRate, m.bankName, m.paymentTiming, notes],
    function(err) {
      if (err) {
        logError(err, { context: 'POST /api/properties', user: req.user?.id });
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const propertyId = this.lastID;
      
      // Trigger mortgage automation for this property if it has mortgage data
      // Fetch the created property data to pass to event handler
      db.get('SELECT * FROM properties WHERE id = ?', [propertyId], (fetchErr, propertyRow) => {
        if (fetchErr) {
          console.error('Error fetching created property for mortgage automation:', fetchErr.message);
          // Don't fail the response - mortgage automation can be retried
          return;
        }
        
        if (propertyRow && hasMortgageData(propertyRow)) {
          // Trigger mortgage automation asynchronously
          handlePropertyMortgageEvent(propertyRow)
            .then(result => {
              if (result.success && result.count > 0) {
                console.log(`✅ Mortgage automation for new property ${propertyRow.name}: ${result.count} transactions created`);
              } else if (!result.success) {
                console.error(`❌ Mortgage automation failed for property ${propertyRow.name}: ${result.error}`);
              }
            })
            .catch(err => {
              console.error('❌ Error in mortgage automation for new property:', err.message);
            });
        }
      });
      
      res.json({ id: propertyId });
    }
  );
});

app.put('/api/properties/:id', requireAuth, validatePropertyUpdate, (req, res) => {
  const { name, address, type, purchasePrice, purchaseDate, rentAmount, size, mortgage, notes } = req.validatedBody;
  const m = mortgage || {};
  const propertyId = req.params.id;
  
  // First, fetch the old property data to check if mortgage data changed
  db.get('SELECT * FROM properties WHERE id = ?', [propertyId], (fetchErr, oldPropertyRow) => {
    if (fetchErr) {
      logError(fetchErr, { context: 'PUT /api/properties - fetch old property', propertyId, user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!oldPropertyRow) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Perform the update
    db.run(
      `UPDATE properties SET name=?, address=?, type=?, purchasePrice=?, purchaseDate=?, rentAmount=?, size=?,
        mortgage_loanAmount=?, mortgage_startDate=?, mortgage_interestRate=?, mortgage_principalRate=?,
        mortgage_bankName=?, mortgage_paymentTiming=?, notes=?
      WHERE id=?`,
      [name, address, type, purchasePrice, purchaseDate, rentAmount, size,
        m.loanAmount, m.startDate, m.interestRate, m.principalRate, m.bankName, m.paymentTiming, notes, propertyId],
      function(err) {
        if (err) {
          logError(err, { context: 'PUT /api/properties', propertyId, user: req.user?.id });
          return res.status(500).json({ error: 'Internal server error' });
        }
        if (this.changes === 0) return res.status(404).json({ error: 'Property not found' });
        
        // Fetch the updated property data
        db.get('SELECT * FROM properties WHERE id = ?', [propertyId], (updatedFetchErr, updatedPropertyRow) => {
          if (updatedFetchErr) {
            console.error('Error fetching updated property for mortgage automation:', updatedFetchErr.message);
            // Don't fail the response - mortgage automation can be retried
            return;
          }
          
          // Trigger mortgage automation only if mortgage data exists and changed
          // Use database data for consistency and existing utility function
          if (updatedPropertyRow) {
            // Check if mortgage data changed using the utility function
            // hasMortgageChanged will return false if either property doesn't have mortgage data
            const mortgageChanged = hasMortgageChanged(updatedPropertyRow, oldPropertyRow);
            
            if (mortgageChanged) {
              handlePropertyMortgageEvent(updatedPropertyRow, oldPropertyRow)
                .then(result => {
                  if (result.success && result.count > 0) {
                    console.log(`✅ Mortgage automation for updated property ${updatedPropertyRow.name}: ${result.count} transactions created`);
                  } else if (!result.success) {
                    console.error(`❌ Mortgage automation failed for updated property ${updatedPropertyRow.name}: ${result.error}`);
                  }
                })
                .catch(err => {
                  console.error('❌ Error in mortgage automation for updated property:', err.message);
                });
            }
          }
          
          res.json({ success: true });
        });
      }
    );
  });
});

app.delete('/api/properties/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM properties WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      logError(err, { context: 'DELETE /api/properties/:id', propertyId: req.params.id, user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ success: true });
  });
});

// ============================================================================
// TENANTS CRUD
// ============================================================================

app.get('/api/tenants', requireAuth, (req, res) => {
  db.all('SELECT * FROM tenants', [], (err, rows) => {
    if (err) {
      logError(err, { context: 'GET /api/tenants', user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    // Map database schema to frontend schema
    const mappedRows = rows.map(row => ({
      id: String(row.id),
      name: row.firstName && row.lastName ? `${row.firstName} ${row.lastName}`.trim() : (row.firstName || row.lastName || ''),
      propertyId: row.property_id ? String(row.property_id) : null,
      startDate: row.leaseStart || null,
      endDate: row.leaseEnd || null,
      isCurrent: row.isCurrent !== undefined ? Boolean(row.isCurrent) : true,
      notes: row.notes || null,
    }));
    res.json(mappedRows);
  });
});

app.post('/api/tenants', requireAuth, (req, res) => {
  const { name, propertyId, startDate, endDate, isCurrent, notes } = req.body;
  
  // Split name into first and last (simple split on first space)
  const nameParts = name ? name.trim().split(/\s+/, 2) : [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts[1] || '';
  
  db.run(
    'INSERT INTO tenants (firstName, lastName, property_id, leaseStart, leaseEnd, isCurrent, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [firstName, lastName, propertyId, startDate, endDate, isCurrent ? 1 : 0, notes],
    function(err) {
      if (err) {
        logError(err, { context: 'POST /api/tenants', user: req.user?.id });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ id: String(this.lastID) });
    }
  );
});

app.put('/api/tenants/:id', requireAuth, (req, res) => {
  const { name, propertyId, startDate, endDate, isCurrent, notes } = req.body;
  
  // Split name into first and last (simple split on first space)
  const nameParts = name ? name.trim().split(/\s+/, 2) : [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts[1] || '';
  
  db.run(
    'UPDATE tenants SET firstName=?, lastName=?, property_id=?, leaseStart=?, leaseEnd=?, isCurrent=?, notes=? WHERE id=?',
    [firstName, lastName, propertyId, startDate, endDate, isCurrent ? 1 : 0, notes, req.params.id],
    function(err) {
      if (err) {
        logError(err, { context: 'PUT /api/tenants/:id', tenantId: req.params.id, user: req.user?.id });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/tenants/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM tenants WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ success: true });
  });
});

// ============================================================================
// CATEGORIES CRUD
// ============================================================================

app.get('/api/categories', requireAuth, (req, res) => {
  db.all('SELECT * FROM categories', [], (err, rows) => {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    // Normalize ID to string and type to frontend format for frontend consistency
    const mappedRows = rows.map(row => ({
      ...row,
      id: String(row.id),
      type: normalizeType(row.type),
      isTaxRelevant: Boolean(row.isTaxRelevant),
    }));
    res.json(mappedRows);
  });
});

app.post('/api/categories', requireAuth, (req, res) => {
  const { name, type, isTaxRelevant } = req.body;
  db.run('INSERT INTO categories (name, type, isTaxRelevant) VALUES (?, ?, ?)',
    [name, normalizeTypeForDB(type), isTaxRelevant ? 1 : 0],
    function(err) {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ id: this.lastID });
    }
  );
});

app.put('/api/categories/:id', requireAuth, (req, res) => {
  const { name, type, isTaxRelevant } = req.body;
  db.run('UPDATE categories SET name=?, type=?, isTaxRelevant=? WHERE id=?',
    [name, normalizeTypeForDB(type), isTaxRelevant ? 1 : 0, req.params.id],
    function(err) {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/categories/:id', requireAuth, (req, res) => {
  const categoryId = req.params.id;

  // Check if category is in use in any related tables
  db.get(
    'SELECT (SELECT COUNT(*) FROM transactions WHERE category_id = ?) + ' +
    '(SELECT COUNT(*) FROM recurring_payments WHERE category_id = ?) + ' +
    '(SELECT COUNT(*) FROM documents WHERE category_id = ?) as totalUses',
    [categoryId, categoryId, categoryId],
    (err, row) => {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row.totalUses > 0) {
        return res.status(400).json({
          error: 'Cannot delete category: it is used in existing transactions, recurring payments, or documents'
        });
      }

      db.run('DELETE FROM categories WHERE id = ?', [categoryId], function(err) {
        if (err) {
          logError(err, { context: 'database operation' });
          return res.status(500).json({ error: 'Internal server error' });
        }
        if (this.changes === 0) return res.status(404).json({ error: 'Category not found' });
        res.json({ success: true });
      });
    }
  );
});

// ============================================================================
// TRANSACTIONS CRUD
// ============================================================================

app.get('/api/transactions', requireAuth, (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY date DESC', [], (err, rows) => {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    // Map and normalize ID fields to strings and type to frontend format for frontend consistency
    const mappedRows = rows.map(row => ({
      id: String(row.id),
      date: ensureValidDate(row.date),
      amount: row.amount,
      currency: row.currency || 'EUR',
      description: row.description || '',
      type: normalizeType(row.type),
      // Map foreign keys to camelCase + convert to strings
      propertyId: row.property_id ? String(row.property_id) : null,
      categoryId: row.category_id ? String(row.category_id) : null,
      counterpartyId: row.counterparty_id ? String(row.counterparty_id) : null,
      documentId: row.document_id ? String(row.document_id) : null,
      isAutoGenerated: Boolean(row.isAutoGenerated),
    }));
    res.json(mappedRows);
  });
});

app.post('/api/transactions', requireAuth, (req, res) => {
  const { date, amount, currency, description, type, property_id, category_id, counterparty_id, document_id } = req.body;
  db.run(
    'INSERT INTO transactions (date, amount, currency, description, type, property_id, category_id, counterparty_id, document_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [date, amount, currency || 'EUR', description, normalizeTypeForDB(type), property_id, category_id, counterparty_id, document_id],
    function(err) {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ id: this.lastID });
    }
  );
});

app.put('/api/transactions/:id', requireAuth, (req, res) => {
  const { date, amount, currency, description, type, property_id, category_id, counterparty_id, document_id } = req.body;
  db.run(
    'UPDATE transactions SET date=?, amount=?, currency=?, description=?, type=?, property_id=?, category_id=?, counterparty_id=?, document_id=? WHERE id=?',
    [date, amount, currency, description, normalizeTypeForDB(type), property_id, category_id, counterparty_id, document_id, req.params.id],
    function(err) {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/transactions/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM transactions WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ success: true });
  });
});

// ============================================================================
// COUNTERPARTIES CRUD
// ============================================================================

app.get('/api/counterparties', requireAuth, (req, res) => {
  db.all('SELECT * FROM counterparties', [], (err, rows) => {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    // Normalize ID to string for frontend consistency
    const mappedRows = rows.map(row => ({
      ...row,
      id: String(row.id),
    }));
    res.json(mappedRows);
  });
});

app.post('/api/counterparties', requireAuth, (req, res) => {
  const { name, type, contactPerson, email, phone, address, notes } = req.body;
  db.run(
    'INSERT INTO counterparties (name, type, contactPerson, email, phone, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, type, contactPerson, email, phone, address, notes],
    function(err) {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ id: this.lastID });
    }
  );
});

app.put('/api/counterparties/:id', requireAuth, (req, res) => {
  const { name, type, contactPerson, email, phone, address, notes } = req.body;
  db.run(
    'UPDATE counterparties SET name=?, type=?, contactPerson=?, email=?, phone=?, address=?, notes=? WHERE id=?',
    [name, type, contactPerson, email, phone, address, notes, req.params.id],
    function(err) {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/counterparties/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM counterparties WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ success: true });
  });
});

// ============================================================================
// RECURRING PAYMENTS CRUD
// ============================================================================

// Helper function to ensure valid date string
function ensureValidDate(dateValue) {
  if (!dateValue || dateValue === 'null' || dateValue === 'undefined') {
    return new Date().toISOString().split('T')[0];
  }
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return dateValue;
}

app.get('/api/recurring-payments', requireAuth, (req, res) => {
  db.all('SELECT * FROM recurring_payments', [], (err, rows) => {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    // Map database snake_case field names to frontend camelCase expectations
    // AND convert INTEGER IDs to strings to match TypeScript EntityId = string
    const mappedRows = rows.map(row => ({
      id: String(row.id),
      name: row.name,
      type: row.type ? normalizeType(row.type) : null,
      amount: row.amount,
      currency: row.currency || 'EUR',
      frequency: row.frequency,
      startDate: ensureValidDate(row.startDate),
      endDate: row.endDate ? ensureValidDate(row.endDate) : null,
      nextDueDate: ensureValidDate(row.nextDueDate) || ensureValidDate(row.startDate),
      active: Boolean(row.isActive),
      // Map snake_case foreign keys to camelCase + convert to strings
      propertyId: row.property_id ? String(row.property_id) : null,
      categoryId: row.category_id ? String(row.category_id) : null,
      counterpartyId: row.counterparty_id ? String(row.counterparty_id) : null,
    }));
    res.json(mappedRows);
  });
});

app.post('/api/recurring-payments', requireAuth, (req, res) => {
  const { name, amount, currency, frequency, startDate, endDate, nextDueDate, category_id, property_id, counterparty_id, isActive } = req.body;
  db.run(
    'INSERT INTO recurring_payments (name, amount, currency, frequency, startDate, endDate, nextDueDate, category_id, property_id, counterparty_id, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, amount, currency || 'EUR', frequency, startDate, endDate, nextDueDate || startDate, category_id, property_id, counterparty_id, isActive ? 1 : 0],
    function(err) {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const recurringPaymentId = this.lastID;
      
      // Trigger recurring payment automation for this payment
      db.get('SELECT * FROM recurring_payments WHERE id = ?', [recurringPaymentId], (fetchErr, paymentRow) => {
        if (fetchErr) {
          console.error('Error fetching created recurring payment for automation:', fetchErr.message);
          // Don't fail the response - automation can be retried
          return;
        }
        
        if (paymentRow) {
          // Trigger recurring payment automation asynchronously
          handleRecurringPaymentEvent(paymentRow)
            .then(result => {
              if (result.success && result.count > 0) {
                console.log(`✅ Recurring automation for new payment ${paymentRow.name}: ${result.count} transactions created`);
              } else if (!result.success) {
                console.error(`❌ Recurring automation failed for payment ${paymentRow.name}: ${result.error}`);
              }
            })
            .catch(err => {
              console.error('❌ Error in recurring automation for new payment:', err.message);
            });
        }
      });
      
      res.json({ id: recurringPaymentId });
    }
  );
});

app.put('/api/recurring-payments/:id', requireAuth, (req, res) => {
  const { name, amount, currency, frequency, startDate, endDate, nextDueDate, category_id, property_id, counterparty_id, isActive, active } = req.body;
  // Support both isActive and active field names
  const isActiveValue = isActive !== undefined ? isActive : active;
  const recurringPaymentId = req.params.id;
  
  // First, fetch the old recurring payment data to check if parameters changed
  db.get('SELECT * FROM recurring_payments WHERE id = ?', [recurringPaymentId], (fetchErr, oldPaymentRow) => {
    if (fetchErr) {
      logError(fetchErr, { context: 'PUT /api/recurring-payments - fetch old payment', recurringPaymentId });
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!oldPaymentRow) {
      return res.status(404).json({ error: 'Recurring payment not found' });
    }
    
    // Perform the update
    db.run(
      'UPDATE recurring_payments SET name=?, amount=?, currency=?, frequency=?, startDate=?, endDate=?, nextDueDate=?, category_id=?, property_id=?, counterparty_id=?, isActive=? WHERE id=?',
      [name, amount, currency, frequency, startDate, endDate, nextDueDate, category_id, property_id, counterparty_id, isActiveValue ? 1 : 0, recurringPaymentId],
      function(err) {
        if (err) {
          logError(err, { context: 'database operation' });
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (this.changes === 0) return res.status(404).json({ error: 'Recurring payment not found' });
        
        // Fetch the updated recurring payment data
        db.get('SELECT * FROM recurring_payments WHERE id = ?', [recurringPaymentId], (updatedFetchErr, updatedPaymentRow) => {
          if (updatedFetchErr) {
            console.error('Error fetching updated recurring payment for automation:', updatedFetchErr.message);
            // Don't fail the response - automation can be retried
            return;
          }
          
          if (updatedPaymentRow) {
            // Check if recurring payment parameters changed
            const paymentChanged = hasRecurringPaymentChanged(updatedPaymentRow, oldPaymentRow);
            
            if (paymentChanged) {
              // Trigger recurring payment automation
              handleRecurringPaymentEvent(updatedPaymentRow, oldPaymentRow)
                .then(result => {
                  if (result.success && result.count > 0) {
                    console.log(`✅ Recurring automation for updated payment ${updatedPaymentRow.name}: ${result.count} transactions created`);
                  } else if (!result.success) {
                    console.error(`❌ Recurring automation failed for updated payment ${updatedPaymentRow.name}: ${result.error}`);
                  }
                })
                .catch(err => {
                  console.error('❌ Error in recurring automation for updated payment:', err.message);
                });
            }
          }
          
          res.json({ success: true });
        });
      }
    );
  });
});

app.delete('/api/recurring-payments/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM recurring_payments WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ success: true });
  });
});

// ============================================================================
// SETTINGS
// ============================================================================

app.get('/api/settings', requireAuth, (req, res) => {
  db.get('SELECT * FROM settings WHERE id = 1', [], (err, row) => {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(row || { currency: 'EUR', taxYear: 2026 /* googleDriveFolderId: '' */ });
  });
});

app.put('/api/settings', requireAuth, (req, res) => {
  const { currency, taxYear /* googleDriveFolderId */ } = req.body;
  db.run(
    'UPDATE settings SET currency=?, taxYear=? WHERE id=1',
    [currency, taxYear /* , googleDriveFolderId */],
    function(err) {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ success: true });
    }
  );
});

// ============================================================================
// DOCUMENTS
// ============================================================================

app.get('/api/documents', requireAuth, (req, res) => {
  db.all('SELECT d.*, p.name as property_name FROM documents d LEFT JOIN properties p ON d.property_id = p.id ORDER BY d.upload_date DESC', [], (err, rows) => {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    // Map and normalize ID fields to strings for frontend consistency
    const mappedRows = rows.map(doc => ({
      ...doc,
      id: String(doc.id),
      uploadDate: ensureValidDate(doc.upload_date),
      documentDate: doc.document_date ? ensureValidDate(doc.document_date) : null,
      // Map foreign keys to camelCase + convert to strings
      propertyId: doc.property_id ? String(doc.property_id) : null,
      categoryId: doc.category_id ? String(doc.category_id) : null,
      counterpartyId: doc.counterparty_id ? String(doc.counterparty_id) : null,
      driveLink: null
    }));
    res.json(mappedRows);
  });
});

app.get('/api/documents/:id', requireAuth, (req, res) => {
  db.get('SELECT d.*, p.name as property_name FROM documents d LEFT JOIN properties p ON d.property_id = p.id WHERE d.id = ?', [req.params.id], (err, row) => {
    if (err) {
      logError(err, { context: 'database operation' });
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) return res.status(404).json({ error: 'Document not found' });
    // row.driveLink = row.google_drive_id ? getDocumentLink(row.google_drive_id) : null;
    row.driveLink = null;
    res.json(row);
  });
});

app.delete('/api/documents/:id', requireAuth, async (req, res) => {
  try {
    /* const doc = await new Promise((resolve, reject) => {
      db.get('SELECT google_drive_id FROM documents WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Delete from Google Drive
    if (doc.google_drive_id) {
      await deleteDocument(doc.google_drive_id);
    } */

    // Delete from database
    db.run('DELETE FROM documents WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ success: true });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const upload = multer({ dest: uploadsDir });

/*
function logAIFailure(fileName, errorType, details) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | ${fileName} | ${errorType} | ${JSON.stringify(details)}\n`;
  const logFile = path.join(logsDir, `ai-failures-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logEntry);
}

async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`⚠️  Retry ${attempt}/${maxRetries} after ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}
*/

/*
app.post('/api/documents/analyze', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fileName = req.file.originalname || req.file.filename;
  console.log(`\n📄 Processing: ${fileName}`);
  
  let driveFileId = null;

  try {
    // AI Analysis
    if (!process.env.API_KEY) throw new Error('API_KEY not configured');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Data = fileBuffer.toString('base64');
    
    const response = await retryWithBackoff(async () => {
      return await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: req.file.mimetype, data: base64Data } },
            { text: "Extract: date (ISO), amount (number), currency (CHF/EUR/USD), documentType (Invoice/Receipt/Contract/Utility Bill/Tax Statement/Other). JSON only." }
          ]
        },
        config: { responseMimeType: "application/json" }
      });
    });

    const parsedResponse = JSON.parse(response.text);
    const validationResult = validateAndSanitize(parsedResponse);
    const aiData = validationResult.success ? validationResult.data : parsedResponse;

    // Upload to Drive
    const propertyId = req.body.propertyId;
    let propertyName = 'Unassigned';
    if (propertyId) {
      const property = await new Promise((resolve, reject) => {
        db.get('SELECT name FROM properties WHERE id = ?', [propertyId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (property) propertyName = property.name;
    }

    const uploadResult = await uploadDocument({
      filePath: req.file.path,
      originalName: fileName,
      mimeType: req.file.mimetype,
      propertyName,
      documentType: aiData?.documentType || 'Other',
      documentDate: aiData?.date,
    });

    driveFileId = uploadResult.fileId;

    // Save to database
    const documentId = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO documents (file_name, original_name, mime_type, upload_date, document_date, document_type, amount, currency, property_id, notes, google_drive_id, google_drive_path, ai_analysis_raw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uploadResult.fileName, fileName, req.file.mimetype, new Date().toISOString(), aiData?.date || null, aiData?.documentType || 'Other', aiData?.amount || null, aiData?.currency || null, propertyId || null, req.body.notes || null, uploadResult.fileId, uploadResult.folderPath, JSON.stringify(parsedResponse)],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      documentId,
      driveFileId,
      driveLink: getDocumentLink(driveFileId),
      folderPath: uploadResult.folderPath,
      aiData,
      validationErrors: validationResult?.success === false ? validationResult.errors : null,
    });
  } catch (error) {
    logAIFailure(fileName, 'PROCESSING_ERROR', { message: error.message, driveFileId });
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Processing failed', message: error.message, driveFileId });
  }
});
*/

// ============================================================================
// AUTOMATION
// ============================================================================

app.post('/api/automation/run-mortgage', requireAuth, async (req, res) => {
  try {
    const { runMortgageAutomation } = require('./mortgage-automation');
    // Force run when called via API (skip monthly check)
    const result = await runMortgageAutomation(true);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/automation/run-recurring', requireAuth, async (req, res) => {
  try {
    const { runRecurringAutomation } = require('./recurring-automation');
    const result = await runRecurringAutomation();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/automation/run-all', requireAuth, async (req, res) => {
  try {
    const { runMortgageAutomation } = require('./mortgage-automation');
    const { runRecurringAutomation } = require('./recurring-automation');
    
    // Force run for all automations when called via API
    const mortgageResult = await runMortgageAutomation(true);
    const recurringResult = await runRecurringAutomation();
    const rentResult = await triggerRentAutomation();
    
    const allLogs = [...mortgageResult.logs || [], ...recurringResult.logs || [], ...rentResult.logs || []];
    const totalCount = (mortgageResult.count || 0) + (recurringResult.count || 0) + (rentResult.count || 0);
    
    res.json({ 
      success: true, 
      logs: allLogs, 
      count: totalCount,
      mortgage: mortgageResult,
      recurring: recurringResult,
      rent: rentResult
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// TENANT CONTRACTS CRUD
// ============================================================================

// Helper function to map tenant_contracts from DB (snake_case) to frontend (camelCase)
function mapTenantContract(row) {
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
    // Computed property
    warmRent: calculateWarmRent(row.cold_rent, row.side_costs),
  };
}

// GET /api/tenant-contracts - List all contracts
app.get('/api/tenant-contracts', requireAuth, (req, res) => {
  db.all('SELECT * FROM tenant_contracts', [], (err, rows) => {
    if (err) {
      logError(err, { context: 'GET /api/tenant-contracts', user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    const mappedRows = rows.map(mapTenantContract);
    res.json(mappedRows);
  });
});

// GET /api/tenant-contracts/:id - Get specific contract
app.get('/api/tenant-contracts/:id', requireAuth, (req, res) => {
  db.get('SELECT * FROM tenant_contracts WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      logError(err, { context: 'GET /api/tenant-contracts/:id', contractId: req.params.id, user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Tenant contract not found' });
    }
    res.json(mapTenantContract(row));
  });
});

// POST /api/tenant-contracts - Create contract
app.post('/api/tenant-contracts', requireAuth, validateTenantContractCreation, async (req, res) => {
  const {
    tenantId, propertyId, startDate, endDate, coldRent, sideCosts, 
    paymentDayOfMonth, isActive, notes
  } = req.validatedBody;
  
  // Validate that tenant and property exist
  try {
    const tenantExists = await new Promise((resolve) => {
      db.get('SELECT id FROM tenants WHERE id = ?', [tenantId], (err, row) => {
        resolve(row !== undefined);
      });
    });
    
    if (!tenantExists) {
      return res.status(400).json({
        error: `Tenant with ID ${tenantId} does not exist`,
      });
    }
    
    const propertyExists = await new Promise((resolve) => {
      db.get('SELECT id FROM properties WHERE id = ?', [propertyId], (err, row) => {
        resolve(row !== undefined);
      });
    });
    
    if (!propertyExists) {
      return res.status(400).json({
        error: `Property with ID ${propertyId} does not exist`,
      });
    }
  } catch (validationErr) {
    logError(validationErr, { context: 'POST /api/tenant-contracts validation', user: req.user?.id });
    return res.status(500).json({ error: 'Internal server error' });
  }
  
  // Calculate warm rent
  const warmRent = calculateWarmRent(coldRent, sideCosts);
  
  db.run(
    `INSERT INTO tenant_contracts (
      tenant_id, property_id, start_date, end_date, cold_rent, side_costs, 
      payment_day_of_month, is_active, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, propertyId, startDate, endDate, coldRent, sideCosts, 
     paymentDayOfMonth, isActive ? 1 : 0, notes],
    function(err) {
      if (err) {
        logError(err, { context: 'POST /api/tenant-contracts', user: req.user?.id });
        return res.status(500).json({ error: 'Internal server error' });
      }
      // Return the created contract with warmRent
      const createdContract = {
        id: String(this.lastID),
        tenantId,
        propertyId,
        startDate,
        endDate,
        coldRent,
        sideCosts,
        paymentDayOfMonth,
        isActive,
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        warmRent,
      };
      
      // Trigger rent automation for this specific contract (event-driven)
      const contractId = this.lastID;
      db.get('SELECT * FROM tenant_contracts WHERE id = ?', [contractId], (fetchErr, contractRow) => {
        if (fetchErr) {
          console.error('Error fetching created contract for automation:', fetchErr.message);
          // Don't fail the response - automation can be retried
          return res.status(201).json(createdContract);
        }
        
        if (contractRow) {
          // Trigger rent payment automation asynchronously for this specific contract
          handleTenantContractEvent(contractRow)
            .then(result => {
              if (result.success && result.count > 0) {
                console.log(`✅ Rent automation for new contract ${contractRow.id}: ${result.count} payments created`);
              } else if (!result.success) {
                console.error(`❌ Rent automation failed for contract ${contractRow.id}: ${result.error}`);
              }
            })
            .catch(err => {
              console.error('❌ Error in rent automation for new contract:', err.message);
            });
        }
        
        res.status(201).json(createdContract);
      });
    }
  );
});

// PUT /api/tenant-contracts/:id - Update contract
app.put('/api/tenant-contracts/:id', requireAuth, validateTenantContractUpdate, (req, res) => {
  const { tenantId, propertyId, startDate, endDate, coldRent, sideCosts, 
          paymentDayOfMonth, isActive, notes } = req.validatedBody;
  const contractId = req.params.id;
  
  // First, fetch the old contract data for change detection
  db.get('SELECT * FROM tenant_contracts WHERE id = ?', [contractId], (fetchErr, oldContractRow) => {
    if (fetchErr) {
      logError(fetchErr, { context: 'PUT /api/tenant-contracts/:id - fetch old contract', contractId });
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!oldContractRow) {
      return res.status(404).json({ error: 'Tenant contract not found' });
    }
    
    // Validate that tenant and property exist if they are being updated
    const totalValidations = (tenantId ? 1 : 0) + (propertyId ? 1 : 0);
    let validationsCompleted = 0;
    const contractIdParam = contractId;
    
    if (totalValidations > 0) {
      if (tenantId) {
        db.get('SELECT id FROM tenants WHERE id = ?', [tenantId], (err, row) => {
          if (err) {
            logError(err, { context: 'PUT tenant-contract tenant validation', contractId: contractIdParam });
            return res.status(500).json({ error: 'Internal server error' });
          }
          if (!row) {
            return res.status(400).json({ error: `Tenant with ID ${tenantId} does not exist` });
          }
          validationsCompleted++;
          if (validationsCompleted === totalValidations) proceedWithUpdate(oldContractRow);
        });
      }
      
      if (propertyId) {
        db.get('SELECT id FROM properties WHERE id = ?', [propertyId], (err, row) => {
          if (err) {
            logError(err, { context: 'PUT tenant-contract property validation', contractId: contractIdParam });
            return res.status(500).json({ error: 'Internal server error' });
          }
          if (!row) {
            return res.status(400).json({ error: `Property with ID ${propertyId} does not exist` });
          }
          validationsCompleted++;
          if (validationsCompleted === totalValidations) proceedWithUpdate(oldContractRow);
        });
      }
    } else {
      proceedWithUpdate(oldContractRow);
    }
    
    function proceedWithUpdate(oldContract) {
      db.run(
        `UPDATE tenant_contracts SET
          tenant_id = ?, property_id = ?, start_date = ?, end_date = ?,
          cold_rent = ?, side_costs = ?, payment_day_of_month = ?, is_active = ?, notes = ?
        WHERE id = ?`,
        [tenantId, propertyId, startDate, endDate, coldRent, sideCosts, 
         paymentDayOfMonth, isActive ? 1 : 0, notes, contractIdParam],
        function(err) {
          if (err) {
            logError(err, { context: 'PUT /api/tenant-contracts/:id', contractId: contractIdParam, user: req.user?.id });
            return res.status(500).json({ error: 'Internal server error' });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Tenant contract not found' });
          }
          // Fetch updated contract to return
          db.get('SELECT * FROM tenant_contracts WHERE id = ?', [contractIdParam], (err2, row) => {
            if (err2) {
              logError(err2, { context: 'PUT /api/tenant-contracts/:id fetch', contractId: contractIdParam });
              return res.status(500).json({ error: 'Internal server error' });
            }
            
            // Trigger rent payment automation asynchronously if payment terms changed
            handleTenantContractEvent(row, oldContract)
              .then(result => {
                if (result.success && result.count > 0) {
                  console.log(`✅ Rent automation for updated contract ${row.id}: ${result.count} payments created`);
                } else if (!result.success) {
                  console.error(`❌ Rent automation failed for contract ${row.id}: ${result.error}`);
                }
              })
              .catch(err => {
                console.error('❌ Error in rent automation for updated contract:', err.message);
              });
            
            res.json(mapTenantContract(row));
          });
        }
      );
    }
  });
});

// DELETE /api/tenant-contracts/:id - Delete contract
app.delete('/api/tenant-contracts/:id', requireAuth, (req, res) => {
  // First check if contract has rent payments
  db.all('SELECT id FROM rent_payments WHERE tenant_contract_id = ?', [req.params.id], (err, rows) => {
    if (err) {
      logError(err, { context: 'DELETE /api/tenant-contracts/:id check', contractId: req.params.id, user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (rows && rows.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete contract with existing rent payments',
        count: rows.length
      });
    }
    
    // Safe to delete
    db.run('DELETE FROM tenant_contracts WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        logError(err, { context: 'DELETE /api/tenant-contracts/:id', contractId: req.params.id, user: req.user?.id });
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Tenant contract not found' });
      }
      res.json({ success: true });
    });
  });
});

// GET /api/tenants/:tenantId/contracts - Contracts for specific tenant
app.get('/api/tenants/:tenantId/contracts', requireAuth, (req, res) => {
  const tenantId = parseInt(req.params.tenantId, 10);
  
  // Validate that tenant exists (IDOR protection)
  db.get('SELECT id FROM tenants WHERE id = ?', [tenantId], (err, row) => {
    if (err) {
      logError(err, { context: 'GET /api/tenants/:tenantId/contracts', tenantId: req.params.tenantId, user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: `Tenant with ID ${tenantId} not found` });
    }
    
    db.all('SELECT * FROM tenant_contracts WHERE tenant_id = ?', [tenantId], (err, rows) => {
      if (err) {
        logError(err, { context: 'GET /api/tenants/:tenantId/contracts', tenantId: req.params.tenantId, user: req.user?.id });
        return res.status(500).json({ error: 'Internal server error' });
      }
      const mappedRows = rows.map(mapTenantContract);
      res.json(mappedRows);
    });
  });
});

// ============================================================================
// RENT PAYMENTS CRUD
// ============================================================================

// Helper function to map rent_payments from DB (snake_case) to frontend (camelCase)
function mapRentPayment(row) {
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

// GET /api/rent-payments - List all payments
app.get('/api/rent-payments', requireAuth, (req, res) => {
  const { tenantId, contractId, status, limit = 50, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM rent_payments';
  const params = [];
  
  // Build WHERE clause based on query params
  if (tenantId) {
    query += ' WHERE tenant_contract_id IN (SELECT id FROM tenant_contracts WHERE tenant_id = ?)';
    params.push(tenantId);
  } else if (contractId) {
    query += ' WHERE tenant_contract_id = ?';
    params.push(contractId);
  }
  
  if (status) {
    query += (params.length > 0 ? ' AND' : ' WHERE') + ' status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  db.all(query, params, (err, rows) => {
    if (err) {
      logError(err, { context: 'GET /api/rent-payments', user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    const mappedRows = rows.map(mapRentPayment);
    res.json(mappedRows);
  });
});

// GET /api/rent-payments/:id - Get specific payment
app.get('/api/rent-payments/:id', requireAuth, (req, res) => {
  db.get('SELECT * FROM rent_payments WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      logError(err, { context: 'GET /api/rent-payments/:id', paymentId: req.params.id, user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Rent payment not found' });
    }
    res.json(mapRentPayment(row));
  });
});

// POST /api/rent-payments - Record manual payment
app.post('/api/rent-payments', requireAuth, validateRentPaymentCreation, async (req, res) => {
  const {
    tenantContractId, date, amount, coldRentAmount, sideCostsAmount,
    status = 'PAID', paymentMethod, transactionId, notes
  } = req.validatedBody;
  
  try {
    // Check for duplicate payment
    const isDuplicate = await checkRentPaymentDuplicate(tenantContractId, date);
    if (isDuplicate) {
      return res.status(409).json({
        error: 'Rent payment already exists for this contract on this date'
      });
    }
    
    // Get contract details to create linked transaction
    const contract = await getTenantContractById(parseInt(tenantContractId, 10));
    if (!contract) {
      return res.status(404).json({ error: `Contract with ID ${tenantContractId} not found` });
    }
    
    // Calculate warm rent
    const warmRent = amount || (coldRentAmount + sideCostsAmount);
    
    // Get categories
    const categories = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM categories', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Find rent category
    let rentCategory = categories.find(c => c.name === 'Rent (Warm)');
    if (!rentCategory) {
      // Create it if it doesn't exist
      const categoryId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO categories (name, type, isTaxRelevant) VALUES (?, ?, ?)`,
          ['Rent (Warm)', 'INCOME', 1],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      rentCategory = { id: categoryId, name: 'Rent (Warm)', type: 'INCOME', isTaxRelevant: 1 };
      categories.push(rentCategory);
    }
    
    // Map contract from DB format to expected format
    const contractForTransaction = {
      id: contract.id,
      tenantId: String(contract.tenant_id),
      propertyId: String(contract.property_id),
      startDate: contract.start_date,
      endDate: contract.end_date,
      coldRent: contract.cold_rent,
      sideCosts: contract.side_costs,
      paymentDayOfMonth: contract.payment_day_of_month,
      isActive: Boolean(contract.is_active),
      notes: contract.notes,
    };
    
    // Create transaction and payment
    const dateObj = new Date(date + 'T00:00:00Z');
    const result = await createRentPaymentAndTransaction({
      contract: contractForTransaction,
      date: dateObj,
      warmRent,
      rentCategory,
      categories,
      status,
      isAutoGenerated: false
    });

    // Validate that transaction was created successfully
    if (!result.transactionId) {
      throw new Error('Failed to create linked transaction for rent payment');
    }
    
    res.status(201).json({
      id: String(result.paymentId),
      tenantContractId: String(contract.id),
      date: date,
      amount: result.amount,
      coldRentAmount: contract.cold_rent,
      sideCostsAmount: contract.side_costs,
      status: status,
      paymentMethod: paymentMethod || null,
      transactionId: String(result.transactionId),
      notes: notes || `Manual payment`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    logError(error, { context: 'POST /api/rent-payments', user: req.user?.id });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/rent-payments/:id - Update payment
app.put('/api/rent-payments/:id', requireAuth, validateRentPaymentUpdate, (req, res) => {
  const { tenantContractId, date, amount, coldRentAmount, sideCostsAmount,
          status, paymentMethod, transactionId, notes } = req.validatedBody;
  
  db.run(
    `UPDATE rent_payments SET
      tenant_contract_id = ?, date = ?, amount = ?, cold_rent_amount = ?, 
      side_costs_amount = ?, status = ?, payment_method = ?, 
      transaction_id = ?, notes = ?
    WHERE id = ?`,
    [tenantContractId, date, amount, coldRentAmount, sideCostsAmount,
     status, paymentMethod, transactionId, notes, req.params.id],
    function(err) {
      if (err) {
        logError(err, { context: 'PUT /api/rent-payments/:id', paymentId: req.params.id, user: req.user?.id });
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Rent payment not found' });
      }
      // Fetch updated payment to return
      db.get('SELECT * FROM rent_payments WHERE id = ?', [req.params.id], (err2, row) => {
        if (err2) {
          logError(err2, { context: 'PUT /api/rent-payments/:id fetch', paymentId: req.params.id });
          return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(mapRentPayment(row));
      });
    }
  );
});

// DELETE /api/rent-payments/:id - Delete payment
app.delete('/api/rent-payments/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM rent_payments WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      logError(err, { context: 'DELETE /api/rent-payments/:id', paymentId: req.params.id, user: req.user?.id });
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Rent payment not found' });
    }
    res.json({ success: true });
  });
});

// GET /api/tenants/:tenantId/rent-payments - Payments for specific tenant
app.get('/api/tenants/:tenantId/rent-payments', requireAuth, (req, res) => {
  db.all(
    `SELECT rp.* FROM rent_payments rp
     JOIN tenant_contracts tc ON rp.tenant_contract_id = tc.id
     WHERE tc.tenant_id = ?`,
    [req.params.tenantId],
    (err, rows) => {
      if (err) {
        logError(err, { context: 'GET /api/tenants/:tenantId/rent-payments', tenantId: req.params.tenantId, user: req.user?.id });
        return res.status(500).json({ error: 'Internal server error' });
      }
      const mappedRows = rows.map(mapRentPayment);
      res.json(mappedRows);
    }
  );
});

// GET /api/tenant-contracts/:contractId/rent-payments - Payments for specific contract
app.get('/api/tenant-contracts/:contractId/rent-payments', requireAuth, async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId, 10);
    
    // Validate that contract exists (IDOR protection)
    const contract = await getTenantContractById(contractId);
    if (!contract) {
      return res.status(404).json({ error: `Contract with ID ${contractId} not found` });
    }
    
    const rows = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM rent_payments WHERE tenant_contract_id = ?',
        [contractId],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });
    
    const mappedRows = rows.map(mapRentPayment);
    res.json(mappedRows);
  } catch (error) {
    logError(error, { context: 'GET /api/tenant-contracts/:contractId/rent-payments', contractId: req.params.contractId, user: req.user?.id });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// BACKUP
// ============================================================================

/*
app.post('/api/backup/manual', requireAuth, async (req, res) => {
  try {
    const result = await performBackup();
    res.json(result.success ? { success: true, message: 'Backup completed', details: result } : { success: false, error: 'Backup failed', details: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Backup failed', message: error.message });
  }
});
*/

// ============================================================================
// STARTUP
// ============================================================================

// initializeDriveClient();
// startBackupScheduler();
startMortgageScheduler();
startRecurringScheduler();
startRentScheduler();

// API endpoint for manual rent automation trigger
app.post('/api/automation/run-rent', requireAuth, async (req, res) => {
  try {
    logRentAction(`Manual rent automation triggered by user ${req.user?.id || 'unknown'}`);
    const result = await triggerRentAutomation();
    res.json({
      success: result.success,
      count: result.count,
      contractsProcessed: result.contractsProcessed,
      error: result.error
    });
  } catch (error) {
    logRentError(error, { context: 'POST /api/automation/run-rent', user: req.user?.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 ImmoPi Server running on http://192.168.1.18:${PORT}`);
  console.log(`🌐 Accessible from any device on the local network`);
  console.log(`⚡ Ready to accept requests\n`);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  db.close();
  process.exit(0);
});
