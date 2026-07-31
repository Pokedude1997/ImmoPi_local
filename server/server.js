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
const { startMortgageScheduler } = require('./mortgage-automation');
const { startRecurringScheduler } = require('./recurring-automation');
const { validatePropertyCreation, validatePropertyUpdate, logError, databaseErrorHandler } = require('./utils/validation');
// const { performBackup, startBackupScheduler } = require('./backup');
// const { validateAndSanitize } = require('./ai-validator');
// const { uploadDocument, getDocumentLink, deleteDocument, initializeDriveClient } = require('./drive-storage');

const app = express();
const PORT = process.env.PORT || 8000;

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

const db = new sqlite3.Database('./immopi.db', (err) => {
  if (err) console.error('❌ DB Error:', err.message);
  else console.log('✅ Connected to SQLite database.');
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
      res.json({ id: this.lastID });
    }
  );
});

app.put('/api/properties/:id', requireAuth, validatePropertyUpdate, (req, res) => {
  const { name, address, type, purchasePrice, purchaseDate, rentAmount, size, mortgage, notes } = req.validatedBody;
  const m = mortgage || {};
  
  db.run(
    `UPDATE properties SET name=?, address=?, type=?, purchasePrice=?, purchaseDate=?, rentAmount=?, size=?,
      mortgage_loanAmount=?, mortgage_startDate=?, mortgage_interestRate=?, mortgage_principalRate=?,
      mortgage_bankName=?, mortgage_paymentTiming=?, notes=?
    WHERE id=?`,
    [name, address, type, purchasePrice, purchaseDate, rentAmount, size,
      m.loanAmount, m.startDate, m.interestRate, m.principalRate, m.bankName, m.paymentTiming, notes, req.params.id],
    function(err) {
      if (err) {
        logError(err, { context: 'PUT /api/properties', propertyId: req.params.id, user: req.user?.id });
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Property not found' });
      res.json({ success: true });
    }
  );
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
    // Normalize IDs to strings and map foreign keys
    const mappedRows = rows.map(row => ({
      ...row,
      id: String(row.id),
      propertyId: row.property_id ? String(row.property_id) : null,
    }));
    res.json(mappedRows);
  });
});

app.post('/api/tenants', requireAuth, (req, res) => {
  const { firstName, lastName, email, phone, property_id, leaseStart, leaseEnd, rentAmount, deposit, notes } = req.body;
  db.run(
    'INSERT INTO tenants (firstName, lastName, email, phone, property_id, leaseStart, leaseEnd, rentAmount, deposit, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [firstName, lastName, email, phone, property_id, leaseStart, leaseEnd, rentAmount, deposit, notes],
    function(err) {
      if (err) {
        logError(err, { context: 'POST /api/tenants', user: req.user?.id });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ id: this.lastID });
    }
  );
});

app.put('/api/tenants/:id', requireAuth, (req, res) => {
  const { firstName, lastName, email, phone, property_id, leaseStart, leaseEnd, rentAmount, deposit, notes } = req.body;
  db.run(
    'UPDATE tenants SET firstName=?, lastName=?, email=?, phone=?, property_id=?, leaseStart=?, leaseEnd=?, rentAmount=?, deposit=?, notes=? WHERE id=?',
    [firstName, lastName, email, phone, property_id, leaseStart, leaseEnd, rentAmount, deposit, notes, req.params.id],
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
      res.json({ id: this.lastID });
    }
  );
});

app.put('/api/recurring-payments/:id', requireAuth, (req, res) => {
  const { name, amount, currency, frequency, startDate, endDate, nextDueDate, category_id, property_id, counterparty_id, isActive, active } = req.body;
  // Support both isActive and active field names
  const isActiveValue = isActive !== undefined ? isActive : active;
  db.run(
    'UPDATE recurring_payments SET name=?, amount=?, currency=?, frequency=?, startDate=?, endDate=?, nextDueDate=?, category_id=?, property_id=?, counterparty_id=?, isActive=? WHERE id=?',
    [name, amount, currency, frequency, startDate, endDate, nextDueDate, category_id, property_id, counterparty_id, isActiveValue ? 1 : 0, req.params.id],
    function(err) {
      if (err) {
        logError(err, { context: 'database operation' });
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ success: true });
    }
  );
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
    
    // Force run for both automations when called via API
    const mortgageResult = await runMortgageAutomation(true);
    const recurringResult = await runRecurringAutomation();
    
    const allLogs = [...mortgageResult.logs || [], ...recurringResult.logs || []];
    const totalCount = (mortgageResult.count || 0) + (recurringResult.count || 0);
    
    res.json({ 
      success: true, 
      logs: allLogs, 
      count: totalCount,
      mortgage: mortgageResult,
      recurring: recurringResult
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
