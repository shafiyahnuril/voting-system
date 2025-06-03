// backend/routes/oracle.js - Enhanced Oracle Service Routes with REST API
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const asyncHandler = require('../middleware/asyncHandler');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting untuk API endpoints
const nikVerificationLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many NIK verification requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const statusCheckLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    message: 'Too many status check requests, please slow down.',
    retryAfter: '1 minute'
  }
});

// Validation rules
const verifyNIKValidation = [
  body('nik')
    .isLength({ min: 16, max: 16 })
    .withMessage('NIK must be exactly 16 digits')
    .isNumeric()
    .withMessage('NIK must contain only numbers')
    .custom((value) => {
      // Additional NIK validation rules
      if (value.startsWith('0000')) {
        throw new Error('Invalid NIK format: cannot start with 0000');
      }
      return true;
    }),
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2-100 characters')
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage('Name can only contain letters, spaces, dots, apostrophes, and hyphens'),
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid wallet address format'),
  body('electionId')
    .optional()
    .isNumeric()
    .withMessage('Election ID must be numeric')
    .isInt({ min: 1 })
    .withMessage('Election ID must be positive')
];

const manualVerifyValidation = [
  body('requestId')
    .notEmpty()
    .withMessage('Request ID is required')
    .isUUID()
    .withMessage('Request ID must be a valid UUID'),
  body('isVerified')
    .isBoolean()
    .withMessage('Verification result must be boolean'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be string')
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
  body('adminNotes')
    .optional()
    .isString()
    .withMessage('Admin notes must be string')
    .isLength({ max: 1000 })
    .withMessage('Admin notes cannot exceed 1000 characters')
];

// POST /api/oracle/verify-nik - Request NIK verification
router.post('/verify-nik',
  nikVerificationLimit,
  authMiddleware.requireWallet,
  verifyNIKValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg,
          value: err.value
        })),
        requestId: req.requestId
      });
    }

    const { nik, name, walletAddress, electionId } = req.body;
    const oracleService = req.app.locals.oracleService;

    try {
      // Verify wallet address matches authenticated user
      if (walletAddress.toLowerCase() !== req.wallet.address.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: 'Wallet address mismatch with authenticated user',
          requestId: req.requestId
        });
      }

      console.log(`🔄 Processing NIK verification request for ${walletAddress}`);

      // Check for existing active verification request
      const existingRequest = await oracleService.getActiveVerificationRequest(walletAddress, electionId);
      if (existingRequest && existingRequest.status === 'pending') {
        return res.status(409).json({
          success: false,
          message: 'NIK verification already in progress',
          data: {
            requestId: existingRequest.requestId,
            status: existingRequest.status,
            createdAt: existingRequest.createdAt,
            estimatedCompletion: existingRequest.estimatedCompletion,
            checkStatusUrl: `/api/oracle/verification-status/${existingRequest.requestId}`
          },
          requestId: req.requestId
        });
      }

      // Check for rate limiting per wallet
      const recentRequests = await oracleService.getRecentRequestsByWallet(walletAddress, 60 * 60 * 1000); // Last hour
      if (recentRequests.length >= 5) {
        return res.status(429).json({
          success: false,
          message: 'Too many verification requests from this wallet. Please wait before requesting again.',
          data: {
            requestCount: recentRequests.length,
            resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
          },
          requestId: req.requestId
        });
      }

      // Check if NIK is already verified for this election
      if (electionId) {
        const existingVerification = await oracleService.checkExistingVerification(nik, electionId);
        if (existingVerification) {
          return res.status(400).json({
            success: false,
            message: 'NIK already verified for this election',
            data: {
              existingRequestId: existingVerification.requestId,
              verifiedAt: existingVerification.completedAt
            },
            requestId: req.requestId
          });
        }
      }

      // Create verification request with enhanced metadata
      const verificationRequest = await oracleService.requestNIKVerification({
        nik,
        name,
        walletAddress,
        electionId,
        metadata: {
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          timestamp: new Date().toISOString(),
          source: 'web_api',
          sessionId: req.sessionID,
          referer: req.get('Referer')
        }
      });

      console.log(`✅ NIK verification request created: ${verificationRequest.requestId}`);

      // Return success response with detailed information
      res.status(202).json({
        success: true,
        message: 'NIK verification request submitted successfully',
        data: {
          requestId: verificationRequest.requestId,
          status: 'pending',
          estimatedVerificationTime: '2-5 minutes',
          checkStatusUrl: `/api/oracle/verification-status/${verificationRequest.requestId}`,
          webhookEnabled: false,
          queuePosition: await oracleService.getQueuePosition(verificationRequest.requestId),
          supportContact: 'support@votingsystem.com'
        },
        requestId: req.requestId
      });

      // Log for monitoring
      console.log(`📊 Verification request metrics:`, {
        requestId: verificationRequest.requestId,
        walletAddress,
        electionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error requesting NIK verification:', error);
      
      // Enhanced error handling with specific error types
      let statusCode = 500;
      let message = 'Failed to request NIK verification';
      let errorCode = 'VERIFICATION_REQUEST_FAILED';
      
      if (error.message.includes('Rate limit')) {
        statusCode = 429;
        message = 'Too many verification requests. Please try again later.';
        errorCode = 'RATE_LIMIT_EXCEEDED';
      } else if (error.message.includes('Invalid NIK format')) {
        statusCode = 400;
        message = 'Invalid NIK format';
        errorCode = 'INVALID_NIK_FORMAT';
      } else if (error.message.includes('Already verified')) {
        statusCode = 400;
        message = 'NIK already verified for this election';
        errorCode = 'ALREADY_VERIFIED';
      } else if (error.message.includes('Service unavailable')) {
        statusCode = 503;
        message = 'Verification service temporarily unavailable';
        errorCode = 'SERVICE_UNAVAILABLE';
      } else if (error.message.includes('Database')) {
        statusCode = 500;
        message = 'Database error occurred';
        errorCode = 'DATABASE_ERROR';
      }

      res.status(statusCode).json({
        success: false,
        message,
        errorCode,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    }
  })
);

