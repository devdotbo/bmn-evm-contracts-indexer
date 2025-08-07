#!/usr/bin/env node

/**
 * BMN v2.2.0 PostInteraction GraphQL Test Script
 * Tests all PostInteraction-related GraphQL queries
 */

import http from 'http';

// Configuration
const GRAPHQL_ENDPOINT = 'http://localhost:42069/graphql';
const ENDPOINT_URL = new URL(GRAPHQL_ENDPOINT);

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Helper function to make GraphQL requests
async function queryGraphQL(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, variables });

    const options = {
      hostname: ENDPOINT_URL.hostname,
      port: ENDPOINT_URL.port,
      path: ENDPOINT_URL.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Test queries
const testQueries = {
  // Test PostInteractionOrder table
  postInteractionOrders: {
    name: 'PostInteractionOrder Records',
    query: `
      query {
        postInteractionOrders(
          limit: 10
          orderBy: "timestamp"
          orderDirection: "desc"
        ) {
          items {
            id
            orderHash
            maker
            taker
            makerAsset
            takerAsset
            makingAmount
            takingAmount
            srcEscrow
            dstEscrow
            status
            filledAt
            chainId
            blockNumber
            timestamp
            transactionHash
          }
        }
      }
    `
  },

  // Test PostInteractionResolverWhitelist table
  postInteractionResolverWhitelists: {
    name: 'PostInteraction Resolver Whitelist',
    query: `
      query {
        postInteractionResolverWhitelists(
          limit: 10
          orderBy: "whitelistedAt"
          orderDirection: "desc"
        ) {
          items {
            id
            resolver
            chainId
            isWhitelisted
            whitelistedAt
            removedAt
            blockNumber
            transactionHash
          }
        }
      }
    `
  },

  // Test MakerWhitelist table
  makerWhitelists: {
    name: 'Maker Whitelist',
    query: `
      query {
        makerWhitelists(
          limit: 10
          orderBy: "whitelistedAt"
          orderDirection: "desc"
        ) {
          items {
            id
            maker
            chainId
            isWhitelisted
            whitelistedAt
            removedAt
            blockNumber
            transactionHash
          }
        }
      }
    `
  },

  // Test PostInteractionEscrow table
  postInteractionEscrows: {
    name: 'PostInteraction Escrows',
    query: `
      query {
        postInteractionEscrows(
          limit: 10
          orderBy: "createdAt"
          orderDirection: "desc"
        ) {
          items {
            id
            orderHash
            escrowAddress
            escrowType
            chainId
            createdAt
            blockNumber
            transactionHash
          }
        }
      }
    `
  },

  // Test AtomicSwap with postInteraction flag
  atomicSwapsWithPostInteraction: {
    name: 'Atomic Swaps with PostInteraction',
    query: `
      query {
        atomicSwaps(
          where: { postInteraction: true }
          limit: 10
          orderBy: "srcCreatedAt"
          orderDirection: "desc"
        ) {
          items {
            id
            orderHash
            hashlock
            srcChainId
            dstChainId
            srcEscrowAddress
            dstEscrowAddress
            srcMaker
            srcTaker
            dstMaker
            dstTaker
            srcToken
            srcAmount
            dstToken
            dstAmount
            status
            postInteraction
            srcCreatedAt
            dstCreatedAt
            completedAt
            secret
          }
        }
      }
    `
  },

  // Test regular Atomic Swaps (non-PostInteraction)
  regularAtomicSwaps: {
    name: 'Regular Atomic Swaps (non-PostInteraction)',
    query: `
      query {
        atomicSwaps(
          where: { postInteraction: false }
          limit: 5
          orderBy: "srcCreatedAt"
          orderDirection: "desc"
        ) {
          items {
            id
            orderHash
            status
            postInteraction
            srcChainId
            dstChainId
          }
        }
      }
    `
  },

  // Test chain-specific PostInteraction orders
  basePostInteractionOrders: {
    name: 'Base Chain PostInteraction Orders',
    query: `
      query {
        postInteractionOrders(
          where: { chainId: 8453 }
          limit: 5
        ) {
          items {
            id
            orderHash
            chainId
            status
            maker
            taker
          }
        }
      }
    `
  },

  optimismPostInteractionOrders: {
    name: 'Optimism Chain PostInteraction Orders',
    query: `
      query {
        postInteractionOrders(
          where: { chainId: 10 }
          limit: 5
        ) {
          items {
            id
            orderHash
            chainId
            status
            maker
            taker
          }
        }
      }
    `
  },

  // Test filled PostInteraction orders
  filledPostInteractionOrders: {
    name: 'Filled PostInteraction Orders',
    query: `
      query {
        postInteractionOrders(
          where: { status: "filled" }
          limit: 10
        ) {
          items {
            id
            orderHash
            status
            filledAt
            srcEscrow
            dstEscrow
          }
        }
      }
    `
  },

  // Test whitelisted resolvers
  activeResolvers: {
    name: 'Active Whitelisted Resolvers',
    query: `
      query {
        postInteractionResolverWhitelists(
          where: { isWhitelisted: true }
        ) {
          items {
            id
            resolver
            chainId
            isWhitelisted
            whitelistedAt
          }
        }
      }
    `
  },

  // Test whitelisted makers
  activeMakers: {
    name: 'Active Whitelisted Makers',
    query: `
      query {
        makerWhitelists(
          where: { isWhitelisted: true }
        ) {
          items {
            id
            maker
            chainId
            isWhitelisted
            whitelistedAt
          }
        }
      }
    `
  },

  // Test PostInteraction escrow linkages
  srcPostInteractionEscrows: {
    name: 'Source PostInteraction Escrows',
    query: `
      query {
        postInteractionEscrows(
          where: { escrowType: "src" }
          limit: 10
        ) {
          items {
            id
            orderHash
            escrowAddress
            escrowType
            chainId
            createdAt
          }
        }
      }
    `
  },

  dstPostInteractionEscrows: {
    name: 'Destination PostInteraction Escrows',
    query: `
      query {
        postInteractionEscrows(
          where: { escrowType: "dst" }
          limit: 10
        ) {
          items {
            id
            orderHash
            escrowAddress
            escrowType
            chainId
            createdAt
          }
        }
      }
    `
  }
};

// Function to run a single test
async function runTest(testName, testConfig) {
  console.log(`\n${colors.blue}Testing: ${testConfig.name}${colors.reset}`);
  console.log('─'.repeat(50));

  try {
    const result = await queryGraphQL(testConfig.query);

    if (result.errors) {
      console.log(`${colors.red}✗ Query failed with errors:${colors.reset}`);
      console.log(JSON.stringify(result.errors, null, 2));
      return { success: false, error: result.errors };
    }

    if (result.data) {
      const tableName = Object.keys(result.data)[0];
      const items = result.data[tableName]?.items || [];

      if (items.length === 0) {
        console.log(`${colors.yellow}→ No records found (table may be empty)${colors.reset}`);
        return { success: true, empty: true, count: 0 };
      } else {
        console.log(`${colors.green}✓ Query successful${colors.reset}`);
        console.log(`${colors.green}→ Found ${items.length} record(s)${colors.reset}`);
        
        // Display first record as sample
        if (items[0]) {
          console.log(`\n${colors.blue}Sample record:${colors.reset}`);
          console.log(JSON.stringify(items[0], null, 2));
        }
        
        return { success: true, empty: false, count: items.length };
      }
    }

    console.log(`${colors.red}✗ Unexpected response format${colors.reset}`);
    return { success: false, error: 'Unexpected response format' };

  } catch (error) {
    console.log(`${colors.red}✗ Test failed: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

// Function to test GraphQL endpoint connectivity
async function testEndpointConnectivity() {
  console.log(`${colors.blue}Testing GraphQL Endpoint Connectivity${colors.reset}`);
  console.log('─'.repeat(50));

  try {
    const result = await queryGraphQL('{ __schema { types { name } } }');
    
    if (result.data && result.data.__schema) {
      console.log(`${colors.green}✓ GraphQL endpoint is accessible${colors.reset}`);
      
      // Count PostInteraction-related types
      const types = result.data.__schema.types.map(t => t.name);
      const postInteractionTypes = types.filter(t => 
        t.toLowerCase().includes('postinteraction') || 
        t.toLowerCase().includes('maker')
      );
      
      console.log(`${colors.green}→ Found ${postInteractionTypes.length} PostInteraction-related types${colors.reset}`);
      if (postInteractionTypes.length > 0) {
        console.log(`  Types: ${postInteractionTypes.join(', ')}`);
      }
      
      return true;
    }
    
    console.log(`${colors.red}✗ GraphQL endpoint not responding correctly${colors.reset}`);
    return false;

  } catch (error) {
    console.log(`${colors.red}✗ Failed to connect: ${error.message}${colors.reset}`);
    return false;
  }
}

// Main test runner
async function main() {
  console.log('═'.repeat(60));
  console.log(`${colors.yellow}BMN v2.2.0 PostInteraction GraphQL Tests${colors.reset}`);
  console.log('═'.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);

  // Test connectivity first
  const isConnected = await testEndpointConnectivity();
  
  if (!isConnected) {
    console.log(`\n${colors.red}Cannot proceed with tests - endpoint not accessible${colors.reset}`);
    process.exit(1);
  }

  // Run all tests
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    empty: 0
  };

  for (const [testName, testConfig] of Object.entries(testQueries)) {
    const result = await runTest(testName, testConfig);
    results.total++;
    
    if (result.success) {
      results.successful++;
      if (result.empty) {
        results.empty++;
      }
    } else {
      results.failed++;
    }
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log(`${colors.yellow}TEST SUMMARY${colors.reset}`);
  console.log('═'.repeat(60));
  console.log(`Total tests: ${results.total}`);
  console.log(`${colors.green}Successful: ${results.successful}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`${colors.yellow}Empty tables: ${results.empty}${colors.reset}`);
  
  // Overall status
  if (results.failed === 0) {
    console.log(`\n${colors.green}✓ All tests passed successfully!${colors.reset}`);
    if (results.empty > 0) {
      console.log(`${colors.yellow}Note: ${results.empty} tables are empty (no PostInteraction events indexed yet)${colors.reset}`);
    }
  } else {
    console.log(`\n${colors.red}✗ Some tests failed. Please check the errors above.${colors.reset}`);
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

// Run tests
main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});