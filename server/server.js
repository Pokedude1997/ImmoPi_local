/**
 * ImmoPi Manager - Enhanced Backend Implementation
 * 
 * Features:
 * - Simple password authentication
 * - Automated Google Drive backups
 * - AI document analysis with retry logic and validation
 * - Google Drive document storage with organized folder structure
 * - Improved error handling and logging
 * 
 * To run this on your Raspberry Pi:
 * 1. Initialize a new Node project: `npm init -y`
 * 2. Install dependencies: `npm install express cors sqlite3 dotenv multer googleapis @google/genai bcrypt node-cron zod cookie-parser`
 * 3. Configure .env file with required variables
 * 4. Run: `node server.js`
 */

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import custom modules
const { login, logout, requireAuth } = require('./auth-middleware');
const { performBackup, startBackupScheduler } = require('./backup');
const { validateAndSanitize } = require('./ai-validator');
const { uploadDocument, getDocumentLink, initializeDriveClient } = require('./drive-storage');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database Setup
const db = new sqlite3.Database('./immopi.db', (err) => {
  if (err) console.error('❌ DB Error:', err.message);
  else console.log('✅ Connected to SQLite database.');
});

// Initialize Tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    type TEXT,
    notes TEXT
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
    google_drive_id TEXT,
    google_drive_path TEXT,
    ai_analysis_raw TEXT,
    FOREIGN KEY (property_id) REFERENCES properties(id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    property_id INTEGER,
    category_id INTEGER,
    document_id INTEGER,
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (document_id) REFERENCES documents(id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    is_tax_relevant INTEGER DEFAULT 0
  )`);
});

// ============================================================================
// AUTHENTICATION ROUTES (No auth required)
// ============================================================================

app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  const result = await login(password);
  
  if (result.success) {
    // Set secure cookie
    res.cookie('sessionToken', result.token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict',
    });
    
    res.json({
      success: true,
      token: result.token,
      expiresAt: result.expiresAt,
    });
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
// PROTECTED API ROUTES (Authentication required)
// ============================================================================

// Properties
app.get('/api/properties', requireAuth, (req, res) => {
  db.all("SELECT * FROM properties", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/properties', requireAuth, (req, res) => {
  const { name, address, type, notes } = req.body;
  db.run(`INSERT INTO properties (name, address, type, notes) VALUES (?,?,?,?)`, 
    [name, address, type, notes], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Documents
app.get('/api/documents', requireAuth, (req, res) => {
  const query = `
    SELECT 
      d.*,
      p.name as property_name
    FROM documents d
    LEFT JOIN properties p ON d.property_id = p.id
    ORDER BY d.upload_date DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Add Drive link to each document
    const documentsWithLinks = rows.map(doc => ({
      ...doc,
      driveLink: doc.google_drive_id ? getDocumentLink(doc.google_drive_id) : null,
    }));
    
    res.json(documentsWithLinks);
  });
});

app.get('/api/documents/:id', requireAuth, (req, res) => {
  const query = `
    SELECT 
      d.*,
      p.name as property_name
    FROM documents d
    LEFT JOIN properties p ON d.property_id = p.id
    WHERE d.id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Document not found' });
    
    row.driveLink = row.google_drive_id ? getDocumentLink(row.google_drive_id) : null;
    res.json(row);
  });
});

// ============================================================================
// AI DOCUMENT ANALYSIS WITH DRIVE STORAGE
// ============================================================================

const upload = multer({ dest: uploadsDir });

/**
 * Retry logic for API calls with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      console.log(`⚠️  Retry attempt ${attempt}/${maxRetries} after ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}

/**
 * Log AI analysis failures
 */
function logAIFailure(fileName, errorType, details) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | ${fileName} | ${errorType} | ${JSON.stringify(details)}\n`;
  
  const logFile = path.join(logsDir, `ai-failures-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logEntry);
}

/**
 * Upload and analyze document
 * 1. Analyze with AI
 * 2. Upload to Google Drive (organized folder structure)
 * 3. Save metadata and Drive reference to database
 * 4. Delete local file
 */
