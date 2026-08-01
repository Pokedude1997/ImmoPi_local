/**
 * Migration 002: Add tenant_contracts and rent_payments tables
 * 
 * This migration creates two new tables for rent payment management:
 * - tenant_contracts: Stores tenant lease contracts with cold rent, side costs, and payment terms
 * - rent_payments: Stores individual rent payments with links to contracts and transactions
 * 
 * Features:
 * - warmRent is computed (coldRent + sideCosts), not stored
 * - Default payment day: 31 (end of month)
 * - Links rent payments to existing transactions table
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../immopi.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Running migration 002: Add rent payment tables...\n');

// Error collection for batch reporting
const errors = [];

// Wrap everything in a try-finally to ensure db.close() is called exactly once
const runMigration = async () => {
  try {
    // ============================================
    // PHASE 1: Verify all prerequisites
    // ============================================

    // Check if required reference tables exist using PRAGMA table_info (consistent with 001)
    const requiredTables = ['tenants', 'properties', 'transactions'];
    let allReferencesExist = true;

    for (const tableName of requiredTables) {
      const exists = await new Promise((resolve) => {
        db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
          if (err || !rows || rows.length === 0) {
            console.error(`❌ Required table '${tableName}' does not exist`);
            errors.push(`Required table '${tableName}' is missing`);
            allReferencesExist = false;
          }
          resolve();
        });
      });

      if (!exists) {
        allReferencesExist = false;
      }
    }

    if (!allReferencesExist) {
      console.error('\n❌ Migration aborted: Missing required reference tables');
      console.error('Please create the following tables first:', errors.join(', '));
      return; // Will close DB in finally block
    }

    console.log('✅ All required reference tables exist\n');

    // ============================================
    // PHASE 2: Check which tables need to be created
    // ============================================

    const checkTableExists = (tableName) => {
      return new Promise((resolve) => {
        db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
          const exists = rows && rows.length > 0;
          resolve(exists);
        });
      });
    };

    const [tenantContractsExists, rentPaymentsExists] = await Promise.all([
      checkTableExists('tenant_contracts'),
      checkTableExists('rent_payments')
    ]);

    const migrations = [];

    // ============================================
    // PHASE 3: Create tenant_contracts table if needed
    // ============================================

    if (!tenantContractsExists) {
      console.log('➕ Creating tenant_contracts table...');
      
      migrations.push(() => {
        return new Promise((resolve, reject) => {
          db.run(`
            CREATE TABLE tenant_contracts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tenant_id INTEGER NOT NULL,
              property_id INTEGER NOT NULL,
              startDate TEXT NOT NULL,
              endDate TEXT,
              coldRent REAL NOT NULL,
              sideCosts REAL NOT NULL DEFAULT 0,
              paymentDayOfMonth INTEGER NOT NULL DEFAULT 31,
              isActive INTEGER NOT NULL DEFAULT 1,
              notes TEXT,
              createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
              FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
            )
          `, (err) => {
            if (err) {
              console.error('❌ Error creating tenant_contracts table:', err.message);
              errors.push(`Failed to create tenant_contracts: ${err.message}`);
              reject(err);
            } else {
              console.log('✅ tenant_contracts table created');
              resolve();
            }
          });
        });
      });

      // Create indexes for tenant_contracts
      const tenantIndexDefs = [
        'idx_tenant_contracts_tenant ON tenant_contracts(tenant_id)',
        'idx_tenant_contracts_property ON tenant_contracts(property_id)',
        'idx_tenant_contracts_active ON tenant_contracts(isActive)'
      ];

      for (const indexDef of tenantIndexDefs) {
        migrations.push(() => {
          return new Promise((resolve, reject) => {
            db.run(`CREATE INDEX IF NOT EXISTS ${indexDef}`, (err) => {
              if (err) {
                console.error(`❌ Error creating index ${indexDef}:`, err.message);
                errors.push(`Failed to create index ${indexDef}: ${err.message}`);
                reject(err);
              } else {
                console.log(`✅ Index ${indexDef.split(' ON ')[0]} created`);
                resolve();
              }
            });
          });
        });
      }
    } else {
      console.log('ℹ️  tenant_contracts table already exists, skipping creation');
    }

    // ============================================
    // PHASE 4: Create rent_payments table if needed
    // ============================================

    if (!rentPaymentsExists) {
      console.log('➕ Creating rent_payments table...');
      
      migrations.push(() => {
        return new Promise((resolve, reject) => {
          db.run(`
            CREATE TABLE rent_payments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tenant_contract_id INTEGER NOT NULL,
              date TEXT NOT NULL,
              amount REAL NOT NULL,
              coldRentAmount REAL NOT NULL,
              sideCostsAmount REAL NOT NULL,
              status TEXT NOT NULL DEFAULT 'PENDING',
              paymentMethod TEXT,
              transaction_id INTEGER NOT NULL,
              notes TEXT,
              createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tenant_contract_id) REFERENCES tenant_contracts(id) ON DELETE CASCADE,
              FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
            )
          `, (err) => {
            if (err) {
              console.error('❌ Error creating rent_payments table:', err.message);
              errors.push(`Failed to create rent_payments: ${err.message}`);
              reject(err);
            } else {
              console.log('✅ rent_payments table created');
              resolve();
            }
          });
        });
      });

      // Create indexes for rent_payments
      const rentPaymentIndexDefs = [
        'idx_rent_payments_contract ON rent_payments(tenant_contract_id)',
        'idx_rent_payments_date ON rent_payments(date)',
        'idx_rent_payments_status ON rent_payments(status)',
        'idx_rent_payments_transaction ON rent_payments(transaction_id)'
      ];

      for (const indexDef of rentPaymentIndexDefs) {
        migrations.push(() => {
          return new Promise((resolve, reject) => {
            db.run(`CREATE INDEX IF NOT EXISTS ${indexDef}`, (err) => {
              if (err) {
                console.error(`❌ Error creating index ${indexDef}:`, err.message);
                errors.push(`Failed to create index ${indexDef}: ${err.message}`);
                reject(err);
              } else {
                console.log(`✅ Index ${indexDef.split(' ON ')[0]} created`);
                resolve();
              }
            });
          });
        });
      }
    } else {
      console.log('ℹ️  rent_payments table already exists, skipping creation');
    }

    // ============================================
    // PHASE 5: Execute all migrations
    // ============================================

    if (migrations.length > 0) {
      console.log('\n🚀 Executing migrations...\n');
      
      for (const migration of migrations) {
        await migration();
      }
      
      console.log('\n✅ Migration 002 completed successfully!');
      console.log('tenant_contracts and rent_payments tables are ready.');
    } else {
      console.log('\n✅ All required tables already exist. Migration not needed.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    errors.push(error.message);
  } finally {
    // Single db.close() call - only happens here
    db.close();
    
    // Report any errors collected
    if (errors.length > 0) {
      console.error('\n⚠️  Migration completed with errors:');
      errors.forEach(err => console.error(`  - ${err}`));
    }
  }
};

// Start the migration
runMigration().catch(err => {
  console.error('Unhandled error in migration:', err);
});
