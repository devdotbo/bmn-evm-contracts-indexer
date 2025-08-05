/**
 * Alternative Solution: Non-Factory Pattern Configuration
 * 
 * Since Ponder's factory pattern doesn't respect maxHistoricalBlockRange during
 * the initial factory event collection phase, we implement an alternative approach:
 * 
 * 1. Track factory events directly (no factory pattern)
 * 2. Dynamically register escrow contracts as they're discovered
 * 3. Use event handlers to maintain a registry of escrow addresses
 * 
 * This gives us full control over block ranges for ALL queries.
 */

import { createConfig } from "ponder";
import { http, webSocket, fallback } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BaseEscrowAbi from "./abis/BaseEscrow.json";

// Constants
const FACTORY_ADDRESS = "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1";
const ETHERLINK_BLOCK_LIMIT = 95; // Conservative limit for Etherlink

// Helper to create transport
const createTransport = (wsUrl?: string, httpUrl?: string) => {
  const transports = [];
  if (wsUrl) {
    transports.push(webSocket(wsUrl, {
      keepAlive: { interval: 30000 },
      reconnect: { attempts: 10, delay: 2000 },
    }));
  }
  if (httpUrl) {
    transports.push(http(httpUrl, {
      batch: { batchSize: 1, wait: 100 },
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30000,
    }));
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
      transport: createTransport(
        process.env.PONDER_WS_URL_8453,
        process.env.PONDER_RPC_URL_8453
      ),
      multicall: {
        batchSize: 128,
        wait: 16,
      },
      maxHistoricalBlockRange: 5000,
      syncBatchSize: 2000,
    },
    etherlink: {
      id: 42793,
      transport: createTransport(
        process.env.PONDER_WS_URL_42793,
        process.env.PONDER_RPC_URL_42793 || "https://node.mainnet.etherlink.com"
      ),
      multicall: {
        batchSize: 10,
        wait: 200,
      },
      // These limits apply to ALL contract queries now
      maxHistoricalBlockRange: ETHERLINK_BLOCK_LIMIT,
      syncBatchSize: 50,
      pollInterval: 3000,
      finalityBlockCount: 6,
      maxRequestsPerSecond: 10,
    },
  },
  contracts: {
    // Track factory events directly - no factory pattern
    CrossChainEscrowFactory: {
      abi: CrossChainEscrowFactoryAbi.abi as any,
      address: FACTORY_ADDRESS,
      // Chain-specific configuration
      chain: {
        base: {
          address: FACTORY_ADDRESS,
          startBlock: parseInt(process.env.BASE_START_BLOCK || "33726385"),
        },
        etherlink: {
          address: FACTORY_ADDRESS,
          startBlock: parseInt(process.env.ETHERLINK_START_BLOCK || "22523319"),
          // This will now respect the chain's maxHistoricalBlockRange
        },
      },
    },
    
    // Pre-register known escrow contracts if any
    // You can add more as they're discovered
    /*
    KnownEscrows: {
      abi: BaseEscrowAbi.abi as any,
      address: [
        // Add known escrow addresses here
        // "0x...",
      ],
      chain: {
        base: {
          startBlock: parseInt(process.env.BASE_START_BLOCK || "33726385"),
        },
        etherlink: {
          startBlock: parseInt(process.env.ETHERLINK_START_BLOCK || "22523319"),
        },
      },
    },
    */
  },
});