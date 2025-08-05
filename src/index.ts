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

// Helper function to find AtomicSwap by hashlock
async function findAtomicSwapByHashlock(context: any, hashlock: string) {
  const swaps = await context.db
    .select(atomicSwap, { 
      where: (row) => row.hashlock === hashlock 
    });
  return swaps.length > 0 ? swaps[0] : null;
}

// Constants for escrow implementations (same across all chains)
const SRC_IMPLEMENTATION = "0x77CC1A51dC5855bcF0d9f1c1FceaeE7fb855a535";
const DST_IMPLEMENTATION = "0x36938b7899A17362520AA741C0E0dA0c8EfE5e3b";
const FACTORY_ADDRESS = "0x2B2d52Cf0080a01f457A4f64F41cbca500f787b1";

// Handle SrcEscrowCreated events from Factory
ponder.on("CrossChainEscrowFactory:SrcEscrowCreated", async ({ event, context }) => {
  const chainId = context.chain.id;
  
  // Enhanced events emit the escrow address directly
  const { escrow: escrowAddress, srcImmutables, dstImmutablesComplement } = event.args;
  
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
  
  // Check if a temporary AtomicSwap exists with this hashlock
  const tempSwap = await context.db.find(atomicSwap, { 
    id: `temp-${srcImmutables.hashlock}`
  });
  
  if (tempSwap) {
    // Delete temporary record and create proper one
    await context.db.delete(atomicSwap, { id: tempSwap.id });
    
    // Create proper AtomicSwap record with all data
    await context.db
      .insert(atomicSwap)
      .values({
        id: srcImmutables.orderHash,
        orderHash: srcImmutables.orderHash,
        hashlock: srcImmutables.hashlock,
        srcChainId: chainId,
        dstChainId: tempSwap.dstChainId || Number(dstImmutablesComplement.chainId),
        srcEscrowAddress: escrowAddress,
        dstEscrowAddress: tempSwap.dstEscrowAddress,
        srcMaker: decodeAddress(srcImmutables.maker),
        srcTaker: decodeAddress(srcImmutables.taker),
        dstMaker: decodeAddress(dstImmutablesComplement.maker),
        dstTaker: tempSwap.dstTaker || decodeAddress(srcImmutables.taker),
        srcToken: decodeAddress(srcImmutables.token),
        srcAmount: srcImmutables.amount,
        dstToken: decodeAddress(dstImmutablesComplement.token),
        dstAmount: dstImmutablesComplement.amount,
        srcSafetyDeposit: srcImmutables.safetyDeposit,
        dstSafetyDeposit: dstImmutablesComplement.safetyDeposit,
        timelocks: srcImmutables.timelocks,
        status: tempSwap.dstEscrowAddress ? "both_created" : "src_created",
        srcCreatedAt: event.block.timestamp,
        dstCreatedAt: tempSwap.dstCreatedAt,
      });
  } else {
    // Create or update AtomicSwap record normally
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
        srcMaker: decodeAddress(srcImmutables.maker),
        srcTaker: decodeAddress(srcImmutables.taker),
        srcToken: decodeAddress(srcImmutables.token),
        srcAmount: srcImmutables.amount,
        srcSafetyDeposit: srcImmutables.safetyDeposit,
        status: row.dstEscrowAddress ? "both_created" : "src_created",
        srcCreatedAt: event.block.timestamp,
      }));
  }
  
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
  const chainId = context.chain.id;
  
  // Both legacy and enhanced events have the same structure for DstEscrowCreated
  // The only difference is that enhanced version has indexed escrow address
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
  
  // First check if an AtomicSwap exists with this hashlock
  const existingSwap = await findAtomicSwapByHashlock(context, hashlock);
  
  if (existingSwap) {
    // Update existing AtomicSwap record
    await context.db
      .update(atomicSwap, { id: existingSwap.id })
      .set({
        dstChainId: chainId,
        dstEscrowAddress: escrow,
        dstTaker: decodeAddress(taker),
        status: existingSwap.status === "src_created" ? "both_created" : "dst_created",
        dstCreatedAt: event.block.timestamp,
      });
  } else {
    // Create a temporary AtomicSwap record using hashlock
    // This will be merged when SrcEscrowCreated is processed
    console.warn(`Creating temporary AtomicSwap for hashlock ${hashlock} - waiting for SrcEscrowCreated`);
    await context.db
      .insert(atomicSwap)
      .values({
        id: `temp-${hashlock}`, // Temporary ID to avoid conflicts
        orderHash: `0x${'0'.repeat(64)}`, // Will be filled when SrcEscrowCreated is processed
        hashlock,
        srcChainId: 0, // Will be updated when we have the full info
        dstChainId: chainId,
        dstEscrowAddress: escrow,
        srcMaker: `0x${'0'.repeat(40)}`, // Will be filled later
        srcTaker: `0x${'0'.repeat(40)}`,
        dstMaker: `0x${'0'.repeat(40)}`,
        dstTaker: decodeAddress(taker),
        srcToken: `0x${'0'.repeat(40)}`,
        srcAmount: 0n,
        dstToken: `0x${'0'.repeat(40)}`,
        dstAmount: 0n,
        srcSafetyDeposit: 0n,
        dstSafetyDeposit: 0n,
        timelocks: 0n,
        status: "dst_created_only",
        dstCreatedAt: event.block.timestamp,
      });
  }
  
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
// Note: These events are not tracked directly anymore since we removed the BaseEscrow contract
// TODO: Implement dynamic escrow tracking using addresses from factory events
/*
ponder.on("BaseEscrow:EscrowWithdrawal", async ({ event, context }) => {
  const chainId = context.chain.id;
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
    
    // Update AtomicSwap if it exists
    const atomicSwapRecord = await context.db.find(atomicSwap, {
      id: srcEscrowRecord.orderHash
    });
    
    if (atomicSwapRecord) {
      await context.db
        .update(atomicSwap, { id: srcEscrowRecord.orderHash })
        .set({
          status: "completed",
          completedAt: event.block.timestamp,
          secret,
        });
    } else {
      console.warn(`AtomicSwap record not found for orderHash: ${srcEscrowRecord.orderHash}`);
    }
    
    // Update statistics
    await context.db
      .insert(chainStatistics)
      .values({
        id: chainId.toString(),
        chainId: chainId,
        totalSrcEscrows: 0n,
        totalDstEscrows: 0n,
        totalWithdrawals: 1n,
        totalCancellations: 0n,
        totalVolumeLocked: 0n,
        totalVolumeWithdrawn: srcEscrowRecord.srcAmount,
        lastUpdatedBlock: event.block.number,
      })
      .onConflictDoUpdate((row) => ({
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
        .insert(chainStatistics)
        .values({
          id: chainId.toString(),
          chainId: chainId,
          totalSrcEscrows: 0n,
          totalDstEscrows: 0n,
          totalWithdrawals: 1n,
          totalCancellations: 0n,
          totalVolumeLocked: 0n,
          totalVolumeWithdrawn: 0n,
          lastUpdatedBlock: event.block.number,
        })
        .onConflictDoUpdate((row) => ({
          totalWithdrawals: row.totalWithdrawals + 1n,
          lastUpdatedBlock: event.block.number,
        }));
    }
  }
});
*/

