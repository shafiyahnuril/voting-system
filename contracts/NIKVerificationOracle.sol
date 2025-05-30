// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Ultra Simple NIK Oracle - No inheritance, minimal constructor
contract NIKVerificationOracle {
    
    // Simple owner management
    address public owner;
    
    struct VerificationRequest {
        address requester;
        string nik;
        string nama;
        bool processed;
        bool isValid;
        uint256 timestamp;
    }
    
    // Storage
    mapping(bytes32 => VerificationRequest) public verificationRequests;
    mapping(address => bool) public authorizedNodes;
    
    // Events
    event VerificationRequested(
        bytes32 indexed requestId, 
        address indexed requester, 
        uint256 timestamp
    );
    
    event VerificationCompleted(
        bytes32 indexed requestId, 
        bool isValid
    );
    
    event NodeAuthorized(address indexed node);
    event NodeDeauthorized(address indexed node);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyAuthorizedNode() {
        require(authorizedNodes[msg.sender], "Not authorized");
        _;
    }
    
    // Minimal constructor - just set owner
    constructor() {
        owner = msg.sender;
        authorizedNodes[msg.sender] = true;
        emit NodeAuthorized(msg.sender);
    }
    
    // Basic owner management
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    // Authorize verification node
    function authorizeNode(address _node) external onlyOwner {
        require(_node != address(0), "Invalid address");
        authorizedNodes[_node] = true;
        emit NodeAuthorized(_node);
    }
    
    // Deauthorize verification node
    function deauthorizeNode(address _node) external onlyOwner {
        authorizedNodes[_node] = false;
        emit NodeDeauthorized(_node);
    }
    
    // Request NIK verification - simplified random generation
    function verifyNIK(string memory _nik, string memory _nama) external returns (bytes32) {
        require(bytes(_nik).length == 16, "NIK must be 16 digits");
        require(bytes(_nama).length > 0, "Name required");
        
        // Simple request ID generation (avoid block.prevrandao issue)
        bytes32 requestId = keccak256(abi.encodePacked(
            msg.sender,
            _nik,
            _nama,
            block.timestamp,
            block.number  // Use block.number instead of prevrandao
        ));
        
        // Store request
        verificationRequests[requestId] = VerificationRequest({
            requester: msg.sender,
            nik: _nik,
            nama: _nama,
            processed: false,
            isValid: false,
            timestamp: block.timestamp
        });
        
        emit VerificationRequested(requestId, msg.sender, block.timestamp);
        return requestId;
    }
    
    // Complete verification
    function completeVerification(bytes32 _requestId, bool _isValid) external onlyAuthorizedNode {
        VerificationRequest storage request = verificationRequests[_requestId];
        
        require(request.requester != address(0), "Request not found");
        require(!request.processed, "Already processed");
        
        request.processed = true;
        request.isValid = _isValid;
        
        emit VerificationCompleted(_requestId, _isValid);
    }
    
    // Check verification status
    function isNIKVerified(bytes32 _requestId) external view returns (bool completed, bool isValid) {
        VerificationRequest memory request = verificationRequests[_requestId];
        return (request.processed, request.isValid);
    }
    
    // Get request details
    function getVerificationRequest(bytes32 _requestId) 
        external 
        view 
        returns (
            address requester,
            bool processed,
            bool isValid,
            uint256 timestamp
        ) 
    {
        VerificationRequest memory request = verificationRequests[_requestId];
        return (
            request.requester,
            request.processed,
            request.isValid,
            request.timestamp
        );
    }
    
    // Check authorization
    function isAuthorizedNode(address _node) external view returns (bool) {
        return authorizedNodes[_node];
    }
}