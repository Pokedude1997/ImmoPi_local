/**
 * Migration Runner
 * Executes all migration scripts in order
 * Tracks which migrations have been applied
 */

const fs = require('fs');
const path = require('path');

// Use server's node_modules
const serverPath = path.resolve(__dirname, '..', 'server');
const dotenvPath = path.resolve(serverPath, 'node_modules', 'dotenv');
const sqlite3Path = path.resolve(serverPath, 'node_modules', 'sqlite3');

// Load dotenv before other requires
require(dotenvPath).config({ path: path.resolve(__dirname, '..', '.env') });
const sqlite3 = require(sqlite3Path).verbose();

// Environment variables already loaded above

const dbPath = process.env.NODE_ENV === 'test' 
  ? path.join(__dirname, '..', 'databases', 'test.db') 
  : path.join(__dirname, '..', 'databases', 'production.db');

const db = new sqlite3.Database(dbPath);

// Ensure migrations_applied table exists
function ensureMigrationsTable() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS migrations_applied (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT UNIQUE NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating migrations_applied table:', err.message);
        reject(err);
      } else {
        console.log('migrations_applied table ready');
        resolve();
      }
    });
  });
}

// Get list of migration files sorted by name
function getMigrationFiles() {
  const files = fs.readdirSync(__dirname)
    .filter(f => f.match(/^\d{3}_/) && (f.endsWith('.sql') || f.endsWith('.js') || f.endsWith('.cjs')))
    .sort();
  return files;
}

// Check if migration has been applied
function isMigrationApplied(migrationName) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM migrations_applied WHERE migration_name = ?', [migrationName], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(!!row);
      }
    });
  });
}

// Record migration as applied
function recordMigration(migrationName) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO migrations_applied (migration_name, applied_at) VALUES (?, datetime("now"))',
      [migrationName],
      (err) => {
        if (err) {
          console.error(`Error recording migration ${migrationName}:`, err.message);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Run a SQL migration
function runSqlMigration(filePath) {
  return new Promise((resolve, reject) => {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running SQL migration: ${path.basename(filePath)}`);
    
    db.exec(sql, (err) => {
      if (err) {
        console.error(`Error running ${path.basename(filePath)}:`, err.message);
        reject(err);
      } else {
        console.log(`SQL migration ${path.basename(filePath)} completed`);
        resolve();
      }
    });
  });
}

// Run a JS migration
function runJsMigration(filePath) {
  return new Promise(async (resolve, reject) => {
    console.log(`Running JS migration: ${path.basename(filePath)}`);
    
    try {
      const migrationModule = require(filePath);
      if (typeof migrationModule.runMigration === 'function') {
        await migrationModule.runMigration();
        console.log(`JS migration ${path.basename(filePath)} completed`);
        resolve();
      } else {
        reject(new Error(`Migration ${path.basename(filePath)} does not export runMigration function`));
      }
    } catch (error) {
      console.error(`Error running JS migration ${path.basename(filePath)}:`, error.message);
      reject(error);
    }
  });
}

async function runMigrations() {
  try {
    console.log('Starting migration runner...');
    console.log(`Database: ${dbPath}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Ensure migrations table exists
    await ensureMigrationsTable();
    
    // Get migration files
    const migrationFiles = getMigrationFiles();
    console.log(`Found ${migrationFiles.length} migration files:`, migrationFiles);
    
    // Process each migration in order
    for (const file of migrationFiles) {
      const migrationName = path.basename(file, path.extname(file));
      
      // Check if already applied
      const applied = await isMigrationApplied(migrationName);
      
      if (applied) {
        console.log(`Migration ${migrationName} already applied, skipping...`);
        continue;
      }
      
      const filePath = path.join(__dirname, file);
      
      try {
        if (file.endsWith('.sql')) {
          await runSqlMigration(filePath);
        } else if (file.endsWith('.js') || file.endsWith('.cjs')) {
          await runJsMigration(filePath);
        } else {
          console.error(`Unknown migration file type: ${file}`);
          continue;
        }
        
        // Record as applied
        await recordMigration(migrationName);
        
      } catch (error) {
        console.error(`Migration ${migrationName} failed:`, error.message);
        process.exit(1);
      }
    }
    
    console.log('All migrations completed successfully!');
    
  } catch (error) {
    console.error('Migration runner failed:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Check if this file is being run directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
