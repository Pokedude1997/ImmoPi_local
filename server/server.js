/**
 * ImmoPi Manager - Enhanced Backend Implementation
 * 
 * Features:
 * - Simple password authentication
 * - Automated Google Drive backups
 * - AI document analysis with retry logic and validation
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

// Initialize Tables (Brief Schema)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    address TEXT,
    type TEXT,
    notes TEXT
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    amount REAL,
    currency TEXT,
    description TEXT,
    type TEXT,
    property_id INTEGER,
    category_id INTEGER,
    document_id INTEGER
  )`);
  // ... Add other tables (documents, categories, etc.)
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

// ============================================================================
// AI DOCUMENT ANALYSIS WITH RETRY LOGIC
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

app.post('/api/documents/analyze', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileName = req.file.originalname || req.file.filename;
  console.log(`\n📄 Analyzing document: ${fileName}`);
  
  try {
    // API key must be obtained from process.env.API_KEY
    if (!process.env.API_KEY) {
      throw new Error('API_KEY not configured in environment variables');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Data = fileBuffer.toString('base64');
    
    // Call Gemini with retry logic
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

    // Parse response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response.text);
    } catch (parseError) {
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }

    // Validate response
    const validation = validateAndSanitize(parsedResponse);
    
    if (!validation.success) {
      console.error('❌ AI response validation failed:', validation.errors);
      logAIFailure(fileName, 'VALIDATION_ERROR', {
        errors: validation.errors,
        raw: validation.raw,
      });
      
      return res.status(422).json({
        error: 'AI response validation failed',
        details: validation.errors,
        raw: parsedResponse,
        suggestion: 'Please enter the data manually',
      });
    }

    console.log('✅ Document analyzed successfully');
    
    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: validation.data,
      aiAnalysisRaw: parsedResponse,
    });

  } catch (error) {
    console.error('❌ AI Analysis failed:', error.message);
    
    // Log failure
    logAIFailure(fileName, 'API_ERROR', {
      message: error.message,
      stack: error.stack,
    });
    
    // Cleanup uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'AI Analysis failed',
      message: error.message,
      suggestion: 'Please try again or enter the data manually',
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

// Start backup scheduler
console.log('\n📦 Initializing backup system...');
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
