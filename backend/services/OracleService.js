// backend/services/OracleServiceEnhanced.js - Enhanced Oracle Service
const { EventEmitter } = require('events');
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../middleware/requestLogger');

class EnhancedOracleService extends EventEmitter {
  constructor() {
    super();
    this.verificationRequests = new Map();
    this.processingQueue = [];
    this.isProcessing = false;
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      pendingRequests: 0,
      successfulVerifications: 0,
      failedVerifications: 0,
      averageProcessingTime: 0
    };
    
    this.initializeService();
  }

  async initializeService() {
    logger.info('🔮 Initializing Enhanced Oracle Service...');
    
    // Start queue processor
    this.startQueueProcessor();
    
    // Setup health monitoring
    this.setupHealthMonitoring();
    
    logger.info('✅ Enhanced Oracle Service initialized');
  }

  // Enhanced NIK verification request
  async requestNIKVerification({ nik, name, walletAddress, electionId, metadata = {} }) {
    try {
      const requestId = uuidv4();
      
      logger.info('🔄 Creating NIK verification request', {
        requestId,
        walletAddress,
        electionId,
        hasMetadata: Object.keys(metadata).length > 0
      });

      // Create enhanced verification request
      const verificationRequest = {
        requestId,
        nik: this.hashNIK(nik),
        name,
        walletAddress,
        electionId,
        status: 'pending',
        isVerified: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        metadata: {
          ...metadata,
          ipAddress: metadata.ip,
          userAgent: metadata.userAgent,
          sessionId: metadata.sessionId,
          requestSource: 'api'
        },
        processingStartedAt: null,
        estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        retryCount: 0,
        priority: this.calculatePriority({ electionId, walletAddress })
      };

      // Store request
      this.verificationRequests.set(requestId, verificationRequest);
      this.stats.totalRequests++;
      this.stats.pendingRequests++;

      // Add to processing queue
      this.addToQueue(verificationRequest);

      // Emit event
      this.emit('verificationRequested', {
        requestId,
        walletAddress,
        electionId,
        timestamp: verificationRequest.createdAt
      });

      logger.info('✅ NIK verification request created', {
        requestId,
        queuePosition: this.processingQueue.length
      });

      return {
        requestId,
        status: 'pending',
        createdAt: verificationRequest.createdAt,
        estimatedCompletion: verificationRequest.estimatedCompletion
      };

    } catch (error) {
      logger.error('❌ Error creating NIK verification request', { error: error.message });
      throw error;
    }
  }

  // Enhanced verification processing
  async processVerificationRequest(requestId, nik, name) {
    const request = this.verificationRequests.get(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    try {
      logger.info('🔄 Processing verification request', { requestId });

      // Update status to processing
      request.status = 'processing';
      request.processingStartedAt = new Date().toISOString();
      this.verificationRequests.set(requestId, request);

      // Simulate realistic processing steps
      await this.delay(1000);

      // Step 1: NIK format validation
      request.status = 'validating';
      this.verificationRequests.set(requestId, request);
      await this.delay(500);

      const isValidFormat = this.validateNIKFormat(nik);
      if (!isValidFormat) {
        await this.completeVerification(requestId, false, 'Invalid NIK format', {
          step: 'format_validation',
          details: 'NIK format does not meet requirements'
        });
        return;
      }

      // Step 2: Government API verification
      request.status = 'verifying';
      this.verificationRequests.set(requestId, request);
      await this.delay(2000);

      const verificationResult = await this.verifyWithGovernmentAPI(nik, name);

      // Step 3: Complete verification
      await this.completeVerification(
        requestId, 
        verificationResult.isValid, 
        verificationResult.reason,
        verificationResult.metadata
      );

    } catch (error) {
      logger.error('❌ Error processing verification', { requestId, error: error.message });
      await this.completeVerification(requestId, false, `Processing error: ${error.message}`);
    }
  }

  // Enhanced government API verification
  async verifyWithGovernmentAPI(nik, name) {
    try {
      logger.info('🌐 Simulating government API verification');

      // Simulate API call with retry logic
      const maxRetries = 3;
      let attempt = 0;
      let result = null;

      while (attempt < maxRetries) {
        try {
          await this.delay(1000 + (attempt * 500)); // Increasing delay

          // Enhanced simulation with more realistic patterns
          const isValid = this.simulateEnhancedNIKVerification(nik, name);
          
          const confidenceScore = isValid ? 
            Math.random() * 0.15 + 0.85 : // 85-100% for valid
            Math.random() * 0.25;         // 0-25% for invalid

          result = {
            isValid,
            reason: isValid ? 'NIK verified successfully with government database' : 
                   'NIK not found or name mismatch in government records',
            confidenceScore,
            verificationMethod: 'government_api_simulation',
            apiResponseTime: 1000 + (attempt * 500),
            attemptNumber: attempt + 1,
            metadata: {
              apiEndpoint: 'dukcapil.api.simulation',
              requestTimestamp: new Date().toISOString(),
              regionCode: nik.substring(0, 2),
              birthDate: this.extractBirthDateFromNIK(nik)
            }
          };

          logger.info('✅ Government API verification completed', {
            isValid: result.isValid,
            confidenceScore: result.confidenceScore,
            attempts: attempt + 1
          });

          break;

        } catch (apiError) {
          attempt++;
          logger.warn(`⚠️ API attempt ${attempt} failed`, { error: apiError.message });
          
          if (attempt >= maxRetries) {
            throw new Error(`Government API verification failed after ${maxRetries} attempts`);
          }
        }
      }

      return result;

    } catch (error) {
      logger.error('❌ Government API verification failed', { error: error.message });
      return {
        isValid: false,
        reason: `API verification failed: ${error.message}`,
        confidenceScore: 0,
        verificationMethod: 'api_error',
        apiResponseTime: 0,
        metadata: {
          errorType: 'api_failure',
          errorMessage: error.message
        }
      };
    }
  }

  // Enhanced NIK simulation with more realistic patterns
  simulateEnhancedNIKVerification(nik, name) {
    // More sophisticated validation rules
    const regionCode = nik.substring(0, 2);
    const birthDate = nik.substring(6, 12);
    const genderCode = parseInt(nik.substring(6, 8));
    
    // Region validation (Indonesian province codes)
    const validRegions = [
      '11', '12', '13', '14', '15', '16', '17', '18', '19', // Sumatera
      '21', '22', '23', '24', '25', '26', '27', '28', '29', // Sumatera continued
      '31', '32', '33', '34', '35', '36',                   // Jawa
      '51', '52', '53',                                     // Bali, NTB, NTT
      '61', '62', '63', '64',                               // Kalimantan
      '71', '72', '73', '74', '75', '76',                   // Sulawesi
      '81', '82', '91', '92', '93', '94'                    // Maluku, Papua
    ];

    const regionValid = validRegions.includes(regionCode);
    
    // Date validation
    const day = parseInt(nik.substring(6, 8));
    const month = parseInt(nik.substring(8, 10));
    const year = parseInt(nik.substring(10, 12));
    
    // For females, day is added with 40
    const actualDay = day > 40 ? day - 40 : day;
    const dateValid = actualDay >= 1 && actualDay <= 31 && month >= 1 && month <= 12;
    
    // Name validation
    const nameValid = name.length >= 3 && /^[a-zA-Z\s.'-]+$/.test(name);
    
    // Special test cases
    if (nik === '1234567890123456' && name.toLowerCase().includes('test')) return true;
    if (nik === '0000000000000000') return false;
    
    // Central Java (32, 33) has higher success rate for demo
    const regionBonus = ['32', '33'].includes(regionCode) ? 0.2 : 0;
    
    // Calculate overall probability
    const baseSuccess = 0.75; // 75% base success rate
    const regionFactor = regionValid ? 0.1 : -0.3;
    const dateFactor = dateValid ? 0.05 : -0.2;
    const nameFactor = nameValid ? 0.05 : -0.1;
    const randomFactor = (Math.random() - 0.5) * 0.2; // ±10%
    
    const successProbability = baseSuccess + regionFactor + dateFactor + nameFactor + regionBonus + randomFactor;
    
    return Math.random() < Math.max(0, Math.min(1, successProbability));
  }

  // Enhanced completion with detailed metadata
  async completeVerification(requestId, isVerified, reason = '', metadata = {}) {
    try {
      const request = this.verificationRequests.get(requestId);
      if (!request) {
        throw new Error(`Request ${requestId} not found for completion`);
      }

      const processingTime = request.processingStartedAt ? 
        new Date() - new Date(request.processingStartedAt) : 0;

      // Update request with enhanced data
      request.status = 'completed';
      request.isVerified = isVerified;
      request.completedAt = new Date().toISOString();
      request.reason = reason;
      request.processingTime = processingTime;
      request.verificationMetadata = {
        ...metadata,
        processingDuration: processingTime,
        completedBy: 'oracle_service',
        verificationId: uuidv4()
      };
      
      this.verificationRequests.set(requestId, request);

      // Update statistics
      this.updateStats(request, processingTime);

      // Remove from processing queue
      this.removeFromQueue(requestId);

      // Emit completion event
      this.emit('verificationCompleted', {
        requestId,
        isVerified,
        walletAddress: request.walletAddress,
        electionId: request.electionId,
        processingTime,
        completedAt: request.completedAt
      });

      logger.info('✅ Verification completed', {
        requestId,
        isVerified,
        processingTime: `${processingTime}ms`,
        reason
      });

    } catch (error) {
      logger.error('❌ Error completing verification', { requestId, error: error.message });
      throw error;
    }
  }

  // Queue management
  addToQueue(request) {
    // Insert based on priority (higher priority first)
    let insertIndex = this.processingQueue.length;
    for (let i = 0; i < this.processingQueue.length; i++) {
      if (request.priority > this.processingQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    this.processingQueue.splice(insertIndex, 0, request);
  }

  removeFromQueue(requestId) {
    this.processingQueue = this.processingQueue.filter(req => req.requestId !== requestId);
  }

  async getQueuePosition(requestId) {
    const position = this.processingQueue.findIndex(req => req.requestId === requestId);
    return position >= 0 ? position + 1 : null;
  }

  async getQueueStatus() {
    const pending = this.processingQueue.filter(req => req.status === 'pending');
    const processing = this.processingQueue.filter(req => req.status === 'processing');
    
    const averageProcessingTime = this.stats.averageProcessingTime || 180000; // 3 minutes default
    const estimatedCompletionTime = new Date(Date.now() + (pending.length * averageProcessingTime));

    return {
      totalCount: this.processingQueue.length,
      pending: pending.length,
      processing: processing.length,
      averageWaitTime: Math.round(averageProcessingTime / 1000), // seconds
      estimatedCompletionTime: estimatedCompletionTime.toISOString(),
      requests: this.processingQueue.slice(0, 10) // Top 10 in queue
    };
  }

  // Enhanced queue processor
  startQueueProcessor() {
    setInterval(async () => {
      if (this.isProcessing || this.processingQueue.length === 0) {
        return;
      }

      this.isProcessing = true;
      
      try {
        const request = this.processingQueue.find(req => req.status === 'pending');
        if (request) {
          await this.processVerificationRequest(request.requestId, request.nik, request.name);
        }
      } catch (error) {
        logger.error('❌ Queue processor error', { error: error.message });
      } finally {
        this.isProcessing = false;
      }
    }, 2000); // Process every 2 seconds
  }

  // Additional utility methods
  calculatePriority({ electionId, walletAddress }) {
    // Higher priority for active elections, special wallets, etc.
    let priority = 1;
    
    if (electionId) {
      priority += 2; // Election-specific requests have higher priority
    }
    
    // Could add more priority logic here
    return priority;
  }

  extractBirthDateFromNIK(nik) {
    try {
      const day = parseInt(nik.substring(6, 8));
      const month = parseInt(nik.substring(8, 10));
      const year = parseInt(nik.substring(10, 12));
      
      // Adjust for female (day > 40)
      const actualDay = day > 40 ? day - 40 : day;
      
      // Determine century (assume 1900s for year > 50, 2000s for year <= 50)
      const fullYear = year > 50 ? 1900 + year : 2000 + year;
      
      return `${fullYear}-${month.toString().padStart(2, '0')}-${actualDay.toString().padStart(2, '0')}`;
    } catch (error) {
      return null;
    }
  }

  updateStats(request, processingTime) {
    this.stats.completedRequests++;
    this.stats.pendingRequests = Math.max(0, this.stats.pendingRequests - 1);
    
    if (request.isVerified) {
      this.stats.successfulVerifications++;
    } else {
      this.stats.failedVerifications++;
    }

    // Update average processing time
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.completedRequests - 1) + processingTime) / 
      this.stats.completedRequests;
  }

  async getHealthStatus() {
    const checks = {
      queueProcessor: this.processingQueue !== null,
      memoryUsage: process.memoryUsage().heapUsed < 500 * 1024 * 1024, // < 500MB
      activeRequests: this.verificationRequests.size < 10000,
      queueSize: this.processingQueue.length < 1000
    };

    const dependencies = {
      database: true, // Would check actual database connection
      governmentAPI: true, // Would check API availability
      blockchain: true // Would check blockchain connection
    };

    return {
      checks,
      dependencies,
      allHealthy: Object.values(checks).every(check => check === true) && 
                  Object.values(dependencies).every(dep => dep === true)
    };
  }

  // Helper methods
  hashNIK(nik) {
    return crypto.createHash('sha256').update(nik).digest('hex');
  }

  validateNIKFormat(nik) {
    return /^\d{16}$/.test(nik);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getActiveVerificationRequest(walletAddress, electionId) {
    for (const [requestId, request] of this.verificationRequests) {
      if (request.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
          request.electionId == electionId &&
          ['pending', 'processing', 'verifying'].includes(request.status)) {
        return {
          requestId,
          status: request.status,
          createdAt: request.createdAt,
          estimatedCompletion: request.estimatedCompletion
        };
      }
    }
    return null;
  }

  async getRecentRequestsByWallet(walletAddress, timeframeMs) {
    const cutoff = new Date(Date.now() - timeframeMs);
    const requests = [];
    
    for (const request of this.verificationRequests.values()) {
      if (request.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
          new Date(request.createdAt) > cutoff) {
        requests.push(request);
      }
    }
    
    return requests;
  }

  async checkExistingVerification(nik, electionId) {
    const nikHash = this.hashNIK(nik);
    
    for (const request of this.verificationRequests.values()) {
      if (request.nik === nikHash &&
          request.electionId == electionId &&
          request.status === 'completed' &&
          request.isVerified) {
        return {
          requestId: request.requestId,
          completedAt: request.completedAt
        };
      }
    }
    
    return null;
  }

  async getVerificationStatus(requestId) {
    return this.verificationRequests.get(requestId) || null;
  }

  async getVerificationHistory({ walletAddress, status, electionId, page = 1, limit = 10 }) {
    let requests = Array.from(this.verificationRequests.values());

    // Apply filters
    if (walletAddress) {
      requests = requests.filter(r => 
        r.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
    }

    if (status) {
      requests = requests.filter(r => r.status === status);
    }

    if (electionId) {
      requests = requests.filter(r => r.electionId == electionId);
    }

    // Sort by creation date (newest first)
    requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const total = requests.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRequests = requests.slice(startIndex, endIndex);

    return {
      data: paginatedRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: endIndex < total,
        hasPrev: startIndex > 0
      }
    };
  }

  async getServiceStats() {
    return {
      ...this.stats,
      requestsLast24h: this.getRequestsInTimeframe(24 * 60 * 60 * 1000),
      requestsLastHour: this.getRequestsInTimeframe(60 * 60 * 1000),
      currentLoad: this.processingQueue.length,
      serviceUptime: process.uptime(),
      queueSize: this.processingQueue.length,
      verificationMethods: ['government_api_simulation'],
      failureReasons: this.getFailureReasons(),
      geographicDistribution: this.getGeographicDistribution(),
      peakHours: this.getPeakHours(),
      serviceStatus: 'operational'
    };
  }

  getRequestsInTimeframe(timeframeMs) {
    const cutoff = new Date(Date.now() - timeframeMs);
    let count = 0;
    
    for (const request of this.verificationRequests.values()) {
      if (new Date(request.createdAt) > cutoff) {
        count++;
      }
    }
    
    return count;
  }

  getFailureReasons() {
    const reasons = {};
    
    for (const request of this.verificationRequests.values()) {
      if (!request.isVerified && request.reason) {
        reasons[request.reason] = (reasons[request.reason] || 0) + 1;
      }
    }
    
    return reasons;
  }

  getGeographicDistribution() {
    return { 'Indonesia': 100 }; // Simplified for demo
  }

  getPeakHours() {
    // Analyze request patterns to determine peak hours
    const hourCounts = {};
    
    for (const request of this.verificationRequests.values()) {
      const hour = new Date(request.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
    
    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));
  }

  setupHealthMonitoring() {
    // Monitor memory usage, queue size, etc.
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const queueSize = this.processingQueue.length;
      
      if (memUsage.heapUsed > 512 * 1024 * 1024) { // > 512MB
        logger.warn('High memory usage detected', {
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
        });
      }
      
      if (queueSize > 100) {
        logger.warn('Large queue size detected', { queueSize });
      }
    }, 60000); // Check every minute
  }
}

module.exports = EnhancedOracleService;