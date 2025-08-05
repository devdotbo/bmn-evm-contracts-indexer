import { createConfig } from "ponder";
import { http, webSocket, fallback } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BaseEscrowAbi from "./abis/BaseEscrow.json";

// Constants
const FACTORY_ADDRESS = "0x2B2d52Cf0080a01f457A4f64F41cbca500f787b1";

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
  
  // Priority 5: Fallback Ankr public
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
    },
    etherlink: {
      id: 42793,
      transport: createEtherlinkTransport(),
    },
  },
  contracts: {
    // Track factory events on both chains - enhanced events emit addresses directly
    CrossChainEscrowFactory: {
      abi: CrossChainEscrowFactoryAbi.abi as any,
      address: FACTORY_ADDRESS,
      chain: {
        base: {
          address: FACTORY_ADDRESS,
          startBlock: 33726385,
        },
        etherlink: {
          address: FACTORY_ADDRESS,
          startBlock: 22523319,
        },
      },
    },
    
  },
});