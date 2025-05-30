// src/utils/transactionMonitor.js - Utility untuk monitor dan debug transaksi

export class TransactionMonitor {
  constructor(web3) {
    this.web3 = web3;
    this.pendingTransactions = new Map();
  }

  // Monitor transaksi dengan timeout dan progress tracking
  async monitorTransaction(txHash, options = {}) {
    const {
      timeout = 120000, // 2 menit default
      onProgress = () => {},
      onConfirmation = () => {},
      confirmations = 1
    } = options;

    return new Promise((resolve, reject) => {
      let resolved = false;
      let confirmationCount = 0;

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.pendingTransactions.delete(txHash);
          reject(new Error(`Transaction ${txHash} timed out after ${timeout}ms`));
        }
      }, timeout);

      // Monitor transaction receipt
      const checkReceipt = async () => {
        try {
          const receipt = await this.web3.eth.getTransactionReceipt(txHash);
          
          if (receipt) {
            confirmationCount++;
            onConfirmation(confirmationCount, receipt);

            if (confirmationCount >= confirmations) {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                this.pendingTransactions.delete(txHash);
                
                if (receipt.status === true || receipt.status === '0x1') {
                  resolve(receipt);
                } else {
                  reject(new Error(`Transaction failed: ${txHash}`));
                }
              }
              return;
            }
          }

          // Update progress
          onProgress(`Waiting for confirmation... (${confirmationCount}/${confirmations})`);
          
          // Check again in 2 seconds
          if (!resolved) {
            setTimeout(checkReceipt, 2000);
          }
        } catch (error) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            this.pendingTransactions.delete(txHash);
            reject(error);
          }
        }
      };

      // Start monitoring
      this.pendingTransactions.set(txHash, { 
        startTime: Date.now(), 
        resolve, 
        reject,
        timeoutId 
      });
      
      onProgress('Transaction sent, waiting for confirmation...');
      checkReceipt();
    });
  }

  // Send transaction dengan monitoring otomatis
  async sendTransactionWithMonitoring(contractMethod, options = {}) {
    const {
      from,
      gas,
      gasPrice,
      timeout = 120000,
      onTransactionHash = () => {},
      onProgress = () => {},
      onConfirmation = () => {}
    } = options;

    try {
      // Estimate gas jika tidak disediakan
      let gasEstimate = gas;
      if (!gasEstimate) {
        onProgress('Estimating gas...');
        gasEstimate = await contractMethod.estimateGas({ from });
        gasEstimate = Math.floor(gasEstimate * 1.2); // Add 20% buffer
      }

      // Get gas price jika tidak disediakan
      let currentGasPrice = gasPrice;
      if (!currentGasPrice) {
        currentGasPrice = await this.web3.eth.getGasPrice();
      }

      onProgress('Sending transaction...');

      // Send transaction
      return new Promise((resolve, reject) => {
        contractMethod.send({
          from,
          gas: gasEstimate,
          gasPrice: currentGasPrice
        })
        .on('transactionHash', (hash) => {
          console.log('📤 Transaction hash:', hash);
          onTransactionHash(hash);
          
          // Monitor transaction
          this.monitorTransaction(hash, {
            timeout,
            onProgress,
            onConfirmation
          })
          .then(resolve)
          .catch(reject);
        })
        .on('error', (error) => {
          console.error('❌ Transaction error:', error);
          reject(error);
        });
      });

    } catch (error) {
      console.error('❌ Send transaction error:', error);
      throw error;
    }
  }

  // Get transaction status
  async getTransactionStatus(txHash) {
    try {
      const [transaction, receipt] = await Promise.all([
        this.web3.eth.getTransaction(txHash),
        this.web3.eth.getTransactionReceipt(txHash)
      ]);

      return {
        exists: !!transaction,
        confirmed: !!receipt,
        success: receipt ? (receipt.status === true || receipt.status === '0x1') : null,
        blockNumber: receipt?.blockNumber,
        gasUsed: receipt?.gasUsed,
        transaction,
        receipt
      };
    } catch (error) {
      console.error('Error getting transaction status:', error);
      return {
        exists: false,
        confirmed: false,
        success: null,
        error: error.message
      };
    }
  }

  // Check if Ganache is responsive
  async checkGanacheConnection() {
    try {
      const blockNumber = await this.web3.eth.getBlockNumber();
      const chainId = await this.web3.eth.getChainId();
      
      return {
        connected: true,
        blockNumber,
        chainId,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Get detailed gas info
  async getGasInfo() {
    try {
      const [gasPrice, blockNumber] = await Promise.all([
        this.web3.eth.getGasPrice(),
        this.web3.eth.getBlockNumber()
      ]);

      const latestBlock = await this.web3.eth.getBlock(blockNumber);

      return {
        gasPrice: gasPrice,
        gasPriceGwei: this.web3.utils.fromWei(gasPrice, 'gwei'),
        blockNumber: blockNumber,
        gasLimit: latestBlock.gasLimit,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Debug transaction yang gagal
  async debugFailedTransaction(txHash) {
    try {
      const status = await this.getTransactionStatus(txHash);
      
      if (!status.exists) {
        return {
          issue: 'Transaction not found',
          recommendation: 'Check if transaction hash is correct'
        };
      }

      if (!status.confirmed) {
        return {
          issue: 'Transaction pending',
          recommendation: 'Wait for confirmation or check if Ganache is running'
        };
      }

      if (!status.success) {
        return {
          issue: 'Transaction reverted',
          recommendation: 'Check contract logic, gas limit, or permissions',
          gasUsed: status.gasUsed,
          receipt: status.receipt
        };
      }

      return {
        issue: 'None',
        status: 'Transaction successful',
        gasUsed: status.gasUsed
      };

    } catch (error) {
      return {
        issue: 'Debug failed',
        error: error.message
      };
    }
  }

  // Cancel/cleanup pending transactions
  cancelPendingTransactions() {
    for (const [txHash, txData] of this.pendingTransactions) {
      if (txData.timeoutId) {
        clearTimeout(txData.timeoutId);
      }
      txData.reject(new Error('Transaction cancelled'));
    }
    this.pendingTransactions.clear();
  }

  // Get pending transaction count
  getPendingCount() {
    return this.pendingTransactions.size;
  }

  // Get all pending transactions
  getPendingTransactions() {
    return Array.from(this.pendingTransactions.keys());
  }
}

// React Hook untuk menggunakan transaction monitor
export const useTransactionMonitor = (web3) => {
  const [monitor] = React.useState(() => web3 ? new TransactionMonitor(web3) : null);
  
  React.useEffect(() => {
    return () => {
      if (monitor) {
        monitor.cancelPendingTransactions();
      }
    };
  }, [monitor]);

  return monitor;
};

// Helper functions
export const getErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  
  if (error.message) {
    // Handle common Web3 errors
    if (error.message.includes('User denied')) {
      return 'Transaksi dibatalkan oleh pengguna';
    }
    
    if (error.message.includes('insufficient funds')) {
      return 'Saldo tidak mencukupi untuk gas fee';
    }
    
    if (error.message.includes('gas required exceeds allowance')) {
      return 'Gas limit terlalu rendah';
    }
    
    if (error.message.includes('nonce too low')) {
      return 'Nonce terlalu rendah, coba refresh MetaMask';
    }
    
    if (error.message.includes('timeout')) {
      return 'Transaksi timeout, periksa koneksi Ganache';
    }
    
    if (error.message.includes('revert')) {
      // Extract revert reason if available
      const revertMatch = error.message.match(/revert (.+)/);
      if (revertMatch) {
        return `Contract error: ${revertMatch[1]}`;
      }
      return 'Transaksi ditolak oleh smart contract';
    }
    
    return error.message;
  }
  
  return 'Unknown error occurred';
};

export const formatTransactionHash = (hash, length = 10) => {
  if (!hash) return '';
  if (hash.length <= length) return hash;
  return `${hash.substring(0, length)}...${hash.substring(hash.length - 4)}`;
};

export const getTransactionExplorerUrl = (hash, network = 'ganache') => {
  // For Ganache, we can't use block explorer, but we can format for console
  if (network === 'ganache') {
    return `Transaction: ${hash}`;
  }
  
  // For other networks, return appropriate explorer URL
  const explorers = {
    mainnet: 'https://etherscan.io/tx/',
    goerli: 'https://goerli.etherscan.io/tx/',
    sepolia: 'https://sepolia.etherscan.io/tx/'
  };
  
  return explorers[network] ? `${explorers[network]}${hash}` : hash;
};

export default TransactionMonitor;