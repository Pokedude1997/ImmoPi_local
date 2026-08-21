/**
 * JWT Utilities
 * Handles JWT token generation and verification
 */

const jwt = require('jsonwebtoken');
const path = require('path');

// Use server's node_modules
const serverPath = path.resolve(__dirname, '..');
const jwtPath = path.resolve(serverPath, 'node_modules', 'jsonwebtoken');
const jwtLib = require(jwtPath);

// Load environment variables
require('dotenv').config({ path: path.resolve(serverPath, '..', '.env') });

// Validate required environment variables
if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET environment variable is required');
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is required');
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Token expiries
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d';  // 7 days

/**
 * Generate access token for a user
 * @param {number} userId - User ID
 * @param {string} username - Username
 * @param {boolean} isAdmin - Whether user is admin
 * @returns {string} JWT access token
 */
function generateAccessToken(userId, username, isAdmin) {
  return jwtLib.sign(
    { userId, username, isAdmin },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate refresh token for a user
 * @param {number} userId - User ID
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(userId) {
  return jwtLib.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @param {string} secret - Secret to use for verification
 * @returns {Promise<Object>} Decoded token payload
 */
function verifyToken(token, secret) {
  return new Promise((resolve, reject) => {
    jwtLib.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}

/**
 * Verify access token
 * @param {string} token - Access token to verify
 * @returns {Promise<Object>} Decoded token payload
 */
function verifyAccessToken(token) {
  return verifyToken(token, JWT_ACCESS_SECRET);
}

/**
 * Verify refresh token
 * @param {string} token - Refresh token to verify
 * @returns {Promise<Object>} Decoded token payload
 */
function verifyRefreshToken(token) {
  return verifyToken(token, JWT_REFRESH_SECRET);
}

/**
 * Decode token without verification (to check expiry)
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
function decodeToken(token) {
  return jwtLib.decode(token);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
};
