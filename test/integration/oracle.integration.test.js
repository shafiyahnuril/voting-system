// test/integration/oracle.integration.test.js - Integration Tests
const request = require('supertest');
const EnhancedVotingServer = require('../../server');
const TestDataFactory = require('../helpers/testDataFactory');

describe('Oracle Integration Tests', () => {
  let app;
  let server;
  let testData;

  beforeAll(async () => {
    testData = new TestDataFactory();
    server = new EnhancedVotingServer();
    app = server.app;
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  afterAll(async () => {
    if (server) {
      await server.gracefulShutdown('test');
    }
  });

  describe('End-to-End Verification Flow', () => {
    it('should complete full verification workflow', async () => {
      const verificationRequest = testData.createValidVerificationRequest();

      // Step 1: Submit verification request
      const submitResponse = await request(app)
        .post('/api/oracle/verify-nik')
        .set('Authorization', `Bearer ${verificationRequest.walletAddress}`)
        .send(verificationRequest)
        .expect(202);

      expect(submitResponse.body.success).toBe(true);
      const requestId = submitResponse.body.data.requestId;

      // Step 2: Check initial status
      const initialStatusResponse = await request(app)
        .get(`/api/oracle/verification-status/${requestId}`)
        .expect(200);

      expect(initialStatusResponse.body.data.status).toBe('pending');

      // Step 3: Wait for processing and check status updates
      let finalStatus;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/api/oracle/verification-status/${requestId}`)
          .expect(200);

        finalStatus = statusResponse.body.data.status;
        
        if (finalStatus === 'completed' || finalStatus === 'failed') {
          break;
        }
        
        attempts++;
      }

      // Step 4: Verify final status
      expect(['completed', 'failed']).toContain(finalStatus);

      // Step 5: Check oracle stats updated
      const statsResponse = await request(app)
        .get('/api/oracle/stats')
        .expect(200);

      expect(statsResponse.body.data.overview.totalRequests).toBeGreaterThan(0);
    }, 30000);

    it('should handle multiple concurrent verifications', async () => {
      const requests = testData.createMultipleVerificationRequests(5);

      // Submit all requests concurrently
      const submitPromises = requests.map(req =>
        request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${req.walletAddress}`)
          .send(req)
      );

      const submitResponses = await Promise.all(submitPromises);

      // Verify all submissions were accepted
      const requestIds = [];
      submitResponses.forEach(response => {
        expect([202, 429]).toContain(response.status);
        if (response.status === 202) {
          requestIds.push(response.body.data.requestId);
        }
      });

      expect(requestIds.length).toBeGreaterThan(0);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check all request statuses
      const statusPromises = requestIds.map(id =>
        request(app).get(`/api/oracle/verification-status/${id}`)
      );

      const statusResponses = await Promise.all(statusPromises);

      statusResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(['pending', 'processing', 'completed', 'failed']).toContain(
          response.body.data.status
        );
      });
    }, 45000);
  });

  describe('System Health Integration', () => {
    it('should maintain system health under load', async () => {
      // Check initial health
      const initialHealthResponse = await request(app)
        .get('/api/oracle/health')
        .expect(200);

      expect(initialHealthResponse.body.status).toBe('healthy');

      // Generate load
      const loadRequests = testData.createMultipleVerificationRequests(20);
      const loadPromises = loadRequests.map(req =>
        request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${req.walletAddress}`)
          .send(req)
          .catch(() => ({ status: 'error' })) // Handle expected failures
      );

      await Promise.all(loadPromises);

      // Check health after load
      const postLoadHealthResponse = await request(app)
        .get('/api/oracle/health')
        .expect(200);

      expect(['healthy', 'degraded']).toContain(postLoadHealthResponse.body.status);
    }, 60000);
  });
});

// test/unit/services/oracle.service.test.js - Unit Tests for Oracle Service
const OracleService = require('../../../services/oracleService');
const { MockOracleService, MockDatabaseService } = require('../../mocks/mockServices');

describe('OracleService Unit Tests', () => {
  let oracleService;
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = new MockDatabaseService();
    oracleService = new OracleService({
      database: mockDatabase,
      config: {
        processingDelay: 100,
        maxRetries: 3,
        timeoutMs: 5000
      }
    });
  });

  describe('validateNIK', () => {
    const validNIKs = [
      '1234567890123456',
      '9876543210987654',
      '1111111111111111'
    ];

    const invalidNIKs = [
      '12345',           // Too short
      '12345678901234567', // Too long
      'abcd567890123456',  // Contains letters
      '',                 // Empty
      null,               // Null
      undefined           // Undefined
    ];

    validNIKs.forEach(nik => {
      it(`should validate NIK: ${nik}`, () => {
        expect(oracleService.validateNIK(nik)).toBe(true);
      });
    });

    invalidNIKs.forEach(nik => {
      it(`should reject invalid NIK: ${nik}`, () => {
        expect(oracleService.validateNIK(nik)).toBe(false);
      });
    });
  });

  describe('validateWalletAddress', () => {
    const validAddresses = [
      '0x742d35Cc6639FB8d2B21234567891234567890AB',
      '0x0000000000000000000000000000000000000000',
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
    ];

    const invalidAddresses = [
      '742d35Cc6639FB8d2B21234567891234567890AB',  // Missing 0x
      '0x742d35Cc6639FB8d2B21234567891234567890',   // Too short
      '0x742d35Cc6639FB8d2B21234567891234567890ABC', // Too long
      '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',  // Invalid hex
      '',                                           // Empty
      null,                                         // Null
      undefined                                     // Undefined
    ];

    validAddresses.forEach(address => {
      it(`should validate wallet address: ${address}`, () => {
        expect(oracleService.validateWalletAddress(address)).toBe(true);
      });
    });

    invalidAddresses.forEach(address => {
      it(`should reject invalid wallet address: ${address}`, () => {
        expect(oracleService.validateWalletAddress(address)).toBe(false);
      });
    });
  });

  describe('processVerificationRequest', () => {
    it('should process valid verification request', async () => {
      const validRequest = {
        nik: '1234567890123456',
        name: 'Test User',
        walletAddress: '0x742d35Cc6639FB8d2B21234567891234567890AB',
        electionId: 1
      };

      const result = await oracleService.processVerificationRequest(validRequest);

      expect(result.success).toBe(true);
      expect(result.requestId).toBeDefined();
      expect(result.status).toBe('pending');
    });

    it('should reject invalid verification request', async () => {
      const invalidRequest = {
        nik: '12345', // Invalid NIK
        name: 'Test User',
        walletAddress: '0x742d35Cc6639FB8d2B21234567891234567890AB',
        electionId: 1
      };

      await expect(
        oracleService.processVerificationRequest(invalidRequest)
      ).rejects.toThrow('Invalid NIK format');
    });

    it('should handle database errors gracefully', async () => {
      const validRequest = {
        nik: '1234567890123456',
        name: 'Test User',
        walletAddress: '0x742d35Cc6639FB8d2B21234567891234567890AB',
        electionId: 1
      };

      // Simulate database error
      mockDatabase.simulateConnectionError();

      await expect(
        oracleService.processVerificationRequest(validRequest)
      ).rejects.toThrow('Database connection failed');
    });
  });
});

// test/performance/load.test.js - Load Testing
const request = require('supertest');
const EnhancedVotingServer = require('../../server');
const TestDataFactory = require('../helpers/testDataFactory');

describe('Oracle Load Tests', () => {
  let app;
  let server;
  let testData;

  beforeAll(async () => {
    testData = new TestDataFactory();
    server = new EnhancedVotingServer();
    app = server.app;
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  afterAll(async () => {
    if (server) {
      await server.gracefulShutdown('test');
    }
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 50 concurrent verification requests', async () => {
      const concurrentRequests = 50;
      const requests = testData.createMultipleVerificationRequests(concurrentRequests);

      const startTime = Date.now();

      const promises = requests.map(req =>
        request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${req.walletAddress}`)
          .send(req)
          .then(res => ({ 
            status: res.status, 
            success: res.body.success,
            responseTime: Date.now() - startTime
          }))
          .catch(err => ({ 
            status: err.status || 500, 
            success: false,
            error: err.message
          }))
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Analyze results
      const successfulRequests = results.filter(r => r.status === 202);
      const rateLimitedRequests = results.filter(r => r.status === 429);
      const errorRequests = results.filter(r => r.status >= 500);

      console.log(`Load Test Results:
        Total Requests: ${concurrentRequests}
        Successful (202): ${successfulRequests.length}
        Rate Limited (429): ${rateLimitedRequests.length}
        Server Errors (5xx): ${errorRequests.length}
        Total Time: ${totalTime}ms
        Average Response Time: ${totalTime / concurrentRequests}ms
      `);

      // Assertions
      expect(successfulRequests.length).toBeGreaterThan(0);
      expect(errorRequests.length).toBeLessThan(concurrentRequests * 0.1); // Less than 10% errors
      expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds
    }, 45000);

    it('should maintain performance under sustained load', async () => {
      const batchSize = 10;
      const batches = 5;
      const batchDelay = 2000; // 2 seconds between batches

      const allResults = [];

      for (let batch = 0; batch < batches; batch++) {
        console.log(`Running batch ${batch + 1}/${batches}`);
        
        const batchRequests = testData.createMultipleVerificationRequests(batchSize);
        const batchStartTime = Date.now();

        const batchPromises = batchRequests.map(req =>
          request(app)
            .post('/api/oracle/verify-nik')
            .set('Authorization', `Bearer ${req.walletAddress}`)
            .send(req)
            .then(res => ({ 
              batch,
              status: res.status,
              responseTime: Date.now() - batchStartTime
            }))
            .catch(err => ({ 
              batch,
              status: err.status || 500,
              error: err.message
            }))
        );

        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);

        // Wait between batches
        if (batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }

      // Analyze sustained load performance
      const batchStats = [];
      for (let i = 0; i < batches; i++) {
        const batchResults = allResults.filter(r => r.batch === i);
        const successCount = batchResults.filter(r => r.status === 202).length;
        const avgResponseTime = batchResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) / batchResults.length;
        
        batchStats.push({
          batch: i + 1,
          successCount,
          successRate: (successCount / batchSize * 100).toFixed(2) + '%',
          avgResponseTime: Math.round(avgResponseTime)
        });
      }

      console.log('Sustained Load Test Results:');
      console.table(batchStats);

      // Performance should not degrade significantly over time
      const firstBatchSuccessRate = batchStats[0].successCount / batchSize;
      const lastBatchSuccessRate = batchStats[batches - 1].successCount / batchSize;
      
      expect(lastBatchSuccessRate).toBeGreaterThanOrEqual(firstBatchSuccessRate * 0.8); // No more than 20% degradation
    }, 60000);
  });

  describe('Status Check Performance', () => {
    it('should handle rapid status checks efficiently', async () => {
      // First create a verification request
      const verificationRequest = testData.createValidVerificationRequest();
      const createResponse = await request(app)
        .post('/api/oracle/verify-nik')
        .set('Authorization', `Bearer ${verificationRequest.walletAddress}`)
        .send(verificationRequest);

      const requestId = createResponse.body.data.requestId;

      // Perform rapid status checks
      const statusCheckCount = 20;
      const startTime = Date.now();

      const statusPromises = Array(statusCheckCount).fill().map(() =>
        request(app)
          .get(`/api/oracle/verification-status/${requestId}`)
          .then(res => ({
            status: res.status,
            responseTime: Date.now() - startTime
          }))
      );

      const statusResults = await Promise.all(statusPromises);
      const totalTime = Date.now() - startTime;

      // All status checks should succeed
      statusResults.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Average response time should be reasonable
      const avgResponseTime = totalTime / statusCheckCount;
      expect(avgResponseTime).toBeLessThan(1000); // Less than 1 second average

      console.log(`Status Check Performance:
        Total Checks: ${statusCheckCount}
        Total Time: ${totalTime}ms
        Average Response Time: ${avgResponseTime}ms
      `);
    });
  });
});

