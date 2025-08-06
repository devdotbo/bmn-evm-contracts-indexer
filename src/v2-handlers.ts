import { ponder } from "ponder:registry";
import {
  srcEscrow,
  dstEscrow,
  atomicSwap,
  chainStatistics,
  resolverWhitelist,
  resolverSuspension,
  factoryAdmin,
  emergencyPause,
  swapMetrics,
  interactionTracking,
  factoryMetrics,
} from "ponder:schema";

// Helper function to decode packed address from uint256
function decodeAddress(packedAddress: bigint): string {
  // Extract the lower 160 bits (20 bytes) which contain the address
  const address = packedAddress & ((1n << 160n) - 1n);
  return `0x${address.toString(16).padStart(40, "0")}`;
}

// V2.1.0 Factory Events - Core Escrow Events

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
      dstEscrowAddress: null,
      srcMaker: decodeAddress(srcImmutables.maker),
      srcTaker: decodeAddress(srcImmutables.taker),
      dstMaker: decodeAddress(dstImmutablesComplement.maker),
      dstTaker: decodeAddress(srcImmutables.taker),
      srcToken: decodeAddress(srcImmutables.token),
      srcAmount: srcImmutables.amount,
      dstToken: decodeAddress(dstImmutablesComplement.token),
      dstAmount: dstImmutablesComplement.amount,
      srcSafetyDeposit: srcImmutables.safetyDeposit,
      dstSafetyDeposit: dstImmutablesComplement.safetyDeposit,
      timelocks: srcImmutables.timelocks,
      status: "src_created",
      srcCreatedAt: event.block.timestamp,
      dstCreatedAt: null,
      completedAt: null,
      cancelledAt: null,
      secret: null,
    })
    .onConflictDoUpdate({
      srcEscrowAddress: escrowAddress,
      status: "src_created",
      srcCreatedAt: event.block.timestamp,
    });

  // Update chain statistics
  await updateChainStatistics(context, chainId, "srcEscrow", event.block.number);
});

// Handle DstEscrowCreated events from Factory V2
ponder.on("CrossChainEscrowFactoryV2:DstEscrowCreated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { escrow: escrowAddress, hashlock, taker } = event.args;

  const id = `${chainId}-${escrowAddress}`;

  // Insert DstEscrow record
  await context.db.insert(dstEscrow).values({
    id,
    chainId,
    escrowAddress,
    hashlock,
    taker: decodeAddress(taker),
    srcCancellationTimestamp: 0n, // Will be updated when we get more details
    createdAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    status: "created",
  });

  // Update AtomicSwap record
  const swaps = await context.db.select(atomicSwap, {
    where: (row: any) => row.hashlock === hashlock,
  });

  if (swaps.length > 0) {
    await context.db.update(atomicSwap, {
      id: swaps[0].id,
      dstEscrowAddress: escrowAddress,
      dstChainId: chainId,
      status: "dst_created",
      dstCreatedAt: event.block.timestamp,
    });
  }

  // Update chain statistics
  await updateChainStatistics(context, chainId, "dstEscrow", event.block.number);
});

// V2.1.0 Factory Events - Resolver Management