// GET /api/oracle/verification-status/:requestId - Get verification status
router.get('/verification-status/:requestId', [
  statusCheckLimit,
  param('requestId').notEmpty().withMessage('Request ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
      requestId: req.requestId
    });
  }

  const { requestId } = req.params;
  const oracleService = req.app.locals.oracleService;

  try {
    const verificationStatus = await oracleService.getVerificationStatus(requestId);
    
    if (!verificationStatus) {
      return res.status(404).json({
        success: false,
        message: 'Verification request not found',
        errorCode: 'REQUEST_NOT_FOUND',
        requestId: req.requestId
      });
    }

    // Calculate progress percentage and ETA
    let progressPercentage = 0;
    let estimatedCompletion = null;
    let nextSteps = [];

    switch (verificationStatus.status) {
      case 'pending':
        progressPercentage = 10;
        estimatedCompletion = new Date(Date.now() + 4 * 60 * 1000).toISOString(); // 4 minutes
        nextSteps = [
          'Request queued for processing',
          'NIK validation in progress',
          'Check back in 2-3 minutes'
        ];
        break;
      case 'processing':
        progressPercentage = 40;
        estimatedCompletion = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes
        nextSteps = [
          'Verifying NIK with government database',
          'Cross-referencing identity information',
          'Almost complete - check status in 1-2 minutes'
        ];
        break;
      case 'verifying':
        progressPercentage = 75;
        estimatedCompletion = new Date(Date.now() + 30 * 1000).toISOString(); // 30 seconds
        nextSteps = [
          'Final verification checks in progress',
          'Preparing blockchain transaction',
          'Results will be available shortly'
        ];
        break;
      case 'completed':
        progressPercentage = 100;
        if (verificationStatus.isVerified) {
          nextSteps = [
            'NIK verification successful',
            'You can now participate in voting',
            'Proceed to cast your vote'
          ];
        } else {
          nextSteps = [
            'NIK verification failed',
            'Please check your information and try again',
            'Contact support if you believe this is an error'
          ];
        }
        break;
      case 'failed':
        progressPercentage = 0;
        nextSteps = [
          'Verification process encountered an error',
          'Please try submitting a new verification request',
          'Contact support if the problem persists'
        ];
        break;
      default:
        nextSteps = [
          'Unknown verification status',
          'Please contact support for assistance'
        ];
    }

    // Calculate processing time if completed
    const processingTime = verificationStatus.completedAt ? 
      new Date(verificationStatus.completedAt) - new Date(verificationStatus.createdAt) : null;

    res.json({
      success: true,
      data: {
        requestId: verificationStatus.requestId,
        status: verificationStatus.status,
        isVerified: verificationStatus.isVerified,
        progressPercentage,
        createdAt: verificationStatus.createdAt,
        completedAt: verificationStatus.completedAt,
        estimatedCompletion,
        processingTime,
        metadata: {
          electionId: verificationStatus.electionId,
          walletAddress: verificationStatus.walletAddress,
          verificationMethod: verificationStatus.verificationMethod || 'government_api',
          confidenceScore: verificationStatus.confidenceScore,
          queuePosition: verificationStatus.status === 'pending' ? 
            await oracleService.getQueuePosition(requestId) : null
        },
        nextSteps,
        error: verificationStatus.error || null,
        supportInfo: {
          email: 'support@votingsystem.com',
          docs: '/api/oracle/docs',
          status: '/api/oracle/health'
        }
      },
      requestId: req.requestId
    });

  } catch (error) {
    console.error('❌ Error getting verification status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get verification status',
      errorCode: 'STATUS_CHECK_FAILED',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.requestId
    });
  }
}));

