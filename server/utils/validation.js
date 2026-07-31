/**
 * Validation Schemas and Error Handling Utilities
 * Uses Zod for schema validation
 */

const { z } = require('zod');

// ============================================
// Property Validation Schema
// ============================================

const mortgageSchema = z.object({
  loanAmount: z.number().min(0).max(10000000).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  interestRate: z.number().min(0).max(100).optional().nullable(),
  principalRate: z.number().min(0).max(100).optional().nullable(),
  bankName: z.string().max(255).optional().nullable(),
  paymentTiming: z.string().max(50).optional().nullable(),
});

const propertySchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional().nullable(),
  type: z.string().min(1).max(100),
  purchasePrice: z.number().min(0).max(10000000).optional().nullable(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  rentAmount: z.number().min(0).max(50000).optional().nullable(),
  size: z.number().min(0).max(10000).optional().nullable(),
  mortgage: mortgageSchema.optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

// Partial schema for PUT (all fields optional)
const partialPropertySchema = propertySchema.partial();

// ============================================
// Validation Middleware
// ============================================

function validatePropertyCreation(req, res, next) {
  try {
    const validated = propertySchema.parse(req.body);
    req.validatedBody = validated;
    next();
  } catch (error) {
    const errors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  }
}

function validatePropertyUpdate(req, res, next) {
  try {
    const validated = partialPropertySchema.parse(req.body);
    req.validatedBody = validated;
    next();
  } catch (error) {
    const errors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  }
}

// ============================================
// Error Handling Utilities
// ============================================

function logError(err, context = {}) {
  const timestamp = new Date().toISOString();
  const errorEntry = `${timestamp} | ERROR | ${err.message || String(err)} | ${JSON.stringify(context)}\n`;
  const fs = require('fs');
  const path = require('path');
  const logsDir = path.join(__dirname, '../logs');
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  fs.appendFileSync(path.join(logsDir, 'errors.log'), errorEntry, (fileErr) => {
    if (fileErr) {
      console.error('Failed to write error log:', fileErr);
    }
  });
  
  // Also log to console for immediate visibility
  console.error(`${timestamp} | ERROR | ${err.message || String(err)} | ${JSON.stringify(context)}`);
}

function createErrorHandler(specificErrors = {}) {
  return function(err, req, res, next) {
    // Log full error details
    logError(err, {
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      user: req.user?.id || 'anonymous',
    });

    // Determine appropriate error message and status
    let status = 500;
    let message = 'Internal server error';

    if (err.name === 'ZodError') {
      status = 400;
      message = 'Validation failed';
    } else if (err.message === 'Unauthorized') {
      status = 401;
      message = 'Unauthorized';
    } else if (err.message === 'Property not found') {
      status = 404;
      message = 'Property not found';
    } else if (err.message?.includes('not found')) {
      status = 404;
      message = 'Resource not found';
    } else if (err.code === 'SQLITE_CONSTRAINT') {
      status = 409;
      message = 'Conflict: resource already exists';
    } else if (specificErrors[err.message]) {
      message = specificErrors[err.message];
    }

    res.status(status).json({ error: message });
  };
}

function safeDatabaseError(err, req, res, next) {
  // Log the full error
  logError(err, {
    url: req.originalUrl,
    method: req.method,
    user: req.user?.id || 'anonymous',
  });

  // Return generic message to client
  return res.status(500).json({ error: 'Internal server error' });
}

function databaseErrorHandler(err, res) {
  // Log full error to file
  logError(err, { context: 'database operation' });
  // Return generic message
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = {
  propertySchema,
  partialPropertySchema,
  validatePropertyCreation,
  validatePropertyUpdate,
  logError,
  createErrorHandler,
  safeDatabaseError,
  databaseErrorHandler,
};