// Handle ResolverWhitelisted event
ponder.on("CrossChainEscrowFactoryV2:ResolverWhitelisted", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { resolver } = event.args;
  const id = `${chainId}-${resolver}`;

  await context.db
    .insert(resolverWhitelist)
    .values({
      id,
      chainId,
      resolver,
      isWhitelisted: true,
      isActive: true,
      addedAt: event.block.timestamp,
      addedBy: event.transaction.from,
      suspendedUntil: null,
      totalTransactions: 0n,
      failedTransactions: 0n,
      lastActivityBlock: null,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoUpdate({
      isWhitelisted: true,
      addedAt: event.block.timestamp,
      addedBy: event.transaction.from,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
    });
});

// Handle ResolverAdded event
ponder.on("CrossChainEscrowFactoryV2:ResolverAdded", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { resolver, addedBy } = event.args;
  const id = `${chainId}-${resolver}`;

  await context.db
    .insert(resolverWhitelist)
    .values({
      id,
      chainId,
      resolver,
      isWhitelisted: true,
      isActive: true,
      addedAt: event.block.timestamp,
      addedBy,
      suspendedUntil: null,
      totalTransactions: 0n,
      failedTransactions: 0n,
      lastActivityBlock: null,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoUpdate({
      isWhitelisted: true,
      isActive: true,
      addedAt: event.block.timestamp,
      addedBy,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
    });
});

// Handle ResolverRemoved event
ponder.on("CrossChainEscrowFactoryV2:ResolverRemoved", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { resolver } = event.args;
  const id = `${chainId}-${resolver}`;

  await context.db.update(resolverWhitelist, {
    id,
    isWhitelisted: false,
    isActive: false,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

// Handle ResolverSuspended event
ponder.on("CrossChainEscrowFactoryV2:ResolverSuspended", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { resolver, until, reason } = event.args;
  const resolverId = `${chainId}-${resolver}`;
  const suspensionId = `${chainId}-${resolver}-${event.block.number}`;

  // Update resolver whitelist
  await context.db.update(resolverWhitelist, {
    id: resolverId,
    isActive: false,
    suspendedUntil: until,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });

  // Record suspension event
  await context.db.insert(resolverSuspension).values({
    id: suspensionId,
    chainId,
    resolver,
    suspendedUntil: until,
    reason,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

// Handle ResolverReactivated event
ponder.on("CrossChainEscrowFactoryV2:ResolverReactivated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { resolver } = event.args;
  const id = `${chainId}-${resolver}`;

  await context.db.update(resolverWhitelist, {
    id,
    isActive: true,
    suspendedUntil: null,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

// V2.1.0 Factory Events - Admin Management

// Handle AdminAdded event
ponder.on("CrossChainEscrowFactoryV2:AdminAdded", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { admin } = event.args;
  const id = `${chainId}-${admin}`;

  await context.db
    .insert(factoryAdmin)
    .values({
      id,
      chainId,
      admin,
      isActive: true,
      addedAt: event.block.timestamp,
      removedAt: null,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoUpdate({
      isActive: true,
      addedAt: event.block.timestamp,
      removedAt: null,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
    });
});

// Handle AdminRemoved event
ponder.on("CrossChainEscrowFactoryV2:AdminRemoved", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { admin } = event.args;
  const id = `${chainId}-${admin}`;

  await context.db.update(factoryAdmin, {
    id,
    isActive: false,
    removedAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

// V2.1.0 Factory Events - Emergency Pause

// Handle EmergencyPause event
ponder.on("CrossChainEscrowFactoryV2:EmergencyPause", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { paused } = event.args;
  const id = `${chainId}-${event.block.number}`;

  await context.db.insert(emergencyPause).values({
    id,
    chainId,
    isPaused: paused,
    pausedAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

// V2.1.0 Factory Events - Swap Metrics

// Handle SwapInitiated event
ponder.on("CrossChainEscrowFactoryV2:SwapInitiated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { escrowSrc, maker, resolver, volume, srcChainId, dstChainId } = event.args;
  const id = `${chainId}-swap-initiated-${event.transaction.hash}`;

  await context.db.insert(swapMetrics).values({
    id,
    chainId,
    orderHash: null,
    escrowSrc,
    maker,
    resolver,
    volume,
    srcChainId,
    dstChainId,
    completionTime: null,
    gasUsed: null,
    status: "initiated",
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });

  // Update resolver activity
  const resolverId = `${chainId}-${resolver}`;
  const resolverRecord = await context.db.find(resolverWhitelist, { id: resolverId });
  if (resolverRecord) {
    await context.db.update(resolverWhitelist, {
      id: resolverId,
      totalTransactions: resolverRecord.totalTransactions + 1n,
      lastActivityBlock: event.block.number,
    });
  }
});

// Handle SwapCompleted event
ponder.on("CrossChainEscrowFactoryV2:SwapCompleted", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { orderHash, resolver, completionTime, gasUsed } = event.args;
  const id = `${chainId}-${orderHash}`;

  await context.db
    .insert(swapMetrics)
    .values({
      id,
      chainId,
      orderHash,
      escrowSrc: null,
      maker: null,
      resolver,
      volume: null,
      srcChainId: null,
      dstChainId: null,
      completionTime,
      gasUsed,
      status: "completed",
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoUpdate({
      completionTime,
      gasUsed,
      status: "completed",
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
    });

  // Update AtomicSwap status
  await context.db.update(atomicSwap, {
    id: orderHash,
    status: "completed",
    completedAt: event.block.timestamp,
  });
});

// V2.1.0 Factory Events - Interaction Tracking

// Handle InteractionExecuted event
ponder.on("CrossChainEscrowFactoryV2:InteractionExecuted", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { orderMaker, interactionTarget, interactionHash, timestamp } = event.args;
  const id = `${chainId}-${interactionHash}`;

  await context.db.insert(interactionTracking).values({
    id,
    chainId,
    orderMaker,
    interactionTarget,
    interactionHash,
    status: "executed",
    failureReason: null,
    executedAt: timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

// Handle InteractionFailed event
ponder.on("CrossChainEscrowFactoryV2:InteractionFailed", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { orderMaker, interactionTarget, reason } = event.args;
  const id = `${chainId}-${event.transaction.hash}-${event.log.logIndex}`;

  await context.db.insert(interactionTracking).values({
    id,
    chainId,
    orderMaker,
    interactionTarget,
    interactionHash: "0x", // Failed interactions might not have a hash
    status: "failed",
    failureReason: reason,
    executedAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });

  // Update resolver failed transactions
  const resolverId = `${chainId}-${event.transaction.from}`;
  const resolverRecord = await context.db.find(resolverWhitelist, { id: resolverId });
  if (resolverRecord) {
    await context.db.update(resolverWhitelist, {
      id: resolverId,
      failedTransactions: resolverRecord.failedTransactions + 1n,
    });
  }
});

// V2.1.0 Factory Events - Global Metrics

// Handle MetricsUpdated event
ponder.on("CrossChainEscrowFactoryV2:MetricsUpdated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { totalVolume, successRate, avgCompletionTime } = event.args;
  const id = `${chainId}-${event.block.number}`;

  await context.db.insert(factoryMetrics).values({
    id,
    chainId,
    totalVolume,
    successRate,
    avgCompletionTime,
    activeResolvers: 0n, // Will be calculated separately
    successfulSwaps: 0n, // Will be calculated separately
    failedSwaps: 0n, // Will be calculated separately
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

// Helper function to update chain statistics
async function updateChainStatistics(
  context: any,
  chainId: number,
  eventType: string,
  blockNumber: bigint
) {
  const id = chainId.toString();
  const stats = await context.db.find(chainStatistics, { id });

  if (stats) {
    const updates: any = {
      id,
      lastUpdatedBlock: blockNumber,
    };

    if (eventType === "srcEscrow") {
      updates.totalSrcEscrows = stats.totalSrcEscrows + 1n;
    } else if (eventType === "dstEscrow") {
      updates.totalDstEscrows = stats.totalDstEscrows + 1n;
    } else if (eventType === "withdrawal") {
      updates.totalWithdrawals = stats.totalWithdrawals + 1n;
    } else if (eventType === "cancellation") {
      updates.totalCancellations = stats.totalCancellations + 1n;
    }

    await context.db.update(chainStatistics, updates);
  } else {
    const newStats: any = {
      id,
      chainId,
      totalSrcEscrows: eventType === "srcEscrow" ? 1n : 0n,
      totalDstEscrows: eventType === "dstEscrow" ? 1n : 0n,
      totalWithdrawals: eventType === "withdrawal" ? 1n : 0n,
      totalCancellations: eventType === "cancellation" ? 1n : 0n,
      totalVolumeLocked: 0n,
      totalVolumeWithdrawn: 0n,
      lastUpdatedBlock: blockNumber,
    };

    await context.db.insert(chainStatistics).values(newStats);
  }
}