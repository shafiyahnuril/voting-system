// backend/routes/voters.js - Voter Management Routes
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const asyncHandler = require('../middleware/asyncHandler');
const authMiddleware = require('../middleware/auth');

// Validation rules
const registerVoterValidation = [
  body('electionId')
    .isNumeric()
    .withMessage('Election ID must be numeric'),
  body('name')
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2-100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  body('nik')
    .isLength({ min: 16, max: 16 })
    .withMessage('NIK must be exactly 16 digits')
    .isNumeric()
    .withMessage('NIK must contain only numbers'),
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid wallet address')
];

const castVoteValidation = [
  param('electionId')
    .isNumeric()
    .withMessage('Election ID must be numeric'),
  body('candidateId')
    .isNumeric()
    .withMessage('Candidate ID must be numeric'),
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid wallet address')
];

// POST /api/voters/register - Register voter for election
router.post('/register',
  authMiddleware.requireWallet,
  registerVoterValidation,
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

    const { electionId, name, nik, walletAddress } = req.body;
    const blockchainService = req.app.locals.blockchainService;
    const oracleService = req.app.locals.oracleService;

    try {
      // Verify wallet address matches authenticated user
      if (walletAddress.toLowerCase() !== req.wallet.address.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: 'Wallet address mismatch',
          requestId: req.requestId
        });
      }

      // Check if election exists
      const election = await blockchainService.getElection(electionId);
      if (!election) {
        return res.status(404).json({
          success: false,
          message: 'Election not found',
          requestId: req.requestId
        });
      }

      // Check if voter already registered
      const voterStatus = await blockchainService.getVoterStatus(electionId, walletAddress);
      if (voterStatus.status !== '0') { // Not NotRegistered
        return res.status(400).json({
          success: false,
          message: 'Voter already registered for this election',
          data: {
            currentStatus: voterStatus.statusText,
            isVerified: voterStatus.isVerified
          },
          requestId: req.requestId
        });
      }

      // Check if NIK already used for this election
      const nikUsed = await blockchainService.isNIKUsed(electionId, nik);
      if (nikUsed) {
        return res.status(400).json({
          success: false,
          message: 'NIK already registered for this election',
          requestId: req.requestId
        });
      }

      console.log(`🔄 Starting voter registration process for election ${electionId}`);

      // Step 1: Request NIK verification from Oracle
      console.log('📋 Step 1: Requesting NIK verification...');
      const verificationRequest = await oracleService.requestNIKVerification({
        nik,
        name,
        walletAddress,
        electionId
      });

      console.log(`✅ Verification request created: ${verificationRequest.requestId}`);

      // Step 2: Register voter on blockchain (will be pending until verified)
      console.log('📋 Step 2: Registering voter on blockchain...');
      const registrationResult = await blockchainService.registerVoter({
        electionId,
        name,
        nik,
        voterAddress: walletAddress
      });

      console.log('✅ Voter registered on blockchain');

      // Step 3: Start monitoring verification process
      console.log('📋 Step 3: Starting verification monitoring...');
      
      // Don't wait for verification to complete - return immediately with pending status
      res.status(202).json({
        success: true,
        message: 'Voter registration initiated successfully',
        data: {
          electionId: parseInt(electionId),
          voterAddress: walletAddress,
          registrationTxHash: registrationResult.transactionHash,
          verificationRequestId: verificationRequest.requestId,
          status: 'pending_verification',
          estimatedVerificationTime: '2-5 minutes',
          nextSteps: [
            'NIK verification in progress',
            'Check status with GET /api/voters/status/:electionId/:address',
            'You will be notified when verification completes'
          ]
        },
        requestId: req.requestId
      });

      // Start background verification monitoring (async)
      oracleService.monitorVerification(verificationRequest.requestId, {
        electionId,
        voterAddress: walletAddress,
        onComplete: async (isVerified) => {
          console.log(`🔔 Verification completed for ${walletAddress}: ${isVerified}`);
          // Could implement webhook/notification here
        }
      }).catch(error => {
        console.error('❌ Verification monitoring error:', error);
      });

    } catch (error) {
      console.error('Error registering voter:', error);
      
      let statusCode = 500;
      let message = 'Failed to register voter';
      
      if (error.message.includes('Already registered')) {
        statusCode = 400;
        message = 'Voter already registered for this election';
      } else if (error.message.includes('NIK already used')) {
        statusCode = 400;
        message = 'NIK already used for this election';
      } else if (error.message.includes('Invalid election')) {
        statusCode = 400;
        message = 'Invalid election ID';
      } else if (error.message.includes('User denied')) {
        statusCode = 400;
        message = 'Transaction was cancelled by user';
      }

      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: req.requestId
      });
    }
  })
);

