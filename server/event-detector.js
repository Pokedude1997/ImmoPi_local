/**
 * Event Detector Module
 * 
 * Detects changes in entity data to determine if automation should be triggered.
 * Used for event-driven automation to identify when mortgage data, payment terms,
 * or recurring payment parameters have changed.
 */

/**
 * Check if mortgage data has changed between two property objects
 * @param {object} newProperty - The new property data
 * @param {object} oldProperty - The old property data (null if creating new)
 * @returns {boolean} True if mortgage data has changed
 */
function hasMortgageChanged(newProperty, oldProperty) {
  // If there's no old property, this is a creation - mortgage data is new
  if (!oldProperty) {
    return hasMortgageData(newProperty);
  }

  // Compare all mortgage-related fields
  const mortgageFields = [
    'mortgage_loanAmount',
    'mortgage_startDate',
    'mortgage_interestRate',
    'mortgage_principalRate',
    'mortgage_bankName',
    'mortgage_paymentTiming'
  ];

  for (const field of mortgageFields) {
    const oldValue = oldProperty[field];
    const newValue = newProperty[field];
    
    // Normalize values for comparison (null vs undefined, string vs number)
    const normalizedOld = normalizeValue(oldValue);
    const normalizedNew = normalizeValue(newValue);
    
    if (normalizedOld !== normalizedNew) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a property has mortgage data
 * @param {object} property - The property data
 * @returns {boolean} True if property has mortgage data
 */
function hasMortgageData(property) {
  if (!property) return false;
  
  const mortgageFields = [
    'mortgage_loanAmount',
    'mortgage_startDate',
    'mortgage_interestRate',
    'mortgage_principalRate'
  ];
  
  for (const field of mortgageFields) {
    if (property[field] !== null && property[field] !== undefined && property[field] !== '') {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if tenant contract payment terms have changed
 * @param {object} newContract - The new contract data
 * @param {object} oldContract - The old contract data (null if creating new)
 * @returns {boolean} True if payment terms have changed
 */
function hasPaymentTermsChanged(newContract, oldContract) {
  // If there's no old contract, this is a creation
  if (!oldContract) {
    return true;
  }

  const paymentFields = [
    'coldRent',
    'sideCosts',
    'paymentDayOfMonth',
    'startDate',
    'endDate',
    'isActive'
  ];

  // Also support snake_case field names for database rows
  const snakeCaseFields = [
    'cold_rent',
    'side_costs',
    'payment_day_of_month',
    'start_date',
    'end_date',
    'is_active'
  ];

  // Combine both camelCase and snake_case fields
  const allFields = [...paymentFields, ...snakeCaseFields];

  for (const field of allFields) {
    const oldValue = oldContract[field];
    const newValue = newContract[field];
    
    const normalizedOld = normalizeValue(oldValue);
    const normalizedNew = normalizeValue(newValue);
    
    if (normalizedOld !== normalizedNew) {
      return true;
    }
  }

  return false;
}

/**
 * Check if recurring payment parameters have changed
 * @param {object} newRecurring - The new recurring payment data
 * @param {object} oldRecurring - The old recurring payment data (null if creating new)
 * @returns {boolean} True if recurring payment parameters have changed
 */
function hasRecurringPaymentChanged(newRecurring, oldRecurring) {
  // If there's no old recurring payment, this is a creation
  if (!oldRecurring) {
    return true;
  }

  // Match actual database column names for recurring_payments table
  const recurringFields = [
    'name',
    'amount',
    'currency',
    'frequency',
    'startDate',
    'endDate',
    'nextDueDate',
    'isActive',
    'category_id',
    'property_id',
    'counterparty_id'
  ];

  for (const field of recurringFields) {
    const oldValue = oldRecurring[field];
    const newValue = newRecurring[field];
    
    const normalizedOld = normalizeValue(oldValue);
    const normalizedNew = normalizeValue(newValue);
    
    if (normalizedOld !== normalizedNew) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize a value for comparison
 * Handles null/undefined, converts dates to strings, etc.
 * @param {*} value - The value to normalize
 * @returns {*} Normalized value for comparison
 */
function normalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  
  // Convert Date objects to ISO strings for comparison
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // Convert numbers to strings if they represent the same value
  // This helps with comparing DB integers to JS numbers
  if (typeof value === 'number') {
    return String(value);
  }
  
  return value;
}

/**
 * Get the type of change (create, update, delete, no-change)
 * @param {object} newEntity - The new entity data
 * @param {object} oldEntity - The old entity data
 * @returns {string} Change type: 'create', 'update', 'delete', or 'no-change'
 */
function getChangeType(newEntity, oldEntity) {
  if (!oldEntity && newEntity) {
    return 'create';
  }
  
  if (oldEntity && !newEntity) {
    return 'delete';
  }
  
  if (oldEntity && newEntity) {
    return 'update';
  }
  
  return 'no-change';
}

/**
 * Determine if automation should be triggered based on entity changes
 * @param {string} entityType - Type of entity: 'property', 'tenantContract', 'recurringPayment'
 * @param {object} newEntity - The new entity data
 * @param {object} oldEntity - The old entity data
 * @returns {object} Result with trigger: boolean and changeType: string
 */
function shouldTriggerAutomation(entityType, newEntity, oldEntity) {
  const changeType = getChangeType(newEntity, oldEntity);
  
  switch (entityType) {
    case 'property':
      if (changeType === 'create') {
        return { trigger: hasMortgageData(newEntity), changeType };
      }
      if (changeType === 'update') {
        return { trigger: hasMortgageChanged(newEntity, oldEntity), changeType };
      }
      break;
    
    case 'tenantContract':
      if (changeType === 'create' || changeType === 'update') {
        return { trigger: hasPaymentTermsChanged(newEntity, oldEntity), changeType };
      }
      break;
    
    case 'recurringPayment':
      if (changeType === 'create' || changeType === 'update') {
        return { trigger: hasRecurringPaymentChanged(newEntity, oldEntity), changeType };
      }
      break;
  }
  
  return { trigger: false, changeType };
}

module.exports = {
  hasMortgageChanged,
  hasMortgageData,
  hasPaymentTermsChanged,
  hasRecurringPaymentChanged,
  getChangeType,
  shouldTriggerAutomation,
  normalizeValue
};
