import { ponder } from "ponder:registry";
import { 
  srcEscrow, 
  dstEscrow, 
  escrowWithdrawal, 
  escrowCancellation, 
  fundsRescued, 
  atomicSwap,
  chainStatistics 
} from "ponder:schema";

// Helper function to decode packed address from uint256
function decodeAddress(packedAddress: bigint): string {
  // Extract the lower 160 bits (20 bytes) which contain the address
  const address = packedAddress & ((1n << 160n) - 1n);
  return `0x${address.toString(16).padStart(40, '0')}`;
}

// Handle SrcEscrowCreated events from Factory
ponder.on("CrossChainEscrowFactory:SrcEscrowCreated", async ({ event, context }) => {
  const chainId = context.network.chainId;
  const { srcImmutables, dstImmutablesComplement } = event.args;
  
  // For now, we'll use a placeholder for escrow address
  // In production, you might want to parse transaction logs or use CREATE2 calculation
  const escrowAddress = "0x" + event.transaction.hash.slice(-40); // Placeholder
  
  const id = `${chainId}-${escrowAddress}`;
  
  // Insert SrcEscrow record
  await context.db.insert(srcEscrow).values({
    id,
    chainId,
    escrowAddress,
    orderHash: srcImmutables.orderHash,
    hashlock: srcImmutables.hashlock,
    maker: decodeAddress(srcImmutables.maker),
    taker: decodeAddress(srcImmutables.taker),
    srcToken: decodeAddress(srcImmutables.token),
    srcAmount: srcImmutables.amount,
    srcSafetyDeposit: srcImmutables.safetyDeposit,
    dstMaker: decodeAddress(dstImmutablesComplement.maker),
    dstToken: decodeAddress(dstImmutablesComplement.token),
    dstAmount: dstImmutablesComplement.amount,
    dstSafetyDeposit: dstImmutablesComplement.safetyDeposit,
    dstChainId: dstImmutablesComplement.chainId,
    timelocks: srcImmutables.timelocks,
    createdAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    status: "created",
  });
  
  // Create or update AtomicSwap record
  await context.db
    .insert(atomicSwap)
    .values({
      id: srcImmutables.orderHash,
      orderHash: srcImmutables.orderHash,
      hashlock: srcImmutables.hashlock,
      srcChainId: chainId,
      dstChainId: Number(dstImmutablesComplement.chainId),
      srcEscrowAddress: escrowAddress,
      srcMaker: decodeAddress(srcImmutables.maker),
      srcTaker: decodeAddress(srcImmutables.taker),
      dstMaker: decodeAddress(dstImmutablesComplement.maker),
      dstTaker: decodeAddress(srcImmutables.taker), // Assuming same taker on both chains
      srcToken: decodeAddress(srcImmutables.token),
      srcAmount: srcImmutables.amount,
      dstToken: decodeAddress(dstImmutablesComplement.token),
      dstAmount: dstImmutablesComplement.amount,
      srcSafetyDeposit: srcImmutables.safetyDeposit,
      dstSafetyDeposit: dstImmutablesComplement.safetyDeposit,
      timelocks: srcImmutables.timelocks,
      status: "src_created",
      srcCreatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      srcChainId: chainId,
      srcEscrowAddress: escrowAddress,
      status: "src_created",
      srcCreatedAt: event.block.timestamp,
    }));
  
  // Update chain statistics
  await context.db
    .insert(chainStatistics)
    .values({
      id: chainId.toString(),
      chainId: chainId,
      totalSrcEscrows: 1n,
      totalDstEscrows: 0n,
      totalWithdrawals: 0n,
      totalCancellations: 0n,
      totalVolumeLocked: srcImmutables.amount,
      totalVolumeWithdrawn: 0n,
      lastUpdatedBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      totalSrcEscrows: row.totalSrcEscrows + 1n,
      totalVolumeLocked: row.totalVolumeLocked + srcImmutables.amount,
      lastUpdatedBlock: event.block.number,
    }));
});

// Handle DstEscrowCreated events from Factory
ponder.on("CrossChainEscrowFactory:DstEscrowCreated", async ({ event, context }) => {
  const chainId = context.network.chainId;
  const { escrow, hashlock, taker } = event.args;
  
  const id = `${chainId}-${escrow}`;
  
  // Insert DstEscrow record
  await context.db.insert(dstEscrow).values({
    id,
    chainId,
    escrowAddress: escrow,
    hashlock,
    taker: decodeAddress(taker),
    srcCancellationTimestamp: 0n, // Will be set when we have more info
    createdAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    status: "created",
  });
  
  // Update AtomicSwap record if it exists
  await context.db
    .insert(atomicSwap)
    .values({
      id: hashlock, // Using hashlock as ID since we might not have orderHash yet
      orderHash: hashlock, // Placeholder
      hashlock,
      srcChainId: 0, // Will be updated when we have the full info
      dstChainId: chainId,
      dstEscrowAddress: escrow,
      srcMaker: "", // Will be filled later
      srcTaker: "",
      dstMaker: "",
      dstTaker: decodeAddress(taker),
      srcToken: "",
      srcAmount: 0n,
      dstToken: "",
      dstAmount: 0n,
      srcSafetyDeposit: 0n,
      dstSafetyDeposit: 0n,
      timelocks: 0n,
      status: "dst_created",
      dstCreatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      dstChainId: chainId,
      dstEscrowAddress: escrow,
      status: row.status === "src_created" ? "dst_created" : row.status,
      dstCreatedAt: event.block.timestamp,
    }));
  
  // Update chain statistics
  await context.db
    .insert(chainStatistics)
    .values({
      id: chainId.toString(),
      chainId: chainId,
      totalSrcEscrows: 0n,
      totalDstEscrows: 1n,
      totalWithdrawals: 0n,
      totalCancellations: 0n,
      totalVolumeLocked: 0n,
      totalVolumeWithdrawn: 0n,
      lastUpdatedBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      totalDstEscrows: row.totalDstEscrows + 1n,
      lastUpdatedBlock: event.block.number,
    }));
});

