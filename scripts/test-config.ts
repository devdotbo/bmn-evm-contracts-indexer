#!/usr/bin/env tsx

/**
 * Test script to verify the Ponder configuration handles block ranges correctly
 * 
 * This script:
 * 1. Loads the configuration
 * 2. Tests block range queries
 * 3. Verifies limits are respected
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { base, etherlink } from 'viem/chains';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Factory address
const FACTORY_ADDRESS = "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1";

// Test configuration
const ETHERLINK_BLOCK_LIMIT = 95;
const BASE_BLOCK_LIMIT = 5000;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Helper to test block range queries
async function testBlockRange(
  client: PublicClient,
  chainName: string,
  startBlock: bigint,
  blockLimit: number
) {
  console.log(`\n${colors.blue}Testing ${chainName} block range queries...${colors.reset}`);
  
  const currentBlock = await client.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);
  
  // Test different block ranges
  const testRanges = [
    { from: startBlock, to: startBlock + BigInt(blockLimit - 1), expected: 'PASS' },
    { from: startBlock, to: startBlock + BigInt(blockLimit), expected: 'PASS (at limit)' },
    { from: startBlock, to: startBlock + BigInt(blockLimit + 10), expected: 'FAIL (exceeds limit)' },
    { from: currentBlock - BigInt(blockLimit - 1), to: currentBlock, expected: 'PASS' },
  ];
  
  for (const range of testRanges) {
    const rangeSize = Number(range.to - range.from) + 1;
    console.log(`\nTesting range: ${range.from} to ${range.to} (${rangeSize} blocks)`);
    
    try {
      const logs = await client.getLogs({
        address: FACTORY_ADDRESS,
        fromBlock: range.from,
        toBlock: range.to,
      });
      
      console.log(`${colors.green}✓ Success${colors.reset} - Found ${logs.length} logs`);
      
      if (range.expected.includes('FAIL')) {
        console.log(`${colors.yellow}⚠ Warning: Expected failure but query succeeded${colors.reset}`);
      }
    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      
      if (range.expected.includes('FAIL')) {
        console.log(`${colors.green}✓ Expected failure${colors.reset}: ${errorMessage}`);
      } else {
        console.log(`${colors.red}✗ Unexpected failure${colors.reset}: ${errorMessage}`);
      }
    }
  }
}

// Main test function
async function main() {
  console.log(`${colors.blue}=== Ponder Configuration Test ===${colors.reset}`);
  console.log(`Testing block range limits for factory queries\n`);
  
  // Create clients
  const baseClient = createPublicClient({
    chain: base,
    transport: http(process.env.PONDER_RPC_URL_8453),
  });
  
  const etherlinkClient = createPublicClient({
    chain: etherlink,
    transport: http(process.env.PONDER_RPC_URL_42793 || 'https://node.mainnet.etherlink.com'),
  });
  
  // Test Base network
  const baseStartBlock = BigInt(process.env.BASE_START_BLOCK || '33726385');
  await testBlockRange(baseClient, 'Base', baseStartBlock, BASE_BLOCK_LIMIT);
  
  // Test Etherlink network
  const etherlinkStartBlock = BigInt(process.env.ETHERLINK_START_BLOCK || '22523319');
  await testBlockRange(etherlinkClient, 'Etherlink', etherlinkStartBlock, ETHERLINK_BLOCK_LIMIT);
  
  console.log(`\n${colors.blue}=== Configuration Recommendations ===${colors.reset}`);
  console.log(`
1. For Etherlink:
   - maxHistoricalBlockRange: ${ETHERLINK_BLOCK_LIMIT}
   - Avoid factory pattern (bypasses block limits)
   - Track factory events directly

2. For Base:
   - maxHistoricalBlockRange: ${BASE_BLOCK_LIMIT}
   - Factory pattern is safe to use

3. General:
   - Use separate contract definitions per chain
   - Monitor logs for block range errors
   - Consider using more recent start blocks if possible
  `);
}

// Run tests
main().catch((error) => {
  console.error(`${colors.red}Test failed:${colors.reset}`, error);
  process.exit(1);
});