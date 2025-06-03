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
const errorHandler = require('./middleware/errorHandler');
const asyncHandler = require('./middleware/asyncHandler');

// Import services
const BlockchainService = require('./services/BlockchainService');
const EnhancedOracleService = require('./services/OracleServiceEnhanced');

// Import routes
const electionRoutes = require('./routes/elections');
const oracleRoutes = require('./routes/oracle');
const votersRoutes = require('./routes/voters');

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
        // Store raw body for webhook verification if needed
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Global rate limiting
    const globalRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 100 : 1000, // requests per windowMs
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
        errorCode: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks and internal services
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
      // Initialize Blockchain Service
      this.blockchainService = new BlockchainService();
      await this.blockchainService.initialize();
      
      // Initialize Enhanced Oracle Service
      this.oracleService = new EnhancedOracleService();
      
      // Make services available to routes
      this.app.locals.blockchainService = this.blockchainService;
      this.app.locals.oracleService = this.oracleService;

      // Setup service event listeners
      this.setupServiceEventListeners();

      logger.info('✅ All services initialized successfully');
    } catch (error) {
      logger.error('❌ Service initialization failed', { error: error.message });
      throw error;
    }
  }

  setupServiceEventListeners() {
    // Blockchain service events
    this.blockchainService.on('electionCreated', (data) => {
      logger.info('📊 Election created', data);
    });

    this.blockchainService.on('voteSubmitted', (data) => {
      logger.info('🗳️ Vote submitted', data);
    });

    // Oracle service events
    this.oracleService.on('verificationRequested', (data) => {
      logger.info('📝 Verification requested', data);
    });

    this.oracleService.on('verificationCompleted', (data) => {
      logger.info('✅ Verification completed', data);
      
      // Could trigger additional actions like notifications
      this.handleVerificationCompletion(data);
    });
  }

  async handleVerificationCompletion(data) {
    try {
      // Example: Update blockchain with verification result
      if (data.isVerified && this.blockchainService) {
        // Could call a blockchain method to update voter status
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
    this.app.get('/health', asyncHandler(async (req, res) => {
      const health = await this.getSystemHealth();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json({
        ...health,
        requestId: req.requestId
      });
    }));

    this.app.get('/api/health', asyncHandler(async (req, res) => {
      const health = await this.getDetailedHealth();
      const statusCode = health.overall === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json({
        ...health,
        requestId: req.requestId
      });
    }));

    // API documentation endpoint
    this.app.get('/api/docs', (req, res) => {
      res.json({
        title: 'Blockchain Voting System API',
        version: '1.2.0',
        description: 'REST API for blockchain-based voting system with NIK verification',
        endpoints: {
          elections: {
            'GET /api/elections': 'Get all elections',
            'GET /api/elections/:id': 'Get specific election',
            'POST /api/elections': 'Create new election',
            'POST /api/elections/:id/candidates': 'Add candidate to election',
            'GET /api/elections/:id/results': 'Get election results',
            'PUT /api/elections/:id/status': 'Update election status'
          },
          oracle: {
            'POST /api/oracle/verify-nik': 'Request NIK verification',
            'GET /api/oracle/verification-status/:requestId': 'Get verification status',
            'GET /api/oracle/verification-history/:walletAddress': 'Get verification history',
            'GET /api/oracle/stats': 'Get oracle statistics',
            'GET /api/oracle/health': 'Oracle health check'
          },
          voters: {
            'POST /api/voters/register': 'Register voter for election',
            'GET /api/voters/status/:electionId/:address': 'Get voter status',
            'POST /api/voters/vote/:electionId': 'Cast vote',
            'GET /api/voters/history/:address': 'Get voting history',
            'GET /api/voters/eligibility/:electionId/:address': 'Check voting eligibility'
          }
        },
        authentication: 'Bearer token (wallet address) required for most endpoints',
        rateLimit: 'Global: 100 req/15min, NIK verification: 10 req/15min',
        support: 'support@votingsystem.com'
      });
    });

    // API routes
    this.app.use('/api/elections', electionRoutes);
    this.app.use('/api/oracle', oracleRoutes);
    this.app.use('/api/voters', votersRoutes);

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
          elections: '/api/elections',
          oracle: '/api/oracle',
          voters: '/api/voters'
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
      
      // Graceful shutdown
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

  async getSystemHealth() {
    try {
      const services = {
        blockchain: this.blockchainService ? true : false,
        oracle: this.oracleService ? true : false
      };

      const allHealthy = Object.values(services).every(status => status === true);

      return {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        version: '1.2.0',
        services
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        version: '1.2.0',
        error: error.message
      };
    }
  }

  async getDetailedHealth() {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Check blockchain service health
      let blockchainHealth = { status: 'unknown' };
      if (this.blockchainService) {
        try {
          const blockNumber = await this.blockchainService.getBlockNumber();
          blockchainHealth = {
            status: 'healthy',
            blockNumber,
            contractAddress: this.blockchainService.contractAddress
          };
        } catch (error) {
          blockchainHealth = {
            status: 'unhealthy',
            error: error.message
          };
        }
      }

      // Check oracle service health
      let oracleHealth = { status: 'unknown' };
      if (this.oracleService) {
        try {
          const health = await this.oracleService.getHealthStatus();
          oracleHealth = {
            status: health.allHealthy ? 'healthy' : 'degraded',
            checks: health.checks,
            queueSize: this.oracleService.processingQueue?.length || 0
          };
        } catch (error) {
          oracleHealth = {
            status: 'unhealthy',
            error: error.message
          };
        }
      }

      const overall = (blockchainHealth.status === 'healthy' && oracleHealth.status === 'healthy') 
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
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
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
          if (this.blockchainService) {
            await this.blockchainService.cleanup();
            logger.info('🔗 Blockchain service cleaned up');
          }

          if (this.oracleService) {
            // Cancel pending operations
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
          docs: `http://localhost:${this.port}/api/docs`,
          oracle: `http://localhost:${this.port}/api/oracle`,
          elections: `http://localhost:${this.port}/api/elections`
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
    logger.error('❌ Server startup failed', { error: error.message });
    process.exit(1);
  });
}

module.exports = EnhancedVotingServer;