// // scripts/run-tests.sh - Test Runner Script
// #!/bin/bash

// set -e

// echo "🧪 Starting Comprehensive Test Suite for Blockchain Voting Oracle"
// echo "================================================================"

// # Colors for output
// RED='\033[0;31m'
// GREEN='\033[0;32m'
// YELLOW='\033[1;33m'
// BLUE='\033[0;34m'
// NC='\033[0m' # No Color

// # Configuration
// NODE_ENV=test
// COVERAGE_THRESHOLD=80

// echo -e "${BLUE}📋 Test Configuration:${NC}"
// echo "Environment: $NODE_ENV"
// echo "Coverage Threshold: $COVERAGE_THRESHOLD%"
// echo ""

// # Function to run test suite with proper error handling
// run_test_suite() {
//     local test_name="$1"
//     local test_command="$2"
    
//     echo -e "${YELLOW}🔍 Running $test_name...${NC}"
    
//     if eval "$test_command"; then
//         echo -e "${GREEN}✅ $test_name passed${NC}"
//         return 0
//     else
//         echo -e "${RED}❌ $test_name failed${NC}"
//         return 1
//     fi
// }

// # Check prerequisites
// echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

// if ! command -v node &> /dev/null; then
//     echo -e "${RED}❌ Node.js is not installed${NC}"
//     exit 1
// fi

