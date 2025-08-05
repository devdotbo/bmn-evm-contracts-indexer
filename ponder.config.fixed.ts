/**
 * Fixed Ponder Configuration for BMN EVM Contracts Indexer
 * 
 * This configuration addresses the Etherlink 100-block limit issue by:
 * 1. Implementing a custom block range limiter for factory events
 * 2. Using contract-specific configurations
 * 3. Implementing request interceptors to enforce limits
 * 
 * Solution approach:
 * - Instead of relying on factory pattern, we define explicit contracts
 * - Use interval-based indexing for historical data
 * - Implement custom transport wrapper to enforce block limits
 */

import { createConfig } from "ponder";
import { http, webSocket, fallback, type Transport, type Chain } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BaseEscrowAbi from "./abis/BaseEscrow.json";

// Constants
const FACTORY_ADDRESS = "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1";
const ETHERLINK_BLOCK_LIMIT = 95; // Conservative limit for safety
const BASE_BLOCK_LIMIT = 5000;

/**
 * Create a block-limited transport wrapper
 * This intercepts eth_getLogs requests and enforces block limits
 */
const createBlockLimitedTransport = (
  baseTransport: Transport,
  maxBlockRange: number
): Transport => {
  return (args) => {
    // Intercept the request
    const originalRequest = baseTransport(args);
    
    // Override the request method to check for eth_getLogs
    return {
      ...originalRequest,
      request: async (params) => {
        const { method } = params;
        
        // Check if this is an eth_getLogs request
        if (method === "eth_getLogs") {
          const [filter] = params.params as any[];
          
          if (filter && filter.fromBlock && filter.toBlock) {
            const fromBlock = BigInt(filter.fromBlock);
            const toBlock = BigInt(filter.toBlock);
            const blockRange = Number(toBlock - fromBlock);
            
            // If block range exceeds limit, split the request
            if (blockRange > maxBlockRange) {
              console.warn(
                `Block range ${blockRange} exceeds limit ${maxBlockRange}, splitting request...`
              );
              
              // Split into multiple requests
              const results = [];
              let currentFrom = fromBlock;
              
              while (currentFrom <= toBlock) {
                const currentTo = currentFrom + BigInt(maxBlockRange);
                const adjustedTo = currentTo > toBlock ? toBlock : currentTo;
                
                const subRequest = {
                  ...params,
                  params: [{
                    ...filter,
                    fromBlock: `0x${currentFrom.toString(16)}`,
                    toBlock: `0x${adjustedTo.toString(16)}`
                  }]
                };
                
                const subResult = await originalRequest.request(subRequest);
                if (Array.isArray(subResult)) {
                  results.push(...subResult);
                }
                
                currentFrom = adjustedTo + 1n;
              }
              
              return results;
            }
          }
        }
        
        // For all other requests, pass through normally
        return originalRequest.request(params);
      }
    };
  };
};

/**
 * Create Etherlink transport with strict block limiting
 */
const createEtherlinkTransport = (): Transport => {
  const transports: Transport[] = [];
  
  // Primary: WebSocket with block limiting
  if (process.env.PONDER_WS_URL_42793) {
    const wsTransport = webSocket(process.env.PONDER_WS_URL_42793, {
      keepAlive: {
        interval: 30000,
      },
      reconnect: {
        attempts: 10,
        delay: 2000,
      },
    });
    transports.push(createBlockLimitedTransport(wsTransport, ETHERLINK_BLOCK_LIMIT));
  }
  
  // Fallback: HTTP with block limiting
  const httpUrl = process.env.PONDER_RPC_URL_42793 || "https://node.mainnet.etherlink.com";
  const httpTransport = http(httpUrl, {
    batch: {
      batchSize: 1, // Conservative for Etherlink
      wait: 100,
    },
    retryCount: 3,
    retryDelay: 1000,
    timeout: 30000,
  });
  transports.push(createBlockLimitedTransport(httpTransport, ETHERLINK_BLOCK_LIMIT));
  
  // Return fallback transport
  return transports.length > 1 ? fallback(transports) : transports[0];
};

/**
 * Create Base transport (standard configuration)
 */
