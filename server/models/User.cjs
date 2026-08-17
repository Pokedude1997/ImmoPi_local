/**
 * User Model
 * Handles all database operations for users
 */

const path = require('path');
const bcrypt = require('bcrypt');

// Use server's node_modules
const serverPath = path.resolve(__dirname, '..');
const bcryptPath = path.resolve(serverPath, 'node_modules', 'bcrypt');
const bcryptLib = require(bcryptPath);
const sqlite3Path = path.resolve(serverPath, 'node_modules', 'sqlite3');
const sqlite3 = require(sqlite3Path).verbose();

// Load environment variables
require('dotenv').config({ path: path.resolve(serverPath, '..', '.env') });

// Database path
const dbPath = process.env.NODE_ENV === 'test' 
  ? path.join(__dirname, '..', '..', 'databases', 'test.db') 
  : path.join(__dirname, '..', '..', 'databases', 'production.db');

// Create database connection pool
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
 db.configure({ 
   "foreign_keys": true 
 });

/**
 * Find user by username
 * @param {string} username - Username to search for
 * @returns {Promise<Object|null>} User object or null
 */
async function findByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, username, password_hash, is_admin as isAdmin, created_at, updated_at FROM users WHERE username = ? LIMIT 1',
      [username],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          // Convert SQLite boolean (0/1) to JavaScript boolean
          if (row) {
            row.isAdmin = Boolean(row.isAdmin);
          }
          resolve(row || null);
        }
      }
    );
  });
}

/**
 * Get user by ID
 * @param {number} id - User ID
 * @returns {Promise<Object|null>} User object or null
 */
async function getById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, username, password_hash, is_admin as isAdmin, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [id],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          // Convert SQLite boolean (0/1) to JavaScript boolean
          if (row) {
            row.isAdmin = Boolean(row.isAdmin);
          }
          resolve(row || null);
        }
      }
    );
  });
}

/**
 * Create a new user
 * @param {string} username - Username
 * @param {string} password - Plain text password (will be hashed)
 * @param {boolean} isAdmin - Whether user is admin (default: false)
 * @returns {Promise<Object>} Created user object
 */
async function create(username, password, isAdmin = false) {
  const hashedPassword = await bcryptLib.hash(password, 12);
  
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (username, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, datetime("now"), datetime("now"))',
      [username, hashedPassword, isAdmin ? 1 : 0],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            reject(new Error('Username already exists'));
          } else {
            reject(err);
          }
        } else {
          // Fetch the created user
          getById(this.lastID)
            .then(user => {
              if (user) {
                user.isAdmin = Boolean(user.isAdmin);
              }
              resolve(user);
            })
            .catch(reject);
        }
      }
    );
  });
}

/**
 * Validate user password
 * @param {Object} user - User object with password_hash
 * @param {string} password - Plain text password to validate
 * @returns {Promise<boolean>} Whether password matches
 */
async function validatePassword(user, password) {
  if (!user || !user.password_hash) {
    return false;
  }
  return await bcryptLib.compare(password, user.password_hash);
}

/**
 * Get all users
 * @returns {Promise<Array>} Array of user objects
 */
async function getAll() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT id, username, is_admin as isAdmin, created_at, updated_at FROM users ORDER BY id',
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Convert SQLite boolean to JavaScript boolean
          rows.forEach(row => {
            row.isAdmin = Boolean(row.isAdmin);
          });
          resolve(rows);
        }
      }
    );
  });
}

/**
 * Update a user
 * @param {number} id - User ID
 * @param {Object} updates - Object with properties to update
 * @returns {Promise<Object>} Updated user object
 */
async function update(id, updates) {
  const fields = [];
  const values = [];
  
  // Build update query
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'password') {
      // Hash password before storing
      const hashedPassword = await bcryptLib.hash(value, 12);
      fields.push(`${key}_hash = ?`);
      values.push(hashedPassword);
    } else if (key === 'isAdmin') {
      fields.push('is_admin = ?');
      values.push(value ? 1 : 0);
    } else if (key !== 'password_hash') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (fields.length === 0) {
    // No valid fields to update
    return getById(id);
  }
  
  values.push(id);
  
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE users SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          reject(err);
        } else {
          if (this.changes === 0) {
            reject(new Error('User not found'));
          } else {
            // Fetch the updated user
            getById(id)
              .then(user => {
                if (user) {
                  user.isAdmin = Boolean(user.isAdmin);
                }
                resolve(user);
              })
              .catch(reject);
          }
        }
      }
    );
  });
}

/**
 * Delete a user
 * @param {number} id - User ID
 * @returns {Promise<boolean>} Whether deletion was successful
 */
async function deleteUser(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
}

/**
 * Get user by username (case-insensitive)
 * @param {string} username - Username to search for
 * @returns {Promise<Object|null>} User object or null
 */
async function findByUsernameCaseInsensitive(username) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, username, password_hash, is_admin as isAdmin, created_at, updated_at FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
      [username],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            row.isAdmin = Boolean(row.isAdmin);
          }
          resolve(row || null);
        }
      }
    );
  });
}

module.exports = {
  findByUsername,
  findByUsernameCaseInsensitive,
  getById,
  create,
  validatePassword,
  getAll,
  update,
  delete: deleteUser,
};
