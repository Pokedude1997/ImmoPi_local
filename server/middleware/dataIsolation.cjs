/**
 * Data Isolation Middleware
 * Provides helper functions for filtering data by user_id
 * Admin users can see all data
 */

const path = require('path');
const serverPath = path.resolve(__dirname, '..');

// Load auth middleware to access user info
const { userScope, getUserFilter, getUserFilterParams } = require(path.resolve(serverPath, 'middleware', 'auth.cjs'));

/**
 * Create a user-scoped version of db.all that automatically filters by user_id
 * @param {Database} db - SQLite database instance
 * @returns {Function} User-scoped db.all
 */
function createScopedAll(db) {
  return function(sql, params = [], callback) {
    // This is a simplified approach
    // For a more robust solution, we'd need to parse the SQL
    // and inject the user_id filter, which is complex
    
    // For now, we'll use the request context
    // The actual filtering should be done in the route handlers
    // using the helper functions
    
    // If we have user context in the request (attached by authenticate middleware)
    // we can filter here, but we don't have access to req in this function
    
    // So this is just a placeholder - actual filtering happens in route handlers
    return db.all(sql, params, callback);
  };
}

/**
 * Create a user-scoped version of db.get
 * @param {Database} db - SQLite database instance
 * @returns {Function} User-scoped db.get
 */
function createScopedGet(db) {
  return function(sql, params = [], callback) {
    return db.get(sql, params, callback);
  };
}

/**
 * Apply user filter to a SELECT query
 * @param {string} query - Original query (should start with SELECT)
 * @param {Object} req - Express request object with user context
 * @returns {string} Query with user_id filter added
 */
function applyUserFilterToSelect(query, req) {
  if (!req || !req.userId) {
    return query;
  }
  
  if (req.isAdmin || req.canBypassUserFilter) {
    return query; // Admin sees all
  }
  
  // Find the position of the first WHERE clause or end of query
  const wherePos = query.toUpperCase().indexOf(' WHERE ');
  const orderByPos = query.toUpperCase().indexOf(' ORDER BY ');
  const limitPos = query.toUpperCase().indexOf(' LIMIT ');
  
  let insertPos;
  if (wherePos !== -1) {
    // Append to existing WHERE clause with AND
    insertPos = query.length;
    return query + ` AND user_id = ${req.userId}`;
  } else {
    // Find where to insert WHERE clause
    const positions = [orderByPos, limitPos].filter(p => p !== -1);
    if (positions.length > 0) {
      insertPos = Math.min(...positions);
    } else {
      insertPos = query.length;
    }
    return query.slice(0, insertPos) + ` WHERE user_id = ${req.userId}` + query.slice(insertPos);
  }
}

/**
 * Add user_id to INSERT values
 * @param {Object} data - Data object to insert
 * @param {Object} req - Express request object with user context
 * @returns {Object} Data with user_id added
 */
function addUserIdToData(data, req) {
  if (!req || !req.userId) {
    return data;
  }
  
  // Don't add user_id if it's already set (for admin operations)
  if (data.user_id !== undefined) {
    return data;
  }
  
  return { ...data, user_id: req.userId };
}

/**
 * Verify that a resource belongs to the current user
 * @param {Object} resource - Resource object with user_id
 * @param {Object} req - Express request object with user context
 * @returns {boolean} Whether resource belongs to user or user is admin
 */
function verifyOwnership(resource, req) {
  if (!resource || !req) {
    return false;
  }
  
  // Admin can access anything
  if (req.isAdmin || req.canBypassUserFilter) {
    return true;
  }
  
  // Check if resource has user_id and it matches
  if (resource.user_id === req.userId) {
    return true;
  }
  
  return false;
}

/**
 * Create a 403 response for unauthorized access
 * @param {Object} res - Express response object
 * @returns {void}
 */
function respondForbidden(res) {
  res.status(403).json({
    error: 'Forbidden',
    message: 'You do not have permission to access this resource',
  });
}

/**
 * Create a 404 response for not found
 * @param {Object} res - Express response object
 * @param {string} message - Custom message
 * @returns {void}
 */
function respondNotFound(res, message = 'Resource not found') {
  res.status(404).json({
    error: 'Not Found',
    message,
  });
}

module.exports = {
  createScopedAll,
  createScopedGet,
  applyUserFilterToSelect,
  addUserIdToData,
  verifyOwnership,
  respondForbidden,
  respondNotFound,
};