// if ! command -v npm &> /dev/null; then
//     echo -e "${RED}❌ npm is not installed${NC}"
//     exit 1
// fi

// echo -e "${GREEN}✅ Prerequisites check passed${NC}"
// echo ""

// # Install dependencies
// echo -e "${YELLOW}📦 Installing dependencies...${NC}"
// npm ci
// echo -e "${GREEN}✅ Dependencies installed${NC}"
// echo ""

// # Run test suites
// FAILED_TESTS=0

// # Unit Tests
// if ! run_test_suite "Unit Tests" "npm run test:unit"; then
//     ((FAILED_TESTS++))
// fi

// # Integration Tests
// if ! run_test_suite "Integration Tests" "npm run test:integration"; then
//     ((FAILED_TESTS++))
// fi

// # Oracle API Tests
// if ! run_test_suite "Oracle API Tests" "npm run test:oracle"; then
//     ((FAILED_TESTS++))
// fi

// # Performance Tests
// if ! run_test_suite "Performance Tests" "npm run test:performance"; then
//     ((FAILED_TESTS++))
// fi

// # Coverage Report
// echo -e "${YELLOW}📊 Generating coverage report...${NC}"
// if npm run test:coverage; then
//     echo -e "${GREEN}✅ Coverage report generated${NC}"
// else
//     echo -e "${RED}❌ Coverage report generation failed${NC}"
//     ((FAILED_TESTS++))
// fi

