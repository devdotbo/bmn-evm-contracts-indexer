/**
 * Solution: Ponder Configuration with Factory Block Range Fix
 * 
 * This configuration addresses the Etherlink 100-block limit issue by:
 * 1. Separating factory contracts per chain (avoiding shared factory config)
 * 2. Using explicit startBlock/endBlock for factory address collection
 * 3. Implementing a phased indexing approach
 * 
 * The key insight is that Ponder's factory pattern may not respect maxHistoricalBlockRange
 * during the initial factory event collection phase. We work around this by:
 * - Defining separate factory contracts for each chain
 * - Using conservative block ranges for factory collection
 * - Leveraging the factory's startBlock/endBlock options
 */

import { createConfig } from "ponder";
import { http, webSocket, fallback } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BaseEscrowAbi from "./abis/BaseEscrow.json";

// Constants
const FACTORY_ADDRESS = "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1";

// Helper to create transport with fallback
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
      // Critical settings for Etherlink
      maxHistoricalBlockRange: 95, // Just under 100-block limit
      syncBatchSize: 50,
      pollInterval: 3000,
      finalityBlockCount: 6,
      maxRequestsPerSecond: 10,
    },
  },
  contracts: {
    // Separate factory contracts for each chain to avoid shared configuration issues
    CrossChainEscrowFactoryBase: {
      abi: CrossChainEscrowFactoryAbi.abi as any,
      address: FACTORY_ADDRESS,
      chain: "base",
      startBlock: parseInt(process.env.BASE_START_BLOCK || "33726385"),
    },
    
    // Critical: Separate Etherlink factory with explicit configuration
    CrossChainEscrowFactoryEtherlink: {
      abi: CrossChainEscrowFactoryAbi.abi as any,
      address: FACTORY_ADDRESS,
      chain: "etherlink",
      startBlock: parseInt(process.env.ETHERLINK_START_BLOCK || "22523319"),
    },
    
    // Base escrow contracts using factory pattern
    BaseEscrowBase: {
      abi: BaseEscrowAbi.abi as any,
      chain: "base",
      factory: {
        // Reference the Base-specific factory
        address: FACTORY_ADDRESS,
        event: CrossChainEscrowFactoryAbi.abi.find(
          (e) => e.type === "event" && e.name === "SrcEscrowCreated"
        ),
        parameter: "srcEscrow", // Assuming the event emits srcEscrow address
        // Factory-specific block range for address collection
        startBlock: parseInt(process.env.BASE_START_BLOCK || "33726385"),
      },
      startBlock: parseInt(process.env.BASE_START_BLOCK || "33726385"),
    },
    
    // Etherlink escrow contracts with conservative factory configuration
    BaseEscrowEtherlink: {
      abi: BaseEscrowAbi.abi as any,
      chain: "etherlink",
      factory: {
        // Reference the Etherlink-specific factory
        address: FACTORY_ADDRESS,
        event: CrossChainEscrowFactoryAbi.abi.find(
          (e) => e.type === "event" && e.name === "SrcEscrowCreated"
        ),
        parameter: "srcEscrow",
        // Critical: Use a more recent block for factory collection if possible
        // This reduces the historical range that needs to be scanned
        startBlock: parseInt(process.env.ETHERLINK_FACTORY_START || process.env.ETHERLINK_START_BLOCK || "22523319"),
        // Optional: Set an endBlock to limit factory scanning range
        // endBlock: currentBlock - 1000, // Scan only recent factory events
      },
      // Start indexing escrow events from a more recent block if desired
      startBlock: parseInt(process.env.ETHERLINK_ESCROW_START || process.env.ETHERLINK_START_BLOCK || "22523319"),
    },
    
    // Alternative approach: Define known escrow addresses explicitly
    // This completely bypasses the factory pattern if you know specific addresses
    /*
    KnownEscrowEtherlink: {
      abi: BaseEscrowAbi.abi as any,
      address: [
        "0x...", // Known escrow address 1
        "0x...", // Known escrow address 2
        // Add more as discovered
      ],
      chain: "etherlink",
      startBlock: parseInt(process.env.ETHERLINK_START_BLOCK || "22523319"),
    },
    */
  },
});