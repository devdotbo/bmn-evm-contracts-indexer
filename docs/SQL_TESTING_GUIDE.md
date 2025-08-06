# SQL over HTTP Testing Guide

## Overview

This guide documents how to test the SQL over HTTP functionality in the BMN EVM Contracts Indexer. The SQL endpoint uses a proprietary protocol that requires the `@ponder/client` package and cannot be tested with standard curl commands.

## Quick Test

The fastest way to test SQL over HTTP:

```bash
# Using Deno (no installation needed)
deno run --node-modules-dir=auto --allow-net --allow-env --allow-read scripts/test-sql-deno.ts
```

## Why curl Doesn't Work

Direct curl requests to the SQL endpoint will fail:

```bash
# This will return 404 Not Found
curl -X POST http://localhost:42069/sql \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM \"SrcEscrow\" LIMIT 5"}'
```

**Reasons:**
- The endpoint uses a proprietary protocol implemented by `@ponder/client`
- Request formatting and headers are handled internally by the client library
- The server expects specific protocol handshake and message format

## Testing Methods

### Method 1: Deno Test Script (Recommended)

**Advantages:**
- No package installation required
- Self-contained test script
- Comprehensive test coverage

**Command:**
```bash
deno run --node-modules-dir=auto --allow-net --allow-env --allow-read scripts/test-sql-deno.ts
```

**What it tests:**
- Connection to SQL endpoint
- Querying all tables (srcEscrow, dstEscrow, atomicSwap, etc.)
- Live query subscriptions (Server-Sent Events)
- Data retrieval and formatting

### Method 2: Node.js Test Script

**Requirements:**
- `@ponder/client` package installed
- TypeScript execution environment (tsx)

**Command:**
```bash
npx tsx scripts/test-ponder-client.ts
```

### Method 3: Custom Client Implementation

Create your own test client using `@ponder/client`:

```typescript
import { createClient } from "@ponder/client";
import * as schema from "./ponder.schema";

const client = createClient("http://localhost:42069/sql", { schema });

// Test query
const results = await client.db
  .select()
  .from(schema.srcEscrow)
  .limit(10)
  .execute();

console.log("Query results:", results);
```

## Verifying Endpoint Health

While SQL queries require `@ponder/client`, you can verify the indexer is running:

```bash
# Health check (works with curl)
curl http://localhost:42069/health

# Ready check (works with curl)
curl http://localhost:42069/ready

# GraphQL endpoint (works with curl)
curl -X POST http://localhost:42069/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ srcEscrows(limit: 5) { items { id status } } }"}'
```

## Expected Test Output

A successful test run will show:

```
Testing SQL over HTTP with Deno + @ponder/client
Server: http://localhost:42069
==================================================
Client created successfully

Test 1: Querying srcEscrow table...
  Found X source escrows

Test 2: Querying dstEscrow table...
  Found X destination escrows

Test 3: Query active escrows...
  Found X active escrows

Test 4: Query chain statistics...
  Found stats for X chains

Test 5: Query BMN token holders...
  Found X BMN token holders
  Top holder: {
    address: "...",
    balance: ...,
    chain: ...
  }

Test 6: Query BMN transfers...
  Found X BMN transfers

Test 7: Testing live query...
  Waiting 3 seconds for live updates...
  Live update received!
  Live query test completed

All tests completed successfully!
```

## Troubleshooting

### Issue: Indexer Not Running
**Symptom:** Connection refused errors  
**Solution:** Start the indexer with `make dev` or `pnpm run dev`

### Issue: 404 Not Found
**Symptom:** Direct curl/fetch requests return 404  
**Solution:** Use `@ponder/client` package instead of direct HTTP requests

### Issue: Schema Errors
**Symptom:** "Cannot read properties of undefined" errors  
**Solution:** Run `pnpm codegen` to regenerate schema types

### Issue: No Data Returned
**Symptom:** Queries succeed but return empty arrays  
**Solution:** Check if indexer has synced data (check logs for sync progress)

## Integration Testing

### In React Applications

```typescript
import { createClient } from "@ponder/client";
import * as schema from "./ponder.schema";

function TestSQLConnection() {
  const [status, setStatus] = useState("testing...");
  
  useEffect(() => {
    const client = createClient("http://localhost:42069/sql", { schema });
    
    client.db
      .select()
      .from(schema.chainStatistics)
      .execute()
      .then(data => setStatus(`Connected! Found ${data.length} chains`))
      .catch(err => setStatus(`Failed: ${err.message}`));
  }, []);
  
  return <div>SQL Status: {status}</div>;
}
```

### In Node.js Scripts

```javascript
const { createClient } = require("@ponder/client");

async function testConnection() {
  const client = createClient("http://localhost:42069/sql");
  
  try {
    const result = await client.execute({
      sql: "SELECT COUNT(*) as count FROM bmn_transfer"
    });
    console.log("Connection successful:", result);
  } catch (error) {
    console.error("Connection failed:", error);
  }
}

testConnection();
```

## Performance Testing

To test query performance:

```bash
# Run performance test
deno run --allow-net --allow-env --allow-read --allow-hrtime scripts/test-sql-performance.ts
```

This will measure:
- Query latency
- Throughput (queries per second)
- Live subscription response time
- Concurrent query handling

## Security Testing

The SQL endpoint includes security measures:
- Read-only transactions enforced
- Only SELECT statements allowed
- Schema isolation
- Statement timeout limits
- SQL injection protection via parameterized queries

Test these protections:

```typescript
// These should all fail with appropriate errors
const securityTests = [
  "DROP TABLE src_escrow",  // Should fail: not a SELECT
  "UPDATE src_escrow SET status = 'hacked'",  // Should fail: not a SELECT
  "SELECT * FROM pg_user",  // Should fail: schema isolation
];
```

## Continuous Testing

For CI/CD integration:

```yaml
# .github/workflows/test-sql.yml
name: Test SQL over HTTP
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      - name: Start services
        run: make docker-up
      - name: Wait for indexer
        run: ./scripts/wait-for-indexer.sh
      - name: Run SQL tests
        run: deno run --allow-net --allow-env --allow-read scripts/test-sql-deno.ts
```

## Summary

- **Cannot test with curl**: The SQL endpoint requires `@ponder/client`
- **Use provided test scripts**: Deno script is the easiest option
- **Verify health first**: Check `/health` endpoint before testing SQL
- **Monitor test output**: Look for successful connections and data retrieval
- **Integration ready**: Use `@ponder/client` in your applications for type-safe queries