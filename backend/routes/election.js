// backend/routes/elections.js - Election Management Routes
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const asyncHandler = require('../middleware/asyncHandler');
const authMiddleware = require('../middleware/auth');

// Validation rules
const createElectionValidation = [
  body('name')
    .notEmpty()
    .withMessage('Election name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Election name must be between 3-100 characters'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10-500 characters'),
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO date')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Start time must be in the future');
      }
      return true;
    }),
  body('endTime')
    .isISO8601()
    .withMessage('End time must be a valid ISO date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startTime)) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  body('candidates')
    .isArray({ min: 2 })
    .withMessage('At least 2 candidates are required'),
  body('candidates.*.name')
    .notEmpty()
    .withMessage('Candidate name is required'),
  body('candidates.*.details')
    .notEmpty()
    .withMessage('Candidate details are required')
];

const addCandidateValidation = [
  param('electionId').isNumeric().withMessage('Election ID must be numeric'),
  body('name').notEmpty().withMessage('Candidate name is required'),
  body('details').notEmpty().withMessage('Candidate details are required')
];

// GET /api/elections - Get all elections
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const blockchainService = req.app.locals.blockchainService;

  try {
    const elections = await blockchainService.getAllElections();
    
    // Filter by status if provided
    let filteredElections = elections;
    if (status) {
      filteredElections = elections.filter(election => {
        const currentTime = Math.floor(Date.now() / 1000);
        const startTime = parseInt(election.startTime);
        const endTime = parseInt(election.endTime);
        
        switch (status) {
          case 'active':
            return currentTime >= startTime && currentTime <= endTime && election.active;
          case 'upcoming':
            return currentTime < startTime;
          case 'ended':
            return currentTime > endTime;
          case 'paused':
            return !election.active;
          default:
            return true;
        }
      });
    }

    // Search by name or description
    if (search) {
      const searchLower = search.toLowerCase();
      filteredElections = filteredElections.filter(election =>
        election.name.toLowerCase().includes(searchLower) ||
        election.description.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedElections = filteredElections.slice(startIndex, endIndex);

    // Add computed fields
    const enrichedElections = await Promise.all(
      paginatedElections.map(async (election) => {
        const candidates = await blockchainService.getElectionCandidates(election.id);
        const currentTime = Math.floor(Date.now() / 1000);
        const startTime = parseInt(election.startTime);
        const endTime = parseInt(election.endTime);
        
        let computedStatus;
        if (currentTime < startTime) {
          computedStatus = 'upcoming';
        } else if (currentTime > endTime) {
          computedStatus = 'ended';
        } else if (election.active) {
          computedStatus = 'active';
        } else {
          computedStatus = 'paused';
        }

        return {
          ...election,
          candidateCount: candidates.length,
          status: computedStatus,
          startTime: new Date(startTime * 1000).toISOString(),
          endTime: new Date(endTime * 1000).toISOString(),
          createdAt: new Date(startTime * 1000).toISOString()
        };
      })
    );

    res.json({
      success: true,
      data: {
        elections: enrichedElections,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredElections.length,
          pages: Math.ceil(filteredElections.length / limit),
          hasNext: endIndex < filteredElections.length,
          hasPrev: startIndex > 0
        },
        filters: {
          status,
          search
        }
      },
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Error fetching elections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch elections',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.requestId
    });
  }
}));

// GET /api/elections/:id - Get specific election
router.get('/:id', [
  param('id').isNumeric().withMessage('Election ID must be numeric')
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

  const { id } = req.params;
  const blockchainService = req.app.locals.blockchainService;

  try {
    // Get election data
    const election = await blockchainService.getElection(id);
    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        requestId: req.requestId
      });
    }

    // Get candidates
    const candidates = await blockchainService.getElectionCandidates(id);
    const candidatesWithDetails = await Promise.all(
      candidates.map(candidateId => blockchainService.getCandidateInfo(candidateId))
    );

    // Compute status
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = parseInt(election.startTime);
    const endTime = parseInt(election.endTime);
    
    let status;
    if (currentTime < startTime) {
      status = 'upcoming';
    } else if (currentTime > endTime) {
      status = 'ended';
    } else if (election.active) {
      status = 'active';
    } else {
      status = 'paused';
    }

    const enrichedElection = {
      ...election,
      candidates: candidatesWithDetails,
      status,
      startTime: new Date(startTime * 1000).toISOString(),
      endTime: new Date(endTime * 1000).toISOString(),
      timeRemaining: status === 'active' ? endTime - currentTime : null,
      canVote: status === 'active' && currentTime >= startTime && currentTime <= endTime
    };

    res.json({
      success: true,
      data: enrichedElection,
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Error fetching election:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch election',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.requestId
    });
  }
}));

