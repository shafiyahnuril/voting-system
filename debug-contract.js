// debug-contract.js - Script untuk debug contract setelah deployment

const Web3 = require('web3');
const fs = require('fs');

async function debugContract() {
  console.log('🔍 Debugging contract after election creation...\n');

  const web3 = new Web3('http://localhost:8545');

  // 1. Check latest transaction
  console.log('1. Checking latest transactions...');
  try {
    const latestBlock = await web3.eth.getBlockNumber();
    const block = await web3.eth.getBlock(latestBlock, true);
    
    console.log(`✅ Latest block: ${latestBlock}`);
    console.log(`✅ Transactions in block: ${block.transactions.length}`);
    
    if (block.transactions.length > 0) {
      const latestTx = block.transactions[block.transactions.length - 1];
      console.log(`✅ Latest transaction: ${latestTx.hash}`);
      console.log(`✅ To address: ${latestTx.to}`);
      
      // Get transaction receipt
      const receipt = await web3.eth.getTransactionReceipt(latestTx.hash);
      console.log(`✅ Transaction status: ${receipt.status ? 'Success' : 'Failed'}`);
      console.log(`✅ Gas used: ${receipt.gasUsed}`);
      
      if (receipt.logs.length > 0) {
        console.log(`✅ Events emitted: ${receipt.logs.length}`);
        receipt.logs.forEach((log, index) => {
          console.log(`   Event ${index + 1}: ${log.topics[0]}`);
        });
      }
    }
  } catch (error) {
    console.log('❌ Error checking transactions:', error.message);
  }

  // 2. Find contract address
  console.log('\n2. Finding contract address...');
  
  let contractAddress = null;
  
  // Method 1: From .env
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const match = envContent.match(/REACT_APP_VOTING_CONTRACT_ADDRESS=(.+)/);
    if (match) {
      contractAddress = match[1].trim();
      console.log(`✅ Address from .env: ${contractAddress}`);
    }
  } catch (error) {
    console.log('⚠️ Could not read .env file');
  }

  // Method 2: From build artifacts
  if (!contractAddress) {
    try {
      const artifact = JSON.parse(fs.readFileSync('./build/contracts/VotingSystem.json', 'utf8'));
      const networks = artifact.networks;
      const networkId = Object.keys(networks)[0];
      if (networkId) {
        contractAddress = networks[networkId].address;
        console.log(`✅ Address from artifact: ${contractAddress}`);
      }
    } catch (error) {
      console.log('⚠️ Could not read build artifacts');
    }
  }

  // Method 3: Scan recent transactions
  if (!contractAddress) {
    console.log('🔍 Scanning recent blocks for contract creation...');
    try {
      const currentBlock = await web3.eth.getBlockNumber();
      for (let i = Math.max(0, currentBlock - 10); i <= currentBlock; i++) {
        const block = await web3.eth.getBlock(i, true);
        for (const tx of block.transactions) {
          if (tx.to === null) { // Contract creation
            const receipt = await web3.eth.getTransactionReceipt(tx.hash);
            if (receipt.contractAddress) {
              console.log(`✅ Found contract creation: ${receipt.contractAddress}`);
              contractAddress = receipt.contractAddress;
              break;
            }
          }
        }
        if (contractAddress) break;
      }
    } catch (error) {
      console.log('❌ Error scanning blocks:', error.message);
    }
  }

  if (!contractAddress) {
    console.log('❌ Could not find contract address!');
    return;
  }

  // 3. Test contract
  console.log(`\n3. Testing contract at ${contractAddress}...`);
  
  const simpleABI = [
    {
      "inputs": [],
      "name": "electionCount",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [{"internalType": "address", "name": "", "type": "address"}],
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
    }
  ];

  try {
    const contract = new web3.eth.Contract(simpleABI, contractAddress);
    
    // Test basic methods
    const owner = await contract.methods.owner().call();
    console.log(`✅ Contract owner: ${owner}`);
    
    const electionCount = await contract.methods.electionCount().call();
    console.log(`✅ Election count: ${electionCount}`);
    
    // Test reading elections
    if (parseInt(electionCount) > 0) {
      console.log(`\n4. Reading elections...`);
      
      for (let i = 1; i <= parseInt(electionCount); i++) {
        try {
          console.log(`\n📊 Reading election ${i}...`);
          const election = await contract.methods.elections(i).call();
          
          console.log(`   ID: ${election.id || election[0]}`);
          console.log(`   Name: ${election.name || election[1]}`);
          console.log(`   Description: ${election.description || election[2]}`);
          console.log(`   Start Time: ${new Date((election.startTime || election[3]) * 1000).toLocaleString()}`);
          console.log(`   End Time: ${new Date((election.endTime || election[4]) * 1000).toLocaleString()}`);
          console.log(`   Candidate Count: ${election.candidateCount || election[5]}`);
          console.log(`   Total Votes: ${election.totalVotes || election[6]}`);
          console.log(`   Active: ${election.active || election[7]}`);
          console.log(`   Creator: ${election.creator || election[8]}`);
          
        } catch (error) {
          console.log(`❌ Error reading election ${i}:`, error.message);
          
          // Try alternative method
          try {
            console.log(`🔄 Trying alternative read method for election ${i}...`);
            const result = await contract.methods.elections(i).call();
            console.log(`✅ Raw result:`, result);
          } catch (altError) {
            console.log(`❌ Alternative method also failed:`, altError.message);
          }
        }
      }
    } else {
      console.log('📭 No elections found in contract');
    }
    
  } catch (error) {
    console.log('❌ Contract test failed:', error.message);
    
    // Additional debugging
    console.log('\n🔧 Additional debugging...');
    
    // Check contract code
    try {
      const code = await web3.eth.getCode(contractAddress);
      if (code === '0x' || code === '0x0') {
        console.log('❌ No contract code at address!');
      } else {
        console.log(`✅ Contract code exists (${code.length} characters)`);
      }
    } catch (codeError) {
      console.log('❌ Error checking contract code:', codeError.message);
    }
  }

  // 5. Generate fix commands
  console.log('\n🔧 TROUBLESHOOTING STEPS:');
  console.log('========================');
  
  if (parseInt(await contract.methods.electionCount().call()) === 0) {
    console.log('📝 No elections found. This might be normal if you just deployed.');
    console.log('💡 Try creating an election through the frontend.');
  } else {
    console.log('📝 Elections exist but might have reading issues.');
    console.log('💡 Possible solutions:');
    console.log('   1. Update .env with correct contract address');
    console.log('   2. Clear browser cache and restart frontend');
    console.log('   3. Check ABI matches deployed contract');
    console.log('   4. Restart Ganache and redeploy if needed');
  }
  
  // 6. Generate updated .env
  console.log('\n📝 Updated .env content:');
  console.log('========================');
  console.log(`REACT_APP_VOTING_CONTRACT_ADDRESS=${contractAddress}`);
  console.log('REACT_APP_RPC_URL=http://localhost:8545');
  console.log('REACT_APP_CHAIN_ID=5777');
  console.log('REACT_APP_NETWORK_NAME=Ganache Local');
  
  // Write updated .env
  const envContent = `# Generated on ${new Date().toISOString()}
REACT_APP_VOTING_CONTRACT_ADDRESS=${contractAddress}
REACT_APP_RPC_URL=http://localhost:8545
REACT_APP_CHAIN_ID=5777
REACT_APP_NETWORK_NAME=Ganache Local
`;
  
  try {
    fs.writeFileSync('.env', envContent);
    console.log('\n✅ .env file updated!');
  } catch (error) {
    console.log('\n❌ Could not update .env file:', error.message);
  }
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('==============');
  console.log('1. Restart your React app: npm start');
  console.log('2. Clear browser cache (Ctrl+Shift+R)');
  console.log('3. Try creating a new election');
  console.log('4. Check browser console for any errors');
  console.log('5. If still issues, run: truffle migrate --reset');
}

// Run debug
debugContract().catch(console.error);