// Handle EscrowWithdrawal events
ponder.on("BaseEscrow:EscrowWithdrawal", async ({ event, context }) => {
  const chainId = context.network.chainId;
  const escrowAddress = event.log.address;
  const { secret } = event.args;
  
  const id = `${chainId}-${escrowAddress}-${event.transaction.hash}`;
  
  // Insert withdrawal record
  await context.db.insert(escrowWithdrawal).values({
    id,
    chainId,
    escrowAddress,
    secret,
    withdrawnAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
  
  // Update escrow status
  const srcEscrowId = `${chainId}-${escrowAddress}`;
  const srcEscrowRecord = await context.db.find(srcEscrow, { 
    id: srcEscrowId 
  });
  
  if (srcEscrowRecord) {
    await context.db
      .update(srcEscrow, { id: srcEscrowId })
      .set({ status: "withdrawn" });
    
    // Update AtomicSwap
    await context.db
      .update(atomicSwap, { orderHash: srcEscrowRecord.orderHash })
      .set({
        status: "completed",
        completedAt: event.block.timestamp,
        secret,
      });
    
    // Update statistics
    await context.db
      .update(chainStatistics, { id: chainId.toString() })
      .set((row) => ({
        totalWithdrawals: row.totalWithdrawals + 1n,
        totalVolumeWithdrawn: row.totalVolumeWithdrawn + srcEscrowRecord.srcAmount,
        lastUpdatedBlock: event.block.number,
      }));
  } else {
    // Check if it's a DstEscrow
    const dstEscrowId = `${chainId}-${escrowAddress}`;
    const dstEscrowRecord = await context.db.find(dstEscrow, { 
      id: dstEscrowId 
    });
    
    if (dstEscrowRecord) {
      await context.db
        .update(dstEscrow, { id: dstEscrowId })
        .set({ status: "withdrawn" });
      
      // Update statistics
      await context.db
        .update(chainStatistics, { id: chainId.toString() })
        .set((row) => ({
          totalWithdrawals: row.totalWithdrawals + 1n,
          lastUpdatedBlock: event.block.number,
        }));
    }
  }
});

// Handle EscrowCancelled events
ponder.on("BaseEscrow:EscrowCancelled", async ({ event, context }) => {
  const chainId = context.network.chainId;
  const escrowAddress = event.log.address;
  
  const id = `${chainId}-${escrowAddress}-${event.transaction.hash}`;
  
  // Insert cancellation record
  await context.db.insert(escrowCancellation).values({
    id,
    chainId,
    escrowAddress,
    cancelledAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
  
  // Update escrow status
  const srcEscrowId = `${chainId}-${escrowAddress}`;
  const srcEscrowRecord = await context.db.find(srcEscrow, { 
    id: srcEscrowId 
  });
  
  if (srcEscrowRecord) {
    await context.db
      .update(srcEscrow, { id: srcEscrowId })
      .set({ status: "cancelled" });
    
    // Update AtomicSwap
    await context.db
      .update(atomicSwap, { orderHash: srcEscrowRecord.orderHash })
      .set({
        status: "cancelled",
        cancelledAt: event.block.timestamp,
      });
  } else {
    // Check if it's a DstEscrow
    const dstEscrowId = `${chainId}-${escrowAddress}`;
    const dstEscrowRecord = await context.db.find(dstEscrow, { 
      id: dstEscrowId 
    });
    
    if (dstEscrowRecord) {
      await context.db
        .update(dstEscrow, { id: dstEscrowId })
        .set({ status: "cancelled" });
    }
  }
  
  // Update statistics
  await context.db
    .update(chainStatistics, { id: chainId.toString() })
    .set((row) => ({
      totalCancellations: row.totalCancellations + 1n,
      lastUpdatedBlock: event.block.number,
    }));
});

// Handle FundsRescued events
ponder.on("BaseEscrow:FundsRescued", async ({ event, context }) => {
  const chainId = context.network.chainId;
  const escrowAddress = event.log.address;
  const { token, amount } = event.args;
  
  const id = `${chainId}-${escrowAddress}-${event.transaction.hash}-${event.log.logIndex}`;
  
  // Insert funds rescued record
  await context.db.insert(fundsRescued).values({
    id,
    chainId,
    escrowAddress,
    token,
    amount,
    rescuedAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex || 0,
  });
  
  // Update statistics
  await context.db
    .update(chainStatistics, { id: chainId.toString() })
    .set((row) => ({
      lastUpdatedBlock: event.block.number,
    }));
});