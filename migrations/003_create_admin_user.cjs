/**
 * Migration 003: Create admin user
 * This migration creates the first admin user using the existing APP_PASSWORD from .env
 * The admin user will have id=1 and own all existing data
 */

const path = require('path');
const fs = require('fs');

// Use server's node_modules
const serverPath = path.resolve(__dirname, '..', 'server');
const dotenvPath = path.resolve(serverPath, 'node_modules', 'dotenv');
const bcrypt = require(path.resolve(serverPath, 'node_modules', 'bcrypt'));
const sqlite3 = require(path.resolve(serverPath, 'node_modules', 'sqlite3')).verbose();

// Load dotenv before other code
require(dotenvPath).config({ path: path.resolve(__dirname, '..', '.env') });

// Environment variables already loaded above

const dbPath = process.env.NODE_ENV === 'test' 
  ? path.join(__dirname, '..', 'databases', 'test.db') 
  : path.join(__dirname, '..', 'databases', 'production.db');

const db = new sqlite3.Database(dbPath);

async function runMigration() {
  try {
    console.log('Running migration 003: Create admin user...');
    
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.APP_PASSWORD;
    
    if (!adminPassword) {
      throw new Error('APP_PASSWORD environment variable is required for admin user migration');
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    
    // Insert admin user with id=1
    const insertUser = new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO users (id, username, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, TRUE, datetime("now"), datetime("now"))',
        [1, adminUsername, hashedPassword],
        function(err) {
          if (err) {
            console.error('Error inserting admin user:', err.message);
            reject(err);
          } else {
            console.log(`Admin user created: username=${adminUsername}, id=1`);
            resolve();
          }
        }
      );
    });
    
    await insertUser;
    
    // Record migration
    const recordMigration = new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO migrations_applied (migration_name, applied_at) VALUES (?, datetime("now"))',
        ['003_create_admin_user'],
        function(err) {
          if (err) {
            console.error('Error recording migration:', err.message);
            reject(err);
          } else {
            console.log('Migration 003 recorded in migrations_applied table');
            resolve();
          }
        }
      );
    });
    
    await recordMigration;
    
    console.log('Migration 003 completed successfully!');
    
  } catch (error) {
    console.error('Migration 003 failed:', error.message);
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
