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
        base: { address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1", startBlock: 33717297 },
        etherlink: { address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1", startBlock: 22511265 },
      },
    },
    BaseEscrow: {
      abi: BaseEscrowAbi.abi,
      chain: {
        base: {startBlock: 33717297},
        etherlink: {startBlock: 22511265},
      },
      factory: {
        chain: {
          base: { factory: "CrossChainEscrowFactory", startBlock: 33717297 },
          etherlink: { factory: "CrossChainEscrowFactory", startBlock: 22511265 },
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
