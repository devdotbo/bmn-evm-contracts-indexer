import { createConfig } from "ponder";
import { http } from "viem";

// Import ABIs
import CrossChainEscrowFactoryV2_2Abi from "./abis/CrossChainEscrowFactoryV2_2.json";
import BmnTokenAbi from "./abis/BmnToken.json";
import SimpleLimitOrderProtocolAbi from "./abis/SimpleLimitOrderProtocol.json";

// Constants
const FACTORY_ADDRESS_V2_2 = "0xB436dBBee1615dd80ff036Af81D8478c1FF1Eb68"; // v2.2.0 with PostInteraction - ACTIVE
const FACTORY_ADDRESS_V2_1 = "0xBc9A20A9FCb7571B2593e85D2533E10e3e9dC61A"; // v2.1.0 - DEPRECATED
const FACTORY_ADDRESS_V1 = "0xB916C3edbFe574fFCBa688A6B92F72106479bD6c"; // v1.1.0 - DEPRECATED
const BMN_TOKEN_ADDRESS = "0x8287CD2aC7E227D9D927F998EB600a0683a832A1";
const LIMIT_ORDER_PROTOCOL_ADDRESS = "0x111111125421ca6dc452d28d826b88f5ccd8c793"; // 1inch SimpleLimitOrderProtocol
const ANKR_API_KEY = process.env.ANKR_API_KEY || "";

const ERPC_URL = process.env.ERPC_URL || "";

export default createConfig({
  ordering: "multichain",
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
  chains: {
    base: {
      id: 8453,
      rpc: http(`https://${ERPC_URL}/main/evm/8453`),
      ws: `wss://rpc.ankr.com/base/ws/${ANKR_API_KEY}`,
    },
    optimism: {
      id: 10,
      rpc: http(`https://${ERPC_URL}/main/evm/10`),
      ws: `wss://rpc.ankr.com/optimism/ws/${ANKR_API_KEY}`,
    },
  },
  contracts: {
    // Track factory v2.2.0 events on both chains (with PostInteraction capability)
    CrossChainEscrowFactoryV2_2: {
      abi: CrossChainEscrowFactoryV2_2Abi.abi as any,
      address: FACTORY_ADDRESS_V2_2,
      chain: {
        base: {
          address: FACTORY_ADDRESS_V2_2,
          startBlock: 33809842, // Keep existing start block from environment
        },
        optimism: {
          address: FACTORY_ADDRESS_V2_2,
          startBlock: 139404873, // Keep existing start block from environment
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
    // Track 1inch SimpleLimitOrderProtocol events on both chains for PostInteraction integration
    SimpleLimitOrderProtocol: {
      abi: SimpleLimitOrderProtocolAbi.abi as any,
      address: LIMIT_ORDER_PROTOCOL_ADDRESS,
      chain: {
        base: {
          address: LIMIT_ORDER_PROTOCOL_ADDRESS,
          startBlock: 33809842, // Align with factory v2.2.0 start block
        },
        optimism: {
          address: LIMIT_ORDER_PROTOCOL_ADDRESS,
          startBlock: 139404873, // Align with factory v2.2.0 start block
        },
      },
    },
  },
});