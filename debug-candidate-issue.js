// debug-candidate-issue.js - Script untuk debug masalah kandidat

const Web3 = require('web3');

async function debugCandidateIssue() {
  try {
    console.log('🔍 Debugging candidate information issue...\n');
    
    const web3 = new Web3('http://localhost:8545');
    const accounts = await web3.eth.getAccounts();
    
    // Get contract address
    const contractAddress = process.env.REACT_APP_VOTING_CONTRACT_ADDRESS || '0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab';
    console.log('📍 Contract Address:', contractAddress);
    console.log('👤 Test Account:', accounts[1]);
    
    const CONTRACT_ABI = [
      {
        "inputs": [],
        "name": "electionCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
          {"internalType": "address", "name": "_voter", "type": "address"}
        ],
        "name": "getUserVote",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
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
        "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}],
        "name": "getElectionCandidates",
        "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
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
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "candidates",
        "outputs": [
          {"internalType": "uint256", "name": "id", "type": "uint256"},
          {"internalType": "uint256", "name": "electionId", "type": "uint256"},
          {"internalType": "string", "name": "name", "type": "string"},
          {"internalType": "string", "name": "details", "type": "string"},
          {"internalType": "uint256", "name": "voteCount", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ];
    
    const contract = new web3.eth.Contract(CONTRACT_ABI, contractAddress);
    
    console.log('📊 Step 1: Check election and voter status...');
    
    // Check election count
    const electionCount = await contract.methods.electionCount().call();
    console.log('✅ Election count:', electionCount);
    
    if (electionCount == 0) {
      console.error('❌ No elections found');
      return;
    }
    
    // Check voter status for different accounts
    for (let i = 0; i < Math.min(3, accounts.length); i++) {
      const account = accounts[i];
      console.log(`\n👤 Checking account ${i}: ${account}`);
      
      try {
        const voterStatus = await contract.methods.voterStatus(1, account).call();
        console.log(`📋 Voter status: ${voterStatus}`);
        
        if (voterStatus === '3') { // Has voted
          console.log('🗳️ This account has voted! Checking vote details...');
          
          // Step 2: Get user's vote
          try {
            const votedCandidateId = await contract.methods.getUserVote(1, account).call();
            console.log('✅ Voted for candidate ID:', votedCandidateId);
            
            // Step 3: Get candidate information
            console.log('🔍 Getting candidate information...');
            
            try {
              const candidateInfo = await contract.methods.getCandidateInfo(votedCandidateId).call();
              console.log('✅ Candidate info retrieved:');
              console.log('   ID:', candidateInfo[0]);
              console.log('   Name:', candidateInfo[1]);
              console.log('   Details:', candidateInfo[2]);
              console.log('   Vote Count:', candidateInfo[3]);
              
              if (!candidateInfo[1] || candidateInfo[1] === '') {
                console.log('⚠️ Candidate name is empty - this might be the issue!');
              }
              
            } catch (candidateError) {
              console.error('❌ Error getting candidate info:', candidateError.message);
              
              // Try alternative method - direct candidates mapping
              console.log('🔄 Trying direct candidates mapping...');
              try {
                const directCandidate = await contract.methods.candidates(votedCandidateId).call();
                console.log('✅ Direct candidate data:');
                console.log('   ID:', directCandidate[0] || directCandidate.id);
                console.log('   Election ID:', directCandidate[1] || directCandidate.electionId);
                console.log('   Name:', directCandidate[2] || directCandidate.name);
                console.log('   Details:', directCandidate[3] || directCandidate.details);
                console.log('   Vote Count:', directCandidate[4] || directCandidate.voteCount);
              } catch (directError) {
                console.error('❌ Direct candidates mapping also failed:', directError.message);
              }
            }
            
          } catch (voteError) {
            console.error('❌ Error getting user vote:', voteError.message);
            
            if (voteError.message.includes('User has not voted')) {
              console.log('💡 Contract says user has not voted, but status is 3. This is inconsistent!');
            }
          }
        } else {
          console.log(`📋 Account ${i} has not voted (status: ${voterStatus})`);
        }
        
      } catch (error) {
        console.error(`❌ Error checking account ${i}:`, error.message);
      }
    }
    
    console.log('\n📊 Step 4: List all candidates in election 1...');
    
    try {
      const candidateIds = await contract.methods.getElectionCandidates(1).call();
      console.log('✅ Candidate IDs in election 1:', candidateIds);
      
      for (const candidateId of candidateIds) {
        try {
          console.log(`\n🔍 Candidate ${candidateId}:`);
          
          // Try getCandidateInfo
          try {
            const info = await contract.methods.getCandidateInfo(candidateId).call();
            console.log('   getCandidateInfo:', {
              id: info[0],
              name: info[1],
              details: info[2],
              voteCount: info[3]
            });
          } catch (error) {
            console.log('   getCandidateInfo failed:', error.message);
          }
          
          // Try direct candidates mapping
          try {
            const direct = await contract.methods.candidates(candidateId).call();
            console.log('   candidates mapping:', {
              id: direct[0] || direct.id,
              electionId: direct[1] || direct.electionId,
              name: direct[2] || direct.name,
              details: direct[3] || direct.details,
              voteCount: direct[4] || direct.voteCount
            });
          } catch (error) {
            console.log('   candidates mapping failed:', error.message);
          }
          
        } catch (error) {
          console.error(`❌ Error checking candidate ${candidateId}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('❌ Error getting candidate list:', error.message);
    }
    
    console.log('\n🔧 DIAGNOSIS AND RECOMMENDATIONS:');
    console.log('==================================');
    
    console.log('💡 Common causes of "Kandidat Tidak Dikenal":');
    console.log('1. getUserVote() returns invalid candidate ID');
    console.log('2. getCandidateInfo() method missing or broken');
    console.log('3. Candidate data was not properly stored');
    console.log('4. Contract ABI mismatch');
    console.log('5. Race condition in vote recording');
    
    console.log('\n🛠️ Recommended fixes:');
    console.log('1. Update MyVotes.js with better error handling');
    console.log('2. Add fallback methods for getting candidate info');
    console.log('3. Verify contract deployment and ABI');
    console.log('4. Check if vote was properly recorded');
    
  } catch (error) {
    console.error('💥 Debug script failed:', error);
  }
}

// Run debug
debugCandidateIssue();