// GET /api/voters/status/:electionId/:address - Get voter status
router.get('/status/:electionId/:address', [
  param('electionId').isNumeric().withMessage('Election ID must be numeric'),
  param('address').isEthereumAddress().withMessage('Invalid wallet address')
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

  const { electionId, address } = req.params;
  const blockchainService = req.app.locals.blockchainService;
  const oracleService = req.app.locals.oracleService;

  try {
    // Get voter status from blockchain
    const voterStatus = await blockchainService.getVoterStatus(electionId, address);
    
    // Get additional verification info if pending
    let verificationInfo = null;
    if (voterStatus.status === '1') { // Pending verification
      verificationInfo = await oracleService.getVerificationStatus(address, electionId);
    }

    // Check if user has voted and get vote details
    let voteInfo = null;
    if (voterStatus.status === '3') { // Has voted
      try {
        const userVote = await blockchainService.getUserVote(electionId, address);
        const candidateInfo = await blockchainService.getCandidateInfo(userVote);
        const voteTimestamp = await blockchainService.getUserVoteTimestamp(electionId, address);
        
        voteInfo = {
          candidateId: userVote,
          candidateName: candidateInfo.name,
          candidateDetails: candidateInfo.details,
          votedAt: new Date(voteTimestamp * 1000).toISOString()
        };
      } catch (error) {
        console.warn('Could not fetch vote details:', error.message);
      }
    }

    // Get election info for context
    const election = await blockchainService.getElection(electionId);
    const currentTime = Math.floor(Date.now() / 1000);
    const canVote = voterStatus.status === '2' && 
                   voterStatus.isVerified && 
                   election.active &&
                   currentTime >= parseInt(election.startTime) &&
                   currentTime <= parseInt(election.endTime);

    res.json({
      success: true,
      data: {
        electionId: parseInt(electionId),
        voterAddress: address,
        status: voterStatus.status,
        statusText: voterStatus.statusText,
        isVerified: voterStatus.isVerified,
        canVote,
        verification: verificationInfo,
        vote: voteInfo,
        election: {
          id: election.id,
          name: election.name,
          active: election.active,
          startTime: new Date(parseInt(election.startTime) * 1000).toISOString(),
          endTime: new Date(parseInt(election.endTime) * 1000).toISOString()
        }
      },
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Error getting voter status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get voter status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.requestId
    });
  }
}));

// POST /api/voters/vote/:electionId - Cast vote
router.post('/vote/:electionId',
  authMiddleware.requireWallet,
  castVoteValidation,
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

    const { electionId } = req.params;
    const { candidateId, walletAddress } = req.body;
    const blockchainService = req.app.locals.blockchainService;

    try {
      // Verify wallet address matches authenticated user
      if (walletAddress.toLowerCase() !== req.wallet.address.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: 'Wallet address mismatch',
          requestId: req.requestId
        });
      }

      console.log(`🗳️ Processing vote: Election ${electionId}, Candidate ${candidateId}, Voter ${walletAddress}`);

      // Perform comprehensive eligibility check
      const eligibilityCheck = await blockchainService.checkVotingEligibility({
        electionId,
        candidateId,
        voterAddress: walletAddress
      });

      if (!eligibilityCheck.eligible) {
        return res.status(400).json({
          success: false,
          message: 'Voting eligibility check failed',
          data: {
            reasons: eligibilityCheck.reasons,
            checks: eligibilityCheck.checks
          },
          requestId: req.requestId
        });
      }

      // Cast vote on blockchain
      const voteResult = await blockchainService.castVote({
        electionId,
        candidateId,
        voterAddress: walletAddress
      });

      console.log('✅ Vote cast successfully');

      // Get updated candidate info
      const candidateInfo = await blockchainService.getCandidateInfo(candidateId);
      
      res.json({
        success: true,
        message: 'Vote cast successfully',
        data: {
          electionId: parseInt(electionId),
          candidateId: parseInt(candidateId),
          candidateName: candidateInfo.name,
          voterAddress: walletAddress,
          transactionHash: voteResult.transactionHash,
          votedAt: new Date().toISOString(),
          blockNumber: voteResult.blockNumber,
          gasUsed: voteResult.gasUsed
        },
        requestId: req.requestId
      });

    } catch (error) {
      console.error('Error casting vote:', error);
      
      let statusCode = 500;
      let message = 'Failed to cast vote';
      
      if (error.message.includes('Not registered')) {
        statusCode = 400;
        message = 'Voter not registered for this election';
      } else if (error.message.includes('Not verified')) {
        statusCode = 400;
        message = 'Voter identity not verified';
      } else if (error.message.includes('Already voted')) {
        statusCode = 400;
        message = 'Voter has already cast their vote';
      } else if (error.message.includes('Election not active')) {
        statusCode = 400;
        message = 'Election is not currently active';
      } else if (error.message.includes('Not started')) {
        statusCode = 400;
        message = 'Election has not started yet';
      } else if (error.message.includes('Ended')) {
        statusCode = 400;
        message = 'Election has already ended';
      } else if (error.message.includes('Invalid candidate')) {
        statusCode = 400;
        message = 'Invalid candidate for this election';
      } else if (error.message.includes('User denied')) {
        statusCode = 400;
        message = 'Transaction was cancelled by user';
      }

      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: req.requestId
      });
    }
  })
);

