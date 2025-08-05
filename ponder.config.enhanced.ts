import { createConfig } from "ponder";
import { http, webSocket, fallback } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BaseEscrowAbi from "./abis/BaseEscrow.json";

// Constants
const FACTORY_ADDRESS = "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1";

// Feature flag for enhanced events (default to false until contracts are deployed)
const USE_ENHANCED_EVENTS = process.env.USE_ENHANCED_EVENTS === "true";

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
    // This configuration expects the enhanced events that emit escrow addresses directly
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
        },
      },
    },
    
    // With enhanced events, we can use factory pattern for BOTH chains
    // since the escrow address is emitted directly in the events
    BaseEscrowBase: {
      abi: BaseEscrowAbi.abi as any,
      chain: "base",
      startBlock: 33726385,
      factory: USE_ENHANCED_EVENTS ? {
        address: FACTORY_ADDRESS,
        event: {
          type: "event",
          name: "SrcEscrowCreated",
          inputs: [
            {
              name: "escrow",
              type: "address",
              indexed: true,
              internalType: "address"
            },
            {
              name: "srcImmutables",
              type: "tuple",
              indexed: false,
              internalType: "struct IBaseEscrow.Immutables",
              components: [
                {
                  name: "orderHash",
                  type: "bytes32",
                  internalType: "bytes32"
                },
                {
                  name: "hashlock",
                  type: "bytes32",
                  internalType: "bytes32"
                },
                {
                  name: "maker",
                  type: "uint256",
                  internalType: "Address"
                },
                {
                  name: "taker",
                  type: "uint256",
                  internalType: "Address"
                },
                {
                  name: "token",
                  type: "uint256",
                  internalType: "Address"
                },
                {
                  name: "amount",
                  type: "uint256",
                  internalType: "uint256"
                },
                {
                  name: "safetyDeposit",
                  type: "uint256",
                  internalType: "uint256"
                },
                {
                  name: "timelocks",
                  type: "uint256",
                  internalType: "Timelocks"
                }
              ]
            },
            {
              name: "dstImmutablesComplement",
              type: "tuple",
              indexed: false,
              internalType: "struct IEscrowFactory.DstImmutablesComplement",
              components: [
                {
                  name: "maker",
                  type: "uint256",
                  internalType: "Address"
                },
                {
                  name: "amount",
                  type: "uint256",
                  internalType: "uint256"
                },
                {
                  name: "token",
                  type: "uint256",
                  internalType: "Address"
                },
                {
                  name: "safetyDeposit",
                  type: "uint256",
                  internalType: "uint256"
                },
                {
                  name: "chainId",
                  type: "uint256",
                  internalType: "uint256"
                }
              ]
            }
          ],
          anonymous: false
        },
        parameter: "escrow", // The escrow address is now directly available as the first parameter!
      } : {
        // Fallback to old factory pattern for Base (still works due to higher limits)
        address: FACTORY_ADDRESS,
        event: CrossChainEscrowFactoryAbi.abi.find(
          (e) => e.type === "event" && e.name === "SrcEscrowCreated",
        ),
        // Note: The SrcEscrowCreated event doesn't directly emit the escrow address
        // The escrow address needs to be calculated using CREATE2 or parsed from logs
      },
    },
    
    // With enhanced events, Etherlink can also use factory pattern!
    BaseEscrowEtherlink: {
      abi: BaseEscrowAbi.abi as any,
      chain: "etherlink",
      startBlock: 22523319,
      factory: USE_ENHANCED_EVENTS ? {
        address: FACTORY_ADDRESS,
        event: {
          type: "event",
          name: "SrcEscrowCreated",
          inputs: [
            {
              name: "escrow",
              type: "address",
              indexed: true,
              internalType: "address"
            },
            {
              name: "srcImmutables",
              type: "tuple",
              indexed: false,
              internalType: "struct IBaseEscrow.Immutables",
              components: [
                {
                  name: "orderHash",
                  type: "bytes32",
                  internalType: "bytes32"
                },
                {
                  name: "hashlock",
                  type: "bytes32",
                  internalType: "bytes32"
                },
                {
                  name: "maker",
                  type: "uint256",
                  internalType: "Address"
                },
                {
                  name: "taker",
                  type: "uint256",
                  internalType: "Address"
                },
                {
                  name: "token",
                  type: "uint256",
                  internalType: "Address"
                },
                {
                  name: "amount",
                  type: "uint256",
                  internalType: "uint256"
                },
                {
                  name: "safetyDeposit",
                  type: "uint256",
                  internalType: "uint256"
                },
                {
                  name: "timelocks",
                  type: "uint256",
                  internalType: "Timelocks"
                }
              ]
            },
            {
              name: "dstImmutablesComplement",
              type: "tuple",
              indexed: false,
              internalType: "struct IEscrowFactory.DstImmutablesComplement",
              components: [
                {
                  name: "maker",
                  type: "uint256",
                  internalType: "Address"
                },
                {
                  name: "amount",
                  type: "uint256",
                  internalType: "uint256"
                },
                {
                  name: "token",
                  type: "uint256",
                  internalType: "Address"
                },
                {
                  name: "safetyDeposit",
                  type: "uint256",
                  internalType: "uint256"
                },
                {
                  name: "chainId",
                  type: "uint256",
                  internalType: "uint256"
                }
              ]
            }
          ],
          anonymous: false
        },
        parameter: "escrow", // The escrow address is now directly available!
      } : undefined, // No factory pattern in legacy mode for Etherlink due to block limits
    },
    
    // Destination escrow tracking for both chains
    DstEscrowBase: USE_ENHANCED_EVENTS ? {
      abi: BaseEscrowAbi.abi as any,
      chain: "base",
      startBlock: 33726385,
      factory: {
        address: FACTORY_ADDRESS,
        event: {
          type: "event",
          name: "DstEscrowCreated",
          inputs: [
            {
              name: "escrow",
              type: "address",
              indexed: true,
              internalType: "address"
            },
            {
              name: "hashlock",
              type: "bytes32",
              indexed: false,
              internalType: "bytes32"
            },
            {
              name: "taker",
              type: "uint256",
              indexed: false,
              internalType: "Address"
            }
          ],
          anonymous: false
        },
        parameter: "escrow", // Direct escrow address parameter
      },
    } : undefined,
    
    DstEscrowEtherlink: USE_ENHANCED_EVENTS ? {
      abi: BaseEscrowAbi.abi as any,
      chain: "etherlink",
      startBlock: 22523319,
      factory: {
        address: FACTORY_ADDRESS,
        event: {
          type: "event",
          name: "DstEscrowCreated",
          inputs: [
            {
              name: "escrow",
              type: "address",
              indexed: true,
              internalType: "address"
            },
            {
              name: "hashlock",
              type: "bytes32",
              indexed: false,
              internalType: "bytes32"
            },
            {
              name: "taker",
              type: "uint256",
              indexed: false,
              internalType: "Address"
            }
          ],
          anonymous: false
        },
        parameter: "escrow", // Direct escrow address parameter
      },
    } : undefined,
  },
});