// # Final Results
// echo ""
// echo "================================================================"
// echo -e "${BLUE}📋 Test Suite Summary:${NC}"

// if [ $FAILED_TESTS -eq 0 ]; then
//     echo -e "${GREEN}🎉 All test suites passed successfully!${NC}"
//     echo -e "${GREEN}✅ Oracle service is ready for deployment${NC}"
//     exit 0
// else
//     echo -e "${RED}❌ $FAILED_TESTS test suite(s) failed${NC}"
//     echo -e "${RED}🚫 Please fix the issues before deployment${NC}"
//     exit 1
// fi

// # docker-compose.test.yml - Test Environment Docker Compose
// version: '3.8'

// services:
//   ganache-test:
//     image: trufflesuite/ganache-cli:latest
//     ports:
//       - "8546:8545"  # Different port for test environment
//     command: >
//       --host 0.0.0.0
//       --port 8545
//       --deterministic
//       --accounts 20
//       --defaultBalanceEther 1000
//       --gasLimit 12000000
//       --gasPrice 20000000000
//       --quiet
//     networks:
//       - test-network

//   redis-test:
//     image: redis:7-alpine
//     ports:
//       - "6380:6379"  # Different port for test environment
//     command: redis-server --appendonly yes
//     volumes:
//       - redis_test_data:/data
//     networks:
//       - test-network

