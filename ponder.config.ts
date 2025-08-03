import { createConfig } from "ponder";
import { http, webSocket } from "viem";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BaseEscrowAbi from "./abis/BaseEscrow.json";

export default createConfig({
  networks: {
    base: {
      chainId: 8453,
      transport: webSocket(process.env.PONDER_WS_URL_8453, {
        fallback: http(process.env.PONDER_RPC_URL_8453),
      }),
    },
    etherlink: {
      chainId: 42793,
      transport: webSocket(process.env.PONDER_WS_URL_42793, {
        fallback: http(process.env.PONDER_RPC_URL_42793),
      }),
    },
  },
  contracts: {
    CrossChainEscrowFactory: {
      abi: CrossChainEscrowFactoryAbi.abi,
      address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1",
      network: {
        base: {
          startBlock: Number(process.env.BASE_START_BLOCK || 0),
        },
        etherlink: {
          startBlock: Number(process.env.ETHERLINK_START_BLOCK || 0),
        },
      },
    },
  },
});