const createBaseTransport = (): Transport => {
  const transports: Transport[] = [];
  
  if (process.env.PONDER_WS_URL_8453) {
    transports.push(webSocket(process.env.PONDER_WS_URL_8453));
  }
  
  if (process.env.PONDER_RPC_URL_8453) {
    transports.push(http(process.env.PONDER_RPC_URL_8453));
  }
  
  return transports.length > 1 ? fallback(transports) : transports[0];
};

export default createConfig({
  ordering: "multichain",
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
  chains: {
    base: {
      id: 8453,
      transport: createBaseTransport(),
      multicall: {
        batchSize: 128,
        wait: 16,
      },
      maxHistoricalBlockRange: BASE_BLOCK_LIMIT,
      syncBatchSize: 2000,
    },
    etherlink: {
      id: 42793,
      transport: createEtherlinkTransport(),
      multicall: {
        batchSize: 10,
        wait: 200,
      },
      // Critical: Set conservative limits
      maxHistoricalBlockRange: ETHERLINK_BLOCK_LIMIT,
      syncBatchSize: 50,
      pollInterval: 3000,
      finalityBlockCount: 6,
      maxRequestsPerSecond: 10,
    },
  },
  contracts: {
    // Define the factory contract explicitly for both chains
    CrossChainEscrowFactoryBase: {
      abi: CrossChainEscrowFactoryAbi.abi as any,
      address: FACTORY_ADDRESS,
      chain: "base",
      startBlock: parseInt(process.env.BASE_START_BLOCK || "33726385"),
      // Explicitly set block range for this contract
      maxHistoricalBlockRange: BASE_BLOCK_LIMIT,
    },
    CrossChainEscrowFactoryEtherlink: {
      abi: CrossChainEscrowFactoryAbi.abi as any,
      address: FACTORY_ADDRESS,
      chain: "etherlink",
      startBlock: parseInt(process.env.ETHERLINK_START_BLOCK || "22523319"),
      // Critical: Enforce block limit for factory events
      maxHistoricalBlockRange: ETHERLINK_BLOCK_LIMIT,
      // Additional safety: limit sync batch size
      syncBatchSize: 50,
    },
    // Define escrow contracts without factory pattern
    // This avoids the factory bypass issue
    BaseEscrowBase: {
      abi: BaseEscrowAbi.abi as any,
      chain: "base",
      startBlock: parseInt(process.env.BASE_START_BLOCK || "33726385"),
      // Note: We'll track these dynamically via event handlers
    },
    BaseEscrowEtherlink: {
      abi: BaseEscrowAbi.abi as any,
      chain: "etherlink", 
      startBlock: parseInt(process.env.ETHERLINK_START_BLOCK || "22523319"),
      maxHistoricalBlockRange: ETHERLINK_BLOCK_LIMIT,
    },
  },
  // Alternative approach: Use interval-based indexing
  // This processes blocks in controlled chunks
  intervals: {
    // Process Etherlink factory events in 90-block chunks
    etherlinkFactoryInterval: {
      chain: "etherlink",
      startBlock: parseInt(process.env.ETHERLINK_START_BLOCK || "22523319"),
      blockInterval: 90, // Process every 90 blocks
      handler: "processEtherlinkFactoryEvents",
    },
    // Process Base factory events in larger chunks
    baseFactoryInterval: {
      chain: "base",
      startBlock: parseInt(process.env.BASE_START_BLOCK || "33726385"),
      blockInterval: 1000, // Process every 1000 blocks
      handler: "processBaseFactoryEvents",
    },
  },
});

// Export configuration helpers
export const ETHERLINK_CONFIG = {
  blockLimit: ETHERLINK_BLOCK_LIMIT,
  factoryAddress: FACTORY_ADDRESS,
  startBlock: parseInt(process.env.ETHERLINK_START_BLOCK || "22523319"),
};

export const BASE_CONFIG = {
  blockLimit: BASE_BLOCK_LIMIT,
  factoryAddress: FACTORY_ADDRESS,
  startBlock: parseInt(process.env.BASE_START_BLOCK || "33726385"),
};