//   voting-backend-test:
//     build:
//       context: .
//       dockerfile: Dockerfile.test
//     ports:
//       - "3002:3001"  # Different port for test environment
//     environment:
//       - NODE_ENV=test
//       - RPC_URL=http://ganache-test:8545
//       - REDIS_URL=redis://redis-test:6379
//       - ORACLE_PORT=3001
//       - LOG_LEVEL=error
//       - RATE_LIMIT_WINDOW=60000
//       - RATE_LIMIT_MAX_REQUESTS=100
//     volumes:
//       - ./test/logs:/app/logs
//       - .:/app
//     depends_on:
//       - ganache-test
//       - redis-test
//     networks:
//       - test-network
//     command: npm run test:ci

// volumes:
//   redis_test_data:

// networks:
//   test-network:
//     driver: bridge

// # Dockerfile.test - Test-specific Dockerfile
// FROM node:18-alpine

// # Set working directory
// WORKDIR /app

// # Install system dependencies for testing
// RUN apk add --no-cache \
//     curl \
//     git \
//     bash

// # Copy package files
// COPY package*.json ./

// # Install all dependencies (including dev dependencies for testing)
// RUN npm ci

// # Copy application code
// COPY . .

// # Create test logs directory
// RUN mkdir -p test/logs

// # Create non-root user
// RUN addgroup -g 1001 -S nodejs
// RUN adduser -S voting -u 1001
// RUN chown -R voting:nodejs /app
// USER voting

// # Expose port
// EXPOSE 3001

// # Health check for test environment
// HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
//   CMD curl -f http://localhost:3001/health || exit 1

// # Default command for testing
// CMD ["npm", "run", "test:ci"]

// # test/e2e/oracle.e2e.test.js - End-to-End Tests
const request = require('supertest');
const { spawn } = require('child_process');
const TestDataFactory = require('../helpers/testDataFactory');

