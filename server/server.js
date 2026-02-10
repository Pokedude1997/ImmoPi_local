
/**
 * ImmoPi Manager - Reference Backend Implementation
 * 
 * To run this on your Raspberry Pi:
 * 1. Initialize a new Node project: `npm init -y`
 * 2. Install dependencies: `npm install express cors sqlite3 dotenv multer googleapis @google/genai`
 * 3. Run: `node server.js`
 */

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Setup
const db = new sqlite3.Database('./immopi.db', (err) => {
  if (err) console.error('DB Error:', err.message);
  else console.log('Connected to SQLite database.');
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

// API Routes
app.get('/api/properties', (req, res) => {
  db.all("SELECT * FROM properties", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/properties', (req, res) => {
  const { name, address, type, notes } = req.body;
  db.run(`INSERT INTO properties (name, address, type, notes) VALUES (?,?,?,?)`, 
    [name, address, type, notes], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Upload & AI Analysis Endpoint
const upload = multer({ dest: 'uploads/' });

app.post('/api/documents/analyze', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  
  try {
    // API key must be obtained from process.env.API_KEY.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Data = fileBuffer.toString('base64');
    
    // Call Gemini with updated model name.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: req.file.mimetype, data: base64Data } },
          { text: "Analyze this document and extract date, amount, currency, documentType as JSON." }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    // Extract text directly from property.
    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI Analysis failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
