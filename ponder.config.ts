import { createConfig } from "ponder";
import { http } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";

// Constants
const FACTORY_ADDRESS = "0xB916C3edbFe574fFCBa688A6B92F72106479bD6c";
const ANKR_API_KEY = process.env.ANKR_API_KEY || "";

export default createConfig({
  ordering: "multichain",
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
  chains: {
    base: {
      id: 8453,
      rpc: http(`https://rpc.ankr.com/base/${ANKR_API_KEY}`),
      ws: `wss://rpc.ankr.com/base/ws/${ANKR_API_KEY}`,
    },
    optimism: {
      id: 10,
      rpc: http(`https://rpc.ankr.com/optimism/${ANKR_API_KEY}`),
      ws: `wss://rpc.ankr.com/optimism/ws/${ANKR_API_KEY}`,
    },
  },
  contracts: {
    // Track factory events on both chains
    CrossChainEscrowFactory: {
      abi: CrossChainEscrowFactoryAbi.abi as any,
      address: FACTORY_ADDRESS,
      chain: {
        base: {
          address: FACTORY_ADDRESS,
          startBlock: 33809842,
        },
        optimism: {
          address: FACTORY_ADDRESS,
          startBlock: 139404873,
        },
      },
    },
  },
});