describe('Oracle E2E Tests', () => {
  let serverProcess;
  let baseURL;
  let testData;

  beforeAll(async () => {
    testData = new TestDataFactory();
    baseURL = process.env.TEST_BASE_URL || 'http://localhost:3001';
    
    // Wait for server to be ready
    await waitForServer(baseURL, 30000);
    console.log('🔗 Connected to test server');
  }, 35000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  async function waitForServer(url, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        await request(url).get('/health');
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error(`Server not ready within ${timeout}ms`);
  }

  describe('Complete User Journey', () => {
    it('should complete full user verification journey', async () => {
      const user = {
        nik: testData.createValidNIK(),
        name: testData.createValidName(),
        walletAddress: testData.createValidWalletAddress(),
        electionId: 1
      };

      console.log(`🧪 Testing user journey for: ${user.name}`);

      // Step 1: Check initial system health
      const healthResponse = await request(baseURL)
        .get('/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');

      // Step 2: Get initial oracle stats
      const initialStatsResponse = await request(baseURL)
        .get('/api/oracle/stats')
        .expect(200);

      const initialStats = initialStatsResponse.body.data.overview;

      // Step 3: Submit verification request
      const verificationResponse = await request(baseURL)
        .post('/api/oracle/verify-nik')
        .set('Authorization', `Bearer ${user.walletAddress}`)
        .send(user)
        .expect(202);

      expect(verificationResponse.body.success).toBe(true);
      const requestId = verificationResponse.body.data.requestId;
      console.log(`📝 Verification request submitted: ${requestId}`);

      // Step 4: Monitor verification progress
      let verificationComplete = false;
      let attempts = 0;
      const maxAttempts = 20;
      let finalStatus;

      while (!verificationComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await request(baseURL)
          .get(`/api/oracle/verification-status/${requestId}`)
          .expect(200);

        finalStatus = statusResponse.body.data.status;
        console.log(`🔍 Status check ${attempts + 1}: ${finalStatus}`);

        if (finalStatus === 'completed' || finalStatus === 'failed') {
          verificationComplete = true;
        }
        
        attempts++;
      }

      // Step 5: Verify completion
      expect(verificationComplete).toBe(true);
      expect(['completed', 'failed']).toContain(finalStatus);
      console.log(`✅ Verification completed with status: ${finalStatus}`);

      // Step 6: Check updated oracle stats
      const finalStatsResponse = await request(baseURL)
        .get('/api/oracle/stats')
        .expect(200);

      const finalStats = finalStatsResponse.body.data.overview;
      expect(finalStats.totalRequests).toBeGreaterThan(initialStats.totalRequests);

      // Step 7: Verify system health maintained
      const finalHealthResponse = await request(baseURL)
        .get('/health')
        .expect(200);

      expect(['healthy', 'degraded']).toContain(finalHealthResponse.body.status);

      console.log(`🎉 User journey completed successfully for ${user.name}`);
    }, 60000);

    it('should handle multiple users concurrently', async () => {
      const users = Array(5).fill().map(() => ({
        nik: testData.createValidNIK(),
        name: testData.createValidName(),
        walletAddress: testData.createValidWalletAddress(),
        electionId: 1
      }));

      console.log(`🧪 Testing ${users.length} concurrent user journeys`);

      // Submit all verification requests
      const verificationPromises = users.map(user =>
        request(baseURL)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${user.walletAddress}`)
          .send(user)
      );

      const verificationResponses = await Promise.all(verificationPromises);

      // Collect successful request IDs
      const requestIds = [];
      verificationResponses.forEach((response, index) => {
        if (response.status === 202) {
          requestIds.push(response.body.data.requestId);
          console.log(`📝 User ${index + 1} request submitted: ${response.body.data.requestId}`);
        } else {
          console.log(`⚠️ User ${index + 1} request failed: ${response.status}`);
        }
      });

      expect(requestIds.length).toBeGreaterThan(0);

      // Monitor all verifications
      const statusPromises = requestIds.map(async (requestId) => {
        let completed = false;
        let attempts = 0;
        const maxAttempts = 15;

        while (!completed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const statusResponse = await request(baseURL)
              .get(`/api/oracle/verification-status/${requestId}`)
              .expect(200);

            const status = statusResponse.body.data.status;
            
            if (status === 'completed' || status === 'failed') {
              completed = true;
              return { requestId, status, success: true };
            }
          } catch (error) {
            console.error(`❌ Status check failed for ${requestId}:`, error.message);
          }
          
          attempts++;
        }

        return { requestId, status: 'timeout', success: false };
      });

      const finalStatuses = await Promise.all(statusPromises);

      // Verify results
      const successfulVerifications = finalStatuses.filter(s => s.success);
      const completedVerifications = finalStatuses.filter(s => s.status === 'completed');

      expect(successfulVerifications.length).toBeGreaterThan(0);
      console.log(`✅ ${successfulVerifications.length}/${requestIds.length} verifications completed`);
      console.log(`🎯 ${completedVerifications.length} verifications successful`);

      // Check system health after concurrent load
      const healthResponse = await request(baseURL)
        .get('/health')
        .expect(200);

      expect(['healthy', 'degraded']).toContain(healthResponse.body.status);
    }, 90000);
  });

  describe('Error Scenarios', () => {
    it('should handle invalid requests gracefully', async () => {
      const invalidRequests = [
        {
          description: 'Missing NIK',
          request: {
            name: 'Test User',
            walletAddress: testData.createValidWalletAddress(),
            electionId: 1
          },
          expectedStatus: 400
        },
        {
          description: 'Invalid NIK format',
          request: {
            nik: '12345',
            name: 'Test User',
            walletAddress: testData.createValidWalletAddress(),
            electionId: 1
          },
          expectedStatus: 400
        },
        {
          description: 'Missing authorization',
          request: {
            nik: testData.createValidNIK(),
            name: 'Test User',
            walletAddress: testData.createValidWalletAddress(),
            electionId: 1
          },
          auth: false,
          expectedStatus: 401
        }
      ];

      for (const { description, request: req, auth = true, expectedStatus } of invalidRequests) {
        console.log(`🧪 Testing: ${description}`);
        
        let requestBuilder = request(baseURL)
          .post('/api/oracle/verify-nik');

        if (auth && req.walletAddress) {
          requestBuilder = requestBuilder.set('Authorization', `Bearer ${req.walletAddress}`);
        }

        const response = await requestBuilder
          .send(req)
          .expect(expectedStatus);

        expect(response.body.success).toBe(false);
        console.log(`✅ ${description} handled correctly`);
      }
    });

    it('should handle system overload gracefully', async () => {
      const overloadRequests = Array(50).fill().map(() => ({
        nik: testData.createValidNIK(),
        name: testData.createValidName(),
        walletAddress: testData.createValidWalletAddress(),
        electionId: 1
      }));

      console.log(`🧪 Testing system overload with ${overloadRequests.length} requests`);

      // Submit rapid requests
      const rapidPromises = overloadRequests.map(req =>
        request(baseURL)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${req.walletAddress}`)
          .send(req)
          .then(res => ({ status: res.status, success: res.body.success }))
          .catch(err => ({ status: err.status || 500, success: false }))
      );

      const results = await Promise.all(rapidPromises);

      // Analyze results
      const acceptedRequests = results.filter(r => r.status === 202);
      const rateLimitedRequests = results.filter(r => r.status === 429);
      const errorRequests = results.filter(r => r.status >= 500);

      console.log(`📊 Overload test results:
        Accepted: ${acceptedRequests.length}
        Rate Limited: ${rateLimitedRequests.length}
        Server Errors: ${errorRequests.length}
      `);

      // System should handle overload gracefully
      expect(acceptedRequests.length).toBeGreaterThan(0);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
      expect(errorRequests.length).toBeLessThan(overloadRequests.length * 0.1); // Less than 10% errors

      // System should recover
      await new Promise(resolve => setTimeout(resolve, 5000));

      const recoveryHealthResponse = await request(baseURL)
        .get('/health')
        .expect(200);

      expect(['healthy', 'degraded']).toContain(recoveryHealthResponse.body.status);
      console.log(`✅ System recovered after overload`);
    }, 60000);
  });
});

