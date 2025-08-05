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

// Feature flag for enhanced events (same as in config)
const USE_ENHANCED_EVENTS = process.env.USE_ENHANCED_EVENTS === "true";

// Enhanced event handlers that use the escrow address directly from events
// These handlers are active when USE_ENHANCED_EVENTS is true

// Handle enhanced SrcEscrowCreated events from Factory
ponder.on("CrossChainEscrowFactory:SrcEscrowCreated", async ({ event, context }) => {
  const chainId = context.chain.id;
  
  if (USE_ENHANCED_EVENTS) {
    // New enhanced event structure with escrow address as first parameter
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
    const tempSwaps = await context.db
      .select(atomicSwap, { 
        where: (row) => row.hashlock === srcImmutables.hashlock && row.id.startsWith("temp-")
      });
    
    if (tempSwaps.length > 0) {
      // Delete temporary record and create proper one
      await context.db.delete(atomicSwap, { id: tempSwaps[0].id });
      
      // Create proper AtomicSwap record with all data
      await context.db
        .insert(atomicSwap)
        .values({
          id: srcImmutables.orderHash,
          orderHash: srcImmutables.orderHash,
          hashlock: srcImmutables.hashlock,
          srcChainId: chainId,
          dstChainId: tempSwaps[0].dstChainId || Number(dstImmutablesComplement.chainId),
          srcEscrowAddress: escrowAddress,
          dstEscrowAddress: tempSwaps[0].dstEscrowAddress,
          srcMaker: decodeAddress(srcImmutables.maker),
          srcTaker: decodeAddress(srcImmutables.taker),
          dstMaker: decodeAddress(dstImmutablesComplement.maker),
          dstTaker: tempSwaps[0].dstTaker || decodeAddress(srcImmutables.taker),
          srcToken: decodeAddress(srcImmutables.token),
          srcAmount: srcImmutables.amount,
          dstToken: decodeAddress(dstImmutablesComplement.token),
          dstAmount: dstImmutablesComplement.amount,
          srcSafetyDeposit: srcImmutables.safetyDeposit,
          dstSafetyDeposit: dstImmutablesComplement.safetyDeposit,
          timelocks: srcImmutables.timelocks,
          status: tempSwaps[0].dstEscrowAddress ? "both_created" : "src_created",
          srcCreatedAt: event.block.timestamp,
          dstCreatedAt: tempSwaps[0].dstCreatedAt,
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
  } else {
    // Legacy event handling (without escrow address) - requires CREATE2 calculation
    console.warn("Legacy SrcEscrowCreated event detected - CREATE2 calculation not implemented in enhanced version");
    console.warn("Please set USE_ENHANCED_EVENTS=true after deploying the new contracts");
    return;
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
      totalVolumeLocked: event.args.srcImmutables.amount,
      totalVolumeWithdrawn: 0n,
      lastUpdatedBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      totalSrcEscrows: row.totalSrcEscrows + 1n,
      totalVolumeLocked: row.totalVolumeLocked + event.args.srcImmutables.amount,
      lastUpdatedBlock: event.block.number,
    }));
});

// Handle enhanced DstEscrowCreated events from Factory
ponder.on("CrossChainEscrowFactory:DstEscrowCreated", async ({ event, context }) => {
  const chainId = context.chain.id;
  
  if (USE_ENHANCED_EVENTS) {
    // New enhanced event structure with escrow address as first parameter
    const { escrow: escrowAddress, hashlock, taker } = event.args;
    
    const id = `${chainId}-${escrowAddress}`;
    
    // Insert DstEscrow record
    await context.db.insert(dstEscrow).values({
      id,
      chainId,
      escrowAddress,
      hashlock,
      taker: decodeAddress(taker),
      srcCancellationTimestamp: 0n, // Will be set when we have more info
      createdAt: event.block.timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
      status: "created",
    });
    
    // First check if an AtomicSwap exists with this hashlock
    const existingSwaps = await context.db
      .select(atomicSwap, { 
        where: (row) => row.hashlock === hashlock 
      });
    
    if (existingSwaps.length > 0) {
      // Update existing AtomicSwap record
      const existingSwap = existingSwaps[0];
      await context.db
        .update(atomicSwap, { id: existingSwap.id })
        .set({
          dstChainId: chainId,
          dstEscrowAddress: escrowAddress,
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
          orderHash: "", // Will be filled when SrcEscrowCreated is processed
          hashlock,
          srcChainId: 0, // Will be updated when we have the full info
          dstChainId: chainId,
          dstEscrowAddress: escrowAddress,
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
          status: "dst_created_only",
          dstCreatedAt: event.block.timestamp,
        });
    }
  } else {
    // Legacy event handling
    console.warn("Legacy DstEscrowCreated event detected - escrow address tracking not available");
    console.warn("Please set USE_ENHANCED_EVENTS=true after deploying the new contracts");
    return;
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

// The escrow event handlers remain the same as they already work with escrow addresses
// Handle EscrowWithdrawal events
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
        .update(atomicSwap, { orderHash: srcEscrowRecord.orderHash })
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

// Handle EscrowCancelled events
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
        .update(atomicSwap, { orderHash: srcEscrowRecord.orderHash })
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

// Handle FundsRescued events
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