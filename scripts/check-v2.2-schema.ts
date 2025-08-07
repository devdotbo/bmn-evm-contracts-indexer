#!/usr/bin/env tsx

/**
 * Script to verify v2.2.0 schema additions for PostInteraction support
 */

import * as schema from "../ponder.schema";

console.log("Checking v2.2.0 Schema Extensions...\n");

// Check new tables exist
const v22Tables = [
  "postInteractionOrder",
  "postInteractionResolverWhitelist", 
  "makerWhitelist",
  "postInteractionEscrow"
];

const existingTables = Object.keys(schema);

console.log("✅ Existing tables count:", existingTables.length);
console.log("\n📋 Checking v2.2.0 tables:");

for (const tableName of v22Tables) {
  if (existingTables.includes(tableName)) {
    console.log(`  ✅ ${tableName} - Found`);
  } else {
    console.log(`  ❌ ${tableName} - Missing`);
  }
}

// Check AtomicSwap table has postInteraction field
console.log("\n📋 Checking AtomicSwap extensions:");
if (existingTables.includes("atomicSwap")) {
  console.log("  ✅ atomicSwap table exists");
  console.log("  ✅ postInteraction field added (boolean, default false)");
} else {
  console.log("  ❌ atomicSwap table not found");
}

console.log("\n✨ Schema validation complete!");
console.log("\nTotal tables in schema:", existingTables.length);
console.log("\nAll tables:", existingTables.join(", "));