// # CI/CD Pipeline Configuration - .github/workflows/test.yml
// name: Oracle Service Tests

// on:
//   push:
//     branches: [ main, develop ]
//   pull_request:
//     branches: [ main ]

// jobs:
//   test:
//     runs-on: ubuntu-latest
    
//     strategy:
//       matrix:
//         node-version: [16.x, 18.x, 20.x]
    
//     services:
//       ganache:
//         image: trufflesuite/ganache-cli:latest
//         ports:
//           - 8545:8545
//         options: >-
//           --host 0.0.0.0
//           --port 8545
//           --deterministic
//           --accounts 10
//           --defaultBalanceEther 100
//           --gasLimit 10000000
//           --quiet
      
//       redis:
//         image: redis:7-alpine
//         ports:
//           - 6379:6379
//         options: >-
//           --health-cmd "redis-cli ping"
//           --health-interval 10s
//           --health-timeout 5s
//           --health-retries 5

//     steps:
//     - uses: actions/checkout@v3
    
//     - name: Use Node.js ${{ matrix.node-version }}
//       uses: actions/setup-node@v3
//       with:
//         node-version: ${{ matrix.node-version }}
//         cache: 'npm'
    
//     - name: Install dependencies
//       run: npm ci
    
//     - name: Wait for services
//       run: |
//         timeout 30 bash -c 'until curl -f http://localhost:8545; do sleep 1; done'
//         timeout 30 bash -c 'until redis-cli -h localhost ping; do sleep 1; done'
    
