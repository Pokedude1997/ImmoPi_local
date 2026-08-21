/**
 * Auth Routes
 * Handles user authentication: login, logout, refresh, me
 */

const express = require('express');
const router = express.Router();
const path = require('path');

// Use server's node_modules for express
const serverPath = path.resolve(__dirname, '..');
const expressPath = path.resolve(serverPath, 'node_modules', 'express');
const expressLib = require(expressPath);

// Load dependencies
const serverRouter = expressLib.Router();

// Load JWT utilities
const jwtUtilsPath = path.resolve(serverPath, 'utils', 'jwt.cjs');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require(jwtUtilsPath);

// Load User model
const User = require(path.resolve(serverPath, 'models', 'User.cjs'));

// Load auth middleware
const {
  authenticate,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
} = require(path.resolve(serverPath, 'middleware', 'auth.cjs'));

// Rate limiting for auth endpoints (simple in-memory implementation)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * POST /api/auth/login
 * Authenticate user and set JWT tokens in cookies
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password are required',
      });
    }
    
    // Rate limiting check
    const ip = req.ip || req.connection.remoteAddress;
    const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    
    if (attempts.count >= MAX_LOGIN_ATTEMPTS && 
        Date.now() - attempts.lastAttempt < LOGIN_ATTEMPT_WINDOW) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many login attempts. Please try again later.',
      });
    }
    
    // Find user by username
    const user = await User.findByUsernameCaseInsensitive(username);
    
    if (!user) {
      // Record failed attempt
      loginAttempts.set(ip, {
        count: attempts.count + 1,
        lastAttempt: Date.now(),
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password',
      });
    }
    
    // Validate password
    const isValidPassword = await User.validatePassword(user, password);
    
    if (!isValidPassword) {
      // Record failed attempt
      loginAttempts.set(ip, {
        count: attempts.count + 1,
        lastAttempt: Date.now(),
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password',
      });
    }
    
    // Reset failed attempts on successful login
    loginAttempts.delete(ip);
    
    // Set JWT tokens in HTTP-only cookies
    setAccessTokenCookie(res, user.id, user.username, user.isAdmin);
    setRefreshTokenCookie(res, user.id);
    
    // Return user info (without sensitive data)
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
      },
    });
    
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during login',
    });
  }
});

/**
 * POST /api/auth/logout
 * Clear authentication cookies
 */
router.post('/logout', (req, res) => {
  try {
    clearAuthCookies(res);
    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during logout',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No refresh token provided',
      });
    }
    
    // Verify refresh token
    const payload = await verifyRefreshToken(refreshToken);
    const userId = payload.userId;
    
    // Get user from database
    const user = await User.getById(userId);
    
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }
    
    // Generate new access token
    setAccessTokenCookie(res, user.id, user.username, user.isAdmin);
    
    return res.json({
      success: true,
      message: 'Access token refreshed',
    });
    
  } catch (error) {
    console.error('Refresh token error:', error.message);
    clearAuthCookies(res);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid refresh token',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', authenticate, (req, res) => {
  try {
    // User should be attached by authenticate middleware
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
    }
    
    return res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        isAdmin: req.user.isAdmin,
      },
    });
    
  } catch (error) {
    console.error('Get me error:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while getting user info',
    });
  }
});

/**
 * GET /api/auth/check
 * Check if current session is valid (compatibility with old auth system)
 */
router.get('/check', authenticate, (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
    }
    
    return res.json({
      success: true,
      authenticated: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        isAdmin: req.user.isAdmin,
      },
    });
    
  } catch (error) {
    console.error('Auth check error:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during authentication check',
    });
  }
});

// Rate limiting for registration endpoint
const registerAttempts = new Map();
const MAX_REGISTER_ATTEMPTS = 5;
const REGISTER_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Rate limiting check
    const ip = req.ip || req.connection.remoteAddress;
    const attempts = registerAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    
    if (attempts.count >= MAX_REGISTER_ATTEMPTS && 
        Date.now() - attempts.lastAttempt < REGISTER_ATTEMPT_WINDOW) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many registration attempts. Please try again later.',
      });
    }
    
    if (!username || !password) {
      // Record failed attempt
      registerAttempts.set(ip, {
        count: attempts.count + 1,
        lastAttempt: Date.now(),
      });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password are required',
      });
    }
    
    // Validate username: 3-32 characters, alphanumeric + underscore only
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      // Record failed attempt
      registerAttempts.set(ip, {
        count: attempts.count + 1,
        lastAttempt: Date.now(),
      });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username must be 3-32 characters and contain only letters, numbers, and underscores',
      });
    }
    
    // Validate password complexity: at least one uppercase, one lowercase, one number, one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(password)) {
      // Record failed attempt
      registerAttempts.set(ip, {
        count: attempts.count + 1,
        lastAttempt: Date.now(),
      });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)',
      });
    }
    
    // Check if username already exists (case-insensitive)
    const existingUser = await User.findByUsernameCaseInsensitive(username);
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username already exists',
      });
    }
    
    // Reset failed attempts on successful registration
    registerAttempts.delete(ip);
    
    // Create new user (non-admin by default)
    const newUser = await User.create(username, password, false);
    
    // Auto-login the user after registration
    setAccessTokenCookie(res, newUser.id, newUser.username, newUser.isAdmin);
    setRefreshTokenCookie(res, newUser.id);
    
    return res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: newUser.id,
        username: newUser.username,
        isAdmin: newUser.isAdmin,
      },
    });
    
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during registration',
    });
  }
});

module.exports = router;