// Handle EscrowCancelled events - commented out since BaseEscrow contract removed
/*
ponder.on("BaseEscrow:EscrowCancelled", async ({ event, context }) => {
  const chainId = context.chain.id;
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
    
    // Update AtomicSwap if it exists
    const atomicSwapRecord = await context.db.find(atomicSwap, {
      id: srcEscrowRecord.orderHash
    });
    
    if (atomicSwapRecord) {
      await context.db
        .update(atomicSwap, { id: srcEscrowRecord.orderHash })
        .set({
          status: "cancelled",
          cancelledAt: event.block.timestamp,
        });
    } else {
      console.warn(`AtomicSwap record not found for orderHash: ${srcEscrowRecord.orderHash}`);
    }
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
    .insert(chainStatistics)
    .values({
      id: chainId.toString(),
      chainId: chainId,
      totalSrcEscrows: 0n,
      totalDstEscrows: 0n,
      totalWithdrawals: 0n,
      totalCancellations: 1n,
      totalVolumeLocked: 0n,
      totalVolumeWithdrawn: 0n,
      lastUpdatedBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      totalCancellations: row.totalCancellations + 1n,
      lastUpdatedBlock: event.block.number,
    }));
});
*/

// Handle FundsRescued events - commented out since BaseEscrow contract removed
/*
ponder.on("BaseEscrow:FundsRescued", async ({ event, context }) => {
  const chainId = context.chain.id;
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
    .insert(chainStatistics)
    .values({
      id: chainId.toString(),
      chainId: chainId,
      totalSrcEscrows: 0n,
      totalDstEscrows: 0n,
      totalWithdrawals: 0n,
      totalCancellations: 0n,
      totalVolumeLocked: 0n,
      totalVolumeWithdrawn: 0n,
      lastUpdatedBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      lastUpdatedBlock: event.block.number,
    }));
});
*/