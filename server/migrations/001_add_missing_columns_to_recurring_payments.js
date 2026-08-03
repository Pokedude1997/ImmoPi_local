/**
 * Migration 001: Add missing columns to recurring_payments table
 * 
 * This migration adds the nextDueDate and type columns that were missing from
 * the recurring_payments table schema. These columns are now required by the
 * frontend but were not in the original table creation.
 * 
 * Issues fixed:
 * - "Invalid Date" display for nextDueDate
 * - Missing type field causing undefined errors
 * - Property/category linkage not working
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path - environment aware
const dbPath = process.env.NODE_ENV === 'test'
  ? path.join(__dirname, '../../databases/test.db')
  : path.join(__dirname, '../../databases/production.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Running migration 001: Add missing columns to recurring_payments...\n');

db.serialize(() => {
  // Check if nextDueDate column exists
  db.all("PRAGMA table_info(recurring_payments)", [], (err, rows) => {
    if (err) {
      console.error('❌ Error checking table info:', err.message);
      db.close();
      return;
    }

    const columnNames = rows.map(row => row.name);
    console.log('Current columns:', columnNames);
    
    const migrations = [];

    // Add nextDueDate column if it doesn't exist
    if (!columnNames.includes('nextDueDate')) {
      console.log('➕ Adding nextDueDate column...');
      migrations.push(() => {
        return new Promise((resolve, reject) => {
          db.run('ALTER TABLE recurring_payments ADD COLUMN nextDueDate TEXT', [], (err) => {
            if (err) {
              console.error('❌ Error adding nextDueDate column:', err.message);
              reject(err);
            } else {
              console.log('✅ nextDueDate column added');
              resolve();
            }
          });
        });
      });
    }

    // Add type column if it doesn't exist
    if (!columnNames.includes('type')) {
      console.log('➕ Adding type column...');
      migrations.push(() => {
        return new Promise((resolve, reject) => {
          db.run('ALTER TABLE recurring_payments ADD COLUMN type TEXT', [], (err) => {
            if (err) {
              console.error('❌ Error adding type column:', err.message);
              reject(err);
            } else {
              console.log('✅ type column added');
              resolve();
            }
          });
        });
      });
    }

    // Update existing data to have proper nextDueDate values
    if (!columnNames.includes('nextDueDate')) {
      console.log('\n📝 Updating existing recurring payments with nextDueDate values...');
      migrations.push(() => {
        return new Promise((resolve, reject) => {
          // For each recurring payment without nextDueDate, set it to startDate
          db.run(
            'UPDATE recurring_payments SET nextDueDate = startDate WHERE nextDueDate IS NULL AND startDate IS NOT NULL',
            [],
            (err) => {
              if (err) {
                console.error('❌ Error updating nextDueDate values:', err.message);
                reject(err);
              } else {
                console.log(`✅ Updated ${this.changes} recurring payments with nextDueDate = startDate`);
                resolve();
              }
            }
          );
        });
      });
    }

    // Update existing data to have proper type values based on category
    if (!columnNames.includes('type')) {
      console.log('\n📝 Updating existing recurring payments with type values...');
      migrations.push(() => {
        return new Promise((resolve, reject) => {
          // Get all categories to map category_id to type
          db.all('SELECT id, type FROM categories', [], (err, categories) => {
            if (err) {
              console.error('❌ Error fetching categories:', err.message);
              reject(err);
              return;
            }

            const categoryTypeMap = {};
            categories.forEach(cat => {
              categoryTypeMap[cat.id] = cat.type;
            });

            // Update each recurring payment with type from its category
            db.all('SELECT id, category_id FROM recurring_payments WHERE type IS NULL', [], (err, payments) => {
              if (err) {
                console.error('❌ Error fetching recurring payments:', err.message);
                reject(err);
                return;
              }

              if (payments.length === 0) {
                console.log('✅ All recurring payments already have type values');
                resolve();
                return;
              }

              let processed = 0;
              payments.forEach(payment => {
                const categoryType = categoryTypeMap[payment.category_id];
                const type = categoryType || 'EXPENSE'; // Default to EXPENSE if no category

                db.run(
                  'UPDATE recurring_payments SET type = ? WHERE id = ?',
                  [type, payment.id],
                  (err) => {
                    if (err) {
                      console.error(`❌ Error updating type for payment ${payment.id}:`, err.message);
                    } else {
                      console.log(`✅ Updated payment ${payment.id} with type: ${type}`);
                    }
                    processed++;
                    if (processed === payments.length) {
                      resolve();
                    }
                  }
                );
              });
            });
          });
        });
      });
    }

    // Execute all migrations
    if (migrations.length > 0) {
      console.log('\n🚀 Executing migrations...\n');
      
      const executeMigrations = async () => {
        try {
          for (const migration of migrations) {
            await migration();
          }
          console.log('\n✅ Migration 001 completed successfully!');
          console.log('Your recurring_payments table now has all required columns.');
        } catch (error) {
          console.error('\n❌ Migration failed:', error.message);
        } finally {
          db.close();
        }
      };
      
      executeMigrations();
    } else {
      console.log('\n✅ All required columns already exist. Migration not needed.');
      db.close();
    }
  });
});
