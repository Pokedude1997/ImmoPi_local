# 🏠 ImmoPi Manager: Raspberry Pi Installation Guide

ImmoPi Manager is a privacy-first, local-hosted real estate management system. It allows private landlords to manage properties, tenants, and finances with AI-powered document analysis via the Google Gemini API.

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Hardware Recommendations](#hardware-recommendations)
3. [Initial Setup](#initial-setup)
4. [Backend Installation (AI & Proxy)](#backend-installation)
5. [Frontend Installation (Web UI)](#frontend-installation)
6. [AI Configuration](#ai-configuration)
7. [Running & Auto-start](#running--auto-start)
8. [Backup & Security](#backup--security)

---

## 1. Prerequisites
*   **Raspberry Pi** (3, 4, or 5 recommended).
*   **Raspberry Pi OS** (64-bit Lite or Desktop).
*   **Node.js** (v18.x or higher).
*   **Google Gemini API Key** (for document analysis).

## 2. Hardware Recommendations
While the app is lightweight, a **Raspberry Pi 4 with 4GB RAM** is the "sweet spot" for handling concurrent AI requests and the web server smoothly. Use a high-quality A1-rated MicroSD card or an SSD for better database performance.

## 3. Initial Setup
Update your Pi and install necessary tools:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nodejs npm
```

Check versions:
```bash
node -v # Should be v18+
npm -v
```

## 4. Backend Installation (AI & Proxy)
The backend acts as a proxy for the Gemini API and handles file uploads.

1.  Navigate to the project root on your Pi.
2.  Install the backend dependencies:
    ```bash
    cd server
    npm init -y
    npm install express cors sqlite3 dotenv multer googleapis @google/genai
    ```
3.  Create a `.env` file in the `server/` directory:
    ```bash
    nano .env
    ```
    Add your API key:
    ```env
    API_KEY=your_gemini_api_key_here
    PORT=8000
    ```

## 5. Frontend Installation (Web UI)
The frontend is built with React and serves as the primary dashboard.

1.  Go back to the project root.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the production files:
    ```bash
    npm run build
    ```
    *Note: This creates a `dist/` or `build/` folder containing static assets.*

## 6. AI Configuration
The app uses **Gemini 2.5 Flash** for high-speed document processing. 
*   Ensure your Pi has internet access.
*   The system extracts: Date, Amount, Currency, and Document Type from PDFs or Images.
*   Results are mapped to your German "Side Costs" or "Rent" categories automatically.

## 7. Running & Auto-start
To ensure the app starts automatically when your Pi reboots, use `PM2`.

1.  Install PM2:
    ```bash
    sudo npm install -g pm2
    ```
2.  Start the Backend:
    ```bash
    cd server
    pm2 start server.js --name "immopi-api"
    ```
3.  Start the Frontend (using a simple static server like `serve`):
    ```bash
    sudo npm install -g serve
    pm2 serve dist 3000 --name "immopi-ui" --spa
    ```
4.  Save the PM2 list and set to start on boot:
    ```bash
    pm2 save
    pm2 startup
    ```
    *Follow the instruction printed by the startup command.*

## 8. Backup & Security
### Data Storage
*   **Database**: The system uses `SQLite` (`server/immopi.db`) for properties and `LocalStorage` for browser sessions.
*   **Backups**: Periodically copy `server/immopi.db` to an external drive.

### Local Access
Access the app from any device on your home network at:
`http://[YOUR-PI-IP]:3000`

### Security Tips
1.  **Change default Pi password**: `passwd`.
2.  **Firewall**: Use `ufw` to restrict access.
    ```bash
    sudo apt install ufw
    sudo ufw allow 22/tcp
    sudo ufw allow 3000/tcp
    sudo ufw enable
    ```

---
*Created for the ImmoPi local real estate project.*