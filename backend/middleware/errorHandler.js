// backend/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // Web3 errors
  if (err.message && err.message.includes('revert')) {
    const revertReason = err.message.split('revert ')[1]?.split('"')[0];
    error = {
      message: revertReason || 'Smart contract transaction failed',
      statusCode: 400
    };
  }

  // Rate limit errors
  if (err.statusCode === 429) {
    error = {
      message: 'Too many requests. Please try again later.',
      statusCode: 429
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      statusCode: 401
    };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;

// backend/middleware/asyncHandler.js
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;

// backend/middleware/auth.js
const Web3 = require('web3');
const crypto = require('crypto');

class AuthMiddleware {
  static requireWallet(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required',
          requestId: req.requestId
        });
      }

      // Extract wallet address from Bearer token
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Bearer token required',
          requestId: req.requestId
        });
      }

      // Simple wallet address validation
      if (!Web3.utils.isAddress(token)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid wallet address',
          requestId: req.requestId
        });
      }

      // In production, you would verify the signature here
      // For demo purposes, we just validate the address format
      req.wallet = {
        address: token,
        authenticated: true
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({
        success: false,
        message: 'Authentication failed',
        requestId: req.requestId
      });
    }
  }

  static requireAdmin(req, res, next) {
    // First authenticate the wallet
    AuthMiddleware.requireWallet(req, res, (err) => {
      if (err || res.headersSent) {
        return; // Stop if authentication failed or response already sent
      }

      try {
        // Check if wallet is admin
        const adminAddresses = (process.env.ADMIN_ADDRESSES || '')
          .split(',')
          .map(addr => addr.trim().toLowerCase())
          .filter(addr => addr.length > 0);

        if (adminAddresses.length === 0) {
          console.warn('No admin addresses configured');
          return res.status(500).json({
            success: false,
            message: 'Admin configuration not found',
            requestId: req.requestId
          });
        }

        const userAddress = req.wallet.address.toLowerCase();

        if (!adminAddresses.includes(userAddress)) {
          return res.status(403).json({
            success: false,
            message: 'Admin access required',
            requestId: req.requestId
          });
        }

        req.wallet.isAdmin = true;
        next();
      } catch (error) {
        console.error('Admin auth error:', error);
        res.status(403).json({
          success: false,
          message: 'Admin authentication failed',
          requestId: req.requestId
        });
      }
    });
  }

  static requireInternalService(req, res, next) {
    try {
      const serviceToken = req.headers['x-service-token'];
      const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

      if (!expectedToken) {
        console.error('INTERNAL_SERVICE_TOKEN not configured');
        return res.status(500).json({
          success: false,
          message: 'Service authentication not configured',
          requestId: req.requestId
        });
      }

      if (!serviceToken) {
        return res.status(401).json({
          success: false,
          message: 'Internal service authentication required',
          requestId: req.requestId
        });
      }

      // Use crypto.timingSafeEqual to prevent timing attacks
      const tokenBuffer = Buffer.from(serviceToken);
      const expectedBuffer = Buffer.from(expectedToken);

      if (tokenBuffer.length !== expectedBuffer.length || 
          !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid service token',
          requestId: req.requestId
        });
      }

      req.serviceAuth = {
        authenticated: true,
        service: 'internal'
      };

      next();
    } catch (error) {
      console.error('Service auth error:', error);
      res.status(401).json({
        success: false,
        message: 'Service authentication failed',
        requestId: req.requestId
      });
    }
  }

  // Signature verification for enhanced security
  static requireSignature(req, res, next) {
    try {
      const { address, signature, message, timestamp } = req.body;

      if (!address || !signature || !message || !timestamp) {
        return res.status(400).json({
          success: false,
          message: 'Missing required signature fields (address, signature, message, timestamp)',
          requestId: req.requestId
        });
      }

      // Validate address format
      if (!Web3.utils.isAddress(address)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid wallet address format',
          requestId: req.requestId
        });
      }

      // Check timestamp (prevent replay attacks)
      const now = Date.now();
      const messageTime = parseInt(timestamp);

      if (isNaN(messageTime)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid timestamp format',
          requestId: req.requestId
        });
      }

      const timeDiff = Math.abs(now - messageTime);
      
      // Allow 5 minutes tolerance (300,000 ms)
      if (timeDiff > 5 * 60 * 1000) {
        return res.status(401).json({
          success: false,
          message: 'Message timestamp expired (max 5 minutes)',
          requestId: req.requestId
        });
      }

      // Verify signature
      try {
        const recoveredAddress = Web3.eth.accounts.recover(message, signature);
        
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          return res.status(401).json({
            success: false,
            message: 'Invalid signature - address mismatch',
            requestId: req.requestId
          });
        }
      } catch (signatureError) {
        console.error('Signature verification error:', signatureError);
        return res.status(401).json({
          success: false,
          message: 'Invalid signature format',
          requestId: req.requestId
        });
      }

      req.wallet = {
        address: address,
        authenticated: true,
        signatureVerified: true
      };

      next();
    } catch (error) {
      console.error('Signature verification error:', error);
      res.status(401).json({
        success: false,
        message: 'Signature verification failed',
        requestId: req.requestId
      });
    }
  }

  // Optional: Combine wallet and signature verification
  static requireWalletWithSignature(req, res, next) {
    AuthMiddleware.requireSignature(req, res, next);
  }

  // Optional: Rate limiting for sensitive operations
  static createRateLimiter(windowMs = 15 * 60 * 1000, max = 100) {
    const requests = new Map();

    return (req, res, next) => {
      const identifier = req.wallet?.address || req.ip;
      const now = Date.now();
      
      if (!requests.has(identifier)) {
        requests.set(identifier, []);
      }

      const userRequests = requests.get(identifier);
      
      // Remove old requests outside the window
      const validRequests = userRequests.filter(time => now - time < windowMs);
      
      if (validRequests.length >= max) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          requestId: req.requestId,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      validRequests.push(now);
      requests.set(identifier, validRequests);
      
      next();
    };
  }
}

module.exports = AuthMiddleware;

// backend/middleware/requestId.js
const crypto = require('crypto');

const requestIdMiddleware = (req, res, next) => {
  // Generate unique request ID
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  
  // Add to response headers for tracking
  res.setHeader('X-Request-ID', req.requestId);
  
  next();
};

module.exports = requestIdMiddleware;

// backend/middleware/cors.js
const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Service-Token',
    'X-Request-ID'
  ],
  exposedHeaders: ['X-Request-ID']
};

module.exports = cors(corsOptions);

// backend/middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');
const Web3 = require('web3');

class ValidationMiddleware {
  static handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        requestId: req.requestId
      });
    }
    next();
  }

  static validateWalletAddress(field = 'address') {
    return body(field)
      .custom((value) => {
        if (!Web3.utils.isAddress(value)) {
          throw new Error('Invalid wallet address');
        }
        return true;
      });
  }

  static validateEthAmount(field = 'amount') {
    return body(field)
      .isNumeric()
      .withMessage('Amount must be a number')
      .custom((value) => {
        if (parseFloat(value) <= 0) {
          throw new Error('Amount must be greater than 0');
        }
        return true;
      });
  }

  static validateTransactionHash(field = 'txHash') {
    return body(field)
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage('Invalid transaction hash format');
  }
}

module.exports = ValidationMiddleware;