import { createConfig } from "ponder";
import { http } from "viem";

// Import ABIs
import { parseAbi } from "viem";
import humanFactoryV2_3 from "./abis/human/SimplifiedEscrowFactoryV2_3.readable.json" assert { type: "json" };
import humanBmnToken from "./abis/human/BmnToken.readable.json" assert { type: "json" };
import humanSLOP from "./abis/human/SimpleLimitOrderProtocol.readable.json" assert { type: "json" };

// Constants
const FACTORY_ADDRESS_V2_3 = process.env.BMN_FACTORY_ADDRESS || "0xdebE6F4bC7BaAD2266603Ba7AfEB3BB6dDA9FE0A"; // v2.3.0 - ACTIVE
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
    // Track factory v2.3.0 events on both chains
    SimplifiedEscrowFactoryV2_3: {
      abi: parseAbi(humanFactoryV2_3 as unknown as string[]),
      address: FACTORY_ADDRESS_V2_3,
      chain: {
        base: {
          address: FACTORY_ADDRESS_V2_3,
          startBlock: 34110108,
        },
        optimism: {
          address: FACTORY_ADDRESS_V2_3,
          startBlock: 139706679,
        },
      },
    },
    // Track BMN token events on both chains
    BmnToken: {
      abi: parseAbi(humanBmnToken as unknown as string[]),
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
      abi: parseAbi(humanSLOP as unknown as string[]),
      address: LIMIT_ORDER_PROTOCOL_ADDRESS,
      chain: {
        base: {
          address: LIMIT_ORDER_PROTOCOL_ADDRESS,
          startBlock: 34103669, // Align with factory v2.2.0 start block
        },
        optimism: {
          address: LIMIT_ORDER_PROTOCOL_ADDRESS,
          startBlock: 139698379, // Align with factory v2.2.0 start block
        },
      },
    },
  },
});