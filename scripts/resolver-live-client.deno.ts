#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Resolver-focused Live Subscription Client
 * Demonstrates how a resolver would use live subscriptions for atomic swaps
 * 
 * Run: deno run --node-modules-dir=auto --allow-net --allow-env --allow-read scripts/resolver-live-client.deno.ts [resolver_address]
 */

import { createClient, eq, desc, and, or } from "npm:@ponder/client@0.12.0";
import * as schema from "../ponder.schema.ts";

const PONDER_URL = Deno.env.get("PONDER_URL") || "http://localhost:42069";
const RESOLVER_ADDRESS = Deno.args[0] || "0x1234567890123456789012345678901234567890";

console.log("🤖 Resolver Live Subscription Client");
console.log("📍 Indexer:", PONDER_URL);
console.log("👤 Resolver:", RESOLVER_ADDRESS);
console.log("=".repeat(60));

class ResolverLiveClient {
  private client: any;
  private resolverAddress: string;
  private unsubscribeFns: Array<() => void> = [];

  constructor(resolverAddress: string) {
    this.resolverAddress = resolverAddress.toLowerCase();
    this.client = createClient(`${PONDER_URL}/sql`, { schema });
  }

  // Main subscription for resolver - watches atomic swaps assigned to this resolver
  async subscribeToMySwaps() {
    console.log("\n📡 Subscribing to atomic swaps for resolver...");
    
    const { unsubscribe } = this.client.live(
      (db: any) => db
        .select()
        .from(schema.atomicSwap)
        .where(
          and(
            eq(schema.atomicSwap.srcTaker, this.resolverAddress),
            or(
              eq(schema.atomicSwap.status, "pending"),
              eq(schema.atomicSwap.status, "src_created"),
              eq(schema.atomicSwap.status, "dst_created")
            )
          )
        )
        .orderBy(desc(schema.atomicSwap.srcCreatedAt))
        .execute(),
      async (swaps: any[]) => {
        console.log(`\n🔔 [${new Date().toLocaleTimeString()}] Swap Update! ${swaps.length} active swaps`);
        
        for (const swap of swaps) {
          console.log(`\n  📦 Swap ${swap.orderHash?.slice(0, 10)}...`);
          console.log(`     Status: ${swap.status}`);
          console.log(`     Src Chain: ${swap.srcChainId} → Dst Chain: ${swap.dstChainId}`);
          console.log(`     Src Amount: ${swap.srcAmount}`);
          console.log(`     Dst Amount: ${swap.dstAmount}`);
          
          // Determine action based on status
          if (swap.status === "pending") {
            console.log(`     ⚠️  ACTION: Need to create source escrow`);
          } else if (swap.status === "src_created" && !swap.dstEscrowAddress) {
            console.log(`     ⚠️  ACTION: Need to create destination escrow`);
            console.log(`     Hashlock: ${swap.hashlock?.slice(0, 20)}...`);
          } else if (swap.status === "dst_created") {
            console.log(`     ⚠️  ACTION: Waiting for secret reveal or timeout`);
          }
        }
        
        if (swaps.length === 0) {
          console.log("  ✅ No pending swaps - resolver is idle");
        }
      },
      (error: Error) => {
        console.error("❌ Subscription error:", error.message);
      }
    );

    this.unsubscribeFns.push(unsubscribe);
    console.log("✅ Atomic swap subscription active");
  }

  // Subscribe to withdrawals to detect revealed secrets
  async subscribeToSecretReveals() {
    console.log("\n🔓 Subscribing to secret reveals...");
    
    const { unsubscribe } = this.client.live(
      (db: any) => db
        .select()
        .from(schema.escrowWithdrawal)
        .where(db.isNotNull(schema.escrowWithdrawal.secret))
        .orderBy(desc(schema.escrowWithdrawal.withdrawnAt))
        .limit(10)
        .execute(),
      (withdrawals: any[]) => {
        if (withdrawals.length > 0) {
          console.log(`\n🔑 [${new Date().toLocaleTimeString()}] Secret Reveal Detected!`);
          
          for (const withdrawal of withdrawals) {
            if (withdrawal.secret) {
              console.log(`  🔓 Escrow: ${withdrawal.escrowAddress?.slice(0, 10)}...`);
              console.log(`     Secret: ${withdrawal.secret.slice(0, 20)}...`);
              console.log(`     Chain: ${withdrawal.chainId}`);
              console.log(`     Block: ${withdrawal.blockNumber}`);
              console.log(`     ⚠️  ACTION: Use this secret to withdraw from corresponding escrow`);
            }
          }
        }
      },
      (error: Error) => {
        console.error("❌ Secret reveal subscription error:", error.message);
      }
    );

    this.unsubscribeFns.push(unsubscribe);
    console.log("✅ Secret reveal subscription active");
  }

