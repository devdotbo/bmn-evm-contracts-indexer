import { createConfig, factory } from "ponder";
import { http, webSocket } from "viem";
import { parseAbiItem } from "viem";

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
      includeTransactionReceipts: true, // Enable to parse BaseEscrow events from SrcEscrows
      network: {
        base: {
          startBlock: Number(process.env.BASE_START_BLOCK || 0),
        },
        etherlink: {
          startBlock: Number(process.env.ETHERLINK_START_BLOCK || 0),
        },
      },
    },
    // DstEscrow contracts created by the factory
    // Note: Only DstEscrowCreated event directly emits the escrow address
    DstEscrow: {
      abi: BaseEscrowAbi.abi,
      address: factory({
        // The factory contract address
        address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1",
        // DstEscrowCreated event contains the escrow address as first parameter
        event: parseAbiItem("event DstEscrowCreated(address escrow, bytes32 hashlock, uint256 taker)"),
        // The parameter containing the child address
        parameter: "escrow",
      }),
      network: {
        base: {
          startBlock: Number(process.env.BASE_START_BLOCK || 0),
        },
        etherlink: {
          startBlock: Number(process.env.ETHERLINK_START_BLOCK || 0),
        },
      },
    },
    // For SrcEscrow contracts, we cannot use the factory pattern directly
    // because SrcEscrowCreated doesn't emit the escrow address.
    // Instead, we'll calculate addresses in the indexing functions and
    // handle BaseEscrow events through transaction receipt parsing or
    // by maintaining a registry of known escrow addresses.
  },
});