# 🏠 ImmoPi Manager

**Privacy-first, local-hosted real estate management system for Raspberry Pi**

Manage properties, tenants, and finances with AI-powered document analysis. All data stays on your device.

## ✨ Features

- 🏢 **Property Management** - Track multiple properties, mortgages, and details
- 👥 **Tenant Management** - Maintain tenant records and rental agreements
- 💰 **Financial Tracking** - Monitor income, expenses, and transactions
- 🤖 **AI Document Analysis** - Automatic data extraction from invoices and receipts using Gemini
- 📄 **Document Storage** - Organize and categorize property-related documents
- 📅 **Recurring Payments** - Track rent and regular expenses
- 📊 **Reports & Analytics** - Visualize financial data and property performance
- 🔒 **Password Protection** - Simple authentication for local access
- ☁️ **Automated Backups** - Weekly backups to Google Drive (write-only)

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Pokedude1997/ImmoPi_local.git
cd ImmoPi_local
```

### 2. Configure Environment
```bash
cd server
cp .env.example .env
nano .env
# Add your API keys and passwords
```

### 3. Install Dependencies
```bash
# Backend
cd server
npm install

# Frontend
cd ..
npm install
npm run build
```

### 4. Start Services
```bash
# Install PM2 globally
sudo npm install -g pm2 serve

# Start both services
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the printed instructions
```

### 5. Access Application
Open your browser: `http://YOUR_PI_IP:3000`

## 📚 Documentation

- **[SETUP.md](./SETUP.md)** - Comprehensive installation and configuration guide
- **[readme.md](./readme.md)** (this file) - Quick overview and getting started

## 🛠️ Prerequisites

