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
    try {
      // First check wallet authentication
      AuthMiddleware.requireWallet(req, res, (err) => {
        if (err) return;

        // Check if wallet is admin
        const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase());
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
      });
    } catch (error) {
      console.error('Admin auth error:', error);
      res.status(403).json({
        success: false,
        message: 'Admin authentication failed',
        requestId: req.requestId
      });
    }
  }

  static requireInternalService(req, res, next) {
    try {
      const serviceToken = req.headers['x-service-token'];
      const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

      if (!serviceToken || !expectedToken) {
        return res.status(401).json({
          success: false,
          message: 'Internal service authentication required',
          requestId: req.requestId
        });
      }

      if (serviceToken !== expectedToken) {
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

  // Signature verification for enhanced security (optional)
  static requireSignature(req, res, next) {
    try {
      const { address, signature, message, timestamp } = req.body;

      if (!address || !signature || !message || !timestamp) {
        return res.status(400).json({
          success: false,
          message: 'Missing required signature fields',
          requestId: req.requestId
        });
      }

      // Check timestamp (prevent replay attacks)
      const now = Date.now();