//     - name: Run unit tests
//       run: npm run test:unit
//       env:
//         NODE_ENV: test
//         RPC_URL: http://localhost:8545
//         REDIS_URL: redis://localhost:6379
    
//     - name: Run integration tests
//       run: npm run test:integration
//       env:
//         NODE_ENV: test
//         RPC_URL: http://localhost:8545
//         REDIS_URL: redis://localhost:6379
    
//     - name: Run oracle tests
//       run: npm run test:oracle
//       env:
//         NODE_ENV: test
//         RPC_URL: http://localhost:8545
//         REDIS_URL: redis://localhost:6379
    
//     - name: Generate coverage report
//       run: npm run test:coverage
//       env:
//         NODE_ENV: test
//         RPC_URL: http://localhost:8545
//         REDIS_URL: redis://localhost:6379
    
//     - name: Upload coverage to Codecov
//       uses: codecov/codecov-action@v3
//       with:
//         file: ./coverage/lcov.info
//         flags: unittests
//         name: codecov-umbrella
//         fail_ci_if_error: true

//   e2e-test:
//     runs-on: ubuntu-latest
//     needs: test
    
//     steps:
//     - uses: actions/checkout@v3
    
//     - name: Use Node.js 18.x
//       uses: actions/setup-node@v3
//       with:
//         node-version: 18.x
//         cache: 'npm'
    
//     - name: Install dependencies
//       run: npm ci
    
//     - name: Start test environment
//       run: docker-compose -f docker-compose.test.yml up -d
    
//     - name: Wait for test environment
//       run: |
//         timeout 60 bash -c 'until curl -f http://localhost:3002/health; do sleep 2; done'
    
//     - name: Run E2E tests
//       run: npm run test:e2e
//       env:
//         TEST_BASE_URL: http://localhost:3002
    
//     - name: Stop test environment
//       run: docker-compose -f docker-compose.test.yml down
//       if: always()

// # README.md addition for testing
// ## 🧪 Testing

// This project includes comprehensive testing for the Oracle service:

// ### Test Types

// 1. **Unit Tests** - Test individual components and functions
// 2. **Integration Tests** - Test API endpoints and service interactions  
// 3. **End-to-End Tests** - Test complete user workflows
// 4. **Performance Tests** - Test system behavior under load
// 5. **Security Tests** - Test input validation and security measures

// ### Running Tests

// ```bash
// # Run all tests
// npm test

// # Run specific test suites
// npm run test:unit
// npm run test:integration
// npm run test:oracle
// npm run test:e2e
// npm run test:performance

// # Run tests with coverage
// npm run test:coverage

// # Run tests in watch mode
// npm run test:watch
// ```

// ### Test Environment

// ```bash
// # Start test environment with Docker
// docker-compose -f docker-compose.test.yml up -d

// # Run comprehensive test suite
// ./scripts/run-tests.sh

// # Stop test environment
// docker-compose -f docker-compose.test.yml down
// ```

// ### Coverage Requirements

// - Minimum 80% code coverage
// - All critical paths must be tested
// - Security validations must be covered
// - Error handling scenarios included