import { createConfig } from "ponder";
import { http, webSocket, fallback } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BaseEscrowAbi from "./abis/BaseEscrow.json";

// Constants
const FACTORY_ADDRESS = "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1";

// Create multi-RPC transport with load balancing and fallback
const createEtherlinkTransport = () => {
  const transports = [];
  
  // Priority 1: WebSocket connections (fastest)
  if (process.env.PONDER_WS_URL_42793) {
    transports.push(
      webSocket(process.env.PONDER_WS_URL_42793, {
        keepAlive: { interval: 30000 },
        reconnect: { attempts: 10, delay: 2000 },
      })
    );
  }
  
  // Priority 2: Premium endpoints
  if (process.env.THIRDWEB_API_KEY) {
    transports.push(
      http(`https://42793.rpc.thirdweb.com/${process.env.THIRDWEB_API_KEY}`, {
        batch: { batchSize: 10, wait: 100 },
        retryCount: 3,
        retryDelay: 1000,
        timeout: 30000,
      })
    );
  }
  
  // Priority 3: Ankr (if API key provided)
  if (process.env.ANKR_API_KEY) {
    transports.push(
      http(`https://rpc.ankr.com/etherlink_mainnet/${process.env.ANKR_API_KEY}`, {
        batch: { batchSize: 5, wait: 200 },
        retryCount: 3,
        retryDelay: 1500,
        timeout: 30000,
      })
    );
  }
  
  // Priority 4: Public endpoints
  transports.push(
    http("https://node.mainnet.etherlink.com", {
      batch: { batchSize: 1, wait: 1000 },
      retryCount: 2,
      retryDelay: 2000,
      timeout: 30000,
    })
  );
  
  // Priority 5: Zeeve (currently disabled - connection issues)
  // if (process.env.ZEEVE_RPC_URL) {
  //   transports.push(
  //     http(process.env.ZEEVE_RPC_URL, {
  //       batch: { batchSize: 1, wait: 500 },
  //       retryCount: 2,
  //       retryDelay: 2000,
  //       timeout: 30000,
  //     })
  //   );
  // }
  
  // Priority 6: Fallback Ankr public
  transports.push(
    http("https://rpc.ankr.com/etherlink_mainnet", {
      batch: { batchSize: 1, wait: 500 },
      retryCount: 2,
      retryDelay: 2000,
      timeout: 30000,
    })
  );
  
  return fallback(transports);
};

// Create Base transport
const createBaseTransport = () => {
  const transports = [];
  
  if (process.env.PONDER_WS_URL_8453) {
    transports.push(
      webSocket(process.env.PONDER_WS_URL_8453, {
        keepAlive: { interval: 10000 },
        reconnect: { attempts: 5, delay: 1000 },
      })
    );
  }
  
  if (process.env.PONDER_RPC_URL_8453) {
    transports.push(
      http(process.env.PONDER_RPC_URL_8453, {
        batch: { batchSize: 100, wait: 16 },
        retryCount: 3,
        retryDelay: 1000,
      })
    );
  }
  
  return transports.length > 1 ? fallback(transports) : transports[0];
};

// Feature flag for enhanced events (default to false until contracts are deployed)
const USE_ENHANCED_EVENTS = process.env.USE_ENHANCED_EVENTS === "true";

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
      // Base has good RPC limits
      maxHistoricalBlockRange: 5000,
      syncBatchSize: 2000,
    },
    etherlink: {
      id: 42793,
      transport: createEtherlinkTransport(),
      multicall: {
        batchSize: 10,
        wait: 200,
      },
      // Critical: Conservative limits for Etherlink's strict 100-block limit
      maxHistoricalBlockRange: 95, // Stay under 100-block limit
      syncBatchSize: 45,
      pollInterval: 3000,
      finalityBlockCount: 6,
      maxRequestsPerSecond: 10,
    },
  },
  contracts: {
    // Track factory events directly without factory pattern for both chains
    CrossChainEscrowFactory: {
      abi: CrossChainEscrowFactoryAbi.abi as any,
      address: FACTORY_ADDRESS,
      startBlock: 22523319, // Earliest deployment (Etherlink)
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
    
    // For Base, we can use factory pattern since it has higher limits
    BaseEscrowBase: {
      abi: BaseEscrowAbi.abi as any,
      chain: "base",
      startBlock: 33726385,
      factory: {
        address: FACTORY_ADDRESS,
        event: CrossChainEscrowFactoryAbi.abi.find(
          (e) => e.type === "event" && e.name === "SrcEscrowCreated",
        ),
        // Note: The SrcEscrowCreated event doesn't directly emit the escrow address
        // The escrow address needs to be calculated using CREATE2 or parsed from logs
      },
    },
    
    // For Etherlink, avoid factory pattern to ensure block range limits are respected
    // We'll track escrow addresses from factory events and filter in handlers
    BaseEscrowEtherlink: {
      abi: BaseEscrowAbi.abi as any,
      chain: "etherlink",
      startBlock: 22523319,
      // No factory pattern - we'll use address filtering in event handlers
      // This ensures all queries respect the 95-block limit
    },
  },
});