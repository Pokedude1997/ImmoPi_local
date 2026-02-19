/**
 * ImmoPi Manager - Simple Authentication Middleware
 * 
 * Provides basic password protection for the web UI
 */

const bcrypt = require('bcrypt');
require('dotenv').config();

// Hash the password from environment (on first run)
const APP_PASSWORD_HASH = process.env.APP_PASSWORD_HASH;
const APP_PASSWORD = process.env.APP_PASSWORD;

// Session storage (in-memory for simplicity)
const activeSessions = new Map();

// Session duration: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;

/**
 * Generate a random session token
 */
function generateSessionToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, expiry] of activeSessions.entries()) {
    if (now > expiry) {
      activeSessions.delete(token);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

/**
 * Verify password and create session
 */
async function login(password) {
  try {
    let isValid = false;

    // Check against hashed password if available
    if (APP_PASSWORD_HASH) {
      isValid = await bcrypt.compare(password, APP_PASSWORD_HASH);
    } 
    // Fallback to plain text comparison (less secure, but simple setup)
    else if (APP_PASSWORD) {
      isValid = password === APP_PASSWORD;
    } else {
      throw new Error('No password configured in environment variables');
    }

    if (!isValid) {
      return { success: false, error: 'Invalid password' };
    }

    // Create session
    const token = generateSessionToken();
    const expiry = Date.now() + SESSION_DURATION;
    activeSessions.set(token, expiry);

    return {
      success: true,
      token,
      expiresAt: new Date(expiry).toISOString(),
    };
  } catch (error) {
    console.error('Login error:', error.message);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Check if session token is valid
 */
function isValidSession(token) {
  if (!token) return false;
  
  const expiry = activeSessions.get(token);
  if (!expiry) return false;
  
  if (Date.now() > expiry) {
    activeSessions.delete(token);
    return false;
  }
  
  return true;
}

/**
 * Logout and invalidate session
 */
function logout(token) {
  if (token) {
    activeSessions.delete(token);
  }
  return { success: true };
}

/**
 * Express middleware to protect routes
 */
function requireAuth(req, res, next) {
  // Get token from Authorization header or cookie
  const token = req.headers.authorization?.replace('Bearer ', '') || 
                req.cookies?.sessionToken;

  if (!isValidSession(token)) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Please log in to access this resource'
    });
  }

  // Attach token to request for potential use
  req.sessionToken = token;
  next();
}

/**
 * Utility function to hash a password (for generating APP_PASSWORD_HASH)
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

module.exports = {
  login,
  logout,
  isValidSession,
  requireAuth,
  hashPassword,
};

// CLI utility to generate password hash
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === 'hash' && args[1]) {
    hashPassword(args[1]).then(hash => {
      console.log('\nAdd this to your .env file:');
      console.log(`APP_PASSWORD_HASH=${hash}`);
      console.log('\nOr use plain text (less secure):');
      console.log(`APP_PASSWORD=${args[1]}`);
    });
  } else {
    console.log('Usage: node auth-middleware.js hash <your-password>');
  }
}
