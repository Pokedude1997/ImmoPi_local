# 🏠 ImmoPi Manager

**Privacy-first, self-hosted real estate management system for Raspberry Pi**

Manage properties, tenants, and finances with AI-powered document analysis. All data stays on your device with automated cloud backups.

---

## 📋 Table of Contents

1. [Features](#-features)
2. [Architecture](#-architecture)
3. [How It Works](#-how-it-works)
4. [Prerequisites](#-prerequisites)
5. [Installation](#-installation)
6. [Configuration](#-configuration)
7. [First-Time Setup](#-first-time-setup)
8. [Usage Guide](#-usage-guide)
9. [Backup & Recovery](#-backup--recovery)
10. [Troubleshooting](#-troubleshooting)
11. [Maintenance](#-maintenance)
12. [Tech Stack](#-tech-stack)

---

## ✨ Features

### Core Functionality
- 🏢 **Property Management** - Track multiple properties with mortgages, purchase details, and rent information
- 👥 **Tenant Management** - Store tenant records, lease agreements, and contact information
- 💰 **Financial Tracking** - Complete transaction history with categorization and tax-relevance marking
- 📊 **Reports & Analytics** - Visual dashboards showing income vs. expenses with property-level breakdown
- 📅 **Recurring Payments** - Automated tracking of rent, mortgages, and regular expenses

### Advanced Features
- 🤖 **AI Document Analysis** - Automatic data extraction from invoices, receipts, and bills using Google Gemini
- ☁️ **Google Drive Storage** - Documents organized by property/year/category in your Drive
- 🔒 **Authentication** - Password-protected access with 24-hour sessions
- 💾 **Automated Backups** - Weekly database backups to Google Drive (Sundays, 2:00 AM)
- 🔄 **Retry Logic** - 3-attempt retry with exponential backoff for AI analysis
- ✅ **Data Validation** - Zod schema validation ensures data quality
- 📝 **Error Logging** - Failed analyses logged for manual review

---

## 🏗️ Architecture

### Backend-Driven Design

ImmoPi uses a **client-server architecture** where the backend is the single source of truth:

```
┌─────────────────────────────────────────────────────┐
│            Frontend (React SPA)                     │
│  - User Interface                                   │
│  - Forms & Displays                                 │
│  - No data persistence                              │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ REST API (HTTP/JSON)
                   │ Authentication: Bearer Token
                   │
┌──────────────────▼──────────────────────────────────┐
│            Backend (Node.js + Express)              │
│  ┌─────────────────────────────────────────────┐   │
│  │  API Layer                                  │   │
│  │  - CRUD endpoints for all entities         │   │
│  │  - Authentication & sessions               │   │
│  │  - File upload handling                    │   │
│  └──────────────┬──────────────────────────────┘   │
│                 │                                    │
│  ┌──────────────▼──────────────────────────────┐   │
│  │  Business Logic                             │   │
│  │  - AI document analysis (Gemini)           │   │
│  │  - Document storage orchestration          │   │
│  │  - Data validation & sanitization          │   │
│  │  - Backup scheduling (node-cron)           │   │
│  └──────────────┬──────────────────────────────┘   │
│                 │                                    │
│  ┌──────────────▼──────────────────────────────┐   │
│  │  Data Layer                                 │   │
│  │  - SQLite database (immopi.db)             │   │
│  │  - Google Drive API integration            │   │
│  │  - File system operations                  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │                           │
         │                           │
         ▼                           ▼
  ┌─────────────┐          ┌──────────────────┐
  │  SQLite DB  │          │  Google Drive    │
  │  Local Pi   │          │  - Documents/    │
  │             │          │  - Backups/      │
  └─────────────┘          └──────────────────┘
```

### Component Responsibilities

#### Frontend (React)
- **Role:** Presentation layer only
- **Responsibilities:**
  - Render UI components
  - Handle user interactions
  - Make API calls via `services/api.ts`
  - Display loading/error states
- **Does NOT:** Store data, call external APIs directly, or maintain state between sessions

#### Backend (Node.js)
- **Role:** Application logic and data management
- **Responsibilities:**
  - Authenticate users (bcrypt + session tokens)
  - Process all CRUD operations
  - Analyze documents with AI (Google Gemini)
  - Upload documents to Google Drive
  - Store references in SQLite database
  - Schedule and perform backups
  - Log errors and failures
- **Single Source of Truth:** SQLite database is authoritative

#### Data Storage

**SQLite Database (`immopi.db`):**
- Properties, tenants, transactions, categories
- Document metadata (filename, date, amount, type)
- Google Drive file IDs (references only)
- Settings and recurring payments
- **NOT stored:** Actual document files

**Google Drive:**
- **Documents folder:** Original files organized as `PropertyName/Year/Category/`
- **Backups folder:** Weekly database snapshots (`immopi_backup_YYYY-MM-DD.db`)
- **Access:** Service account with write-only permissions

---

## 🔄 How It Works

### Document Upload & Analysis Flow

```
1. User uploads invoice.pdf via frontend
   ↓
2. Frontend: POST /api/documents/analyze
   ↓
3. Backend receives file, saves to /uploads/ temporarily
   ↓
4. AI Analysis (Gemini 2.5 Flash)
   - Extract: date, amount, currency, document type
   - Retry up to 3 times on failure
   - Validate with Zod schema
   ↓
5. Google Drive Upload
   - Organize: Property1/2026/Invoices/
   - Generate unique filename
   - Upload and get file ID
   ↓
6. Database Save
   - Store metadata + Drive file ID
   - Link to property/category
   - Save AI analysis result
   ↓
7. Cleanup
   - Delete temporary file from /uploads/
   ↓
8. Response to frontend
   - Document ID, Drive link, AI data
   - Validation errors (if any)
```

### Authentication Flow

```
1. User visits app → Redirected to /login
   ↓
2. Enter password
   ↓
3. POST /api/auth/login
   ↓
4. Backend validates password
   - Plain text OR bcrypt hash
   ↓
5. Generate session token (crypto.randomBytes)
   ↓
6. Store token in memory (24h expiry)
   ↓
7. Return token to frontend
   ↓
8. Frontend stores in localStorage
   ↓
9. All subsequent requests include:
   Authorization: Bearer <token>
   ↓
10. Backend validates token on each request
    - 401 if invalid/expired → redirect to login
```

### Data Persistence

**What gets saved where:**

| Data Type | Storage Location | Format |
|-----------|------------------|--------|
| Properties, Tenants, Transactions | SQLite (`immopi.db`) | Relational tables |
| Document files (PDFs, images) | Google Drive | Original files |
| Document references | SQLite (`documents` table) | Drive file ID + metadata |
| Database backups | Google Drive (separate folder) | `.db` files |
| Session tokens | Backend memory | Temporary (24h) |
| User password | `.env` file | Plain or bcrypt hash |
| AI failures | Log files (`logs/`) | Timestamped entries |

**No localStorage persistence** - All data lives on backend to survive browser cache clears.

---

## 🛠️ Prerequisites

### Hardware
- **Raspberry Pi 4** (4GB+ RAM recommended) or **Raspberry Pi 5**
- **32GB+ microSD card** (A1-rated) or SSD for better performance
- **Stable internet** for AI API and backups
- **Local network** access from devices you'll use

### Software
- **Raspberry Pi OS** (64-bit, Lite or Desktop)
- **Node.js** v18+ and npm
- **Git** for repository management

### Required Accounts & APIs
1. **Google AI Studio** - [Get Gemini API key](https://makersuite.google.com/app/apikey)
2. **Google Cloud Platform** - For Drive API service account
3. **Google Drive** - Account with available storage

---

## 📦 Installation

### Step 1: System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y git nodejs npm

# Verify versions
node -v  # Should be v18+
npm -v
```

### Step 2: Install Global Tools

```bash
# Process manager and static file server
sudo npm install -g pm2 serve
```

### Step 3: Clone Repository

```bash
cd ~
git clone https://github.com/Pokedude1997/ImmoPi_local.git
cd ImmoPi_local
```

### Step 4: Install Dependencies

```bash
# Backend dependencies
cd server
npm install

# Frontend dependencies
cd ..
npm install
```

### Step 5: Build Frontend

```bash
npm run build
# Creates production-ready files in dist/
```

---

## ⚙️ Configuration

### 1. Google Cloud Service Account

**Create service account:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "ImmoPi Manager"
3. Enable APIs:
   - Google Drive API
4. Navigate to **IAM & Admin → Service Accounts**
5. Click **Create Service Account**
   - Name: `immopi-service`
   - Role: None needed (we'll use folder sharing)
6. Click **Keys → Add Key → Create New Key → JSON**
7. Download the JSON file

**Transfer credentials to Pi:**

```bash
# From your computer
scp ~/Downloads/your-credentials.json pi@YOUR_PI_IP:~/ImmoPi_local/server/google-credentials.json

# Or create manually on Pi
cd ~/ImmoPi_local/server
nano google-credentials.json
# Paste JSON content, save with Ctrl+X, Y, Enter

# Set permissions
chmod 600 google-credentials.json
```

### 2. Google Drive Folders

**Create two folders in your Google Drive:**

1. **"ImmoPi Documents"** - For uploaded documents
2. **"ImmoPi Backups"** - For database backups

**Share both folders with service account:**

1. Right-click folder → Share
2. Add the `client_email` from your JSON credentials file
   - Example: `immopi-service@project-id.iam.gserviceaccount.com`
3. Set permission: **Editor**
4. Copy folder IDs from URLs:
   - Format: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

### 3. Environment Variables

```bash
cd ~/ImmoPi_local/server
cp .env.example .env
nano .env
```

**Configure the following:**

```env
# Server Configuration
PORT=8000
NODE_ENV=production

# Authentication (CHOOSE ONE METHOD)
# Method 1: Plain text (simpler, less secure)
APP_PASSWORD=YourSecurePassword123!

# Method 2: Bcrypt hash (recommended, more secure)
# Generate with: node auth-middleware.js hash YourPassword
# APP_PASSWORD_HASH=$2b$10$your_generated_hash_here

# Google Gemini AI API
API_KEY=your_gemini_api_key_from_ai_studio

# Google Drive - Documents Storage
GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID=folder_id_for_documents

# Google Drive - Database Backups
GOOGLE_DRIVE_FOLDER_ID=folder_id_for_backups

# Credentials Path
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
```

**Generate password hash (optional but recommended):**

```bash
cd ~/ImmoPi_local/server
node auth-middleware.js hash YourSecurePassword
# Copy the output hash to .env as APP_PASSWORD_HASH
# Comment out or remove APP_PASSWORD line
```

**Secure environment file:**

```bash
chmod 600 .env
```

---

## 🚀 First-Time Setup

### 1. Test Backend

```bash
cd ~/ImmoPi_local/server
node server.js
```

**Expected output:**
```
✅ Connected to SQLite database.
✅ Seeded default categories
☁️  Initializing Google Drive...
✅ Google Drive storage client initialized
📦 Initializing backup system...
📅 Backup scheduler started
⏰ Schedule: Every Sunday at 2:00 AM
🚀 ImmoPi Server running on http://localhost:8000
⚡ Ready to accept requests
```

Press `Ctrl+C` to stop.

### 2. Test Backup System

```bash
cd ~/ImmoPi_local/server
node backup.js
```

Check your Google Drive "ImmoPi Backups" folder for a new `.db` file.

### 3. Start with PM2

```bash
cd ~/ImmoPi_local
pm2 start ecosystem.config.js
```

**Verify services:**

```bash
pm2 status
# Should show:
# immopi-api: online
# immopi-ui: online

pm2 logs
# Check for errors
```

### 4. Configure Auto-Start on Boot

```bash
pm2 save
pm2 startup
# Follow the command shown in the output
# Example: sudo env PATH=... pm2 startup systemd -u pi --hp /home/pi
```

### 5. Access Application

```bash
# Find your Pi's IP address
hostname -I
```

Open browser: `http://YOUR_PI_IP:3000`

You should see the login page.

---

## 📖 Usage Guide

### First Login

1. Navigate to `http://YOUR_PI_IP:3000`
2. Enter password from your `.env` file
3. Session expires after 24 hours
4. Token stored in browser localStorage

### Managing Properties

**Add Property:**
1. Click **Properties** in navigation
2. Click **Add Property**
3. Fill in details:
   - Name, address, type
   - Purchase price & date
   - Rent amount, size
   - Mortgage details (optional)
4. Click **Save**

**Mortgage Information:**
- Loan amount, start date
- Interest rate (annual %)
- Principal repayment rate (annual %)
- Bank name
- Payment timing (start/end of month)

**Note:** Mortgage transactions can be auto-generated on the backend if needed.

### Managing Tenants

1. Click **Tenants**
2. Add tenant with:
   - Name, contact info
   - Linked property
   - Lease start/end dates
   - Rent amount, deposit
3. Track active vs. past tenants

### Recording Transactions

**Manual Entry:**
1. Click **Transactions**
2. Click **Add Transaction**
3. Enter:
   - Date, amount, currency
   - Type (Income/Expense)
   - Category (from dropdown)
   - Property (optional)
   - Description
4. Save

**Categories:**
- Pre-seeded with common real estate categories
- Marked as tax-relevant or not
- Add custom categories as needed

### Document Upload & AI Analysis

**Upload Document:**
1. Go to **Documents**
2. Click **Upload Document**
3. Select file (PDF or image)
4. Choose property (optional)
5. Add notes (optional)
6. Click **Analyze & Upload**

**What Happens:**
- Backend analyzes document with AI
- Extracts: date, amount, currency, type
- Uploads to Google Drive in organized structure
- Saves metadata to database
- Shows results with Drive link

**Review Results:**
- Check extracted data accuracy
- Edit if needed
- Create transaction from document (if applicable)
- Access original via Drive link

### Viewing Reports

1. Navigate to **Reports**
2. View:
   - Income vs. Expense charts
   - Property-level breakdown
   - Monthly trends
   - Tax-relevant categories
3. Filter by:
   - Date range
   - Property
   - Category
4. Export data for tax purposes

### Recurring Payments

**Setup Recurring Payment:**
1. Click **Recurring Payments**
2. Add:
   - Name, amount, currency
   - Frequency (monthly/quarterly/yearly)
   - Start/end dates
   - Category, property
3. Mark as active/inactive

**Use Cases:**
- Rent collection
- Mortgage payments
- Utilities
- Insurance premiums
- HOA fees

### Settings

**Configure:**
- Default currency (EUR/CHF/USD)
- Tax year for reporting
- Google Drive folder IDs (if changed)

---

## 🛡️ Backup & Recovery

### Automatic Backups

**Schedule:**
- Every Sunday at 2:00 AM (Europe/Zurich timezone)
- Runs automatically via node-cron
- No user intervention needed

**What Gets Backed Up:**
- Complete SQLite database (`immopi.db`)
- Uploaded to Google Drive as `immopi_backup_YYYY-MM-DD.db`
- **Does NOT backup:** Document files (already in Drive)

**Verify Backups:**
```bash
# Check logs
pm2 logs immopi-api | grep backup

# Or check log file
cat ~/ImmoPi_local/server/logs/backup-errors.log
```

### Manual Backup

**Via Command Line:**
```bash
cd ~/ImmoPi_local/server
node backup.js
```

**Via API (from browser or curl):**
```bash
curl -X POST http://localhost:8000/api/backup/manual \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Restore from Backup

**Step 1: Download Backup**

1. Go to Google Drive "ImmoPi Backups" folder
2. Download desired backup file (e.g., `immopi_backup_2026-02-15.db`)
3. Transfer to Pi:

```bash
# From your computer
scp ~/Downloads/immopi_backup_2026-02-15.db pi@YOUR_PI_IP:~/
```

**Step 2: Stop Services**

```bash
pm2 stop all
```

**Step 3: Backup Current Database (precaution)**

```bash
cd ~/ImmoPi_local/server
cp immopi.db immopi.db.before-restore
```

**Step 4: Restore**

```bash
cp ~/immopi_backup_2026-02-15.db ~/ImmoPi_local/server/immopi.db
chmod 644 ~/ImmoPi_local/server/immopi.db
```

**Step 5: Restart**

```bash
pm2 restart all
pm2 logs
```

**Step 6: Verify**

Access app and check your data.

---

## 🐞 Troubleshooting

### Services Won't Start

**Check status:**
```bash
pm2 status
pm2 logs immopi-api --lines 50
pm2 logs immopi-ui --lines 50
```

**Common causes:**
- Port already in use (8000 or 3000)
- Missing dependencies
- Invalid .env configuration

**Fix:**
```bash
# Check ports
sudo netstat -tulpn | grep :8000
sudo netstat -tulpn | grep :3000

# Reinstall dependencies
cd ~/ImmoPi_local/server && npm install
cd ~/ImmoPi_local && npm install

# Restart
pm2 restart all
```

### Authentication Fails

**Check password configuration:**
```bash
cat ~/ImmoPi_local/server/.env | grep APP_PASSWORD
```

**Test:**
- Verify you're using correct password
- Check if using plain text or hash
- Regenerate hash if needed

**Clear session and retry:**
```bash
# In browser console
localStorage.clear();
# Reload page and login again
```

### Backup Fails

**Check logs:**
```bash
cat ~/ImmoPi_local/server/logs/backup-errors.log
```

**Common issues:**
- Invalid Google credentials
- Service account not shared on folder
- Folder ID incorrect
- Network connectivity

**Test credentials:**
```bash
cd ~/ImmoPi_local/server
node backup.js
# Watch output for specific error
```

### AI Document Analysis Fails

**Check AI logs:**
```bash
ls ~/ImmoPi_local/server/logs/ai-failures-*.log
cat ~/ImmoPi_local/server/logs/ai-failures-2026-02-19.log
```

**Common issues:**
- Invalid API key
- Gemini API quota exceeded
- Network issues
- Unsupported file format

**Test API key:**
```bash
curl https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY
```

**Fallback:** Enter document data manually if AI fails.

### Can't Access UI

**Find Pi IP:**
```bash
hostname -I
```

**Test locally:**
```bash
curl http://localhost:3000
curl http://localhost:8000/api/auth/check
```

**Check firewall:**
```bash
sudo ufw status
# If enabled, allow ports:
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
```

### Database Locked Errors

**Cause:** SQLite accessed by multiple processes

**Fix:**
```bash
pm2 stop all
# Wait a few seconds
pm2 start ecosystem.config.js
```

### Out of Disk Space

**Check space:**
```bash
df -h
```

**Clean up:**
```bash
# Remove old logs
find ~/ImmoPi_local/server/logs -name "*.log" -mtime +30 -delete

# Remove old backups (if stored locally)
find ~/ImmoPi_local/server -name "*.db.backup" -mtime +7 -delete

# Clean npm cache
npm cache clean --force
```

---

## 🔧 Maintenance

### Weekly

- [ ] Verify backup ran (check Drive folder)
- [ ] Review AI analysis logs for patterns
- [ ] Check disk space: `df -h`

### Monthly

- [ ] Update system: `sudo apt update && sudo apt upgrade -y`
- [ ] Review application logs: `pm2 logs --lines 100`
- [ ] Test backup restoration process
- [ ] Check for app updates: `git pull origin main`

### Quarterly

- [ ] Update Node.js dependencies:
  ```bash
  cd ~/ImmoPi_local
  npm update
  cd server && npm update
  npm run build
  pm2 restart all
  ```
- [ ] Review and rotate old logs
- [ ] Clean up old Drive backups (keep last 12 weeks)
- [ ] Test disaster recovery procedure

### Update Application

```bash
# 1. Stop services
pm2 stop all

# 2. Backup current database
cp ~/ImmoPi_local/server/immopi.db ~/immopi.db.backup

# 3. Pull updates
cd ~/ImmoPi_local
git pull origin main

# 4. Update dependencies
npm install
cd server && npm install

# 5. Rebuild frontend
cd ..
npm run build

# 6. Restart
pm2 restart all

# 7. Verify
pm2 logs
```

---

## 📱 Tech Stack

### Frontend
- **React 19** with TypeScript
- **React Router** for navigation
- **Recharts** for data visualization
- **Lucide React** for icons
- **Vite** as build tool
- **date-fns** for date handling

### Backend
- **Node.js** with Express framework
- **SQLite3** for database
- **Google Gemini AI** (2.5 Flash model)
- **Google Drive API** for cloud storage
- **Bcrypt** for password hashing
- **Zod** for schema validation
- **Multer** for file uploads
- **Node-cron** for scheduling
- **Cookie-parser** for session management

### Infrastructure
- **PM2** for process management
- **Serve** for static file hosting
- **Raspberry Pi OS** (64-bit)

### Project Structure

```
ImmoPi_local/
├── server/                    # Backend API
│   ├── server.js             # Main Express server (CRUD endpoints)
│   ├── auth-middleware.js    # Authentication logic
│   ├── backup.js             # Backup automation & scheduling
│   ├── ai-validator.js       # Zod schemas for AI validation
│   ├── drive-storage.js      # Google Drive integration
│   ├── .env                  # Configuration (create from .env.example)
│   ├── .env.example          # Environment variables template
│   ├── .gitignore            # Protects secrets
│   ├── package.json          # Backend dependencies
│   ├── google-credentials.json  # Service account key (excluded from git)
│   ├── immopi.db             # SQLite database (created on first run)
│   ├── logs/                 # Error and backup logs
│   └── uploads/              # Temporary upload directory
├── services/                 # Frontend services
│   └── api.ts                # API client for backend communication
├── pages/                    # React pages
│   ├── Login.tsx             # Authentication page
│   ├── Dashboard.tsx         # Overview & analytics
│   ├── Properties.tsx        # Property management
│   ├── Tenants.tsx           # Tenant management
│   ├── Transactions.tsx      # Financial transactions
│   ├── Documents.tsx         # Document upload & viewing
│   ├── Reports.tsx           # Financial reports
│   ├── RecurringPayments.tsx # Recurring payment tracking
│   └── Settings.tsx          # App configuration
├── components/               # Reusable React components
├── App.tsx                   # Main app with routing & auth
├── types.ts                  # TypeScript type definitions
├── ecosystem.config.js       # PM2 configuration
├── package.json              # Frontend dependencies
├── vite.config.ts            # Vite build configuration
├── tsconfig.json             # TypeScript configuration
└── readme.md                 # This file
```

---

## 🔐 Security Considerations

### Best Practices

1. **Strong Password:** Use 12+ characters with mixed case, numbers, and symbols
2. **Hash Passwords:** Use bcrypt hash instead of plain text
3. **Restrict Access:** Keep app on local network only (no port forwarding)
4. **Secure Credentials:**
   ```bash
   chmod 600 ~/ImmoPi_local/server/.env
   chmod 600 ~/ImmoPi_local/server/google-credentials.json
   ```
5. **Regular Updates:** Keep system and dependencies updated
6. **SSH Security:** Use SSH keys instead of passwords for Pi access
7. **Firewall:** Enable ufw and allow only necessary ports

### Security Checklist

- [ ] `.env` file has `chmod 600` permissions
- [ ] `google-credentials.json` has `chmod 600` permissions
- [ ] Using bcrypt hashed password (not plain text)
- [ ] Google Drive folders shared only with service account
- [ ] Raspberry Pi default password changed
- [ ] SSH key-based authentication enabled
- [ ] Backups tested and verified
- [ ] Network access restricted to local network
- [ ] Regular log monitoring enabled

---

## 📊 Database Schema

**Main Tables:**

- `properties` - Property records with mortgage details
- `tenants` - Tenant information linked to properties
- `categories` - Income/expense categories (pre-seeded)
- `transactions` - Financial transactions
- `documents` - Document metadata with Drive references
- `counterparties` - Vendors, service providers
- `recurring_payments` - Scheduled payments
- `settings` - App configuration (single row)

**Key Relationships:**

- Transactions → Properties (property_id)
- Transactions → Categories (category_id)
- Transactions → Documents (document_id)
- Documents → Properties (property_id)
- Tenants → Properties (property_id)
- Recurring Payments → Properties, Categories, Counterparties

---

## 💡 Tips & Tricks

### Network Configuration

**Set static IP for Pi:**
1. Access router admin panel
2. Find DHCP reservation settings
3. Reserve current IP for Pi's MAC address
4. Pi will always get same IP after reboot

### Access from Multiple Devices

- Desktop: `http://192.168.1.X:3000`
- Phone: Same URL in mobile browser
- Tablet: Same URL

**Bookmark on all devices** for quick access.

### Keyboard Shortcuts

Create desktop shortcuts:

**Windows:**
- Right-click Desktop → New → Shortcut
- Target: `http://YOUR_PI_IP:3000`
- Name: "ImmoPi Manager"

**Mac:**
- Create bookmark in Safari
- Drag bookmark to Desktop

### Performance Optimization

**For Pi 3 or systems with limited RAM:**

1. Reduce PM2 instances to 1 (already default)
2. Use SSD instead of SD card
3. Close unused browser tabs
4. Limit concurrent document uploads

### Data Export

**Export SQLite data for Excel/CSV:**

```bash
cd ~/ImmoPi_local/server
sqlite3 immopi.db
.headers on
.mode csv
.output transactions_export.csv
SELECT * FROM transactions;
.quit
```

Transfer file to your computer:
```bash
scp pi@YOUR_PI_IP:~/ImmoPi_local/server/transactions_export.csv ~/Downloads/
```

---

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

**Report Issues:**
- Open GitHub issue with detailed description
- Include error logs and steps to reproduce
- Mention Pi model and OS version

**Feature Requests:**
- Describe use case and expected behavior
- Explain why it would be useful

---

## 📝 License

MIT License - Free to use, modify, and distribute.

---

## 👨‍💻 Author

**Christopher** - Built for personal real estate management

Created to solve the challenge of managing rental properties with privacy-first, self-hosted infrastructure.

---

## 🆘 Support & Help

### Quick Links

- **GitHub Repository:** [Pokedude1997/ImmoPi_local](https://github.com/Pokedude1997/ImmoPi_local)
- **Google AI Studio:** [Get API Key](https://makersuite.google.com/app/apikey)
- **Google Cloud Console:** [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)

### Common Questions

**Q: Can I run this on a regular computer instead of Pi?**  
A: Yes! Works on any system with Node.js. Just skip Pi-specific steps.

**Q: What if I don't want Google Drive integration?**  
A: You can disable backups by removing the scheduler. Documents won't be stored though.

**Q: Can multiple users access simultaneously?**  
A: Yes, but they share the same account. No multi-user support currently.

**Q: What happens if my Pi loses power?**  
A: Services auto-restart on boot (if `pm2 startup` configured). Data persists in SQLite.

**Q: Can I access from outside my home network?**  
A: Not recommended for security. Use VPN if remote access needed.

### Getting Help

1. Check this README thoroughly
2. Review logs: `pm2 logs`
3. Search existing GitHub issues
4. Open new issue with:
   - Pi model & OS version
   - Node.js version
   - Error logs
   - Steps to reproduce

---

**Last Updated:** February 19, 2026  
**Version:** 2.0 (Backend-Driven Architecture)  
**Status:** Production Ready ✅
