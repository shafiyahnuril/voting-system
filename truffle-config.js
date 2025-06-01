module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
      gas: 6721975,          // Increased gas limit
      gasPrice: 20000000000, // 20 gwei
      from: undefined,       // Let Truffle choose the account
      timeoutBlocks: 200,    // # of blocks before a deployment times out
      skipDryRun: false      // Skip dry run before migrations
    }
  },

  // Set default mocha options here, use special reporters, etc.
  mocha: {
    timeout: 100000,
    useColors: true
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.19",      // Use exact version
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "istanbul"  // Use compatible EVM version
      }
    }
  },

  // Truffle DB is currently disabled by default
  db: {
    enabled: false
  }
};