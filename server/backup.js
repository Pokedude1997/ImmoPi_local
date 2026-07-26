/**
 * ImmoPi Manager - Automated Google Drive Backup
 * 
 * Backs up SQLite database to Google Drive weekly
 * Requires service account credentials with write-only access to Drive folder
 * 
 * COMMENTED OUT - Google Drive backup functionality disabled
 */

// const { google } = require('googleapis');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

// Configuration
const DB_PATH = path.join(__dirname, 'immopi.db');
// const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json';
// const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Initialize Google Drive client
// let driveClient = null;

/*
function initializeDriveClient() {
  try {
    const resolvedCredentialsPath = path.isAbsolute(CREDENTIALS_PATH)
      ? CREDENTIALS_PATH
      : path.join(__dirname, CREDENTIALS_PATH);

    if (!fs.existsSync(resolvedCredentialsPath)) {
      console.error(`❌ Google credentials not found at: ${resolvedCredentialsPath}`);
      return null;
    }

    const credentials = JSON.parse(fs.readFileSync(resolvedCredentialsPath, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    driveClient = google.drive({ version: 'v3', auth });
    console.log('✅ Google Drive client initialized');
    return driveClient;
  } catch (error) {
    console.error('❌ Failed to initialize Google Drive client:', error.message);
    return null;
  }
}
*/

/**
 * Perform database backup and upload to Google Drive
 * COMMENTED OUT - Google Drive backup functionality disabled
 */
/*
async function performBackup() {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const backupFileName = `immopi_backup_${timestamp}.db`;
  const tempBackupPath = path.join(__dirname, backupFileName);

  console.log(`\n🔄 Starting backup: ${backupFileName}`);
  console.log(`⏰ Time: ${new Date().toISOString()}`);

  try {
    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(`Database not found at: ${DB_PATH}`);
    }

    // Initialize Drive client if needed
    if (!driveClient) {
      driveClient = initializeDriveClient();
      if (!driveClient) {
        throw new Error('Failed to initialize Google Drive client');
      }
    }

    // Check if folder ID is configured
    if (!DRIVE_FOLDER_ID) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in environment variables');
    }

    // Create backup using SQLite backup API
    console.log('📦 Creating database backup...');
    await new Promise((resolve, reject) => {
      const sourceDb = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
        if (err) return reject(err);
      });

      const backupDb = new sqlite3.Database(tempBackupPath, (err) => {
        if (err) {
          sourceDb.close();
          return reject(err);
        }
      });

      sourceDb.backup(tempBackupPath, (err) => {
        sourceDb.close();
        backupDb.close();
        if (err) return reject(err);
        resolve();
      });
    });

    console.log('☁️  Uploading to Google Drive...');
    
    // Upload to Google Drive
    const fileMetadata = {
      name: backupFileName,
      parents: [DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: 'application/x-sqlite3',
      body: fs.createReadStream(tempBackupPath),
    };

    const response = await driveClient.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, size, createdTime',
    });

    // Clean up local backup file
    fs.unlinkSync(tempBackupPath);

    const fileSizeMB = (response.data.size / (1024 * 1024)).toFixed(2);
    console.log('✅ Backup successful!');
    console.log(`   File ID: ${response.data.id}`);
    console.log(`   Size: ${fileSizeMB} MB`);
    console.log(`   Created: ${response.data.createdTime}`);

    return {
      success: true,
      fileId: response.data.id,
      fileName: backupFileName,
      size: response.data.size,
    };

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    
    // Clean up temp file if it exists
    if (fs.existsSync(tempBackupPath)) {
      try {
        fs.unlinkSync(tempBackupPath);
      } catch (cleanupError) {
        console.error('⚠️  Failed to clean up temp file:', cleanupError.message);
      }
    }

    // Log to file for tracking
    const logEntry = `${new Date().toISOString()} - Backup failed: ${error.message}\n`;
    fs.appendFileSync(path.join(__dirname, 'logs', 'backup-errors.log'), logEntry);

    return {
      success: false,
      error: error.message,
    };
  }
}
*/

/**
 * Schedule automatic weekly backups (Every Sunday at 2:00 AM)
 * COMMENTED OUT - Google Drive backup functionality disabled
 */
/*
function startBackupScheduler() {
  console.log('📅 Backup scheduler started');
  console.log('⏰ Schedule: Every Sunday at 2:00 AM');
  
  // Cron format: minute hour day month weekday
  // 0 2 * * 0 = Every Sunday at 2:00 AM
  cron.schedule('0 2 * * 0', async () => {
    console.log('\n🔔 Scheduled backup triggered');
    await performBackup();
  }, {
    timezone: "Europe/Zurich"
  });
}

// Initialize on module load
initializeDriveClient();

module.exports = {
  performBackup,
  startBackupScheduler,
};

// Allow direct execution for testing
if (require.main === module) {
  console.log('🧪 Running backup manually...');
  performBackup().then((result) => {
    if (result.success) {
      console.log('\n✅ Manual backup completed successfully');
      process.exit(0);
    } else {
      console.error('\n❌ Manual backup failed');
      process.exit(1);
    }
  });
}
*/

// Export empty functions to maintain module compatibility
module.exports = {
  performBackup: () => { throw new Error('Google Drive backup disabled'); },
  startBackupScheduler: () => { console.log('⚠️  Google Drive backup scheduler disabled'); },
};
