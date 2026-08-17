/**
 * Migration 002: Add user_id columns to data tables
 * This migration adds user_id columns to all data tables (EXCEPT settings and automation_state)
 * Note: SQLite doesn't support ALTER TABLE ... ADD FOREIGN KEY, so we just add the columns
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

const tablesToAlter = [
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

// SQLite doesn't support ALTER TABLE ... ADD FOREIGN KEY
// We'll just add the columns and create indexes
// Foreign key enforcement can be done at application level or through triggers

function addUserIdColumn(table) {
  return new Promise((resolve, reject) => {
    // Add user_id column (nullable initially)
    db.run(
      `ALTER TABLE ${table} ADD COLUMN user_id INTEGER`,
      function(err) {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            // Column already exists
            console.log(`Column user_id already exists in ${table}`);
            resolve();
          } else {
            console.error(`Error adding user_id to ${table}:`, err.message);
            reject(err);
          }
        } else {
          console.log(`Added user_id column to ${table}`);
          
          // Create index on user_id
          db.run(
            `CREATE INDEX IF NOT EXISTS idx_${table}_user_id ON ${table}(user_id)`,
            function(err) {
              if (err) {
                console.error(`Error creating index on ${table}(user_id):`, err.message);
                reject(err);
              } else {
                console.log(`Created index idx_${table}_user_id`);
                resolve();
              }
            }
          );
        }
      }
    );
  });
}

async function runMigration() {
  try {
    console.log('Running migration 002: Add user_id columns to data tables...');
    
    // Process each table
    for (const table of tablesToAlter) {
      try {
        await addUserIdColumn(table);
      } catch (error) {
        console.error(`Skipping ${table} due to error:`, error.message);
      }
    }
    
    // Record migration
    const recordMigration = new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO migrations_applied (migration_name, applied_at) VALUES (?, datetime("now"))',
        ['002_add_user_id_columns'],
        function(err) {
          if (err) {
            console.error('Error recording migration:', err.message);
            reject(err);
          } else {
            console.log('Migration 002 recorded in migrations_applied table');
            resolve();
          }
        }
      );
    });
    
    await recordMigration;
    
    console.log('Migration 002 completed successfully!');
    console.log('Note: Foreign key constraints will be enforced at application level');
    
  } catch (error) {
    console.error('Migration 002 failed:', error.message);
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