app.post('/api/documents/analyze', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileName = req.file.originalname || req.file.filename;
  console.log(`\n📄 Processing document: ${fileName}`);
  
  let driveFileId = null;
  let aiData = null;
  let validationResult = null;

  try {
    // Step 1: AI Analysis
    console.log('🤖 Step 1: AI Analysis...');
    if (!process.env.API_KEY) {
      throw new Error('API_KEY not configured in environment variables');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Data = fileBuffer.toString('base64');
    
    const response = await retryWithBackoff(async () => {
      return await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: req.file.mimetype, data: base64Data } },
            { text: "Analyze this document and extract the following fields as JSON: date (ISO format), amount (number), currency (CHF/EUR/USD), documentType (Invoice/Receipt/Contract/Utility Bill/Tax Statement/Other). Return only valid JSON." }
          ]
        },
        config: { responseMimeType: "application/json" }
      });
    });

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response.text);
    } catch (parseError) {
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }

    validationResult = validateAndSanitize(parsedResponse);
    
    if (!validationResult.success) {
      console.error('❌ AI response validation failed:', validationResult.errors);
      logAIFailure(fileName, 'VALIDATION_ERROR', {
        errors: validationResult.errors,
        raw: validationResult.raw,
      });
      
      // Continue with upload even if validation fails
      aiData = parsedResponse;
    } else {
      console.log('✅ AI analysis successful');
      aiData = validationResult.data;
    }

    // Step 2: Upload to Google Drive
    console.log('☁️  Step 2: Uploading to Google Drive...');
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
      propertyName: propertyName,
      documentType: aiData?.documentType || 'Other',
      documentDate: aiData?.date,
    });

    driveFileId = uploadResult.fileId;
    console.log(`✅ Uploaded to Drive: ${uploadResult.folderPath}`);

    // Step 3: Save to database (only metadata and Drive reference)
    console.log('💾 Step 3: Saving metadata to database...');
    const documentId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO documents (
          file_name, original_name, mime_type, upload_date, document_date,
          document_type, amount, currency, property_id, notes,
          google_drive_id, google_drive_path, ai_analysis_raw
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uploadResult.fileName,
          fileName,
          req.file.mimetype,
          new Date().toISOString(),
          aiData?.date || null,
          aiData?.documentType || 'Other',
          aiData?.amount || null,
          aiData?.currency || null,
          propertyId || null,
          req.body.notes || null,
          uploadResult.fileId,
          uploadResult.folderPath,
          JSON.stringify(parsedResponse),
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // Step 4: Cleanup local file
    console.log('🗑️  Step 4: Cleaning up local file...');
    fs.unlinkSync(req.file.path);

    console.log('✅ Document processing complete');

    res.json({
      success: true,
      documentId: documentId,
      driveFileId: driveFileId,
      driveLink: getDocumentLink(driveFileId),
      folderPath: uploadResult.folderPath,
      aiData: aiData,
      validationErrors: validationResult?.success === false ? validationResult.errors : null,
    });

  } catch (error) {
    console.error('❌ Document processing failed:', error.message);
    
    logAIFailure(fileName, 'PROCESSING_ERROR', {
      message: error.message,
      stack: error.stack,
      driveFileId: driveFileId,
    });
    
    // Cleanup local file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Document processing failed',
      message: error.message,
      suggestion: 'Please try again or contact support',
      driveFileId: driveFileId, // Return file ID if upload succeeded
    });
  }
});

// ============================================================================
// BACKUP ROUTES
// ============================================================================

app.post('/api/backup/manual', requireAuth, async (req, res) => {
  console.log('🔄 Manual backup requested');
  
  try {
    const result = await performBackup();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Backup completed successfully',
        details: result,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Backup failed',
        details: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Backup failed',
      message: error.message,
    });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Initialize Drive client
console.log('\n☁️  Initializing Google Drive...');
initializeDriveClient();

// Start backup scheduler
console.log('📦 Initializing backup system...');
startBackupScheduler();

app.listen(PORT, () => {
  console.log(`\n🚀 ImmoPi Server running on http://localhost:${PORT}`);
  console.log(`📅 Current time: ${new Date().toISOString()}`);
  console.log(`\n⚡ Ready to accept requests\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, closing database...');
  db.close();
  process.exit(0);
});
