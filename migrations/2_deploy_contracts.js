const VotingSystem = artifacts.require("VotingSystem");

module.exports = function(deployer, network, accounts) {
  // Alamat Oracle (gunakan alamat akun pertama untuk testing)
  const oracleAddress = accounts[0];
  
  // Deploy kontrak VotingSystem
  deployer.deploy(VotingSystem, oracleAddress);
};