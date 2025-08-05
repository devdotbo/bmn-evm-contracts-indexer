import { createConfig } from "ponder";
import { http } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";

// Constants
const FACTORY_ADDRESS = "0x2B2d52Cf0080a01f457A4f64F41cbca500f787b1";

export default createConfig({
  ordering: "multichain",
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
  chains: {
    base: {
      id: 8453,
      rpc: http(process.env.PONDER_RPC_URL_8453, {
        timeout: 10_000, // 10 seconds
      }),
      ws: process.env.PONDER_WS_URL_8453,
    },
    etherlink: {
      id: 42793,
      rpc: http(process.env.PONDER_RPC_URL_42793, {
        timeout: 10_000, // 10 seconds
      }),
      ws: process.env.PONDER_WS_URL_42793,
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