- **Raspberry Pi 4** (4GB+ RAM recommended) or Pi 5
- **Raspberry Pi OS** (64-bit)
- **Node.js** v18+
- **Google Gemini API Key** - [Get one here](https://makersuite.google.com/app/apikey)
- **Google Cloud Service Account** - For automated backups (optional but recommended)

## 🔐 Security Features

- **Local-only by default** - No external access required
- **Password authentication** - Simple login protection
- **Session management** - 24-hour token expiration
- **Write-only backups** - Google Drive can't read your data
- **SQLite database** - All data stored locally

## 🤖 AI Document Analysis

Upload invoices, receipts, or bills and the system automatically extracts:
- 📅 Date
- 💵 Amount
- 💱 Currency (CHF/EUR/USD)
- 📝 Document Type

Features:
- **Automatic retry** - 3 attempts with exponential backoff
- **Validation** - Ensures data quality before saving
- **Error logging** - Track failures for manual review
- **Fallback** - Manual entry option always available

## 💾 Automated Backups

- **Weekly schedule** - Every Sunday at 2:00 AM (Europe/Zurich)
- **Google Drive integration** - Secure cloud storage
- **Manual trigger** - Backup on-demand via API or command
- **Write-only access** - Service account can't read existing files

```bash
# Trigger manual backup
cd server
node backup.js
```

## 📱 Tech Stack

**Frontend:**
- React 19 with TypeScript
- React Router for navigation
- Recharts for analytics
- Lucide icons
- Vite build system

**Backend:**
- Node.js with Express
- SQLite database
- Google Gemini AI (2.5 Flash)
- Google Drive API for backups
- Bcrypt for password hashing
- Zod for validation

**Infrastructure:**
- PM2 process management
- Node-cron for scheduling
- Serve for static hosting

## 📁 Project Structure

```
ImmoPi_local/
├── server/                 # Backend API
│   ├── server.js          # Main server file
│   ├── backup.js          # Backup automation
│   ├── auth-middleware.js # Authentication
│   ├── ai-validator.js    # AI response validation
│   ├── .env               # Configuration (create from .env.example)
│   └── package.json       # Dependencies
├── pages/                 # React pages
│   ├── Dashboard.tsx
│   ├── Properties.tsx
│   ├── Transactions.tsx
│   ├── Documents.tsx
│   ├── Login.tsx          # Authentication page
│   └── ...
├── components/            # React components
├── App.tsx                # Main app with routing
├── types.ts               # TypeScript definitions
├── ecosystem.config.js    # PM2 configuration
├── package.json           # Frontend dependencies
├── SETUP.md               # Detailed setup guide
└── readme.md              # This file
```

## ⚙️ Configuration

### Environment Variables

Create `server/.env` from `server/.env.example`:

```env
# Server
PORT=8000

# Authentication (choose one method)
APP_PASSWORD=your_password              # Simple (less secure)
# APP_PASSWORD_HASH=bcrypt_hash        # Recommended (more secure)

# AI
API_KEY=your_gemini_api_key

# Backups
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
```

### Generate Password Hash
```bash
cd server
node auth-middleware.js hash YourSecurePassword
# Copy output to .env as APP_PASSWORD_HASH
```

## 🐞 Troubleshooting

### Check Service Status
```bash
pm2 status
pm2 logs
```

### Common Issues

**Services won't start:**
```bash
pm2 logs immopi-api --lines 50
# Check for port conflicts or missing dependencies
```

**Authentication fails:**
```bash
# Verify password in .env
cat server/.env | grep APP_PASSWORD
```

**Backup fails:**
```bash
# Check logs
cat server/logs/backup-errors.log

# Test manually
cd server && node backup.js
```

**Can't access UI:**
```bash
# Find Pi IP
hostname -I

# Check if port 3000 is accessible
curl http://localhost:3000
```

See [SETUP.md](./SETUP.md) for detailed troubleshooting.

## 📝 Usage

### First Login
1. Navigate to `http://YOUR_PI_IP:3000`
2. Enter the password from your `.env` file
3. Session lasts 24 hours

### Managing Properties
1. Click **Properties** in navigation
2. Add property details including mortgage info
3. Track multiple properties from one dashboard

### Document Analysis
1. Go to **Documents** page
2. Upload invoice/receipt (PDF or image)
3. AI extracts data automatically
4. Review and save or edit manually

### Viewing Reports
1. Navigate to **Reports**
2. View income vs. expenses
3. Filter by property or date range
4. Export data for tax purposes

## 🛡️ Backup & Recovery

### Automatic Backups
- Run every Sunday at 2:00 AM
- Stored in Google Drive: `immopi_backup_YYYY-MM-DD.db`

### Manual Backup
```bash
cd server
node backup.js
```

### Restore from Backup
```bash
pm2 stop all
cd server
cp immopi_backup_2026-02-15.db immopi.db
pm2 restart all
```

See [SETUP.md](./SETUP.md) for complete restoration procedures.

## 🔄 Updates

```bash
# Stop services
pm2 stop all

# Pull latest changes
git pull origin main

# Update dependencies
npm install
cd server && npm install

# Rebuild and restart
cd ..
npm run build
pm2 restart all
```

## 💯 Best Practices

1. **Set strong password** - 12+ characters, mixed case, numbers, symbols
2. **Test backups regularly** - Verify restoration process works
3. **Keep system updated** - `sudo apt update && sudo apt upgrade`
4. **Monitor logs** - `pm2 logs` for issues
5. **Restrict network access** - Keep on local network only
6. **Document your setup** - Note IP address, credentials location

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

## 📝 License

MIT License - See LICENSE file for details

## 👨‍💻 Author

Christopher - Built for personal real estate management

## 💬 Support

For detailed setup instructions, see [SETUP.md](./SETUP.md)

For issues specific to:
- **Google Drive backups** - Check service account permissions
- **AI analysis** - Verify Gemini API key and quota
- **Authentication** - Check `.env` password configuration
- **General issues** - Review logs: `pm2 logs`

---

**Last Updated:** February 19, 2026  
**Version:** 1.0 (Enhanced with authentication, backups, and AI validation)
