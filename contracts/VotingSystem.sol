// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Ultra Simple Voting System - No external dependencies in constructor
contract VotingSystem {
    
    // Simple owner management
    address public owner;
    
    // Optional Oracle (can be set later)
    address public nikOracle;
    
    // Reentrancy protection
    bool private locked;
    modifier noReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    // Enum untuk status voter
    enum VoterStatus { 
        NotRegistered,        // 0
        PendingVerification,  // 1  
        Registered,           // 2
        Voted                 // 3
    }
    
    // Struct untuk Election
    struct Election {
        uint256 id;
        string name;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 candidateCount;
        uint256 totalVotes;
        bool active;
        address creator;
    }

    // Struct untuk Candidate
    struct Candidate {
        uint256 id;
        uint256 electionId;
        string name;
        string details;
        uint256 voteCount;
    }

    // Struct untuk Voter
    struct Voter {
        string name;
        string nikHash;
        VoterStatus status;
        uint256 votedFor;
        uint256 timestamp;
        bool nikVerified;
    }

    // State variables
    uint256 public electionCount;
    uint256 private candidateCount;

    // Mappings
    mapping(uint256 => Election) public elections;
    mapping(uint256 => Candidate) public candidates;
    mapping(uint256 => uint256[]) public electionCandidates;
    mapping(uint256 => mapping(address => Voter)) public electionVoters;
    mapping(string => bool) public usedNIKHashes;

    // Events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ElectionCreated(uint256 indexed electionId, string name, uint256 startTime, uint256 endTime, address creator);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name, string details);
    event VoterRegistrationRequested(uint256 indexed electionId, address indexed voter, bytes32 requestId);
    event VoterVerified(uint256 indexed electionId, address indexed voter, bool verified);
    event VoteSubmitted(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);
    event ElectionStatusChanged(uint256 indexed electionId, bool active);

    // Minimal constructor - no parameters
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // Set Oracle address after deployment
    function setOracleAddress(address _oracleAddress) external onlyOwner {
        nikOracle = _oracleAddress;
    }

    // Ownership functions
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // Create new election
    function createElection(
        string memory _name,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime
    ) external returns (uint256) {
        require(_startTime < _endTime, "Invalid time range");
        require(_endTime > block.timestamp, "End time in past");
        require(bytes(_name).length > 0, "Name required");

        electionCount++;
        uint256 electionId = electionCount;

        elections[electionId] = Election({
            id: electionId,
            name: _name,
            description: _description,
            startTime: _startTime,
            endTime: _endTime,
            candidateCount: 0,
            totalVotes: 0,
            active: true,
            creator: msg.sender
        });

        emit ElectionCreated(electionId, _name, _startTime, _endTime, msg.sender);
        return electionId;
    }

    // Add candidate to election
    function addCandidate(
        uint256 _electionId,
        string memory _name,
        string memory _details
    ) external {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        require(elections[_electionId].creator == msg.sender, "Only creator");
        require(block.timestamp < elections[_electionId].startTime, "Election started");
        require(bytes(_name).length > 0, "Name required");

        candidateCount++;
        uint256 candidateId = candidateCount;

        candidates[candidateId] = Candidate({
            id: candidateId,
            electionId: _electionId,
            name: _name,
            details: _details,
            voteCount: 0
        });

        elections[_electionId].candidateCount++;
        electionCandidates[_electionId].push(candidateId);

        emit CandidateAdded(_electionId, candidateId, _name, _details);
    }

    // Register voter (simplified - auto verify for demo)
    function registerVoter(
        uint256 _electionId,
        string memory _name,
        string memory _nik
    ) external noReentrant {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        require(bytes(_name).length > 0, "Name required");
        require(bytes(_nik).length == 16, "NIK must be 16 digits");
        require(electionVoters[_electionId][msg.sender].status == VoterStatus.NotRegistered, "Already registered");

        // Validate NIK is numeric
        bytes memory nikBytes = bytes(_nik);
        for (uint i = 0; i < nikBytes.length; i++) {
            require(nikBytes[i] >= 0x30 && nikBytes[i] <= 0x39, "NIK must be numeric");
        }

        // Create NIK hash
        string memory nikHash = string(abi.encodePacked(keccak256(abi.encodePacked(_nik, msg.sender))));
        require(!usedNIKHashes[nikHash], "NIK already used");

        usedNIKHashes[nikHash] = true;

        // Create request ID
        bytes32 requestId = keccak256(abi.encodePacked(msg.sender, _nik, block.timestamp));

        // Auto-verify for demo (skip Oracle)
        electionVoters[_electionId][msg.sender] = Voter({
            name: _name,
            nikHash: nikHash,
            status: VoterStatus.Registered, // Skip verification step
            votedFor: 0,
            timestamp: 0,
            nikVerified: true
        });

        emit VoterRegistrationRequested(_electionId, msg.sender, requestId);
        emit VoterVerified(_electionId, msg.sender, true);
    }

    // Cast vote
    function castVote(uint256 _electionId, uint256 _candidateId) external noReentrant {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        
        Election storage election = elections[_electionId];
        require(election.active, "Election not active");
        require(block.timestamp >= election.startTime, "Not started");
        require(block.timestamp <= election.endTime, "Ended");
        
        Voter storage voter = electionVoters[_electionId][msg.sender];
        require(voter.status == VoterStatus.Registered, "Not registered");
        require(voter.nikVerified, "Not verified");
        require(_candidateId > 0 && candidates[_candidateId].electionId == _electionId, "Invalid candidate");

        voter.status = VoterStatus.Voted;
        voter.votedFor = _candidateId;
        voter.timestamp = block.timestamp;

        candidates[_candidateId].voteCount++;
        election.totalVotes++;

        emit VoteSubmitted(_electionId, _candidateId, msg.sender);
    }

    // View functions
    function getVoterStatus(uint256 _electionId, address _voter) 
        external 
        view 
        returns (VoterStatus, bool) 
    {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        Voter memory voter = electionVoters[_electionId][_voter];
        return (voter.status, voter.nikVerified);
    }

    function getElectionCandidates(uint256 _electionId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        return electionCandidates[_electionId];
    }

    function getCandidateInfo(uint256 _candidateId) 
        external 
        view 
        returns (uint256, string memory, string memory, uint256) 
    {
        require(_candidateId > 0 && _candidateId <= candidateCount, "Invalid candidate");
        Candidate memory candidate = candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.details, candidate.voteCount);
    }

    function isElectionActive(uint256 _electionId) 
        external 
        view 
        returns (bool) 
    {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        return elections[_electionId].active;
    }

    function getUserVote(uint256 _electionId, address _voter) 
        external 
        view 
        returns (uint256) 
    {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        require(electionVoters[_electionId][_voter].status == VoterStatus.Voted, "Not voted");
        return electionVoters[_electionId][_voter].votedFor;
    }

    function getUserVoteTimestamp(uint256 _electionId, address _voter) 
        external 
        view 
        returns (uint256) 
    {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        require(electionVoters[_electionId][_voter].status == VoterStatus.Voted, "Not voted");
        return electionVoters[_electionId][_voter].timestamp;
    }

    // Admin functions
    function setElectionStatus(uint256 _electionId, bool _active) external {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        require(elections[_electionId].creator == msg.sender, "Only creator");
        
        elections[_electionId].active = _active;
        emit ElectionStatusChanged(_electionId, _active);
    }

    // Backward compatibility
    function voterStatus(uint256 _electionId, address _voter) 
        external 
        view 
        returns (VoterStatus) 
    {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        return electionVoters[_electionId][_voter].status;
    }
}