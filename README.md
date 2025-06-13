# Decentralized Voting System

A blockchain-powered voting platform designed to ensure transparency, security, and integrity in digital elections. Built using React.js for the frontend and Ethereum smart contracts for the backend.

---

## 🚀 Features

### Core Voting Capabilities

* **Immutable Voting Records:** All votes are securely stored on the blockchain.
* **Identity Verification:** Voter identities verified through an oracle using NIK.
* **One-Person-One-Vote:** Prevents double voting with cryptographic checks.
* **Live Results:** Real-time election updates and results.
* **Multiple Elections:** Supports concurrent election creation and management.

### Security & Privacy

* **Decentralized System:** Eliminates single points of failure.
* **End-to-End Encryption:** Votes are securely encrypted.
* **Anonymous Ballots:** Ensures voter privacy.
* **Auditable Contracts:** Transparent and verifiable smart contract logic.

### User Experience

* **MetaMask Integration:** Easy wallet connection.
* **Mobile-Responsive UI:** Optimized for all devices.
* **Simple Navigation:** Intuitive interface for both voters and admins.
* **Real-Time Notifications:** Keeps users informed with live updates.

---

## 🧰 Tech Stack

### Frontend

* React 18.2
* Vite
* Tailwind CSS
* React Router
* React Toastify

### Blockchain

* Solidity 0.8.19
* Truffle Suite
* Web3.js 1.10.4
* OpenZeppelin
* Ganache

### Backend / Services

* Node.js
* Express.js
* Custom Oracle Service
* CORS

### Tooling

* ESLint
* PostCSS
* MetaMask

---

## 🧱 Architecture

```
Frontend (React.js)  <-->  Smart Contracts (Solidity)  <-->  Oracle Service (Node.js)
       |                         |                               |
       ▼                         ▼                               ▼
    MetaMask                Ganache                        Identity API
```

---

## 🖥️ Prerequisites

* Node.js >= v16
* npm >= v7
* Git
* MetaMask Extension
* Ganache CLI or GUI

### System Requirements

* RAM: 4GB minimum (8GB recommended)
* Storage: 2GB free
* OS: Windows 10+, macOS 10.14+, or Ubuntu 18.04+

---

## ⚙️ Installation

1. **Clone the Repository**

```bash
git clone https://github.com/yourusername/decentralized-voting-system.git
cd decentralized-voting-system
```

2. **Install Dependencies**

```bash
npm install
npm install -g truffle
npm install -g ganache-cli
```

3. **Set Up MetaMask**

* Install [MetaMask](https://metamask.io/)
* Add a custom network with RPC URL `http://localhost:8545`, Chain ID `5777`

4. **Start Ganache**

```bash
ganache-cli --host 0.0.0.0 --port 8545 --deterministic --accounts 10 --defaultBalanceEther 100
```

5. **Deploy Contracts**

```bash
truffle compile
truffle migrate --reset
```

6. **Configure `.env`**

```env
REACT_APP_VOTING_CONTRACT_ADDRESS=0x...
REACT_APP_ORACLE_CONTRACT_ADDRESS=0x...
REACT_APP_RPC_URL=http://localhost:8545
REACT_APP_CHAIN_ID=5777
REACT_APP_NETWORK_NAME=Ganache Local
```

---

## ▶️ Usage

### Start the App

```bash
npm start
```

Navigate to [http://localhost:3000](http://localhost:3000)

### Admin Flow

* Connect wallet
* Create election
* Add candidates
* Manage elections

### Voter Flow

* Connect with MetaMask
* Register with NIK and name
* Vote for a candidate
* View live and final results

---

## 📄 Smart Contracts

### VotingSystem.sol

Handles elections, candidates, registration, voting, and result tracking.

Key functions:

```solidity
createElection(name, description, startTime, endTime);
addCandidate(electionId, name, details);
registerVoter(electionId, name, nik);
castVote(electionId, candidateId);
getElectionResults(electionId);
```

### NIKVerificationOracle.sol

Acts as a bridge to verify voter identity.

Key functions:

```solidity
verifyNIK(nik, name);
completeVerification(requestId, isValid);
getVerificationStatus(requestId);
```

---

## 🧪 Testing

### Run Tests

```bash
truffle test      # Smart contracts
npm test          # Frontend
npm run test:api  # API tests (if backend implemented)
```

### Sample Test Data

* NIK: `1234567890123456`
* Names: Test User 1, Test User 2
* Elections: Set dates in the future

---

## 🐞 Debugging Tools

### Available Scripts

```bash
node debug.js
node debug-contract.js
node debug-candidate-issue.js
node test-voting-flow.js
```

### Common Issues

* **MetaMask not connecting**: Check RPC URL and network settings.
* **Transactions failing**: Ensure enough ETH, increase gas limit.
* **Contracts not found**: Re-deploy and update `.env`.

---

## 📡 API Overview (Oracle)

### POST /api/oracle/verify-nik

Request:

```json
{
  "nik": "1234567890123456",
  "name": "John Doe",
  "walletAddress": "0x...",
  "electionId": 1
}
```

Response:

```json
{
  "success": true,
  "data": {
    "requestId": "uuid-here",
    "status": "pending"
  }
}
```

### GET /api/oracle/verification-status/\:requestId

Response:

```json
{
  "success": true,
  "data": {
    "requestId": "uuid-here",
    "status": "completed",
    "isValid": true,
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

---

## 🤝 Contributing

1. Fork the repo and create a feature branch.
2. Commit your changes.
3. Open a pull request.

### Code Style

* Use ESLint
* Follow React and Solidity best practices
* Write tests and documentation

---

## 🙌 Acknowledgments

* OpenZeppelin
* Truffle Suite
* React Team
* Ethereum Foundation
* MetaMask

---

## 📍 Roadmap

* Integrate real government identity verification APIs
* Develop a mobile application (iOS and Android)
* Support multi-language/localization
* Build an advanced analytics and admin dashboard
* Store candidate data and election documents via IPFS
* Explore Layer 2 (Optimism/Arbitrum) integration for scalability
* Conduct third-party audits for enhanced security

---