// GET /api/oracle/verification-history/:walletAddress - Get verification history
router.get('/verification-history/:walletAddress', [
  param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
  query('status').optional().isIn(['pending', 'processing', 'verifying', 'completed', 'failed']).withMessage('Invalid status'),
  query('electionId').optional().isNumeric().withMessage('Election ID must be numeric')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
      requestId: req.requestId
    });
  }

  const { walletAddress } = req.params;
  const { page = 1, limit = 10, status, electionId } = req.query;
  const oracleService = req.app.locals.oracleService;

  try {
    const verificationHistory = await oracleService.getVerificationHistory({
      walletAddress,
      status,
      electionId,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Calculate summary statistics
    const summary = {
      totalVerifications: verificationHistory.pagination.total,
      successfulVerifications: verificationHistory.data.filter(v => v.isVerified && v.status === 'completed').length,
      failedVerifications: verificationHistory.data.filter(v => !v.isVerified && v.status === 'completed').length,
      pendingVerifications: verificationHistory.data.filter(v => ['pending', 'processing', 'verifying'].includes(v.status)).length,
      averageProcessingTime: calculateAverageProcessingTime(verificationHistory.data),
      successRate: calculateSuccessRate(verificationHistory.data)
    };

    res.json({
      success: true,
      data: {
        verifications: verificationHistory.data.map(v => ({
          ...v,
          // Add computed fields for better UX
          statusDescription: getStatusDescription(v.status, v.isVerified),
          canRetry: canRetryVerification(v),
          actions: getAvailableActions(v)
        })),
        pagination: verificationHistory.pagination,
        summary,
        filters: {
          status,
          electionId,
          walletAddress
        }
      },
      requestId: req.requestId
    });

  } catch (error) {
    console.error('❌ Error getting verification history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get verification history',
      errorCode: 'HISTORY_FETCH_FAILED',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.requestId
    });
  }
}));

