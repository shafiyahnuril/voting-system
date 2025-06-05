// backend/server.js - Enhanced server with Oracle REST API
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import middleware
const { requestIdMiddleware, requestLoggerMiddleware, logger } = require('./middleware/requestLogger');

// Import services - only import what's actually needed
let BlockchainService, EnhancedOracleService;
try {
  BlockchainService = require('./services/BlockchainService');
} catch (error) {
  console.warn('⚠️ BlockchainService not found, continuing without it');
}

try {
  EnhancedOracleService = require('./services/OracleService');
} catch (error) {
  console.warn('⚠️ EnhancedOracleService not found, continuing without it');
}

// Import routes - with error handling
let electionRoutes, oracleRoutes, votersRoutes;
try {
  electionRoutes = require('./routes/elections');
} catch (error) {
  console.warn('⚠️ Election routes not found:', error.message);
}

try {
  oracleRoutes = require('./routes/oracle');
} catch (error) {
  console.warn('⚠️ Oracle routes not found:', error.message);
}

try {
  votersRoutes = require('./routes/voters');
} catch (error) {
  console.warn('⚠️ Voters routes not found:', error.message);
}

// Fallback error handler if the main one doesn't exist
let errorHandler;
try {
  errorHandler = require('./middleware/errorHandler');
} catch (error) {
  console.warn('⚠️ Error handler middleware not found, using default');
  errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      requestId: req.requestId
    });
  };
}

class EnhancedVotingServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.blockchainService = null;
    this.oracleService = null;
    
    this.initializeMiddleware();
    this.initializeServices();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddleware() {
    logger.info('🔧 Initializing middleware...');

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // Compression middleware
    this.app.use(compression());

    // Request ID and logging
    this.app.use(requestIdMiddleware);
    this.app.use(requestLoggerMiddleware);

    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
    }));

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Global rate limiting
    const globalRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 100 : 1000,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
        errorCode: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        return req.path === '/health' || req.path === '/api/health' ||
               req.headers['x-internal-service'] === 'true';
      }
    });
    this.app.use(globalRateLimit);

    // Request timeout middleware
    this.app.use((req, res, next) => {
      req.setTimeout(30000, () => {
        logger.warn('Request timeout', {
          requestId: req.requestId,
          method: req.method,
          url: req.url
        });
        
        if (!res.headersSent) {
          res.status(408).json({
            success: false,
            message: 'Request timeout',
            errorCode: 'REQUEST_TIMEOUT',
            requestId: req.requestId
          });
        }
      });
      next();
    });

    logger.info('✅ Middleware initialized');
  }

  async initializeServices() {
    logger.info('🔧 Initializing services...');

    try {
      // Initialize Blockchain Service if available
      if (BlockchainService) {
        this.blockchainService = new BlockchainService();
        await this.blockchainService.initialize();
        this.app.locals.blockchainService = this.blockchainService;
        logger.info('✅ BlockchainService initialized');
      }
      
      // Initialize Enhanced Oracle Service if available
      if (EnhancedOracleService) {
        this.oracleService = new EnhancedOracleService();
        this.app.locals.oracleService = this.oracleService;
        logger.info('✅ OracleService initialized');
      }

      // Setup service event listeners if services exist
      if (this.blockchainService || this.oracleService) {
        this.setupServiceEventListeners();
      }

      logger.info('✅ All available services initialized successfully');
    } catch (error) {
      logger.error('❌ Service initialization failed', { error: error.message });
      // Don't throw error - continue without services
      logger.warn('⚠️ Continuing without some services...');
    }
  }

  setupServiceEventListeners() {
    // Blockchain service events
    if (this.blockchainService) {
      this.blockchainService.on('electionCreated', (data) => {
        logger.info('📊 Election created', data);
      });

      this.blockchainService.on('voteSubmitted', (data) => {
        logger.info('🗳️ Vote submitted', data);
      });
    }

    // Oracle service events
    if (this.oracleService) {
      this.oracleService.on('verificationRequested', (data) => {
        logger.info('📝 Verification requested', data);
      });

      this.oracleService.on('verificationCompleted', (data) => {
        logger.info('✅ Verification completed', data);
        this.handleVerificationCompletion(data);
      });
    }
  }

  async handleVerificationCompletion(data) {
    try {
      if (data.isVerified && this.blockchainService) {
        logger.info('🔗 Verification result could be recorded on blockchain', {
          requestId: data.requestId,
          walletAddress: data.walletAddress
        });
      }
    } catch (error) {
      logger.error('❌ Error handling verification completion', { error: error.message });
    }
  }

  initializeRoutes() {
    logger.info('🛣️ Initializing routes...');

    // Health check endpoints
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        version: '1.2.0',
        services: {
          blockchain: !!this.blockchainService,
          oracle: !!this.oracleService
        },
        requestId: req.requestId
      });
    });

    this.app.get('/api/health', async (req, res) => {
      try {
        const health = await this.getDetailedHealth();
        const statusCode = health.overall === 'healthy' ? 200 : 503;
        res.status(statusCode).json({ ...health, requestId: req.requestId });
      } catch (error) {
        res.status(503).json({
          overall: 'unhealthy',
          error: error.message,
          requestId: req.requestId
        });
      }
    });

    // API documentation endpoint
    this.app.get('/api/docs', (req, res) => {
      res.json({
        title: 'Blockchain Voting System API',
        version: '1.2.0',
        description: 'REST API for blockchain-based voting system with NIK verification',
        endpoints: {
          elections: electionRoutes ? {
            'GET /api/elections': 'Get all elections',
            'GET /api/elections/:id': 'Get specific election',
            'POST /api/elections': 'Create new election',
            'POST /api/elections/:id/candidates': 'Add candidate to election',
            'GET /api/elections/:id/results': 'Get election results',
            'PUT /api/elections/:id/status': 'Update election status'
          } : 'Not available',
          oracle: oracleRoutes ? {
            'POST /api/oracle/verify-nik': 'Request NIK verification',
            'GET /api/oracle/verification-status/:requestId': 'Get verification status',
            'GET /api/oracle/verification-history/:walletAddress': 'Get verification history',
            'GET /api/oracle/stats': 'Get oracle statistics',
            'GET /api/oracle/health': 'Oracle health check'
          } : 'Not available',
          voters: votersRoutes ? {
            'POST /api/voters/register': 'Register voter for election',
            'GET /api/voters/status/:electionId/:address': 'Get voter status',
            'POST /api/voters/vote/:electionId': 'Cast vote',
            'GET /api/voters/history/:address': 'Get voting history',
            'GET /api/voters/eligibility/:electionId/:address': 'Check voting eligibility'
          } : 'Not available'
        },
        authentication: 'Bearer token (wallet address) required for most endpoints',
        rateLimit: 'Global: 100 req/15min, NIK verification: 10 req/15min',
        support: 'support@votingsystem.com'
      });
    });

    // API routes - only add if they exist
    if (electionRoutes) {
      this.app.use('/api/elections', electionRoutes);
    }
    if (oracleRoutes) {
      this.app.use('/api/oracle', oracleRoutes);
    }
    if (votersRoutes) {
      this.app.use('/api/voters', votersRoutes);
    }

    // API version info
    this.app.get('/api', (req, res) => {
      res.json({
        service: 'Blockchain Voting System API',
        version: '1.2.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          documentation: '/api/docs',
          elections: electionRoutes ? '/api/elections' : 'Not available',
          oracle: oracleRoutes ? '/api/oracle' : 'Not available',
          voters: votersRoutes ? '/api/voters' : 'Not available'
        }
      });
    });

    // 404 handler for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        errorCode: 'ENDPOINT_NOT_FOUND',
        requestId: req.requestId,
        availableEndpoints: '/api/docs'
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Blockchain Voting System Backend',
        version: '1.2.0',
        status: 'operational',
        api: '/api',
        health: '/health',
        docs: '/api/docs'
      });
    });

    logger.info('✅ Routes initialized');
  }

  initializeErrorHandling() {
    logger.info('🛡️ Initializing error handling...');

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Resource not found',
        errorCode: 'NOT_FOUND',
        requestId: req.requestId,
        path: req.originalUrl
      });
    });

    // Global error handler
    this.app.use(errorHandler);

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack
      });
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      
      this.gracefulShutdown('uncaughtException');
    });

    // Handle process termination signals
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, starting graceful shutdown');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, starting graceful shutdown');
      this.gracefulShutdown('SIGINT');
    });

    logger.info('✅ Error handling initialized');
  }

  async getDetailedHealth() {
    try {
      const memoryUsage = process.memoryUsage();
      
      // Check blockchain service health
      let blockchainHealth = { status: 'not_available' };
      if (this.blockchainService) {
        try {
          blockchainHealth = {
            status: 'healthy',
            initialized: true
          };
        } catch (error) {
          blockchainHealth = {
            status: 'unhealthy',
            error: error.message
          };
        }
      }

      // Check oracle service health
      let oracleHealth = { status: 'not_available' };
      if (this.oracleService) {
        try {
          oracleHealth = {
            status: 'healthy',
            initialized: true
          };
        } catch (error) {
          oracleHealth = {
            status: 'unhealthy',
            error: error.message
          };
        }
      }

      const overall = (blockchainHealth.status === 'healthy' || blockchainHealth.status === 'not_available') && 
                     (oracleHealth.status === 'healthy' || oracleHealth.status === 'not_available') 
        ? 'healthy' : 'degraded';

      return {
        overall,
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        version: '1.2.0',
        system: {
          memory: {
            used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
          },
          nodeVersion: process.version
        },
        services: {
          blockchain: blockchainHealth,
          oracle: oracleHealth
        }
      };
    } catch (error) {
      return {
        overall: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  async gracefulShutdown(signal) {
    logger.info(`🔄 Graceful shutdown initiated (${signal})`);

    const server = this.server;
    if (server) {
      server.close(async () => {
        logger.info('📴 HTTP server closed');

        try {
          // Cleanup services
          if (this.blockchainService && this.blockchainService.cleanup) {
            await this.blockchainService.cleanup();
            logger.info('🔗 Blockchain service cleaned up');
          }

          if (this.oracleService && this.oracleService.removeAllListeners) {
            this.oracleService.removeAllListeners();
            logger.info('🔮 Oracle service cleaned up');
          }

          logger.info('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('❌ Error during cleanup', { error: error.message });
          process.exit(1);
        }
      });

      // Force close after timeout
      setTimeout(() => {
        logger.error('⚠️ Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  }

  async start() {
    try {
      // Ensure log directory exists
      const logDir = path.join(__dirname, 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      this.server = this.app.listen(this.port, () => {
        logger.info('🚀 Enhanced Voting System Server started', {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
          timestamp: new Date().toISOString()
        });

        logger.info('📋 Available endpoints:', {
          health: `http://localhost:${this.port}/health`,
          api: `http://localhost:${this.port}/api`,
          docs: `http://localhost:${this.port}/api/docs`
        });
      });

      this.server.on('error', (error) => {
        logger.error('❌ Server error', { error: error.message });
      });

    } catch (error) {
      logger.error('❌ Failed to start server', { error: error.message });
      process.exit(1);
    }
  }
}

// Create and start server
const server = new EnhancedVotingServer();

// Start server if this file is run directly
if (require.main === module) {
  server.start().catch((error) => {
    console.error('❌ Server startup failed', error.message);
    process.exit(1);
  });
}

module.exports = EnhancedVotingServer;