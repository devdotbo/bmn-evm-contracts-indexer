#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Test SQL over HTTP using @ponder/client with Deno
 * Run: deno run --allow-net --allow-env --allow-read scripts/test-sql-deno.ts
 */

import { createClient, eq, desc } from "npm:@ponder/client@0.12.0";
import * as schema from "../ponder.schema.ts";

const PONDER_URL = Deno.env.get("PONDER_URL") || "http://localhost:42069";

console.log("🔍 Testing SQL over HTTP with Deno + @ponder/client");
console.log(`📍 Server: ${PONDER_URL}`);
console.log("=".repeat(50));

async function main() {
  try {
    // Create client with schema
    const client = createClient(`${PONDER_URL}/sql`, { schema });
    console.log("✅ Client created successfully\n");

    // Test 1: Query srcEscrow table
    console.log("📊 Test 1: Querying srcEscrow table...");
    const srcEscrows = await client.db
      .select()
      .from(schema.srcEscrow)
      .limit(5)
      .execute();
    
    console.log(`  Found ${srcEscrows.length} source escrows`);
    if (srcEscrows.length > 0) {
      console.log("  Sample:", {
        id: srcEscrows[0].id,
        chain: srcEscrows[0].chainId,
        status: srcEscrows[0].status,
      });
    }

    // Test 2: Query dstEscrow table
    console.log("\n📊 Test 2: Querying dstEscrow table...");
    const dstEscrows = await client.db
      .select()
      .from(schema.dstEscrow)
      .limit(5)
      .execute();
    
    console.log(`  Found ${dstEscrows.length} destination escrows`);

    // Test 3: Query with where clause
    console.log("\n📊 Test 3: Query active escrows...");
    const activeEscrows = await client.db
      .select()
      .from(schema.srcEscrow)
      .where(eq(schema.srcEscrow.status, "Active"))
      .limit(5)
      .execute();
    
    console.log(`  Found ${activeEscrows.length} active escrows`);

    // Test 4: Query chain statistics
    console.log("\n📊 Test 4: Query chain statistics...");
    const stats = await client.db
      .select()
      .from(schema.chainStatistics)
      .execute();
    
    console.log(`  Found stats for ${stats.length} chains`);
    stats.forEach((stat: any) => {
      console.log(`  Chain ${stat.chain}:`, {
        srcEscrows: stat.totalSrcEscrows,
        dstEscrows: stat.totalDstEscrows,
        withdrawals: stat.totalWithdrawals,
        cancellations: stat.totalCancellations,
      });
    });

    // Test 5: Query BMN token holders
    console.log("\n📊 Test 5: Query BMN token holders...");
    const holders = await client.db
      .select()
      .from(schema.bmnTokenHolder)
      .limit(10)
      .execute();
    
    console.log(`  Found ${holders.length} BMN token holders`);
    if (holders.length > 0) {
      console.log("  Top holder:", {
        address: holders[0].id,
        balance: holders[0].balance,
        chain: holders[0].chainId,
      });
    }

    // Test 6: Query BMN transfers
    console.log("\n📊 Test 6: Query BMN transfers...");
    const transfers = await client.db
      .select()
      .from(schema.bmnTransfer)
      .limit(10)
      .execute();
    
    console.log(`  Found ${transfers.length} BMN transfers`);

    // Test 7: Live query subscription
    console.log("\n📊 Test 7: Testing live query...");
    const { unsubscribe } = client.live(
      (db) => db.select().from(schema.chainStatistics).execute(),
      (data) => {
        console.log("  📡 Live update received!");
        data.forEach((stat: any) => {
          console.log(`    Chain ${stat.chain}: ${stat.totalSrcEscrows} escrows`);
        });
      },
      (error) => {
        console.error("  ❌ Live query error:", error);
      }
    );

    console.log("  ⏳ Waiting 3 seconds for live updates...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    unsubscribe();
    console.log("  ✅ Live query test completed");

    console.log("\n✨ All tests completed successfully!");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("Details:", error.message);
    }
    Deno.exit(1);
  }
}

await main();