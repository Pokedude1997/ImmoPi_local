/**
 * User Routes
 * Handles user management (CRUD operations on users)
 * Admin-only access for most endpoints
 */

const express = require('express');
const router = express.Router();
const path = require('path');

// Use server's node_modules
const serverPath = path.resolve(__dirname, '..');
const expressPath = path.resolve(serverPath, 'node_modules', 'express');
const expressLib = require(expressPath);

// Load User model
const User = require(path.resolve(serverPath, 'models', 'User.cjs'));

// Load auth middleware
const { requireAuth, requireAdmin } = require(path.resolve(serverPath, 'middleware', 'auth.cjs'));

/**
 * GET /api/users
 * List all users (admin only)
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.getAll();
    
    // Remove password_hash from response
    const usersForResponse = users.map(user => {
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    return res.json(usersForResponse);
    
  } catch (error) {
    console.error('Error listing users:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while listing users',
    });
  }
});

/**
 * POST /api/users
 * Create new user (admin only)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, isAdmin } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password are required',
      });
    }
    
    // Check if username already exists
    const existingUser = await User.findByUsernameCaseInsensitive(username);
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username already exists',
      });
    }
    
    // Create user (regular users cannot be admins unless requester is admin)
    const canCreateAdmin = req.user && req.user.isAdmin;
    const userIsAdmin = canCreateAdmin ? (isAdmin || false) : false;
    
    const user = await User.create(username, password, userIsAdmin);
    
    // Remove password_hash from response
    const { password_hash, ...userForResponse } = user;
    
    return res.status(201).json(userForResponse);
    
  } catch (error) {
    console.error('Error creating user:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while creating user',
    });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID (admin only, or self)
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid user ID',
      });
    }
    
    // Check permissions: user can only access their own info or admin can access any
    if (!req.user.isAdmin && req.user.id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own user information',
      });
    }
    
    const user = await User.getById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }
    
    // Remove password_hash from response
    const { password_hash, ...userForResponse } = user;
    
    return res.json(userForResponse);
    
  } catch (error) {
    console.error('Error getting user:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while getting user',
    });
  }
});

/**
 * PUT /api/users/:id
 * Update user (admin only, or self for profile updates)
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid user ID',
      });
    }
    
    // Check permissions
    if (!req.user.isAdmin && req.user.id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own profile',
      });
    }
    
    const updates = req.body;
    
    // Regular users cannot change their own admin status
    if (!req.user.isAdmin && updates.isAdmin !== undefined) {
      delete updates.isAdmin;
    }
    
    // Only admin can update other users' admin status
    if (req.user.id !== userId && !req.user.isAdmin && updates.isAdmin !== undefined) {
      delete updates.isAdmin;
    }
    
    const user = await User.update(userId, updates);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }
    
    // Remove password_hash from response
    const { password_hash, ...userForResponse } = user;
    
    return res.json(userForResponse);
    
  } catch (error) {
    console.error('Error updating user:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while updating user',
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 * CASCADE will delete all user data
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid user ID',
      });
    }
    
    // Prevent deleting self
    if (req.user.id === userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'You cannot delete your own account',
      });
    }
    
    const deleted = await User.delete(userId);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }
    
    return res.json({
      success: true,
      message: 'User deleted successfully',
    });
    
  } catch (error) {
    console.error('Error deleting user:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while deleting user',
    });
  }
});

/**
 * POST /api/users/register
 * Self-registration endpoint (if enabled)
 * Regular users can register themselves
 */
router.post('/register', async (req, res) => {
  try {
    // Check if registration is enabled (could be controlled by settings)
    const REGISTRATION_ENABLED = process.env.ALLOW_REGISTRATION === 'true';
    
    if (!REGISTRATION_ENABLED) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User registration is currently disabled',
      });
    }
    
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password are required',
      });
    }
    
    // Check if username already exists
    const existingUser = await User.findByUsernameCaseInsensitive(username);
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username already exists',
      });
    }
    
    // Create regular (non-admin) user
    const user = await User.create(username, password, false);
    
    // Remove password_hash from response
    const { password_hash, ...userForResponse } = user;
    
    return res.status(201).json(userForResponse);
    
  } catch (error) {
    console.error('Error registering user:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during registration',
    });
  }
});

module.exports = router;
