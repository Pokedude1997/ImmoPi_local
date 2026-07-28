/**
 * ImmoPi Database Backup Script
 * 
 * Creates a dated backup of the SQLite database
 * Usage: node backup-db.js
 * 
 * Backups are stored in: server/backups/immopi(db-backup-YYYY-MM-DD_HH-MM-SS.db)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = path.join(__dirname, 'immopi.db');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`📁 Created backups directory: ${BACKUP_DIR}`);
}

// Generate backup filename with timestamp
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFilename = `immopi-db-backup-${timestamp}.db`;
const backupPath = path.join(BACKUP_DIR, backupFilename);

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database file not found: ${DB_PATH}`);
  process.exit(1);
}

// Create backup
try {
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`✅ Database backed up successfully!`);
  console.log(`   Source: ${DB_PATH}`);
  console.log(`   Backup: ${backupPath}`);
  console.log(`   Size: ${fs.statSync(backupPath).size} bytes`);
  
  // Clean up old backups (keep last 30 days)
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
  const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);
  
  let deletedCount = 0;
  files.forEach(file => {
    const filePath = path.join(BACKUP_DIR, file);
    const fileDate = fs.statSync(filePath).mtime.getTime();
    if (fileDate < thirtyDaysAgo && file !== backupFilename) {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`   🗑️  Deleted old backup: ${file}`);
    }
  });
  
  if (deletedCount > 0) {
    console.log(`   Cleaned up ${deletedCount} old backup(s)`);
  }
  
  console.log(`\n📊 Total backups in directory: ${fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).length}`);
  
} catch (error) {
  console.error(`❌ Failed to create backup: ${error.message}`);
  process.exit(1);
}