  // Subscribe to source escrows directly
  async subscribeToSrcEscrows() {
    console.log("\n📥 Subscribing to source escrows...");
    
    const { unsubscribe } = this.client.live(
      (db: any) => db
        .select()
        .from(schema.srcEscrow)
        .where(
          and(
            eq(schema.srcEscrow.taker, this.resolverAddress),
            eq(schema.srcEscrow.status, "created")
          )
        )
        .orderBy(desc(schema.srcEscrow.createdAt))
        .execute(),
      (escrows: any[]) => {
        if (escrows.length > 0) {
          console.log(`\n📥 [${new Date().toLocaleTimeString()}] Source Escrow Update! ${escrows.length} escrows`);
          
          for (const escrow of escrows) {
            console.log(`  💼 Escrow ${escrow.escrowAddress?.slice(0, 10)}...`);
            console.log(`     Order Hash: ${escrow.orderHash?.slice(0, 20)}...`);
            console.log(`     Hashlock: ${escrow.hashlock?.slice(0, 20)}...`);
            console.log(`     Deadline: ${new Date(Number(escrow.timelocks) * 1000).toLocaleString()}`);
            console.log(`     ⚠️  ACTION: Create corresponding destination escrow`);
          }
        }
      },
      (error: Error) => {
        console.error("❌ Source escrow subscription error:", error.message);
      }
    );

    this.unsubscribeFns.push(unsubscribe);
    console.log("✅ Source escrow subscription active");
  }

  // Get initial state before starting subscriptions
  async getInitialState() {
    console.log("\n📊 Fetching initial state...");
    
    // Get pending swaps
    const swaps = await this.client.db
      .select()
      .from(schema.atomicSwap)
      .where(
        and(
          eq(schema.atomicSwap.srcTaker, this.resolverAddress),
          or(
            eq(schema.atomicSwap.status, "pending"),
            eq(schema.atomicSwap.status, "src_created"),
            eq(schema.atomicSwap.status, "dst_created")
          )
        )
      )
      .execute();
    
    console.log(`  Found ${swaps.length} pending atomic swaps`);
    
    // Get pending source escrows
    const srcEscrows = await this.client.db
      .select()
      .from(schema.srcEscrow)
      .where(
        and(
          eq(schema.srcEscrow.taker, this.resolverAddress),
          eq(schema.srcEscrow.status, "created")
        )
      )
      .execute();
    
    console.log(`  Found ${srcEscrows.length} pending source escrows`);
    
    return { swaps, srcEscrows };
  }

  // Start all subscriptions
  async start() {
    console.log("\n🚀 Starting resolver live client...");
    
    // Get initial state
    await this.getInitialState();
    
    // Set up subscriptions
    await this.subscribeToMySwaps();
    await this.subscribeToSecretReveals();
    await this.subscribeToSrcEscrows();
    
    console.log("\n" + "=".repeat(60));
    console.log("👀 Watching for updates... Press Ctrl+C to stop");
    console.log("=".repeat(60));
  }

  // Clean up
  stop() {
    console.log("\n🛑 Stopping subscriptions...");
    this.unsubscribeFns.forEach(fn => fn());
    console.log("✅ All subscriptions closed");
  }
}

// Main execution
async function main() {
  const client = new ResolverLiveClient(RESOLVER_ADDRESS);
  
  // Handle shutdown
  const shutdown = () => {
    client.stop();
    Deno.exit(0);
  };
  
  // Listen for interrupt signal
  Deno.addSignalListener("SIGINT", shutdown);
  
  try {
    await client.start();
    
    // Keep running until interrupted
    await new Promise(() => {});
  } catch (error) {
    console.error("❌ Fatal error:", error);
    client.stop();
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}