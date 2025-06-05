// backend/middleware/validation.js - Enhanced validation middleware
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
      errorCode: 'VALIDATION_ERROR',
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// Custom validation functions
const customValidators = {
  isValidNIK: (value) => {
    // Indonesian NIK validation rules
    if (!/^\d{16}$/.test(value)) {
      throw new Error('NIK must be exactly 16 digits');
    }
    
    // Check for obviously invalid patterns
    if (value === '0000000000000000' || value === '1111111111111111') {
      throw new Error('Invalid NIK pattern');
    }
    
    // Basic region code validation (first 2 digits)
    const regionCode = value.substring(0, 2);
    if (parseInt(regionCode) < 11 || parseInt(regionCode) > 94) {
      throw new Error('Invalid NIK region code');
    }
    
    return true;
  },

  isValidName: (value) => {
    // Indonesian name validation
    if (!/^[a-zA-Z\s.'-]+$/.test(value)) {
      throw new Error('Name contains invalid characters');
    }
    
    if (value.length < 2 || value.length > 100) {
      throw new Error('Name must be between 2-100 characters');
    }
    
    return true;
  }
};

module.exports = {
  handleValidationErrors,
  customValidators
};