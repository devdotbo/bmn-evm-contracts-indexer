import { createSchema } from "ponder";

export default createSchema((p) => ({
  // Factory events tracking
  SrcEscrow: p.createTable({
    id: p.string(), // chainId-escrowAddress
    chainId: p.int(),
    escrowAddress: p.string(),
    orderHash: p.hex(),
    hashlock: p.hex(),
    maker: p.string(),
    taker: p.string(),
    srcToken: p.string(),
    srcAmount: p.bigint(),
    srcSafetyDeposit: p.bigint(),
    dstMaker: p.string(),
    dstToken: p.string(),
    dstAmount: p.bigint(),
    dstSafetyDeposit: p.bigint(),
    dstChainId: p.bigint(),
    timelocks: p.bigint(),
    createdAt: p.bigint(),
    blockNumber: p.bigint(),
    transactionHash: p.hex(),
    status: p.string(), // "created", "withdrawn", "cancelled"
  }),

  DstEscrow: p.createTable({
    id: p.string(), // chainId-escrowAddress
    chainId: p.int(),
    escrowAddress: p.string(),
    hashlock: p.hex(),
    taker: p.string(),
    srcCancellationTimestamp: p.bigint(),
    createdAt: p.bigint(),
    blockNumber: p.bigint(),
    transactionHash: p.hex(),
    status: p.string(), // "created", "withdrawn", "cancelled"
  }),

  // Escrow events tracking
  EscrowWithdrawal: p.createTable({
    id: p.string(), // chainId-escrowAddress-transactionHash
    chainId: p.int(),
    escrowAddress: p.string(),
    secret: p.hex(),
    withdrawnAt: p.bigint(),
    blockNumber: p.bigint(),
    transactionHash: p.hex(),
  }),

  EscrowCancellation: p.createTable({
    id: p.string(), // chainId-escrowAddress-transactionHash
    chainId: p.int(),
    escrowAddress: p.string(),
    cancelledAt: p.bigint(),
    blockNumber: p.bigint(),
    transactionHash: p.hex(),
  }),

  FundsRescued: p.createTable({
    id: p.string(), // chainId-escrowAddress-transactionHash-logIndex
    chainId: p.int(),
    escrowAddress: p.string(),
    token: p.string(),
    amount: p.bigint(),
    rescuedAt: p.bigint(),
    blockNumber: p.bigint(),
    transactionHash: p.hex(),
    logIndex: p.int(),
  }),

  // Cross-chain atomic swap tracking
  AtomicSwap: p.createTable({
    id: p.string(), // orderHash
    orderHash: p.hex(),
    hashlock: p.hex(),
    srcChainId: p.int(),
    dstChainId: p.int(),
    srcEscrowAddress: p.string().optional(),
    dstEscrowAddress: p.string().optional(),
    srcMaker: p.string(),
    srcTaker: p.string(),
    dstMaker: p.string(),
    dstTaker: p.string(),
    srcToken: p.string(),
    srcAmount: p.bigint(),
    dstToken: p.string(),
    dstAmount: p.bigint(),
    srcSafetyDeposit: p.bigint(),
    dstSafetyDeposit: p.bigint(),
    timelocks: p.bigint(),
    status: p.string(), // "pending", "src_created", "dst_created", "completed", "cancelled"
    srcCreatedAt: p.bigint().optional(),
    dstCreatedAt: p.bigint().optional(),
    completedAt: p.bigint().optional(),
    cancelledAt: p.bigint().optional(),
    secret: p.hex().optional(),
  }),

  // Statistics and aggregations
  ChainStatistics: p.createTable({
    id: p.string(), // chainId
    chainId: p.int(),
    totalSrcEscrows: p.bigint(),
    totalDstEscrows: p.bigint(),
    totalWithdrawals: p.bigint(),
    totalCancellations: p.bigint(),
    totalVolumeLocked: p.bigint(),
    totalVolumeWithdrawn: p.bigint(),
    lastUpdatedBlock: p.bigint(),
  }),
}));
