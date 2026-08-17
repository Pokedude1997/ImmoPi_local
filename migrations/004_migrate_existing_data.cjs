/**
 * Migration 004: Assign existing data to admin user
 * This migration updates all existing data rows to have user_id = 1 (admin)
 * EXCLUDES: settings and automation_state tables (remain global)
 */

const path = require('path');

// Use server's node_modules
const serverPath = path.resolve(__dirname, '..', 'server');
const dotenvPath = path.resolve(serverPath, 'node_modules', 'dotenv');
const sqlite3 = require(path.resolve(serverPath, 'node_modules', 'sqlite3')).verbose();

// Load dotenv
require(dotenvPath).config({ path: path.resolve(__dirname, '..', '.env') });

const dbPath = process.env.NODE_ENV === 'test' 
  ? path.join(__dirname, '..', 'databases', 'test.db') 
  : path.join(__dirname, '..', 'databases', 'production.db');

const db = new sqlite3.Database(dbPath);

const tablesToMigrate = [
  'properties',
  'tenants', 
  'categories',
  'counterparties',
  'transactions',
  'documents',
  'recurring_payments',
  'tenant_contracts',
  'rent_payments',
  'idempotency_keys'
];

function updateTable(table) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE ${table} SET user_id = 1 WHERE user_id IS NULL`,
      function(err) {
        if (err) {
          console.error(`Error updating ${table}:`, err.message);
          reject(err);
        } else {
          console.log(`Updated ${this.changes} rows in ${table} to user_id=1`);
          resolve();
        }
      }
    );
  });
}

async function runMigration() {
  try {
    console.log('Running migration 004: Migrate existing data to admin user...');
    
    // Verify admin user exists
    const adminCheck = new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE id = 1', (err, row) => {
        if (err) {
          console.error('Error checking admin user:', err.message);
          reject(err);
        } else if (!row) {
          reject(new Error('Admin user (id=1) does not exist. Run migration 003 first.'));
        } else {
          console.log('Admin user (id=1) verified');
          resolve();
        }
      });
    });
    
    await adminCheck;
    
    // Migrate each table
    for (const table of tablesToMigrate) {
      try {
        await updateTable(table);
      } catch (error) {
        console.error(`Skipping ${table} due to error:`, error.message);
      }
    }
    
    // Record migration
    const recordMigration = new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO migrations_applied (migration_name, applied_at) VALUES (?, datetime("now"))',
        ['004_migrate_existing_data'],
        function(err) {
          if (err) {
            console.error('Error recording migration:', err.message);
            reject(err);
          } else {
            console.log('Migration 004 recorded in migrations_applied table');
            resolve();
          }
        }
      );
    });
    
    await recordMigration;
    
    console.log('Migration 004 completed successfully!');
    
  } catch (error) {
    console.error('Migration 004 failed:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Check if this file is being run directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
