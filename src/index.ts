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
  limitOrderStatistics,
  postInteractionOrder,
  postInteractionResolverWhitelist,
  makerWhitelist,
  postInteractionEscrow,
} from "ponder:schema";

// Note: v2.2.0 event handlers with PostInteraction support are included

// Helper function to decode packed address from uint256
function decodeAddress(packedAddress: bigint): string {
  // Extract the lower 160 bits (20 bytes) which contain the address
  const address = packedAddress & ((1n << 160n) - 1n);
  return `0x${address.toString(16).padStart(40, "0")}`;
}

// Helper function to find AtomicSwap by hashlock
async function findAtomicSwapByHashlock(context: any, hashlock: string) {
  const swaps = await context.db.select(atomicSwap, {
    where: (row: any) => row.hashlock === hashlock,
  });
  return swaps.length > 0 ? swaps[0] : null;
}

// Constants for escrow implementations (same across all chains)
const SRC_IMPLEMENTATION = "0x77CC1A51dC5855bcF0d9f1c1FceaeE7fb855a535";
const DST_IMPLEMENTATION = "0x36938b7899A17362520AA741C0E0dA0c8EfE5e3b";
const FACTORY_ADDRESS = "0xB916C3edbFe574fFCBa688A6B92F72106479bD6c";

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
    const senderRecord = await context.db.find(bmnTokenHolder, {
      id: senderId,
    });

    if (senderRecord) {
      await context.db.update(bmnTokenHolder, { id: senderId }).set({
        balance: senderRecord.balance - value,
        lastTransferBlock: event.block.number,
        transferCount: senderRecord.transferCount + 1n,
      });
    }
  }

  // Update receiver balance (if not zero address)
  if (to !== "0x0000000000000000000000000000000000000000") {
    const receiverId = `${chainId}-${to}`;
    const receiverRecord = await context.db.find(bmnTokenHolder, {
      id: receiverId,
    });

    if (receiverRecord) {
      await context.db.update(bmnTokenHolder, { id: receiverId }).set({
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

ponder.on(
  "SimpleLimitOrderProtocol:OrderCancelled",
  async ({ event, context }) => {
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
      await context.db.update(limitOrder, { id: orderId }).set({
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
    await updateLimitOrderStatistics(
      context,
      chainId,
      event.block.number,
      "cancel",
    );
  },
);

ponder.on(
  "SimpleLimitOrderProtocol:BitInvalidatorUpdated",
  async ({ event, context }) => {
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
  },
);

ponder.on(
  "SimpleLimitOrderProtocol:EpochIncreased",
  async ({ event, context }) => {
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
  },
);

// Helper function to update limit order statistics
async function updateLimitOrderStatistics(
  context: any,
  chainId: number,
  blockNumber: bigint,
  action: "fill" | "cancel" | "create",
) {
  const statsId = chainId.toString();
  const currentStats = await context.db.find(limitOrderStatistics, {
    id: statsId,
  });

  if (currentStats) {
    const updates: any = {
      lastUpdatedBlock: blockNumber,
    };

    if (action === "fill") {
      updates.filledOrders = currentStats.filledOrders + 1n;
      updates.activeOrders =
        currentStats.activeOrders > 0n ? currentStats.activeOrders - 1n : 0n;
    } else if (action === "cancel") {
      updates.cancelledOrders = currentStats.cancelledOrders + 1n;
      updates.activeOrders =
        currentStats.activeOrders > 0n ? currentStats.activeOrders - 1n : 0n;
    } else if (action === "create") {
      updates.totalOrders = currentStats.totalOrders + 1n;
      updates.activeOrders = currentStats.activeOrders + 1n;
    }

    await context.db.update(limitOrderStatistics, { id: statsId }).set(updates);
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

// V2.2.0 Helper Functions for PostInteraction Support

// Convert bytes32 to hex string
function decodeOrderHash(orderHash: string): string {
  return orderHash.toLowerCase();
}

// Link 1inch order to created escrows
async function linkOrderToEscrows(
  context: any,
  orderHash: string,
  srcEscrow: string,
  dstEscrow: string,
  chainId: number,
  blockNumber: bigint,
  timestamp: bigint,
  transactionHash: string,
) {
  // Update the PostInteractionOrder with escrow addresses
  const orderId = orderHash;
  await context.db.update(postInteractionOrder, { id: orderId }).set({
    srcEscrow: srcEscrow,
    dstEscrow: dstEscrow,
    status: "filled",
    filledAt: timestamp,
  });

  // Create PostInteractionEscrow records for tracking
  await context.db.insert(postInteractionEscrow).values({
    id: `${orderHash}-src`,
    orderHash: orderHash,
    escrowAddress: srcEscrow,
    escrowType: "src",
    chainId: chainId,
    createdAt: timestamp,
    blockNumber: blockNumber,
    transactionHash: transactionHash,
  });

  await context.db.insert(postInteractionEscrow).values({
    id: `${orderHash}-dst`,
    orderHash: orderHash,
    escrowAddress: dstEscrow,
    escrowType: "dst",
    chainId: chainId,
    createdAt: timestamp,
    blockNumber: blockNumber,
    transactionHash: transactionHash,
  });
}

// Update swap statistics for PostInteraction swaps
async function updateSwapStatisticsForPostInteraction(
  context: any,
  chainId: number,
  blockNumber: bigint,
  amount: bigint,
) {
  await context.db
    .insert(chainStatistics)
    .values({
      id: chainId.toString(),
      chainId: chainId,
      totalSrcEscrows: 1n,
      totalDstEscrows: 0n,
      totalWithdrawals: 0n,
      totalCancellations: 0n,
      totalVolumeLocked: amount,
      totalVolumeWithdrawn: 0n,
      lastUpdatedBlock: blockNumber,
    })
    .onConflictDoUpdate((row) => ({
      totalSrcEscrows: row.totalSrcEscrows + 1n,
      totalVolumeLocked: row.totalVolumeLocked + amount,
      lastUpdatedBlock: blockNumber,
    }));
}

// ==========================================
// V2.2.0 Factory Event Handlers - PostInteraction Support
// ==========================================

// Handle PostInteractionEscrowCreated events
ponder.on(
  "CrossChainEscrowFactoryV2_2:PostInteractionEscrowCreated",
  async ({ event, context }) => {
    const chainId = context.chain.id;
    const { escrow, hashlock, protocol, taker, amount } = event.args;

    // This event fires when PostInteraction creates escrows after 1inch order fill
    // The orderHash should be the same as the hashlock for PostInteraction orders
    const orderHash = decodeOrderHash(hashlock);

    console.log(
      `PostInteractionEscrowCreated: escrow=${escrow}, hashlock=${hashlock}, protocol=${protocol}, taker=${taker}, amount=${amount}`,
    );

    // Check if we have a pending PostInteractionOrder for this hashlock
    const existingOrder = await context.db.find(postInteractionOrder, {
      id: orderHash,
    });

    if (existingOrder) {
      // Link the order to the created escrows
      // Note: This event doesn't distinguish between src and dst escrows directly
      // We need to determine based on context or additional logic
      await linkOrderToEscrows(
        context,
        orderHash,
        escrow, // src escrow
        escrow, // dst escrow (might be same or different based on implementation)
        chainId,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash,
      );
    } else {
      // Create a new PostInteractionOrder if we haven't seen it yet
      await context.db.insert(postInteractionOrder).values({
        id: orderHash,
        orderHash: hashlock,
        maker: taker, // In PostInteraction, the taker becomes the maker of the escrow
        taker: taker,
        makerAsset: "0x", // Will be updated when we get more info
        takerAsset: "0x",
        makingAmount: amount,
        takingAmount: 0n,
        srcEscrow: escrow,
        dstEscrow: escrow,
        status: "filled",
        filledAt: event.block.timestamp,
        chainId: chainId,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
        transactionHash: event.transaction.hash,
      });
    }

    // Update AtomicSwap record to mark it as PostInteraction
    const swapRecord = await findAtomicSwapByHashlock(context, hashlock);
    if (swapRecord) {
      await context.db.update(atomicSwap, { id: swapRecord.id }).set({
        postInteraction: true,
      });
    }

    // Update chain statistics
    await updateSwapStatisticsForPostInteraction(
      context,
      chainId,
      event.block.number,
      amount,
    );
  },
);

// Handle ResolverWhitelisted events
ponder.on(
  "CrossChainEscrowFactoryV2_2:ResolverWhitelisted",
  async ({ event, context }) => {
    const chainId = context.chain.id;
    const { resolver } = event.args;

    const id = `${resolver.toLowerCase()}-${chainId}`;

    // Create or update resolver whitelist record
    await context.db
      .insert(postInteractionResolverWhitelist)
      .values({
        id,
        resolver: resolver.toLowerCase(),
        chainId: chainId,
        isWhitelisted: true,
        whitelistedAt: event.block.timestamp,
        removedAt: null,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
      })
      .onConflictDoUpdate({
        isWhitelisted: true,
        whitelistedAt: event.block.timestamp,
        removedAt: null,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
      });

    console.log(`Resolver whitelisted: ${resolver} on chain ${chainId}`);
  },
);

// Handle ResolverRemoved events
ponder.on(
  "CrossChainEscrowFactoryV2_2:ResolverRemoved",
  async ({ event, context }) => {
    const chainId = context.chain.id;
    const { resolver } = event.args;

    const id = `${resolver.toLowerCase()}-${chainId}`;

    // Update resolver whitelist record
    const existingRecord = await context.db.find(
      postInteractionResolverWhitelist,
      { id },
    );

    if (existingRecord) {
      await context.db.update(postInteractionResolverWhitelist, { id }).set({
        isWhitelisted: false,
        removedAt: event.block.timestamp,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
      });
    } else {
      // Create a record showing the resolver was removed (edge case)
      await context.db.insert(postInteractionResolverWhitelist).values({
        id,
        resolver: resolver.toLowerCase(),
        chainId: chainId,
        isWhitelisted: false,
        whitelistedAt: 0n,
        removedAt: event.block.timestamp,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
      });
    }

    console.log(`Resolver removed: ${resolver} on chain ${chainId}`);
  },
);

// Handle MakerWhitelisted events
ponder.on(
  "CrossChainEscrowFactoryV2_2:MakerWhitelisted",
  async ({ event, context }) => {
    const chainId = context.chain.id;
    const { maker } = event.args;

    const id = `${maker.toLowerCase()}-${chainId}`;

    // Create or update maker whitelist record
    await context.db
      .insert(makerWhitelist)
      .values({
        id,
        maker: maker.toLowerCase(),
        chainId: chainId,
        isWhitelisted: true,
        whitelistedAt: event.block.timestamp,
        removedAt: null,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
      })
      .onConflictDoUpdate({
        isWhitelisted: true,
        whitelistedAt: event.block.timestamp,
        removedAt: null,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
      });

    console.log(`Maker whitelisted: ${maker} on chain ${chainId}`);
  },
);

// Handle MakerRemoved events
ponder.on(
  "CrossChainEscrowFactoryV2_2:MakerRemoved",
  async ({ event, context }) => {
    const chainId = context.chain.id;
    const { maker } = event.args;

    const id = `${maker.toLowerCase()}-${chainId}`;

    // Update maker whitelist record
    const existingRecord = await context.db.find(makerWhitelist, { id });

    if (existingRecord) {
      await context.db.update(makerWhitelist, { id }).set({
        isWhitelisted: false,
        removedAt: event.block.timestamp,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
      });
    } else {
      // Create a record showing the maker was removed (edge case)
      await context.db.insert(makerWhitelist).values({
        id,
        maker: maker.toLowerCase(),
        chainId: chainId,
        isWhitelisted: false,
        whitelistedAt: 0n,
        removedAt: event.block.timestamp,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
      });
    }

    console.log(`Maker removed: ${maker} on chain ${chainId}`);
  },
);

// ==========================================
// Enhanced 1inch SimpleLimitOrderProtocol OrderFilled Handler for PostInteraction
// ==========================================

// Override the existing OrderFilled handler to support PostInteraction
ponder.on(
  "SimpleLimitOrderProtocol:OrderFilled",
  async ({ event, context }) => {
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

    // Check if this is a PostInteraction order by looking for maker in whitelist
    const makerAddress = event.transaction.from?.toLowerCase();
    if (makerAddress) {
      const makerWhitelistRecord = await context.db.find(makerWhitelist, {
        id: `${makerAddress}-${chainId}`,
      });

      if (makerWhitelistRecord && makerWhitelistRecord.isWhitelisted) {
        // This is likely a PostInteraction order
        // Create a PostInteractionOrder record in pending status
        const orderId = decodeOrderHash(orderHash);

        await context.db
          .insert(postInteractionOrder)
          .values({
            id: orderId,
            orderHash: orderHash,
            maker: makerAddress,
            taker: event.transaction.from?.toLowerCase() || "0x",
            makerAsset: "0x", // Will be updated when we get escrow creation events
            takerAsset: "0x",
            makingAmount: 0n, // Will be updated from escrow events
            takingAmount: 0n,
            srcEscrow: null,
            dstEscrow: null,
            status: "pending", // Waiting for PostInteractionEscrowCreated
            filledAt: null,
            chainId: chainId,
            blockNumber: event.block.number,
            timestamp: event.block.timestamp,
            transactionHash: event.transaction.hash,
          })
          .onConflictDoUpdate({
            status: remainingAmount === 0n ? "filled" : "pending",
            chainId: chainId,
            blockNumber: event.block.number,
            timestamp: event.block.timestamp,
            transactionHash: event.transaction.hash,
          });

        console.log(
          `PostInteraction order detected: ${orderHash} by whitelisted maker ${makerAddress}`,
        );
      }
    }

    // Update or create limit order record
    const orderId = `${chainId}-${orderHash}`;
    const existingOrder = await context.db.find(limitOrder, { id: orderId });

    if (existingOrder) {
      // Update existing order
      const status = remainingAmount === 0n ? "filled" : "partially_filled";
      await context.db.update(limitOrder, { id: orderId }).set({
        remainingAmount: remainingAmount,
        status: status,
        updatedAt: event.block.timestamp,
      });
    } else {
      // Create new order record (first time seeing this order)
      await context.db.insert(limitOrder).values({
        id: orderId,
        chainId: chainId,
        orderHash: orderHash,
        maker: event.transaction.from?.toLowerCase() || "0x",
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
    await updateLimitOrderStatistics(
      context,
      chainId,
      event.block.number,
      "fill",
    );
  },
);

// ==========================================
// V2.2.0 Factory Event Handlers - Compatibility with existing events
// ==========================================

// Update existing SrcEscrowCreated handler to be compatible with v2.2.0
ponder.on(
  "CrossChainEscrowFactoryV2_2:SrcEscrowCreated",
  async ({ event, context }) => {
    const chainId = context.chain.id;

    // Enhanced events emit the escrow address directly
    const {
      escrow: escrowAddress,
      srcImmutables,
      dstImmutablesComplement,
    } = event.args;

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
      id: `temp-${srcImmutables.hashlock}`,
    });

    if (tempSwap) {
      // Delete temporary record and create proper one
      await context.db.delete(atomicSwap, { id: tempSwap.id });

      // Create proper AtomicSwap record with all data
      await context.db.insert(atomicSwap).values({
        id: srcImmutables.orderHash,
        orderHash: srcImmutables.orderHash,
        hashlock: srcImmutables.hashlock,
        srcChainId: chainId,
        dstChainId:
          tempSwap.dstChainId || Number(dstImmutablesComplement.chainId),
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
        postInteraction: false, // Regular escrow, not PostInteraction
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
          postInteraction: false, // Regular escrow, not PostInteraction
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
  },
);

// Update existing DstEscrowCreated handler to be compatible with v2.2.0
ponder.on(
  "CrossChainEscrowFactoryV2_2:DstEscrowCreated",
  async ({ event, context }) => {
    const chainId = context.chain.id;

    // Both legacy and enhanced events have the same structure for DstEscrowCreated
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
      await context.db.update(atomicSwap, { id: existingSwap.id }).set({
        dstChainId: chainId,
        dstEscrowAddress: escrow,
        dstTaker: decodeAddress(taker),
        status:
          existingSwap.status === "src_created"
            ? "both_created"
            : "dst_created",
        dstCreatedAt: event.block.timestamp,
      });
    } else {
      // Create a temporary AtomicSwap record using hashlock
      console.warn(
        `Creating temporary AtomicSwap for hashlock ${hashlock} - waiting for SrcEscrowCreated`,
      );
      await context.db.insert(atomicSwap).values({
        id: `temp-${hashlock}`, // Temporary ID to avoid conflicts
        orderHash: `0x${"0".repeat(64)}`, // Will be filled when SrcEscrowCreated is processed
        hashlock,
        srcChainId: 0, // Will be updated when we have the full info
        dstChainId: chainId,
        dstEscrowAddress: escrow,
        srcMaker: `0x${"0".repeat(40)}`, // Will be filled later
        srcTaker: `0x${"0".repeat(40)}`,
        dstMaker: `0x${"0".repeat(40)}`,
        dstTaker: decodeAddress(taker),
        srcToken: `0x${"0".repeat(40)}`,
        srcAmount: 0n,
        dstToken: `0x${"0".repeat(40)}`,
        dstAmount: 0n,
        srcSafetyDeposit: 0n,
        dstSafetyDeposit: 0n,
        timelocks: 0n,
        status: "dst_created_only",
        dstCreatedAt: event.block.timestamp,
        postInteraction: false, // Regular escrow, not PostInteraction
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
  },
);
