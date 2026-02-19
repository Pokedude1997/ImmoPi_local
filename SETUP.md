# 🛠️ ImmoPi Manager - Setup & Configuration Guide

This document provides detailed instructions for setting up and maintaining your ImmoPi Manager installation.

## 📋 Table of Contents
1. [Hardware & Prerequisites](#hardware--prerequisites)
2. [Initial Raspberry Pi Setup](#initial-raspberry-pi-setup)
3. [Google Drive Backup Configuration](#google-drive-backup-configuration)
4. [Environment Configuration](#environment-configuration)
5. [Installation & Dependencies](#installation--dependencies)
6. [First-Time Deployment](#first-time-deployment)
7. [Backup Restoration](#backup-restoration)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance Tasks](#maintenance-tasks)

---

## Hardware & Prerequisites

### Recommended Hardware
- **Raspberry Pi 4** with 4GB RAM (or Pi 5)
- **32GB+ MicroSD card** (A1-rated or better) or SSD
- **Stable internet connection** for AI API and backups
- **Local network access** from devices you'll use

### Required Accounts
- [Google AI Studio](https://makersuite.google.com/app/apikey) - for Gemini API key
- [Google Cloud Platform](https://console.cloud.google.com/) - for Drive API service account
- Google Drive account with available storage

### Network Configuration
- Note your Raspberry Pi's IP address: `hostname -I`
- Recommended: Set static IP in router DHCP settings
- Default ports: `3000` (UI), `8000` (API)

---

## Initial Raspberry Pi Setup

### 1. OS Installation
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required system packages
sudo apt install -y git nodejs npm

# Verify Node.js version (should be v18+)
node -v
npm -v
```

### 2. Install Global Dependencies
```bash
# Install PM2 for process management
sudo npm install -g pm2

# Install serve for static file hosting
sudo npm install -g serve
```

### 3. Clone Repository
```bash
cd ~
git clone https://github.com/Pokedude1997/ImmoPi_local.git
cd ImmoPi_local
```

---

## Google Drive Backup Configuration

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "ImmoPi Backup"
3. Enable **Google Drive API** for the project

### 2. Create Service Account
1. Navigate to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
3. Name: `immopi-backup`
4. Grant role: **Service Account User**
5. Click **Done**

### 3. Generate Credentials
1. Click on the created service account
2. Go to **Keys** tab
3. Click **Add Key → Create New Key**
4. Select **JSON** format
5. Download the JSON file

### 4. Setup Google Drive Folder
1. Create a new folder in your Google Drive: "ImmoPi Backups"
2. Right-click → **Share**
3. Add the service account email (found in JSON file: `client_email`)
4. Set permission to **Editor** (write access)
5. Copy the folder ID from the URL:
   - URL format: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Example: `1a2b3c4d5e6f7g8h9i0j`

### 5. Install Credentials on Pi
```bash
# Copy the downloaded JSON file to your Pi
# Method 1: Using scp from your computer
scp ~/Downloads/your-credentials.json pi@YOUR_PI_IP:~/ImmoPi_local/server/google-credentials.json

# Method 2: Create file manually and paste content
nano ~/ImmoPi_local/server/google-credentials.json
# Paste JSON content, then Ctrl+X, Y, Enter

# Set restrictive permissions
chmod 600 ~/ImmoPi_local/server/google-credentials.json
```

---

## Environment Configuration

### 1. Create Environment File
```bash
cd ~/ImmoPi_local/server
cp .env.example .env
nano .env
```

### 2. Configure Variables
```env
# Server Configuration
PORT=8000
NODE_ENV=production

# Authentication - CHOOSE ONE METHOD:
# Method 1: Plain text (simpler)
APP_PASSWORD=YourSecurePasswordHere123!

# Method 2: Hashed (more secure)
# Generate with: node auth-middleware.js hash YourPassword
# APP_PASSWORD_HASH=$2b$10$your_generated_hash_here

# Google Gemini AI
API_KEY=your_gemini_api_key_from_ai_studio

# Google Drive Backup
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_from_step_4
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
```

### 3. Secure Environment File
```bash
chmod 600 .env
```

### 4. Generate Password Hash (Optional but Recommended)
```bash
cd ~/ImmoPi_local/server
node auth-middleware.js hash YourSecurePassword
# Copy the output hash to .env file as APP_PASSWORD_HASH
```

---

## Installation & Dependencies

### 1. Install Backend Dependencies
```bash
cd ~/ImmoPi_local/server
npm install express cors sqlite3 dotenv multer googleapis @google/genai bcrypt node-cron zod cookie-parser
```

### 2. Install Frontend Dependencies
```bash
cd ~/ImmoPi_local
npm install
```

### 3. Build Frontend
```bash
npm run build
```

---

## First-Time Deployment

### 1. Test Backend Manually
```bash
cd ~/ImmoPi_local/server
node server.js
# Should show: "Server running on http://localhost:8000"
# Press Ctrl+C to stop
```

### 2. Test Backup Manually
```bash
cd ~/ImmoPi_local/server
node backup.js
# Should upload a backup file to Google Drive
# Check your Drive folder to verify
```

### 3. Start Services with PM2
```bash
cd ~/ImmoPi_local
pm2 start ecosystem.config.js
```

### 4. Verify Services
```bash
pm2 status
# Both immopi-api and immopi-ui should show "online"

pm2 logs
# Check for any errors
```

### 5. Save PM2 Configuration
```bash
pm2 save
pm2 startup
# Follow the command shown in output (copy and run it)
```

### 6. Access Application
- Open browser: `http://YOUR_PI_IP:3000`
- You should see the login page
- Enter the password from your `.env` file

---

## Backup Restoration

### Automatic Backups
- Run every Sunday at 2:00 AM (Europe/Zurich timezone)
- Stored in Google Drive with filename: `immopi_backup_YYYY-MM-DD.db`

### Manual Backup
```bash
# Trigger manual backup via API
curl -X POST http://localhost:8000/api/backup/manual \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or run directly
cd ~/ImmoPi_local/server
node backup.js
```

### Restore from Backup

#### 1. Download Backup from Google Drive
```bash
# Stop services first
pm2 stop all

# Backup current database (just in case)
cd ~/ImmoPi_local/server
mv immopi.db immopi.db.old

# Download from Google Drive (use web interface or gdown)
# Place the downloaded backup file in server directory
```

#### 2. Restore Database
```bash
cd ~/ImmoPi_local/server
cp immopi_backup_2026-02-15.db immopi.db
chmod 644 immopi.db

# Restart services
pm2 restart all
```

#### 3. Verify Restoration
- Access UI and check your data
- Test creating a new entry

---

## Troubleshooting

### Service Won't Start
```bash
# Check PM2 logs
pm2 logs immopi-api --lines 50
pm2 logs immopi-ui --lines 50

# Check if ports are in use
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :8000

# Restart services
pm2 restart all
```

### Authentication Fails
```bash
# Verify .env file exists and has correct permissions
ls -la ~/ImmoPi_local/server/.env

# Check password in .env
cat ~/ImmoPi_local/server/.env | grep APP_PASSWORD

# Generate new password hash if needed
cd ~/ImmoPi_local/server
node auth-middleware.js hash NewPassword
```

### Backup Fails
```bash
# Check backup logs
cat ~/ImmoPi_local/server/logs/backup-errors.log

# Verify Google credentials
ls -la ~/ImmoPi_local/server/google-credentials.json

# Test credentials manually
cd ~/ImmoPi_local/server
node backup.js
```

### AI Document Analysis Fails
```bash
# Check AI failure logs
cat ~/ImmoPi_local/server/logs/ai-failures-*.log

# Verify API key
cat ~/ImmoPi_local/server/.env | grep API_KEY

# Test Gemini API separately
curl https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY
```

### Can't Access from Browser
```bash
# Verify Pi IP address
hostname -I

# Check if services are running
pm2 status

# Check firewall (if enabled)
sudo ufw status
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp

# Test from Pi itself
curl http://localhost:3000
curl http://localhost:8000/api/auth/check
```

---

## Maintenance Tasks

### Weekly
- Verify backup ran successfully (check Google Drive folder)
- Review AI analysis logs for patterns

### Monthly
- Update system packages: `sudo apt update && sudo apt upgrade -y`
- Check disk space: `df -h`
- Review application logs: `pm2 logs --lines 100`
- Test backup restoration process

### Quarterly
- Update Node.js dependencies: `npm update`
- Rebuild frontend: `npm run build`
- Review and rotate old backup files in Google Drive

### Update Application
```bash
# Stop services
pm2 stop all

# Pull latest changes
cd ~/ImmoPi_local
git pull origin main

# Update dependencies
npm install
cd server && npm install

# Rebuild frontend
cd ..
npm run build

# Restart services
pm2 restart all
```

---

## Security Checklist

- [ ] `.env` file has `chmod 600` permissions
- [ ] `google-credentials.json` has `chmod 600` permissions
- [ ] Strong password set (12+ characters, mixed case, numbers, symbols)
- [ ] Google Drive folder shared only with service account
- [ ] Raspberry Pi has non-default password
- [ ] SSH key-based authentication enabled (optional)
- [ ] Backups tested and verified
- [ ] Network access restricted to home network only

---

## Quick Reference

### Important File Locations
- Database: `~/ImmoPi_local/server/immopi.db`
- Environment: `~/ImmoPi_local/server/.env`
- Credentials: `~/ImmoPi_local/server/google-credentials.json`
- Logs: `~/ImmoPi_local/server/logs/`
- PM2 Config: `~/ImmoPi_local/ecosystem.config.js`

### Useful Commands
```bash
# View all services
pm2 status

# View logs
pm2 logs
pm2 logs immopi-api
pm2 logs immopi-ui

# Restart services
pm2 restart all
pm2 restart immopi-api

# Stop services
pm2 stop all

# Manual backup
cd ~/ImmoPi_local/server && node backup.js

# Check disk space
df -h

# Find Pi IP
hostname -I
```

---

**Last Updated:** February 19, 2026  
**Version:** 1.0