// POST /api/elections - Create new election
router.post('/', 
  authMiddleware.requireWallet,
  createElectionValidation,
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

    const { name, description, startTime, endTime, candidates } = req.body;
    const creatorAddress = req.wallet.address;
    const blockchainService = req.app.locals.blockchainService;

    try {
      // Convert dates to timestamps
      const startTimestamp = Math.floor(new Date(startTime).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);

      console.log(`🔄 Creating election: ${name}`);

      // Create election on blockchain
      const result = await blockchainService.createElection({
        name,
        description,
        startTime: startTimestamp,
        endTime: endTimestamp,
        creatorAddress
      });

      const electionId = result.electionId;
      console.log(`✅ Election created with ID: ${electionId}`);

      // Add candidates
      console.log(`🔄 Adding ${candidates.length} candidates...`);
      const candidateResults = [];
      
      for (const candidate of candidates) {
        try {
          const candidateResult = await blockchainService.addCandidate({
            electionId,
            name: candidate.name,
            details: candidate.details,
            creatorAddress
          });
          candidateResults.push(candidateResult);
          console.log(`✅ Added candidate: ${candidate.name}`);
        } catch (error) {
          console.error(`❌ Failed to add candidate ${candidate.name}:`, error);
          throw new Error(`Failed to add candidate: ${candidate.name}`);
        }
      }

      // Return complete election data
      const createdElection = await blockchainService.getElection(electionId);
      
      res.status(201).json({
        success: true,
        message: 'Election created successfully',
        data: {
          election: {
            ...createdElection,
            startTime: new Date(startTimestamp * 1000).toISOString(),
            endTime: new Date(endTimestamp * 1000).toISOString()
          },
          candidates: candidateResults,
          transactionHash: result.transactionHash
        },
        requestId: req.requestId
      });

    } catch (error) {
      console.error('Error creating election:', error);
      
      let statusCode = 500;
      let message = 'Failed to create election';
      
      if (error.message.includes('Only creator')) {
        statusCode = 403;
        message = 'Only election creator can perform this action';
      } else if (error.message.includes('Invalid time')) {
        statusCode = 400;
        message = 'Invalid election time parameters';
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

// POST /api/elections/:id/candidates - Add candidate to election
router.post('/:id/candidates',
  authMiddleware.requireWallet,
  addCandidateValidation,
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

    const { id: electionId } = req.params;
    const { name, details } = req.body;
    const creatorAddress = req.wallet.address;
    const blockchainService = req.app.locals.blockchainService;

    try {
      // Check if election exists
      const election = await blockchainService.getElection(electionId);
      if (!election) {
        return res.status(404).json({
          success: false,
          message: 'Election not found',
          requestId: req.requestId
        });
      }

      // Add candidate
      const result = await blockchainService.addCandidate({
        electionId,
        name,
        details,
        creatorAddress
      });

      res.status(201).json({
        success: true,
        message: 'Candidate added successfully',
        data: {
          candidate: result.candidate,
          transactionHash: result.transactionHash
        },
        requestId: req.requestId
      });

    } catch (error) {
      console.error('Error adding candidate:', error);
      
      let statusCode = 500;
      let message = 'Failed to add candidate';
      
      if (error.message.includes('Only creator')) {
        statusCode = 403;
        message = 'Only election creator can add candidates';
      } else if (error.message.includes('Election started')) {
        statusCode = 400;
        message = 'Cannot add candidates after election has started';
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

// GET /api/elections/:id/results - Get election results
router.get('/:id/results', [
  param('id').isNumeric().withMessage('Election ID must be numeric')
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

  const { id } = req.params;
  const blockchainService = req.app.locals.blockchainService;

  try {
    // Get election
    const election = await blockchainService.getElection(id);
    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        requestId: req.requestId
      });
    }

    // Get candidates with vote counts
    const candidates = await blockchainService.getElectionCandidates(id);
    const candidatesWithVotes = await Promise.all(
      candidates.map(async candidateId => {
        const candidateInfo = await blockchainService.getCandidateInfo(candidateId);
        return candidateInfo;
      })
    );

    // Sort by vote count (descending)
    candidatesWithVotes.sort((a, b) => parseInt(b.voteCount) - parseInt(a.voteCount));

    // Calculate percentages
    const totalVotes = candidatesWithVotes.reduce((sum, candidate) => 
      sum + parseInt(candidate.voteCount), 0
    );

    const resultsWithPercentage = candidatesWithVotes.map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      percentage: totalVotes > 0 ? 
        ((parseInt(candidate.voteCount) / totalVotes) * 100).toFixed(2) : 0,
      isWinner: index === 0 && parseInt(candidate.voteCount) > 0
    }));

    // Determine election status
    const currentTime = Math.floor(Date.now() / 1000);
    const endTime = parseInt(election.endTime);
    const canShowResults = currentTime > endTime || req.query.preview === 'true';

    res.json({
      success: true,
      data: {
        election: {
          ...election,
          startTime: new Date(parseInt(election.startTime) * 1000).toISOString(),
          endTime: new Date(endTime * 1000).toISOString(),
          isEnded: currentTime > endTime
        },
        results: resultsWithPercentage,
        summary: {
          totalVotes,
          totalCandidates: candidatesWithVotes.length,
          winner: resultsWithPercentage.length > 0 ? resultsWithPercentage[0] : null,
          turnout: totalVotes // Could calculate against registered voters if available
        },
        canShowResults
      },
      requestId: req.requestId
    });

  } catch (error) {
    console.error('Error fetching election results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch election results',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: req.requestId
    });
  }
}));

// PUT /api/elections/:id/status - Update election status
router.put('/:id/status',
  authMiddleware.requireWallet,
  [
    param('id').isNumeric().withMessage('Election ID must be numeric'),
    body('active').isBoolean().withMessage('Active status must be boolean')
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

    const { id } = req.params;
    const { active } = req.body;
    const creatorAddress = req.wallet.address;
    const blockchainService = req.app.locals.blockchainService;

    try {
      const result = await blockchainService.setElectionStatus({
        electionId: id,
        active,
        creatorAddress
      });

      res.json({
        success: true,
        message: `Election ${active ? 'activated' : 'deactivated'} successfully`,
        data: {
          electionId: id,
          active,
          transactionHash: result.transactionHash
        },
        requestId: req.requestId
      });

    } catch (error) {
      console.error('Error updating election status:', error);
      
      let statusCode = 500;
      let message = 'Failed to update election status';
      
      if (error.message.includes('Only creator')) {
        statusCode = 403;
        message = 'Only election creator can change status';
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

module.exports = router;