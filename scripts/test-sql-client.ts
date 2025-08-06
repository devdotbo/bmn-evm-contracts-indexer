#!/usr/bin/env tsx

/**
 * Test client for SQL over HTTP functionality
 * This demonstrates the correct way to query Ponder's SQL endpoint
 */

import { createClient } from "@ponder/client";
import { eq } from "drizzle-orm";
import * as schema from "../ponder.schema";

// Configuration
const PONDER_URL = process.env.PONDER_URL || "http://localhost:42069";
const SQL_ENDPOINT = `${PONDER_URL}/sql`;

console.log("🔍 Testing SQL over HTTP Client");
console.log(`📍 Endpoint: ${SQL_ENDPOINT}`);
console.log("=" .repeat(50));

async function testSqlClient() {
  try {
    // Create the client
    const client = createClient(SQL_ENDPOINT);
    console.log("✅ Client created successfully");

    // Test 1: Query SrcEscrow table
    console.log("\n📊 Test 1: Querying SrcEscrow table...");
    const srcEscrows = await client.db
      .select()
      .from(schema.SrcEscrow)
      .limit(5);
    
    console.log(`  Found ${srcEscrows.length} source escrows`);
    if (srcEscrows.length > 0) {
      console.log("  Sample escrow:", {
        id: srcEscrows[0].id,
        chain: srcEscrows[0].chain,
        status: srcEscrows[0].status,
      });
    }

    // Test 2: Query DstEscrow table
    console.log("\n📊 Test 2: Querying DstEscrow table...");
    const dstEscrows = await client.db
      .select()
      .from(schema.DstEscrow)
      .limit(5);
    
    console.log(`  Found ${dstEscrows.length} destination escrows`);

    // Test 3: Query AtomicSwap table
    console.log("\n📊 Test 3: Querying AtomicSwap table...");
    const swaps = await client.db
      .select()
      .from(schema.AtomicSwap)
      .limit(5);
    
    console.log(`  Found ${swaps.length} atomic swaps`);

    // Test 4: Query ChainStatistics
    console.log("\n📊 Test 4: Querying ChainStatistics...");
    const stats = await client.db
      .select()
      .from(schema.ChainStatistics);
    
    console.log(`  Found statistics for ${stats.length} chains`);
    stats.forEach(stat => {
      console.log(`  Chain ${stat.chain}:`, {
        totalSrcEscrows: stat.totalSrcEscrows,
        totalDstEscrows: stat.totalDstEscrows,
        totalWithdrawals: stat.totalWithdrawals,
        totalCancellations: stat.totalCancellations,
      });
    });

    // Test 5: Query BMN Token data
    console.log("\n📊 Test 5: Querying BMN Token holders...");
    const holders = await client.db
      .select()
      .from(schema.BmnTokenHolder)
      .limit(10);
    
    console.log(`  Found ${holders.length} BMN token holders`);

    // Test 6: Complex query with where clause
    console.log("\n📊 Test 6: Testing complex queries...");
    const activeEscrows = await client.db
      .select()
      .from(schema.SrcEscrow)
      .where(eq(schema.SrcEscrow.status, "Active"))
      .limit(5);
    
    console.log(`  Found ${activeEscrows.length} active source escrows`);

    // Test 7: Live query subscription (brief test)
    console.log("\n📊 Test 7: Testing live query subscription...");
    const unsubscribe = await client.live(
      (db) => db.select().from(schema.ChainStatistics),
      (result) => {
        console.log("  Live update received: Chain stats updated");
        // Immediately unsubscribe for this test
        unsubscribe();
      }
    );
    
    // Wait briefly to see if we get any updates
    await new Promise(resolve => setTimeout(resolve, 1000));
    unsubscribe();
    console.log("  Live query test completed");

    console.log("\n✅ All SQL over HTTP tests completed successfully!");
    
  } catch (error) {
    console.error("\n❌ Error testing SQL client:", error);
    if (error instanceof Error) {
      console.error("  Message:", error.message);
      console.error("  Stack:", error.stack);
    }
    process.exit(1);
  }
}

// Run the tests
testSqlClient().catch(console.error);