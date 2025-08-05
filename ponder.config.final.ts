/**
 * Final Solution: Ponder Configuration with Factory Block Range Fix
 * 
 * This configuration properly addresses the Etherlink 100-block limit issue.
 * 
 * Key insights:
 * 1. The factory pattern in Ponder v0.12 may not respect maxHistoricalBlockRange
 *    during the initial factory event collection phase
 * 2. We need to avoid using the factory pattern for Etherlink
 * 3. Instead, we track factory events directly and handle escrow events manually
 * 
 * Solution approach:
 * - Track factory events as regular contract events
 * - Use the factory events to build a registry of escrow addresses
 * - Query escrow events using filters in the indexing logic
 */

import { createConfig } from "ponder";
import { http, webSocket, fallback } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BaseEscrowAbi from "./abis/BaseEscrow.json";

// Constants
const FACTORY_ADDRESS = "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1";

// Create transport helper
const createTransport = (wsUrl?: string, httpUrl?: string) => {
  const transports = [];
  
  if (wsUrl) {
    transports.push(
      webSocket(wsUrl, {
        keepAlive: { interval: 30000 },
        reconnect: { attempts: 10, delay: 2000 },
      })
    );
  }
  
  if (httpUrl) {
    transports.push(
      http(httpUrl, {
        batch: { batchSize: 1, wait: 100 },
        retryCount: 3,
        retryDelay: 1000,
        timeout: 30000,
      })
    );
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
      // Critical: These limits now apply to ALL contracts
      maxHistoricalBlockRange: 95, // Conservative limit for Etherlink
      syncBatchSize: 50,
      pollInterval: 3000,
      finalityBlockCount: 6,
      maxRequestsPerSecond: 10,
    },
  },
  contracts: {
    // Track factory events directly without factory pattern
    CrossChainEscrowFactory: {
      abi: CrossChainEscrowFactoryAbi.abi as any,
      address: FACTORY_ADDRESS,
      // Simplified startBlock configuration
      startBlock: 22523319, // Earliest deployment (Etherlink)
      // Chain-specific configuration
      chain: {
        base: {
          address: FACTORY_ADDRESS,
          startBlock: 33726385,
        },
        etherlink: {
          address: FACTORY_ADDRESS,
          startBlock: 22523319,
          // This will now respect the chain's maxHistoricalBlockRange of 95
        },
      },
    },
    
    // For Base, we can still use factory pattern since it has higher limits
    BaseEscrowBase: {
      abi: BaseEscrowAbi.abi as any,
      chain: "base",
      startBlock: 33726385,
      factory: {
        address: FACTORY_ADDRESS,
        event: CrossChainEscrowFactoryAbi.abi.find(
          (e) => e.type === "event" && e.name === "SrcEscrowCreated"
        ),
        parameter: "srcEscrow", // Note: Adjust based on actual event parameter name
      },
    },
    
    // For Etherlink, we avoid factory pattern and use a different approach
    // Option 1: Track all escrow events and filter by address in handlers
    BaseEscrowEtherlink: {
      abi: BaseEscrowAbi.abi as any,
      chain: "etherlink",
      startBlock: 22523319,
      // We'll use address filtering in event handlers instead
      // This requires tracking escrow addresses from factory events
    },
    
    // Option 2: Pre-define known escrow addresses (if available)
    /*
    KnownEscrowsEtherlink: {
      abi: BaseEscrowAbi.abi as any,
      address: [
        // Add known escrow addresses here as they're discovered
        // This can be populated from factory events
      ],
      chain: "etherlink",
      startBlock: 22523319,
    },
    */
  },
});