// POST /api/oracle/manual-verify - Manual verification (admin only)
router.post('/manual-verify',
  authMiddleware.requireAdmin,
  manualVerifyValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        requestId: req.requestId
      });
    }

    const { requestId, isVerified, reason, adminNotes } = req.body;
    const adminAddress = req.wallet.address;
    const oracleService = req.app.locals.oracleService;

    try {
      console.log(`🔧 Manual verification by admin ${adminAddress}: ${requestId} -> ${isVerified}`);

      // Get request details first for validation
      const verificationRequest = await oracleService.getVerificationStatus(requestId);
      if (!verificationRequest) {
        return res.status(404).json({
          success: false,
          message: 'Verification request not found',
          errorCode: 'REQUEST_NOT_FOUND',
          requestId: req.requestId
        });
      }

      if (verificationRequest.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Verification request already completed',
          errorCode: 'ALREADY_COMPLETED',
          data: {
            completedAt: verificationRequest.completedAt,
            isVerified: verificationRequest.isVerified
          },
          requestId: req.requestId
        });
      }

      const result = await oracleService.completeManualVerification({
        requestId,
        isVerified,
        reason,
        adminNotes,
        adminAddress
      });

      // Log admin action for audit
      console.log(`📋 Admin action logged:`, {
        admin: adminAddress,
        requestId,
        action: 'manual_verification',
        result: isVerified,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Manual verification completed successfully',
        data: {
          requestId,
          isVerified,
          completedBy: adminAddress,
          completedAt: new Date().toISOString(),
          transactionHash: result.transactionHash,
          reason,
          adminNotes,
          auditTrail: {
            action: 'manual_verification',
            timestamp: new Date().toISOString(),
            adminId: adminAddress
          }
        },
        requestId: req.requestId
      });

    } catch (error) {
      console.error('❌ Error completing manual verification:', error);
      
      let statusCode = 500;
      let message = 'Failed to complete manual verification';
      let errorCode = 'MANUAL_VERIFICATION_FAILED';
      
      if (error.message.includes('Not found')) {
        statusCode = 404;
        message = 'Verification request not found';
        errorCode = 'REQUEST_NOT_FOUND';
      } else if (error.message.includes('Already completed')) {
        statusCode = 400;
        message = 'Verification request already completed';
        errorCode = 'ALREADY_COMPLETED';
      } else if (error.message.includes('Not authorized')) {
        statusCode = 403;
        message = 'Not authorized to perform manual verification';
        errorCode = 'INSUFFICIENT_PERMISSIONS';
      }

      res.status(statusCode).json({
        success: false,
        message,
        errorCode,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: req.requestId
      });
    }
  })
);

// GET /api/oracle/stats - Get oracle service statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const oracleService = req.app.locals.oracleService;

  try {
    const stats = await oracleService.getServiceStats();

    res.json({
      success: true,
      data: {
        overview: {
          totalRequests: stats.totalRequests,
          pendingRequests: stats.pendingRequests,
          completedRequests: stats.completedRequests,
          successRate: `${(stats.successRate * 100).toFixed(1)}%`,
          averageProcessingTime: `${Math.round(stats.averageProcessingTime / 1000)}s`
        },
        performance: {
          requestsLast24h: stats.requestsLast24h,
          requestsLastHour: stats.requestsLastHour,
          currentLoad: stats.currentLoad,
          serviceUptime: `${Math.round(stats.serviceUptime / 3600)}h`,
          queueSize: stats.queueSize || 0
        },
        verification: {
          verificationMethods: stats.verificationMethods,
          failureReasons: stats.failureReasons,
          geographicDistribution: stats.geographicDistribution,
          peakHours: stats.peakHours || []
        },
        system: {
          serviceStatus: stats.serviceStatus || 'operational',
          lastMaintenanceWindow: stats.lastMaintenanceWindow,
          apiVersion: '1.2.0',
          supportedNIKRegions: ['Indonesia'],
          maxConcurrentRequests: 100,
          rateLimits: {
            perIP: '10 requests per 15 minutes',
            perWallet: '5 requests per hour'
          }
        }
      },
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting oracle stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get oracle statistics',
      errorCode: 'STATS_FETCH_FAILED',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.requestId
    });
  }
}));

// GET /api/oracle/health - Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  const oracleService = req.app.locals.oracleService;

  try {
    const health = await oracleService.getHealthStatus();
    
    const status = health.allHealthy ? 'healthy' : 'degraded';
    const statusCode = health.allHealthy ? 200 : 503;

    res.status(statusCode).json({
      success: health.allHealthy,
      status,
      timestamp: new Date().toISOString(),
      version: '1.2.0',
      uptime: Math.round(process.uptime()),
      checks: health.checks,
      dependencies: health.dependencies
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      uptime: Math.round(process.uptime())
    });
  }
}));