// GET /api/voters/history/:address - Get voting history for address
router.get('/history/:address', [
  param('address').isEthereumAddress().withMessage('Invalid wallet address')
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

  const { address } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const blockchainService = req.app.locals.blockchainService;

  try {
    console.log(`📊 Fetching voting history for ${address}`);

    // Get voting history
    const votingHistory = await blockchainService.getVotingHistory(address);
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedHistory = votingHistory.slice(startIndex, endIndex);

    // Enrich with additional details
    const enrichedHistory = await Promise.all(
      paginatedHistory.map(async (vote) => {
        try {
          const election = await blockchainService.getElection(vote.electionId);
          const candidate = await blockchainService.getCandidateInfo(vote.candidateId);
          
          return {
            ...vote,
            election: {
              id: election.id,
              name: election.name,
              description: election.description,
              startTime: new Date(parseInt(election.startTime) * 1000).toISOString(),
              endTime: new Date(parseInt(election.endTime) * 1000).toISOString()
            },
            candidate: {
              id: candidate.id,
              name: candidate.name,
              details: candidate.details,
              currentVoteCount: candidate.voteCount
            },
            votedAt: new Date(vote.timestamp * 1000).toISOString()
          };
        } catch (error) {
          console.warn(`Could not enrich vote data for election ${vote.electionId}:`, error.message);
          return {
            ...vote,
            election: { id: vote.electionId, name: 'Unknown Election' },
            candidate: { id: vote.candidateId, name: 'Unknown Candidate' },
            error: 'Could not load complete data'
          };
        }
      })
    );

    res.json({
      success: true,
      data: {
        votingHistory: enrichedHistory,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: votingHistory.length,
          pages: Math.ceil(votingHistory.length / limit),
          hasNext: endIndex < votingHistory.length,
          hasPrev: startIndex > 0
        },
        summary: {
          totalVotes: votingHistory.length,
          participatedElections: [...new Set(votingHistory.map(v => v.electionId))].length
        }
      },
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Error fetching voting history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch voting history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.requestId
    });
  }
}));

// GET /api/voters/eligibility/:electionId/:address - Check voting eligibility
router.get('/eligibility/:electionId/:address', [
  param('electionId').isNumeric().withMessage('Election ID must be numeric'),
  param('address').isEthereumAddress().withMessage('Invalid wallet address')
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

  const { electionId, address } = req.params;
  const { candidateId } = req.query;
  const blockchainService = req.app.locals.blockchainService;

  try {
    const eligibilityCheck = await blockchainService.checkVotingEligibility({
      electionId,
      candidateId: candidateId || null,
      voterAddress: address
    });

    res.json({
      success: true,
      data: {
        electionId: parseInt(electionId),
        voterAddress: address,
        candidateId: candidateId ? parseInt(candidateId) : null,
        eligible: eligibilityCheck.eligible,
        checks: eligibilityCheck.checks,
        reasons: eligibilityCheck.reasons,
        recommendations: eligibilityCheck.recommendations || []
      },
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Error checking voting eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check voting eligibility',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.requestId
    });
  }
}));

module.exports = router;