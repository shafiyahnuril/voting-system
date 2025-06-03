// test/oracle.test.js - Comprehensive Oracle Service Tests
const request = require('supertest');
const EnhancedVotingServer = require('../server');
const TestDataFactory = require('./helpers/testDataFactory');
const MockServices = require('./mocks/mockServices');

describe('Oracle Service API', () => {
  let app;
  let server;
  let testData;

  beforeAll(async () => {
    // Initialize test data factory
    testData = new TestDataFactory();
    
    // Start server with test configuration
    server = new EnhancedVotingServer();
    app = server.app;
    
    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🧪 Oracle test suite initialized');
  });

  afterAll(async () => {
    if (server) {
      await server.gracefulShutdown('test');
    }
    console.log('🧪 Oracle test suite completed');
  });

  describe('POST /api/oracle/verify-nik', () => {
    describe('Valid Requests', () => {
      it('should accept valid NIK verification request', async () => {
        const validRequest = testData.createValidVerificationRequest();

        const response = await request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${validRequest.walletAddress}`)
          .send(validRequest)
          .expect(202);

        expect(response.body.success).toBe(true);
        expect(response.body.data.requestId).toBeDefined();
        expect(response.body.data.status).toBe('pending');
        expect(response.body.data.requestId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });

      it('should handle multiple valid requests from different users', async () => {
        const requests = [
          testData.createValidVerificationRequest(),
          testData.createValidVerificationRequest(),
          testData.createValidVerificationRequest()
        ];

        const responses = await Promise.all(
          requests.map(req =>
            request(app)
              .post('/api/oracle/verify-nik')
              .set('Authorization', `Bearer ${req.walletAddress}`)
              .send(req)
          )
        );

        responses.forEach(response => {
          expect(response.status).toBe(202);
          expect(response.body.success).toBe(true);
          expect(response.body.data.requestId).toBeDefined();
        });

        // Ensure all request IDs are unique
        const requestIds = responses.map(r => r.body.data.requestId);
        const uniqueIds = new Set(requestIds);
        expect(uniqueIds.size).toBe(requestIds.length);
      });
    });

    describe('NIK Validation', () => {
      const nikTestCases = [
        {
          nik: '12345',
          description: 'NIK too short',
          expectedStatus: 400,
          expectedError: 'INVALID_NIK_FORMAT'
        },
        {
          nik: '12345678901234567',
          description: 'NIK too long',
          expectedStatus: 400,
          expectedError: 'INVALID_NIK_FORMAT'
        },
        {
          nik: 'abcd567890123456',
          description: 'NIK contains letters',
          expectedStatus: 400,
          expectedError: 'INVALID_NIK_FORMAT'
        },
        {
          nik: '1234567890123456',
          description: 'Valid NIK format',
          expectedStatus: 202,
          expectedError: null
        },
        {
          nik: '',
          description: 'Empty NIK',
          expectedStatus: 400,
          expectedError: 'MISSING_REQUIRED_FIELDS'
        },
        {
          nik: null,
          description: 'Null NIK',
          expectedStatus: 400,
          expectedError: 'MISSING_REQUIRED_FIELDS'
        },
        {
          nik: '1234-5678-9012-3456',
          description: 'NIK with dashes',
          expectedStatus: 400,
          expectedError: 'INVALID_NIK_FORMAT'
        },
        {
          nik: '1234 5678 9012 3456',
          description: 'NIK with spaces',
          expectedStatus: 400,
          expectedError: 'INVALID_NIK_FORMAT'
        }
      ];

      nikTestCases.forEach(({ nik, description, expectedStatus, expectedError }) => {
        it(`should handle ${description}`, async () => {
          const request_data = testData.createValidVerificationRequest();
          request_data.nik = nik;

          const response = await request(app)
            .post('/api/oracle/verify-nik')
            .set('Authorization', `Bearer ${request_data.walletAddress}`)
            .send(request_data)
            .expect(expectedStatus);

          if (expectedStatus !== 202) {
            expect(response.body.success).toBe(false);
            if (expectedError) {
              expect(response.body.errorCode).toBe(expectedError);
            }
          } else {
            expect(response.body.success).toBe(true);
          }
        });
      });
    });

    describe('Wallet Address Validation', () => {
      it('should reject wallet address mismatch', async () => {
        const validRequest = testData.createValidVerificationRequest();
        const differentAddress = testData.createValidWalletAddress();

        const response = await request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${differentAddress}`)
          .send(validRequest)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBe('WALLET_ADDRESS_MISMATCH');
        expect(response.body.message).toContain('mismatch');
      });

      it('should reject invalid wallet address format', async () => {
        const invalidRequest = testData.createValidVerificationRequest();
        invalidRequest.walletAddress = 'invalid-wallet-address';

        const response = await request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${invalidRequest.walletAddress}`)
          .send(invalidRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBe('INVALID_WALLET_ADDRESS');
      });

      it('should reject missing authorization header', async () => {
        const validRequest = testData.createValidVerificationRequest();

        const response = await request(app)
          .post('/api/oracle/verify-nik')
          .send(validRequest)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBe('MISSING_AUTHORIZATION');
      });
    });

    describe('Input Validation', () => {
      const requiredFields = ['nik', 'name', 'walletAddress', 'electionId'];

      requiredFields.forEach(field => {
        it(`should reject request missing ${field}`, async () => {
          const invalidRequest = testData.createValidVerificationRequest();
          delete invalidRequest[field];

          const response = await request(app)
            .post('/api/oracle/verify-nik')
            .set('Authorization', `Bearer ${invalidRequest.walletAddress || testData.createValidWalletAddress()}`)
            .send(invalidRequest)
            .expect(400);

          expect(response.body.success).toBe(false);
          expect(response.body.errorCode).toBe('MISSING_REQUIRED_FIELDS');
          expect(response.body.errors).toContain(field);
        });
      });

      it('should reject invalid election ID', async () => {
        const invalidRequest = testData.createValidVerificationRequest();
        invalidRequest.electionId = 'invalid';

        const response = await request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${invalidRequest.walletAddress}`)
          .send(invalidRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBe('INVALID_ELECTION_ID');
      });

      it('should reject empty name', async () => {
        const invalidRequest = testData.createValidVerificationRequest();
        invalidRequest.name = '';

        const response = await request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${invalidRequest.walletAddress}`)
          .send(invalidRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBe('INVALID_NAME');
      });
    });

    describe('Duplicate Requests', () => {
      it('should handle duplicate NIK verification requests', async () => {
        const validRequest = testData.createValidVerificationRequest();

        // First request should succeed
        const firstResponse = await request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${validRequest.walletAddress}`)
          .send(validRequest)
          .expect(202);

        expect(firstResponse.body.success).toBe(true);

        // Duplicate request should be rejected or handled gracefully
        const secondResponse = await request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${validRequest.walletAddress}`)
          .send(validRequest);

        expect([409, 202]).toContain(secondResponse.status);
        
        if (secondResponse.status === 409) {
          expect(secondResponse.body.success).toBe(false);
          expect(secondResponse.body.errorCode).toBe('DUPLICATE_REQUEST');
        }
      });
    });

    describe('Rate Limiting', () => {
      it('should handle rate limiting for multiple rapid requests', async () => {
        const walletAddress = testData.createValidWalletAddress();
        
        // Create multiple requests rapidly
        const rapidRequests = Array(15).fill().map((_, index) => {
          const req = testData.createValidVerificationRequest();
          req.walletAddress = walletAddress;
          req.nik = testData.createValidNIK() + index.toString().padStart(2, '0');
          return req;
        });

        const responses = await Promise.all(
          rapidRequests.map(req =>
            request(app)
              .post('/api/oracle/verify-nik')
              .set('Authorization', `Bearer ${req.walletAddress}`)
              .send(req)
              .then(res => ({ status: res.status, body: res.body }))
              .catch(err => ({ status: err.status || 500, body: err.body }))
          )
        );

        // Should have some rate limited responses
        const rateLimitedResponses = responses.filter(r => r.status === 429);
        const successfulResponses = responses.filter(r => r.status === 202);

        expect(rateLimitedResponses.length).toBeGreaterThan(0);
        expect(successfulResponses.length).toBeGreaterThan(0);

        rateLimitedResponses.forEach(response => {
          expect(response.body.errorCode).toBe('RATE_LIMIT_EXCEEDED');
        });
      }, 30000);
    });
  });

  describe('GET /api/oracle/verification-status/:requestId', () => {
    let validRequestId;

    beforeEach(async () => {
      // Create a verification request to get a valid request ID
      const validRequest = testData.createValidVerificationRequest();
      const createResponse = await request(app)
        .post('/api/oracle/verify-nik')
        .set('Authorization', `Bearer ${validRequest.walletAddress}`)
        .send(validRequest);

      validRequestId = createResponse.body.data.requestId;
    });

    it('should return verification status for valid request ID', async () => {
      const response = await request(app)
        .get(`/api/oracle/verification-status/${validRequestId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestId).toBe(validRequestId);
      expect(response.body.data.status).toBeDefined();
      expect(['pending', 'processing', 'completed', 'failed']).toContain(
        response.body.data.status
      );
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should return 404 for non-existent request ID', async () => {
      const fakeRequestId = testData.createValidUUID();

      const response = await request(app)
        .get(`/api/oracle/verification-status/${fakeRequestId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('REQUEST_NOT_FOUND');
    });

    it('should reject invalid UUID format', async () => {
      const invalidRequestId = 'invalid-uuid-format';

      const response = await request(app)
        .get(`/api/oracle/verification-status/${invalidRequestId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_REQUEST_ID_FORMAT');
    });

    it('should handle verification status updates over time', async () => {
      // Check initial status
      const initialResponse = await request(app)
        .get(`/api/oracle/verification-status/${validRequestId}`)
        .expect(200);

      expect(initialResponse.body.data.status).toBe('pending');

      // Wait and check if status changes (in real scenario)
      await new Promise(resolve => setTimeout(resolve, 3000));

      const updatedResponse = await request(app)
        .get(`/api/oracle/verification-status/${validRequestId}`)
        .expect(200);

      expect(updatedResponse.body.success).toBe(true);
      expect(['pending', 'processing', 'completed', 'failed']).toContain(
        updatedResponse.body.data.status
      );
    }, 10000);
  });

  describe('GET /api/oracle/stats', () => {
    it('should return comprehensive oracle statistics', async () => {
      const response = await request(app)
        .get('/api/oracle/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.performance).toBeDefined();
      expect(response.body.data.system).toBeDefined();

      // Validate overview statistics
      const { overview } = response.body.data;
      expect(typeof overview.totalRequests).toBe('number');
      expect(typeof overview.pendingRequests).toBe('number');
      expect(typeof overview.completedRequests).toBe('number');
      expect(typeof overview.failedRequests).toBe('number');
      expect(typeof overview.successRate).toBe('string');

      // Validate performance metrics
      const { performance } = response.body.data;
      expect(typeof performance.averageProcessingTime).toBe('number');
      expect(typeof performance.queueSize).toBe('number');
      expect(Array.isArray(performance.recentProcessingTimes)).toBe(true);

      // Validate system metrics
      const { system } = response.body.data;
      expect(typeof system.uptime).toBe('number');
      expect(system.memory).toBeDefined();
      expect(system.cpu).toBeDefined();
    });

    it('should return stats with proper data types and ranges', async () => {
      const response = await request(app)
        .get('/api/oracle/stats')
        .expect(200);

      const { overview, performance, system } = response.body.data;

      // Check data ranges and consistency
      expect(overview.totalRequests).toBeGreaterThanOrEqual(0);
      expect(overview.pendingRequests).toBeGreaterThanOrEqual(0);
      expect(overview.completedRequests).toBeGreaterThanOrEqual(0);
      expect(overview.failedRequests).toBeGreaterThanOrEqual(0);
      
      // Total should equal completed + failed + pending
      const sum = overview.completedRequests + overview.failedRequests + overview.pendingRequests;
      expect(overview.totalRequests).toBeGreaterThanOrEqual(sum);

      expect(performance.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(performance.queueSize).toBeGreaterThanOrEqual(0);
      expect(system.uptime).toBeGreaterThan(0);
    });
  });

  describe('GET /api/oracle/health', () => {
    it('should return oracle health status', async () => {
      const response = await request(app)
        .get('/api/oracle/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);

      // Validate timestamp format
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should include service dependencies health', async () => {
      const response = await request(app)
        .get('/api/oracle/health')
        .expect(200);

      if (response.body.services) {
        expect(response.body.services.blockchain).toBeDefined();
        expect(response.body.services.database).toBeDefined();
        expect(['healthy', 'degraded', 'unhealthy']).toContain(
          response.body.services.blockchain
        );
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/oracle/verify-nik')
        .set('Authorization', 'Bearer 0x742d35Cc6639FB8d2B21234567891234567890AB')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_JSON');
    });

    it('should handle very large request payloads', async () => {
      const largeRequest = testData.createValidVerificationRequest();
      largeRequest.name = 'A'.repeat(10000); // Very long name

      const response = await request(app)
        .post('/api/oracle/verify-nik')
        .set('Authorization', `Bearer ${largeRequest.walletAddress}`)
        .send(largeRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('PAYLOAD_TOO_LARGE');
    });

    it('should handle concurrent requests properly', async () => {
      const concurrentRequests = Array(5).fill().map(() => {
        const req = testData.createValidVerificationRequest();
        return request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', `Bearer ${req.walletAddress}`)
          .send(req);
      });

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect([202, 429]).toContain(response.status);
      });

      const successfulResponses = responses.filter(r => r.status === 202);
      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/oracle/stats')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // 5 seconds max
      expect(response.body.success).toBe(true);
    });

    it('should handle multiple concurrent status checks', async () => {
      // Create a verification request first
      const validRequest = testData.createValidVerificationRequest();
      const createResponse = await request(app)
        .post('/api/oracle/verify-nik')
        .set('Authorization', `Bearer ${validRequest.walletAddress}`)
        .send(validRequest);

      const requestId = createResponse.body.data.requestId;

      // Make multiple concurrent status checks
      const statusChecks = Array(10).fill().map(() =>
        request(app).get(`/api/oracle/verification-status/${requestId}`)
      );

      const responses = await Promise.all(statusChecks);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.requestId).toBe(requestId);
      });
    });
  });

  describe('Security Tests', () => {
    it('should prevent SQL injection in request parameters', async () => {
      const maliciousRequestId = "'; DROP TABLE verifications; --";

      const response = await request(app)
        .get(`/api/oracle/verification-status/${encodeURIComponent(maliciousRequestId)}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_REQUEST_ID_FORMAT');
    });

    it('should sanitize input data', async () => {
      const maliciousRequest = testData.createValidVerificationRequest();
      maliciousRequest.name = '<script>alert("xss")</script>';

      const response = await request(app)
        .post('/api/oracle/verify-nik')
        .set('Authorization', `Bearer ${maliciousRequest.walletAddress}`)
        .send(maliciousRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_CHARACTERS');
    });

    it('should validate authorization header format', async () => {
      const validRequest = testData.createValidVerificationRequest();

      const invalidAuthHeaders = [
        'Invalid Bearer Token',
        'Bearer ',
        'Bearer invalid-format',
        'NotBearer 0x742d35Cc6639FB8d2B21234567891234567890AB'
      ];

      for (const authHeader of invalidAuthHeaders) {
        const response = await request(app)
          .post('/api/oracle/verify-nik')
          .set('Authorization', authHeader)
          .send(validRequest)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBe('INVALID_AUTHORIZATION_FORMAT');
      }
    });
  });
});