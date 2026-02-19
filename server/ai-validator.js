/**
 * ImmoPi Manager - AI Response Validator
 * 
 * Validates Gemini API responses for document analysis
 */

const { z } = require('zod');

// Define expected AI response schema
const AIDocumentSchema = z.object({
  date: z.string().refine(
    (val) => {
      // Validate ISO date format or common date formats
      const isoDate = new Date(val);
      return !isNaN(isoDate.getTime());
    },
    { message: 'Invalid date format - must be a valid date string' }
  ),
  amount: z.number().positive({ message: 'Amount must be a positive number' }),
  currency: z.enum(['CHF', 'EUR', 'USD'], {
    errorMap: () => ({ message: 'Currency must be CHF, EUR, or USD' })
  }),
  documentType: z.enum([
    'Invoice',
    'Receipt',
    'Contract',
    'Utility Bill',
    'Tax Statement',
    'Other'
  ], {
    errorMap: () => ({ message: 'Invalid document type' })
  }),
}).strict(); // Don't allow extra fields

/**
 * Validate AI response against expected schema
 * @param {object} response - Raw response from Gemini API
 * @returns {object} - Validation result with parsed data or errors
 */
function validateAIResponse(response) {
  try {
    const parsed = AIDocumentSchema.parse(response);
    
    return {
      success: true,
      data: parsed,
      errors: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        received: err.code === 'invalid_type' ? err.received : undefined,
      }));

      return {
        success: false,
        data: null,
        errors: formattedErrors,
        raw: response,
      };
    }

    // Unexpected error
    return {
      success: false,
      data: null,
      errors: [{ field: 'unknown', message: error.message }],
      raw: response,
    };
  }
}

/**
 * Normalize currency codes to uppercase
 */
function normalizeCurrency(currency) {
  if (typeof currency !== 'string') return currency;
  return currency.toUpperCase();
}

/**
 * Sanitize AI response before validation
 * Attempts to fix common issues in AI responses
 */
function sanitizeAIResponse(response) {
  if (!response || typeof response !== 'object') {
    return response;
  }

  const sanitized = { ...response };

  // Normalize currency
  if (sanitized.currency) {
    sanitized.currency = normalizeCurrency(sanitized.currency);
  }

  // Convert amount string to number if needed
  if (typeof sanitized.amount === 'string') {
    const parsed = parseFloat(sanitized.amount.replace(/[^0-9.-]/g, ''));
    if (!isNaN(parsed)) {
      sanitized.amount = parsed;
    }
  }

  // Normalize document type capitalization
  if (sanitized.documentType && typeof sanitized.documentType === 'string') {
    // Handle common variations
    const typeMap = {
      'invoice': 'Invoice',
      'receipt': 'Receipt',
      'contract': 'Contract',
      'utility bill': 'Utility Bill',
      'utility_bill': 'Utility Bill',
      'tax statement': 'Tax Statement',
      'tax_statement': 'Tax Statement',
      'other': 'Other',
    };
    
    const normalized = typeMap[sanitized.documentType.toLowerCase()];
    if (normalized) {
      sanitized.documentType = normalized;
    }
  }

  return sanitized;
}

/**
 * Full validation pipeline with sanitization
 */
function validateAndSanitize(response) {
  const sanitized = sanitizeAIResponse(response);
  return validateAIResponse(sanitized);
}

module.exports = {
  validateAIResponse,
  sanitizeAIResponse,
  validateAndSanitize,
  AIDocumentSchema,
};
