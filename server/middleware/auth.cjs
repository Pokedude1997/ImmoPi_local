/**
 * Authentication Middleware
 * Handles JWT authentication, authorization, and user scoping
 */

const path = require('path');

// Use server's node_modules
const serverPath = path.resolve(__dirname, '..');

// Load JWT utilities
const jwtUtilsPath = path.resolve(serverPath, 'utils', 'jwt.cjs');
const {
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken,
  decodeToken
} = require(jwtUtilsPath);

// Token cookie names
const ACCESS_TOKEN_COOKIE = 'accessToken';
const REFRESH_TOKEN_COOKIE = 'refreshToken';

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
  sameSite: 'lax', // Allow cross-site cookies for development (localhost:3000 -> 192.168.1.18:8000)
  maxAge: 15 * 60 * 1000, // 15 minutes for access token
  path: '/',
  domain: '192.168.1.18', // Allow cookies across all ports on this IP (3000, 8000, etc.)
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for refresh token
};

/**
 * Generate access token and set cookie
 * @param {Object} res - Express response object
 * @param {number} userId - User ID
 * @param {string} username - Username
 * @param {boolean} isAdmin - Whether user is admin
 */
function setAccessTokenCookie(res, userId, username, isAdmin) {
  const token = generateAccessToken(userId, username, isAdmin);
  res.cookie(ACCESS_TOKEN_COOKIE, token, COOKIE_OPTIONS);
  return token;
}

/**
 * Generate refresh token and set cookie
 * @param {Object} res - Express response object
 * @param {number} userId - User ID
 */
function setRefreshTokenCookie(res, userId) {
  const jwt = require(path.resolve(serverPath, 'node_modules', 'jsonwebtoken'));
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
  const token = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  res.cookie(REFRESH_TOKEN_COOKIE, token, REFRESH_COOKIE_OPTIONS);
  return token;
}

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
function clearAuthCookies(res) {
  res.clearCookie(ACCESS_TOKEN_COOKIE);
  res.clearCookie(REFRESH_TOKEN_COOKIE);
}

/**
 * Extract access token from cookies
 * @param {Object} req - Express request object
 * @returns {string|null} Access token or null
 */
function getAccessTokenFromCookies(req) {
  return req.cookies?.[ACCESS_TOKEN_COOKIE] || null;
}

/**
 * Extract refresh token from cookies
 * @param {Object} req - Express request object
 * @returns {string|null} Refresh token or null
 */
function getRefreshTokenFromCookies(req) {
  return req.cookies?.[REFRESH_TOKEN_COOKIE] || null;
}

/**
 * Authenticate user from JWT token
 * Attaches user object to req.user if authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticate(req, res, next) {
  try {
    const accessToken = getAccessTokenFromCookies(req);
    
    if (!accessToken) {
      // No access token, check if we can refresh
      const refreshToken = getRefreshTokenFromCookies(req);
      
      if (refreshToken) {
        try {
          const refreshPayload = await verifyRefreshToken(refreshToken);
          const userId = refreshPayload.userId;
          
          // Get user from database to get username and isAdmin
          const User = require(path.resolve(serverPath, 'models', 'User.cjs'));
          const user = await User.getById(userId);
          
          if (user) {
            // Generate new access token
            setAccessTokenCookie(res, user.id, user.username, user.isAdmin);
            
            // Attach user to request
            req.user = {
              id: user.id,
              username: user.username,
              isAdmin: user.isAdmin,
            };
            
            return next();
          }
        } catch (refreshError) {
          console.log('Refresh token verification failed:', refreshError.message);
          // Continue to 401
        }
      }
      
      // No valid tokens
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No valid authentication token provided',
      });
    }
    
    // Verify access token
    const payload = await verifyAccessToken(accessToken);
    
    // Attach user to request
    req.user = {
      id: payload.userId,
      username: payload.username,
      isAdmin: payload.isAdmin,
    };
    
    next();
    
  } catch (error) {
    console.error('Authentication error:', error.message);
    
    // Check if it's a token expired error and we have a refresh token
    if (error.name === 'TokenExpiredError') {
      const refreshToken = getRefreshTokenFromCookies(req);
      
      if (refreshToken) {
        try {
          const refreshPayload = await verifyRefreshToken(refreshToken);
          const userId = refreshPayload.userId;
          
          // Get user from database
          const User = require(path.resolve(serverPath, 'models', 'User.cjs'));
          const user = await User.getById(userId);
          
          if (user) {
            // Generate new access token
            setAccessTokenCookie(res, user.id, user.username, user.isAdmin);
            
            // Attach user to request
            req.user = {
              id: user.id,
              username: user.username,
              isAdmin: user.isAdmin,
            };
            
            return next();
          }
        } catch (refreshError) {
          console.log('Refresh token verification failed:', refreshError.message);
        }
      }
    }
    
    // Clear potentially invalid cookies
    clearAuthCookies(res);
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token',
    });
  }
}

/**
 * Require authentication middleware
 * Ensures user is authenticated, returns 401 if not
 */