// POST /api/oracle/webhook/verification-complete - Webhook endpoint (internal)
router.post('/webhook/verification-complete',
  authMiddleware.requireInternalService,
  [
    body('requestId').notEmpty().withMessage('Request ID is required'),
    body('isVerified').isBoolean().withMessage('Verification result must be boolean'),
    body('metadata').optional().isObject().withMessage('Metadata must be object')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        requestId: req.requestId
      });
    }

    const { requestId, isVerified, metadata } = req.body;
    const oracleService = req.app.locals.oracleService;

    try {
      console.log(`🔔 Webhook: Verification completed for ${requestId}: ${isVerified}`);

      await oracleService.handleVerificationWebhook({
        requestId,
        isVerified,
        metadata: {
          ...metadata,
          webhookReceivedAt: new Date().toISOString(),
          source: 'internal_webhook'
        }
      });

      res.json({
        success: true,
        message: 'Webhook processed successfully',
        data: {
          requestId,
          processed: true,
          timestamp: new Date().toISOString()
        },
        requestId: req.requestId
      });

    } catch (error) {
      console.error('❌ Error processing verification webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        errorCode: 'WEBHOOK_PROCESSING_FAILED',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: req.requestId
      });
    }
  })
);

// GET /api/oracle/queue - Get current verification queue status
router.get('/queue', 
  authMiddleware.requireAdmin,
  asyncHandler(async (req, res) => {
    const oracleService = req.app.locals.oracleService;

    try {
      const queueStatus = await oracleService.getQueueStatus();

      res.json({
        success: true,
        data: {
          totalInQueue: queueStatus.totalCount,
          pendingRequests: queueStatus.pending,
          processingRequests: queueStatus.processing,
          averageWaitTime: queueStatus.averageWaitTime,
          estimatedCompletionTime: queueStatus.estimatedCompletionTime,
          queuedRequests: queueStatus.requests.map(req => ({
            requestId: req.requestId,
            walletAddress: req.walletAddress,
            electionId: req.electionId,
            queuedAt: req.createdAt,
            estimatedProcessTime: req.estimatedProcessTime
          }))
        },
        requestId: req.requestId
      });

    } catch (error) {
      console.error('❌ Error getting queue status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get queue status',
        errorCode: 'QUEUE_STATUS_FAILED',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: req.requestId
      });
    }
  })
);

// Helper functions
function getStatusDescription(status, isVerified) {
  const descriptions = {
    'pending': 'Request queued for processing',
    'processing': 'Verifying with government database',
    'verifying': 'Performing final verification checks',
    'completed': isVerified ? 'Successfully verified' : 'Verification failed',
    'failed': 'Verification process failed'
  };
  return descriptions[status] || 'Unknown status';
}

function canRetryVerification(verification) {
  return verification.status === 'failed' || 
         (verification.status === 'completed' && !verification.isVerified);
}

function getAvailableActions(verification) {
  const actions = [];
  
  if (verification.status === 'completed' && verification.isVerified) {
    actions.push('view_certificate');
  }
  
  if (canRetryVerification(verification)) {
    actions.push('retry_verification');
  }
  
  if (verification.status === 'pending' || verification.status === 'processing') {
    actions.push('check_status');
  }
  
  return actions;
}

function calculateAverageProcessingTime(verifications) {
  const completed = verifications.filter(v => v.status === 'completed' && v.processingTime);
  if (completed.length === 0) return null;
  
  const total = completed.reduce((sum, v) => sum + v.processingTime, 0);
  return Math.round(total / completed.length / 1000); // Convert to seconds
}

function calculateSuccessRate(verifications) {
  const completed = verifications.filter(v => v.status === 'completed');
  if (completed.length === 0) return null;
  
  const successful = completed.filter(v => v.isVerified);
  return Math.round((successful.length / completed.length) * 100);
}

// Error handler for this router
router.use((error, req, res, next) => {
  console.error('Oracle router error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal oracle service error',
    errorCode: 'ORACLE_SERVICE_ERROR',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;