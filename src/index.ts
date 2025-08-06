import { ponder } from "ponder:registry";
import { 
  srcEscrow, 
  dstEscrow, 
  escrowWithdrawal, 
  escrowCancellation, 
  fundsRescued, 
  atomicSwap,
  chainStatistics,
  bmnTransfer,
  bmnApproval,
  bmnTokenHolder,
  limitOrder,
  orderFilled,
  orderCancelled,
  bitInvalidatorUpdated,
  epochIncreased,
  limitOrderStatistics
} from "ponder:schema";

// Note: v2.1.0 event handlers are below in this file

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
      where: (row: any) => row.hashlock === hashlock 
    });
  return swaps.length > 0 ? swaps[0] : null;
}

// Constants for escrow implementations (same across all chains)
const SRC_IMPLEMENTATION = "0x77CC1A51dC5855bcF0d9f1c1FceaeE7fb855a535";
const DST_IMPLEMENTATION = "0x36938b7899A17362520AA741C0E0dA0c8EfE5e3b";
const FACTORY_ADDRESS = "0xB916C3edbFe574fFCBa688A6B92F72106479bD6c";

// Handle SrcEscrowCreated events from Factory V2
ponder.on("CrossChainEscrowFactoryV2:SrcEscrowCreated", async ({ event, context }) => {
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

// Handle DstEscrowCreated events from Factory V2
ponder.on("CrossChainEscrowFactoryV2:DstEscrowCreated", async ({ event, context }) => {
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

// BMN Token Event Handlers

ponder.on("BmnToken:Transfer", async ({ event, context }) => {
  const chainId = context.chain.id;
  const from = event.args.from.toLowerCase();
  const to = event.args.to.toLowerCase();
  const value = event.args.value;
  
  // Record the transfer
  await context.db.insert(bmnTransfer).values({
    id: `${chainId}-${event.transaction.hash}-${event.log.logIndex}`,
    chainId: chainId,
    from: from,
    to: to,
    value: value,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });
  
  // Update sender balance (if not zero address)
  if (from !== "0x0000000000000000000000000000000000000000") {
    const senderId = `${chainId}-${from}`;
    const senderRecord = await context.db.find(bmnTokenHolder, { id: senderId });
    
    if (senderRecord) {
      await context.db
        .update(bmnTokenHolder, { id: senderId })
        .set({
          balance: senderRecord.balance - value,
          lastTransferBlock: event.block.number,
          transferCount: senderRecord.transferCount + 1n,
        });
    }
  }
  
  // Update receiver balance (if not zero address)
  if (to !== "0x0000000000000000000000000000000000000000") {
    const receiverId = `${chainId}-${to}`;
    const receiverRecord = await context.db.find(bmnTokenHolder, { id: receiverId });
    
    if (receiverRecord) {
      await context.db
        .update(bmnTokenHolder, { id: receiverId })
        .set({
          balance: receiverRecord.balance + value,
          lastTransferBlock: event.block.number,
          transferCount: receiverRecord.transferCount + 1n,
        });
    } else {
      // First transfer for this address
      await context.db.insert(bmnTokenHolder).values({
        id: receiverId,
        chainId: chainId,
        address: to,
        balance: value,
        firstTransferBlock: event.block.number,
        lastTransferBlock: event.block.number,
        transferCount: 1n,
      });
    }
  }
});

ponder.on("BmnToken:Approval", async ({ event, context }) => {
  const chainId = context.chain.id;
  const owner = event.args.owner.toLowerCase();
  const spender = event.args.spender.toLowerCase();
  const value = event.args.value;
  
  // Update approval record
  await context.db
    .insert(bmnApproval)
    .values({
      id: `${chainId}-${owner}-${spender}`,
      chainId: chainId,
      owner: owner,
      spender: spender,
      value: value,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoUpdate({
      value: value,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    });
});

// SimpleLimitOrderProtocol Event Handlers

ponder.on("SimpleLimitOrderProtocol:OrderFilled", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { orderHash, remainingAmount } = event.args;
  
  // Record the fill event
  await context.db.insert(orderFilled).values({
    id: `${chainId}-${event.transaction.hash}-${event.log.logIndex}`,
    chainId: chainId,
    orderHash: orderHash,
    remainingAmount: remainingAmount,
    taker: event.transaction.from?.toLowerCase(),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });
  
  // Update or create limit order record
  const orderId = `${chainId}-${orderHash}`;
  const existingOrder = await context.db.find(limitOrder, { id: orderId });
  
  if (existingOrder) {
    // Update existing order
    const status = remainingAmount === 0n ? "filled" : "partially_filled";
    await context.db
      .update(limitOrder, { id: orderId })
      .set({
        remainingAmount: remainingAmount,
        status: status,
        updatedAt: event.block.timestamp,
      });
  } else {
    // Create new order record (first time seeing this order)
    // Note: We don't have full order details from just the fill event
    await context.db.insert(limitOrder).values({
      id: orderId,
      chainId: chainId,
      orderHash: orderHash,
      maker: "0x", // Will be updated when we see the order creation
      makerAsset: "0x",
      takerAsset: "0x",
      makingAmount: 0n,
      takingAmount: 0n,
      remainingAmount: remainingAmount,
      status: remainingAmount === 0n ? "filled" : "partially_filled",
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
    });
  }
  
  // Update statistics
  await updateLimitOrderStatistics(context, chainId, event.block.number, "fill");
});

ponder.on("SimpleLimitOrderProtocol:OrderCancelled", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { orderHash } = event.args;
  
  // Record the cancellation
  await context.db.insert(orderCancelled).values({
    id: `${chainId}-${orderHash}`,
    chainId: chainId,
    orderHash: orderHash,
    maker: event.transaction.from?.toLowerCase(),
    cancelledAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
  
  // Update order status
  const orderId = `${chainId}-${orderHash}`;
  const existingOrder = await context.db.find(limitOrder, { id: orderId });
  
  if (existingOrder) {
    await context.db
      .update(limitOrder, { id: orderId })
      .set({
        status: "cancelled",
        updatedAt: event.block.timestamp,
      });
  } else {
    // Create cancelled order record
    await context.db.insert(limitOrder).values({
      id: orderId,
      chainId: chainId,
      orderHash: orderHash,
      maker: event.transaction.from?.toLowerCase() || "0x",
      makerAsset: "0x",
      takerAsset: "0x",
      makingAmount: 0n,
      takingAmount: 0n,
      remainingAmount: 0n,
      status: "cancelled",
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
    });
  }
  
  // Update statistics
  await updateLimitOrderStatistics(context, chainId, event.block.number, "cancel");
});

ponder.on("SimpleLimitOrderProtocol:BitInvalidatorUpdated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { maker, slotIndex, slotValue } = event.args;
  
  // Update or insert bit invalidator record
  await context.db
    .insert(bitInvalidatorUpdated)
    .values({
      id: `${chainId}-${maker.toLowerCase()}-${slotIndex}`,
      chainId: chainId,
      maker: maker.toLowerCase(),
      slotIndex: slotIndex,
      slotValue: slotValue,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoUpdate({
      slotValue: slotValue,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    });
});

ponder.on("SimpleLimitOrderProtocol:EpochIncreased", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { maker, series, newEpoch } = event.args;
  
  // Update or insert epoch record
  await context.db
    .insert(epochIncreased)
    .values({
      id: `${chainId}-${maker.toLowerCase()}-${series}`,
      chainId: chainId,
      maker: maker.toLowerCase(),
      series: series,
      newEpoch: newEpoch,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoUpdate({
      newEpoch: newEpoch,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    });
});

// Helper function to update limit order statistics
async function updateLimitOrderStatistics(
  context: any,
  chainId: number,
  blockNumber: bigint,
  action: "fill" | "cancel" | "create"
) {
  const statsId = chainId.toString();
  const currentStats = await context.db.find(limitOrderStatistics, { id: statsId });
  
  if (currentStats) {
    const updates: any = {
      lastUpdatedBlock: blockNumber,
    };
    
    if (action === "fill") {
      updates.filledOrders = currentStats.filledOrders + 1n;
      updates.activeOrders = currentStats.activeOrders > 0n ? currentStats.activeOrders - 1n : 0n;
    } else if (action === "cancel") {
      updates.cancelledOrders = currentStats.cancelledOrders + 1n;
      updates.activeOrders = currentStats.activeOrders > 0n ? currentStats.activeOrders - 1n : 0n;
    } else if (action === "create") {
      updates.totalOrders = currentStats.totalOrders + 1n;
      updates.activeOrders = currentStats.activeOrders + 1n;
    }
    
    await context.db
      .update(limitOrderStatistics, { id: statsId })
      .set(updates);
  } else {
    // Initialize statistics
    await context.db.insert(limitOrderStatistics).values({
      id: statsId,
      chainId: chainId,
      totalOrders: action === "create" ? 1n : 0n,
      activeOrders: action === "create" ? 1n : 0n,
      filledOrders: action === "fill" ? 1n : 0n,
      partiallyFilledOrders: 0n,
      cancelledOrders: action === "cancel" ? 1n : 0n,
      totalVolume: 0n,
      lastUpdatedBlock: blockNumber,
    });
  }
}