function requireAuth(req, res, next) {
  // Check if user is already authenticated (from authenticate middleware)
  if (req.user) {
    return next();
  }
  
  // If not, try to authenticate
  return authenticate(req, res, () => {
    if (req.user) {
      next();
    } else {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }
  });
}

/**
 * Require admin middleware
 * Ensures user is authenticated AND is admin
 */
function requireAdmin(req, res, next) {
  return authenticate(req, res, () => {
    if (req.user && req.user.isAdmin) {
      next();
    } else {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }
  });
}

/**
 * User scope middleware
 * Adds user_id filter to request for data isolation
 * Admin users bypass the filter
 */
function userScope(req, res, next) {
  // Skip userScope for auth and users routes
  // When mounted via app.use('/api', ...), req.path is relative
  // For example: /api/auth/login -> req.path = '/auth/login'
  // For example: /api/users -> req.path = '/users'
  const relativePath = req.path;
  const fullPath = req.originalUrl;
  
  if (relativePath.startsWith('/auth') || 
      relativePath.startsWith('/users') ||
      fullPath.startsWith('/api/auth') || 
      fullPath.startsWith('/api/users')) {
    return next();
  }
  
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required for user-scoped data',
    });
  }
  
  // Add user context to request for filtering
  req.userId = req.user.id;
  req.isAdmin = req.user.isAdmin;
  
  // If admin, add flag for bypass
  if (req.user.isAdmin) {
    req.canBypassUserFilter = true;
  }
  
  next();
}

/**
 * Helper function to get user filter SQL
 * @param {Object} req - Express request object
 * @returns {string} SQL WHERE clause for user filtering
 */
/**
 * Get user filter SQL clause and parameters for parameterized queries
 * Returns object with query fragment and params array to prevent SQL injection
 * @param {Object} req - Express request object
 * @returns {Object} Object with query string and params array
 */
function getUserFilter(req) {
  if (!req.userId) {
    return { query: '', params: [] };
  }
  
  if (req.canBypassUserFilter || req.isAdmin) {
    return { query: '', params: [] }; // Admin can see all data
  }
  
  return { query: ' WHERE user_id = ?', params: [req.userId] };
}

/**
 * Helper function to get user filter parameters
 * @param {Object} req - Express request object
 * @returns {Array} Array of parameter values for prepared statements
 */
function getUserFilterParams(req) {
  if (!req.userId) {
    return [];
  }
  
  if (req.canBypassUserFilter || req.isAdmin) {
    return []; // Admin can see all data
  }
  
  return [req.userId];
}

module.exports = {
  authenticate,
  requireAuth,
  requireAdmin,
  userScope,
  getUserFilter,
  getUserFilterParams,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  getAccessTokenFromCookies,
  getRefreshTokenFromCookies,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
};
