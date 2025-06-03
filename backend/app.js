// backend/app.js - Main REST API Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const electionRoutes = require('./routes/elections');
const voterRoutes = require('./routes/voters');
const oracleRoutes = require('./routes/oracle');
const blockchainRoutes = require('./routes/blockchain');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// Import services
const BlockchainService = require('./services/BlockchainService');
const OracleService = require('./services/OracleService');

class VotingAPIServer {
  constructor() {
    this.app = express();
    this.port = process.env.API_PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.initializeServices();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Logging
    this.app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.requestId = require('crypto').randomUUID();
      res.set('X-Request-ID', req.requestId);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // API routes
    this.app.use('/api/elections', electionRoutes);
    this.app.use('/api/voters', voterRoutes);
    this.app.use('/api/oracle', oracleRoutes);
    this.app.use('/api/blockchain', blockchainRoutes);

    // API documentation endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        message: 'Blockchain Voting System API',
        version: '1.0.0',
        endpoints: {
          elections: '/api/elections',
          voters: '/api/voters',
          oracle: '/api/oracle',
          blockchain: '/api/blockchain'
        },
        documentation: '/api/docs'
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        requestId: req.requestId
      });
    });
  }

  setupErrorHandling() {
    this.app.use(errorHandler);
  }

  async initializeServices() {
    try {
      console.log('🔄 Initializing services...');
      
      // Initialize blockchain service
      const blockchainService = new BlockchainService();
      await blockchainService.initialize();
      
      // Initialize oracle service
      const oracleService = new OracleService();
      await oracleService.initialize();
      
      // Make services available globally
      this.app.locals.blockchainService = blockchainService;
      this.app.locals.oracleService = oracleService;
      
      console.log('✅ All services initialized successfully');
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      process.exit(1);
    }
  }

  async start() {
    try {
      await this.initializeServices();
      
      this.server = this.app.listen(this.port, () => {
        console.log(`🚀 Voting API Server running on port ${this.port}`);
        console.log(`📍 Health check: http://localhost:${this.port}/health`);
        console.log(`📍 API docs: http://localhost:${this.port}/api`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    console.log('🔄 Shutting down server...');
    
    if (this.server) {
      this.server.close(() => {
        console.log('✅ Server shut down gracefully');
        process.exit(0);
      });
    }
  }
}

// Export for testing
module.exports = VotingAPIServer;

// Start server if run directly
if (require.main === module) {
  const server = new VotingAPIServer();
  server.start();
}