/**
 * User-Scoped Database Wrapper
 * Wraps SQLite database methods to automatically filter by user_id
 * Admin users bypass the filtering
 */

const path = require('path');
const serverPath = path.resolve(__dirname, '..');

// Load data isolation helpers
const {
  applyUserFilterToSelect,
  addUserIdToData,
  verifyOwnership,
  respondForbidden,
  respondNotFound,
} = require(path.resolve(serverPath, 'middleware', 'dataIsolation.cjs'));

/**
 * Create a user-scoped database wrapper
 * @param {Database} db - SQLite database instance
 * @param {Object} req - Express request object (for user context)
 * @returns {Object} Wrapped database methods
 */
function createUserScopedDb(db, req) {
  // Determine if we should filter
  const shouldFilter = req && req.userId && !req.isAdmin && !req.canBypassUserFilter;
  const userId = shouldFilter ? req.userId : null;
  
  return {
    /**
     * User-scoped version of db.all
     * Automatically adds user_id filter to SELECT queries
     */
    all: (sql, params = [], callback) => {
      // Check if this is a SELECT query that needs filtering
      const upperSql = sql.toUpperCase().trim();
      
      if (shouldFilter && upperSql.startsWith('SELECT')) {
        // Apply user filter
        const filteredSql = applyUserFilterToSelect(sql, req);
        // Add userId to params if needed
        const filteredParams = filteredSql.includes('user_id = ?') 
          ? [...params, userId] 
          : params;
        return db.all(filteredSql, filteredParams, callback);
      }
      
      // For non-SELECT queries or admin users, use original
      return db.all(sql, params, callback);
    },
    
    /**
     * User-scoped version of db.get
     * Automatically adds user_id filter to SELECT queries
     */
    get: (sql, params = [], callback) => {
      const upperSql = sql.toUpperCase().trim();
      
      if (shouldFilter && upperSql.startsWith('SELECT')) {
        const filteredSql = applyUserFilterToSelect(sql, req);
        const filteredParams = filteredSql.includes('user_id = ?') 
          ? [...params, userId] 
          : params;
        return db.get(filteredSql, filteredParams, callback);
      }
      
      return db.get(sql, params, callback);
    },
    
    /**
     * User-scoped version of db.run
     * Automatically adds user_id to INSERT/UPDATE queries
     */
    run: (sql, params = [], callback) => {
      const upperSql = sql.toUpperCase().trim();
      
      // For INSERT queries, we need to modify the data, not the SQL
      // This is handled separately in the route handlers
      
      return db.run(sql, params, callback);
    },
    
    /**
     * Add user_id to data for INSERT/UPDATE
     * @param {Object} data - Data to insert/update
     * @returns {Object} Data with user_id added
     */
    addUserId: (data) => {
      return addUserIdToData(data, req);
    },
    
    /**
     * Verify ownership of a resource
     * @param {Object} resource - Resource with user_id
     * @returns {boolean} Whether resource belongs to user
     */
    verifyOwnership: (resource) => {
      return verifyOwnership(resource, req);
    },
    
    /**
     * Respond with 403 Forbidden
     */
    forbidden: () => {
      respondForbidden({ res: res });
    },
    
    /**
     * Respond with 404 Not Found
     */
    notFound: (message) => {
      respondNotFound({ res: res }, message);
    },
    
    // Pass through other methods
    exec: db.exec.bind(db),
    close: db.close.bind(db),
    configure: db.configure.bind(db),
    
    // Expose the original db for cases where we need to bypass filtering
    raw: db,
    
    // User context
    userId: shouldFilter ? userId : null,
    isAdmin: req ? (req.isAdmin || false) : false,
    canBypass: req ? (req.canBypassUserFilter || false) : false,
  };
}

/**
 * Create a user-scoped INSERT helper
 * @param {Object} db - Database instance
 * @param {string} table - Table name
 * @param {Object} data - Data to insert
 * @param {Object} req - Express request
 * @param {Function} callback - Callback
 */
function userScopedInsert(db, table, data, req, callback) {
  const scopedDb = createUserScopedDb(db, req);
  const dataWithUserId = scopedDb.addUserId(data);
  
  // Build INSERT query
  const columns = Object.keys(dataWithUserId).join(', ');
  const placeholders = Object.keys(dataWithUserId).map(() => '?').join(', ');
  const values = Object.values(dataWithUserId);
  
  const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
  
  db.run(sql, values, function(err) {
    if (err) {
      callback(err);
    } else {
      callback(null, { id: this.lastID, ...dataWithUserId });
    }
  });
}

/**
 * Create a user-scoped UPDATE helper
 * @param {Object} db - Database instance
 * @param {string} table - Table name
 * @param {number} id - Resource ID
 * @param {Object} data - Data to update
 * @param {Object} req - Express request
 * @param {Function} callback - Callback
 */
function userScopedUpdate(db, table, id, data, req, callback) {
  const scopedDb = createUserScopedDb(db, req);
  const dataWithUserId = scopedDb.addUserId(data);
  
  // First, verify ownership if not admin
  if (!scopedDb.isAdmin && !scopedDb.canBypass) {
    // Get the resource first to check ownership
    db.get(`SELECT user_id FROM ${table} WHERE id = ?`, [id], (err, row) => {
      if (err) {
        return callback(err);
      }
      if (!row) {
        return callback(new Error('Resource not found'));
      }
      if (!scopedDb.verifyOwnership(row)) {
        return callback(new Error('Forbidden'));
      }
      // Proceed with update
      proceedWithUpdate();
    });
  } else {
    proceedWithUpdate();
  }
  
  function proceedWithUpdate() {
    const updates = Object.keys(dataWithUserId).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(dataWithUserId), id];
    
    const sql = `UPDATE ${table} SET ${updates} WHERE id = ?`;
    
    db.run(sql, values, function(err) {
      if (err) {
        callback(err);
      } else if (this.changes === 0) {
        callback(new Error('Resource not found'));
      } else {
        callback(null, { id, ...dataWithUserId });
      }
    });
  }
}

/**
 * Create a user-scoped DELETE helper
 * @param {Object} db - Database instance
 * @param {string} table - Table name
 * @param {number} id - Resource ID
 * @param {Object} req - Express request
 * @param {Function} callback - Callback
 */
function userScopedDelete(db, table, id, req, callback) {
  const scopedDb = createUserScopedDb(db, req);
  
  // First, verify ownership if not admin
  if (!scopedDb.isAdmin && !scopedDb.canBypass) {
    // Get the resource first to check ownership
    db.get(`SELECT user_id FROM ${table} WHERE id = ?`, [id], (err, row) => {
      if (err) {
        return callback(err);
      }
      if (!row) {
        return callback(new Error('Resource not found'));
      }
      if (!scopedDb.verifyOwnership(row)) {
        return callback(new Error('Forbidden'));
      }
      // Proceed with delete
      proceedWithDelete();
    });
  } else {
    proceedWithDelete();
  }
  
  function proceedWithDelete() {
    db.run(`DELETE FROM ${table} WHERE id = ?`, [id], function(err) {
      if (err) {
        callback(err);
      } else if (this.changes === 0) {
        callback(new Error('Resource not found'));
      } else {
        callback(null, { deleted: true });
      }
    });
  }
}

/**
 * Create a middleware that attaches user-scoped db to request
 */
function attachScopedDb(db) {
  return (req, res, next) => {
    req.scopedDb = createUserScopedDb(db, req);
    next();
  };
}

module.exports = {
  createUserScopedDb,
  userScopedInsert,
  userScopedUpdate,
  userScopedDelete,
  attachScopedDb,
};
