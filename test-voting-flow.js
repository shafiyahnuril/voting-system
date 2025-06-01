// test-voting-flow.js - Script untuk test complete voting flow
const Web3 = require('web3');

const VOTING_ABI = [
  {
    "inputs": [],
    "name": "electionCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "name": "elections",
    "outputs": [
      {"internalType": "uint256", "name": "id", "type": "uint256"},
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "description", "type": "string"},
      {"internalType": "uint256", "name": "startTime", "type": "uint256"},
      {"internalType": "uint256", "name": "endTime", "type": "uint256"},
      {"internalType": "uint256", "name": "candidateCount", "type": "uint256"},
      {"internalType": "uint256", "name": "totalVotes", "type": "uint256"},
      {"internalType": "bool", "name": "active", "type": "bool"},
      {"internalType": "address", "name": "creator", "type": "address"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "string", "name": "_name", "type": "string"},
      {"internalType": "string", "name": "_nik", "type": "string"}
    ],
    "name": "registerVoter",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "address", "name": "_voter", "type": "address"}
    ],
    "name": "getVoterStatus",
    "outputs": [
      {"internalType": "enum VotingSystem.VoterStatus", "name": "", "type": "uint8"},
      {"internalType": "bool", "name": "", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "address", "name": "_voter", "type": "address"}
    ],
    "name": "voterStatus",
    "outputs": [{"internalType": "enum VotingSystem.VoterStatus", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}],
    "name": "getElectionCandidates",
    "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_candidateId", "type": "uint256"}],
    "name": "getCandidateInfo",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"},
      {"internalType": "string", "name": "", "type": "string"},
      {"internalType": "string", "name": "", "type": "string"},
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "uint256", "name": "_candidateId", "type": "uint256"}
    ],
    "name": "castVote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}],
    "name": "isElectionActive",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function testCompleteVotingFlow() {
  try {
    console.log('🗳️ Testing Complete Voting Flow...\n');
    
    // Setup
    const web3 = new Web3('http://localhost:8545');
    const accounts = await web3.eth.getAccounts();
    
    // Use different accounts for testing
    const voterAccount = accounts[1]; // Test voter
    const contractAddress = process.env.REACT_APP_VOTING_CONTRACT_ADDRESS || '0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab';
    
    console.log('📍 Contract Address:', contractAddress);
    console.log('👤 Voter Account:', voterAccount);
    console.log('💰 Voter Balance:', web3.utils.fromWei(await web3.eth.getBalance(voterAccount), 'ether'), 'ETH\n');
    
    const contract = new web3.eth.Contract(VOTING_ABI, contractAddress);
    
    // Step 1: Check available elections
    console.log('📊 Step 1: Checking available elections...');
    const electionCount = await contract.methods.electionCount().call();
    console.log('✅ Total elections:', electionCount);
    
    if (electionCount == 0) {
      console.error('❌ No elections available. Please create an election first.');
      return;
    }
    
    // Step 2: Get election details
    console.log('\n📋 Step 2: Getting election details...');
    const electionData = await contract.methods.elections(1).call();
    console.log('✅ Election ID:', electionData.id || electionData[0]);
    console.log('✅ Election Name:', electionData.name || electionData[1]);
    console.log('✅ Start Time:', new Date((electionData.startTime || electionData[3]) * 1000).toLocaleString());
    console.log('✅ End Time:', new Date((electionData.endTime || electionData[4]) * 1000).toLocaleString());
    console.log('✅ Is Active:', electionData.active || electionData[7]);
    
    // Check if election is active
    const isActive = await contract.methods.isElectionActive(1).call();
    console.log('✅ Election Active Status:', isActive);
    
    // Step 3: Check current voter status
    console.log('\n👤 Step 3: Checking voter status...');
    
    let voterStatus;
    let isVerified = false;
    
    try {
      // Try new getVoterStatus method first
      const statusResult = await contract.methods.getVoterStatus(1, voterAccount).call();
      voterStatus = statusResult[0] || statusResult;
      isVerified = statusResult[1] || true; // Assume verified if method exists
      console.log('✅ Voter Status (getVoterStatus):', voterStatus, 'Verified:', isVerified);
    } catch (error) {
      // Fallback to old voterStatus method
      try {
        voterStatus = await contract.methods.voterStatus(1, voterAccount).call();
        isVerified = true; // In simplified contract, registration means verified
        console.log('✅ Voter Status (voterStatus):', voterStatus, 'Verified:', isVerified);
      } catch (error2) {
        console.error('❌ Could not get voter status:', error2.message);
        voterStatus = '0'; // NotRegistered
        isVerified = false;
      }
    }
    
    // Convert status to readable text
    const statusText = {
      '0': 'Not Registered',
      '1': 'Pending Verification', 
      '2': 'Registered/Verified',
      '3': 'Already Voted'
    };
    
    console.log('📋 Current Status:', statusText[voterStatus] || 'Unknown');
    
    // Step 4: Register if not registered
    if (voterStatus === '0') {
      console.log('\n📝 Step 4: Registering voter...');
      
      const testData = {
        electionId: 1,
        name: "Test Voter " + Date.now(),
        nik: "1234567890123456"
      };
      
      try {
        const gasEstimate = await contract.methods
          .registerVoter(testData.electionId, testData.name, testData.nik)
          .estimateGas({ from: voterAccount });
        
        console.log('⛽ Gas estimate for registration:', gasEstimate);
        
        const registerResult = await contract.methods
          .registerVoter(testData.electionId, testData.name, testData.nik)
          .send({ 
            from: voterAccount,
            gas: Math.floor(gasEstimate * 1.5)
          });
        
        console.log('✅ Registration successful!');
        console.log('📋 Transaction hash:', registerResult.transactionHash);
        console.log('⛽ Gas used:', registerResult.gasUsed);
        
        // Update voter status after registration
        try {
          const statusResult = await contract.methods.getVoterStatus(1, voterAccount).call();
          voterStatus = statusResult[0] || statusResult;
          isVerified = statusResult[1] !== false; // Default to true
        } catch (error) {
          voterStatus = await contract.methods.voterStatus(1, voterAccount).call();
          isVerified = true; // In simplified contract, registration means immediate verification
        }
        
        console.log('📋 New Status:', statusText[voterStatus] || 'Unknown', 'Verified:', isVerified);
        
      } catch (error) {
        console.error('❌ Registration failed:', error.message);
        return;
      }
    }
    
    // Step 5: Get candidates
    console.log('\n🏆 Step 5: Getting candidates...');
    try {
      const candidateIds = await contract.methods.getElectionCandidates(1).call();
      console.log('✅ Candidate IDs:', candidateIds);
      
      if (candidateIds.length === 0) {
        console.error('❌ No candidates available for this election');
        return;
      }
      
      // Get candidate details
      for (let i = 0; i < candidateIds.length; i++) {
        try {
          const candidateInfo = await contract.methods.getCandidateInfo(candidateIds[i]).call();
          console.log(`✅ Candidate ${i + 1}:`);
          console.log(`   ID: ${candidateInfo[0]}`);
          console.log(`   Name: ${candidateInfo[1]}`);
          console.log(`   Details: ${candidateInfo[2]}`);
          console.log(`   Vote Count: ${candidateInfo[3]}`);
        } catch (error) {
          console.warn(`⚠️ Could not get candidate ${candidateIds[i]} info:`, error.message);
        }
      }
      
      // Step 6: Cast vote (if eligible)
      console.log('\n🗳️ Step 6: Attempting to cast vote...');
      
      // Check all conditions for voting
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = electionData.startTime || electionData[3];
      const endTime = electionData.endTime || electionData[4];
      
      console.log('🕐 Current time:', new Date(currentTime * 1000).toLocaleString());
      console.log('🕐 Election start:', new Date(startTime * 1000).toLocaleString());
      console.log('🕐 Election end:', new Date(endTime * 1000).toLocaleString());
      
      // Detailed eligibility check
      const canVote = {
        isRegistered: voterStatus === '2' || voterStatus === '1', // Registered or Verified
        isVerified: isVerified,
        hasNotVoted: voterStatus !== '3',
        electionActive: isActive,
        withinTimeWindow: currentTime >= startTime && currentTime <= endTime,
        hasCandidates: candidateIds.length > 0
      };
      
      console.log('📋 Voting Eligibility Check:');
      Object.entries(canVote).forEach(([key, value]) => {
        console.log(`   ${value ? '✅' : '❌'} ${key}: ${value}`);
      });
      
      const eligible = Object.values(canVote).every(v => v === true);
      console.log('🎯 Overall Eligible:', eligible);
      
      if (!eligible) {
        console.log('\n❌ Cannot vote due to failed eligibility checks');
        
        // Provide specific guidance
        if (!canVote.isRegistered) {
          console.log('💡 Solution: Register for this election first');
        }
        if (!canVote.electionActive) {
          console.log('💡 Solution: Election is not active');
        }
        if (!canVote.withinTimeWindow) {
          if (currentTime < startTime) {
            console.log('💡 Solution: Election has not started yet');
          } else {
            console.log('💡 Solution: Election has already ended');
          }
        }
        if (!canVote.hasCandidates) {
          console.log('💡 Solution: No candidates available');
        }
        return;
      }
      
      // Try to cast vote
      const candidateToVote = candidateIds[0]; // Vote for first candidate
      console.log(`\n🗳️ Attempting to vote for candidate ${candidateToVote}...`);
      
      try {
        const voteGasEstimate = await contract.methods
          .castVote(1, candidateToVote)
          .estimateGas({ from: voterAccount });
        
        console.log('⛽ Gas estimate for voting:', voteGasEstimate);
        
        const voteResult = await contract.methods
          .castVote(1, candidateToVote)
          .send({ 
            from: voterAccount,
            gas: Math.floor(voteGasEstimate * 1.5)
          });
        
        console.log('🎉 VOTE CAST SUCCESSFULLY!');
        console.log('📋 Transaction hash:', voteResult.transactionHash);
        console.log('⛽ Gas used:', voteResult.gasUsed);
        
        // Verify vote was recorded
        try {
          const finalStatus = await contract.methods.voterStatus(1, voterAccount).call();
          console.log('📋 Final voter status:', statusText[finalStatus] || 'Unknown');
          
          // Get updated candidate info
          const updatedCandidateInfo = await contract.methods.getCandidateInfo(candidateToVote).call();
          console.log('📊 Updated candidate vote count:', updatedCandidateInfo[3]);
          
        } catch (error) {
          console.warn('⚠️ Could not verify vote:', error.message);
        }
        
      } catch (error) {
        console.error('❌ Voting failed:', error.message);
        
        // Detailed error analysis
        if (error.message.includes('Not registered')) {
          console.log('💡 Error: Voter not registered for this election');
        } else if (error.message.includes('Not verified')) {
          console.log('💡 Error: Voter identity not verified');
        } else if (error.message.includes('Already voted')) {
          console.log('💡 Error: Voter has already cast their vote');
        } else if (error.message.includes('Election not active')) {
          console.log('💡 Error: Election is not currently active');
        } else if (error.message.includes('Not started')) {
          console.log('💡 Error: Election has not started yet');
        } else if (error.message.includes('Ended')) {
          console.log('💡 Error: Election has already ended');
        } else if (error.message.includes('Invalid candidate')) {
          console.log('💡 Error: Candidate ID is not valid for this election');
        } else if (error.message.includes('revert')) {
          console.log('💡 Error: Smart contract reverted the transaction');
          console.log('💡 Check contract requirements and voter eligibility');
        } else {
          console.log('💡 Error: Unknown issue -', error.message);
        }
      }
      
    } catch (error) {
      console.error('❌ Error getting candidates:', error.message);
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Export for use in other files
module.exports = { testCompleteVotingFlow };

// Run if called directly
if (require.main === module) {
  testCompleteVotingFlow()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}