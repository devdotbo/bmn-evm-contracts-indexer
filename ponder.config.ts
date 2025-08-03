import { createConfig } from "ponder";

// Import ABIs
import CrossChainEscrowFactoryAbi from "./abis/CrossChainEscrowFactory.json";
import BaseEscrowAbi from "./abis/BaseEscrow.json";

export default createConfig({
  ordering: "multichain",
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453,
      ws: process.env.PONDER_WS_URL_8453,
    },
    etherlink: {
      id: 42793,
      rpc: process.env.PONDER_RPC_URL_42793,
      ws: process.env.PONDER_WS_URL_42793,
    },
  },
  contracts: {
    CrossChainEscrowFactory: {
      abi: CrossChainEscrowFactoryAbi.abi,
      address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1",
      startBlock: "latest",
      chain: {
        base: { address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1" },
        etherlink: { address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1" },
      },
    },
    BaseEscrow: {
      abi: BaseEscrowAbi.abi,
      factory: {
        chain: {
          base: { factory: "CrossChainEscrowFactory" },
          etherlink: { factory: "CrossChainEscrowFactory" },
        },
        event: CrossChainEscrowFactoryAbi.abi.find(
          (e) => e.type === "event" && e.name === "SrcEscrowCreated"
        ),
        parameter: "escrow",
      },
    },
  },
});