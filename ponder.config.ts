import { createConfig } from "ponder";
import { http } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BmnTokenAbi from "./abis/BmnToken.json";
import SimpleLimitOrderProtocolAbi from "./abis/SimpleLimitOrderProtocol.json";

// Constants
const FACTORY_ADDRESS = "0xB916C3edbFe574fFCBa688A6B92F72106479bD6c";
const BMN_TOKEN_ADDRESS = "0x8287CD2aC7E227D9D927F998EB600a0683a832A1";
const LIMIT_ORDER_PROTOCOL_BASE = "0x1c1A74b677A28ff92f4AbF874b3Aa6dE864D3f06";
const LIMIT_ORDER_PROTOCOL_OPTIMISM = "0x44716439C19c2E8BD6E1bCB5556ed4C31dA8cDc7";
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
    // Track BMN token events on both chains
    BmnToken: {
      abi: BmnTokenAbi.abi as any,
      address: BMN_TOKEN_ADDRESS,
      chain: {
        base: {
          address: BMN_TOKEN_ADDRESS,
          startBlock: 33717297, // BMN Token creation block on Base
        },
        optimism: {
          address: BMN_TOKEN_ADDRESS,
          startBlock: 139404696, // BMN Token creation block on Optimism
        },
      },
    },
    // Track SimpleLimitOrderProtocol events on both chains
    SimpleLimitOrderProtocol: {
      abi: SimpleLimitOrderProtocolAbi.abi as any,
      chain: {
        base: {
          address: LIMIT_ORDER_PROTOCOL_BASE,
          startBlock: 33852257, // SimpleLimitOrderProtocol deployment block on Base
        },
        optimism: {
          address: LIMIT_ORDER_PROTOCOL_OPTIMISM,
          startBlock: 139447565, // SimpleLimitOrderProtocol deployment block on Optimism
        },
      },
    },
  },
});