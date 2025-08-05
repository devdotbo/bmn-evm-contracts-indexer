import { createConfig } from "ponder";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BaseEscrowAbi from "./abis/BaseEscrow.json";

export default createConfig({
  ordering: "multichain",
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
  chains: {
    base: {
      id: 8453,
      ws: process.env.PONDER_WS_URL_8453,
      rpc: process.env.PONDER_RPC_URL_8453,
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
      ws: process.env.PONDER_WS_URL_42793,
      rpc: process.env.PONDER_RPC_URL_42793,
      multicall: {
        batchSize: 128,
        wait: 16,
      },
      // Now using private RPC with higher limits
      maxHistoricalBlockRange: 2000,
      syncBatchSize: 1000,
    },
  },
  contracts: {
    CrossChainEscrowFactory: {
      abi: CrossChainEscrowFactoryAbi.abi,
      address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1",
      startBlock: 22523319, // Earliest deployment block (Etherlink)
      chain: {
        base: {
          address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1",
          startBlock: 33726385,
        },
        etherlink: {
          address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1",
          startBlock: 22523319,
        },
      },
    },
    BaseEscrow: {
      abi: BaseEscrowAbi.abi,
      chain: {
        base: { startBlock: 33726385 },
        etherlink: { startBlock: 22523319 },
      },
      factory: {
        chain: {
          base: { factory: "CrossChainEscrowFactory", startBlock: 33726385 },
          etherlink: {
            factory: "CrossChainEscrowFactory",
            startBlock: 22523319,
          },
        },
        event: CrossChainEscrowFactoryAbi.abi.find(
          (e) => e.type === "event" && e.name === "SrcEscrowCreated",
        ),
        // Note: The SrcEscrowCreated event doesn't directly emit the escrow address
        // The escrow address needs to be calculated using CREATE2 or parsed from logs
      },
    },
  },
});
