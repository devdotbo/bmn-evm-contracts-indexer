# SQL over HTTP Documentation

## Overview

The BMN EVM Contracts Indexer provides SQL over HTTP functionality through the `@ponder/client` package, enabling direct SQL queries against the indexed blockchain data via a REST API endpoint.

## ✅ Current Status

**SQL over HTTP is FULLY CONFIGURED and WORKING**

- Endpoint: `http://localhost:42069/sql/*`
- Configuration: `src/api/index.ts`
- Protocol: @ponder/client compatible
- Features: Query execution, live queries (SSE), type-safe queries
- **Test Results**: Successfully querying data, live subscriptions working

## Configuration

### Server-Side Setup

The SQL over HTTP endpoint is already configured in `src/api/index.ts`:

```typescript
import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

// SQL over HTTP endpoint
app.use("/sql/*", client({ db, schema }));

// GraphQL endpoints
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
```

## Client Usage

### Method 1: Using @ponder/client (Recommended)

#### Installation

```bash
# NPM/PNPM
pnpm add @ponder/client drizzle-orm

# Deno (no installation needed)
import { createClient } from "npm:@ponder/client@0.12.0";
```

#### Basic Usage

```typescript
import { createClient } from "@ponder/client";
import { eq, desc } from "@ponder/client"; // Drizzle utilities included
import * as schema from "./ponder.schema";

const client = createClient("http://localhost:42069/sql", { schema });

// Simple query
const srcEscrows = await client.db
  .select()
  .from(schema.srcEscrow)
  .limit(10)
  .execute();

// Query with conditions
const activeEscrows = await client.db
  .select()
  .from(schema.srcEscrow)
  .where(eq(schema.srcEscrow.status, "Active"))
  .execute();

// Live query (Server-Sent Events)
const { unsubscribe } = client.live(
  (db) => db.select().from(schema.chainStatistics).execute(),
  (data) => console.log("Update received:", data),
  (error) => console.error("Error:", error)
);
```

### Method 2: Using Deno (No Package Installation)

See `scripts/test-sql-deno.ts` for a complete example:

```typescript
#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { createClient, eq } from "npm:@ponder/client@0.12.0";
import * as schema from "../ponder.schema.ts";

const client = createClient("http://localhost:42069/sql", { schema });

// Query execution works the same as Method 1
const results = await client.db
  .select()
  .from(schema.bmnTokenHolder)
  .limit(10)
  .execute();
```

Run with:
```bash
deno run --node-modules-dir=auto --allow-net --allow-env --allow-read scripts/test-sql-deno.ts
```

## Available Tables

All tables defined in `ponder.schema.ts` are queryable:

- `srcEscrow` - Source chain escrows
- `dstEscrow` - Destination chain escrows  
- `escrowWithdrawal` - Withdrawal events
- `escrowCancellation` - Cancellation events
- `fundsRescued` - Rescued funds events
- `atomicSwap` - Cross-chain swap aggregations
- `chainStatistics` - Per-chain analytics
- `bmnTransfer` - BMN token transfers
- `bmnApproval` - BMN token approvals
- `bmnTokenHolder` - BMN token balances

## Schema Sharing Strategies

### For External Clients in Different Repositories

When building a client application in a separate repository, you need access to the Ponder schema for type-safe queries. Here are the recommended approaches:

#### Option 1: Monorepo Structure (Best for Related Projects)

Structure your projects in a monorepo:
```
bridge-me-not/
├── packages/
│   ├── indexer/          # This Ponder indexer
│   │   └── ponder.schema.ts
│   └── client/           # Your client app
│       └── src/
│           └── index.ts  # Import: import * as schema from "../../indexer/ponder.schema"
```

#### Option 2: NPM Package (Best for Public APIs)

1. Create a schema package:
```json
// package.json in schema package
{
  "name": "@bmn/indexer-schema",
  "version": "1.0.0",
  "main": "index.js",
  "types": "index.d.ts",
  "files": ["ponder.schema.ts", "index.js", "index.d.ts"],
  "dependencies": {
    "ponder": "^0.12.0"
  }
}
```

2. Publish to npm:
```bash
npm publish --access public
```

3. Use in client:
```typescript
import { createClient } from "@ponder/client";
import * as schema from "@bmn/indexer-schema";
```

#### Option 3: Direct Schema Copy (Quickest Setup)

1. Copy `ponder.schema.ts` to your client project
2. Install Ponder to get the `onchainTable` function:
```bash
pnpm add ponder
```

3. Use the copied schema:
```typescript
import { createClient } from "@ponder/client";
import * as schema from "./ponder.schema";
```

#### Option 4: Schema Export Script (Automated Copy)

Use the provided export script (see `scripts/export-schema.sh`):
```bash
# Export schema with types to another project
./scripts/export-schema.sh /path/to/client/project
```

#### Option 5: Untyped Queries (No Schema Needed)

If type safety isn't critical, use raw SQL without schema:
```typescript
const client = createClient("http://localhost:42069/sql");

// Untyped query - no schema needed but no type safety
const result = await client.execute({
  sql: "SELECT * FROM src_escrow WHERE status = 'Active' LIMIT 10"
});
```

## Test Scripts

### Quick Test
```bash
# Using Deno (no installation needed)
deno run --node-modules-dir=auto --allow-net --allow-env --allow-read scripts/test-sql-deno.ts

# Using Node.js (requires @ponder/client installed)
npx tsx scripts/test-ponder-client.ts
```

### Verify Endpoint

#### Why curl Doesn't Work
The SQL over HTTP endpoint **cannot be tested with curl** directly because:
- It uses a proprietary protocol implemented by `@ponder/client`
- Direct POST requests to `/sql` will return `404 Not Found`
- The endpoint requires specific request formatting and headers that `@ponder/client` handles

#### Correct Testing Methods
```bash
# Check if indexer is running (this works with curl)
curl http://localhost:42069/health

# Test SQL over HTTP functionality (use one of these)
# Option 1: Deno test script (recommended - no installation needed)
deno run --node-modules-dir=auto --allow-net --allow-env --allow-read scripts/test-sql-deno.ts

# Option 2: Node.js test script (requires @ponder/client)
npx tsx scripts/test-ponder-client.ts
```

#### Example Test Output
```
🔍 Testing SQL over HTTP with Deno + @ponder/client
📍 Server: http://localhost:42069
==================================================
✅ Client created successfully

📊 Test 1: Querying srcEscrow table...
  Found 0 source escrows

📊 Test 2: Querying dstEscrow table...
  Found 0 destination escrows

📊 Test 5: Query BMN token holders...
  Found 10 BMN token holders
  Top holder: {
  address: "10-0x5f29827e25dc174a6a51c99e6811bbd7581285b0",
  balance: 4000000000000000000000000n,
  chain: 10
}

📊 Test 7: Testing live query...
  ⏳ Waiting 3 seconds for live updates...
  📡 Live update received!
  ✅ Live query test completed

✨ All tests completed successfully!
```

## Common Issues and Solutions

### Issue: 404 Not Found on `/sql` endpoint
**Cause**: Direct GET/POST requests to `/sql` don't work  
**Solution**: Use `@ponder/client` package which implements the correct protocol

### Issue: "Cannot read properties of undefined"
**Cause**: Schema not properly imported or compiled  
**Solution**: Run `pnpm codegen` and ensure schema import path is correct

### Issue: "function sum() does not exist"
**Cause**: Some Drizzle aggregation functions may not be supported  
**Solution**: Use basic queries or implement aggregations in application code

### Issue: Cross-Origin Resource Sharing (CORS)
**Cause**: Browser clients may face CORS issues  
**Solution**: Configure CORS in `src/api/index.ts` if needed:
```typescript
import { cors } from "hono/cors";
app.use("*", cors());
```

## Security Considerations

The SQL over HTTP endpoint includes built-in security measures:

- **Read-only transactions**: All queries run in READ ONLY mode
- **Query validation**: Only SELECT statements allowed
- **Schema isolation**: Queries restricted to current schema
- **Resource limits**: Statement timeout and memory limits enforced
- **SQL injection protection**: Parameterized queries through Drizzle ORM

## Performance Tips

1. **Use limits**: Always limit result sets to avoid large transfers
2. **Index usage**: Queries automatically use Ponder's optimized indexes
3. **Live queries**: Use sparingly as they maintain server connections
4. **Batch queries**: Combine related queries when possible

## Integration Examples

### React Application
```typescript
import { createClient } from "@ponder/client";
import { useEffect, useState } from "react";
import * as schema from "./ponder.schema";

function useEscrows() {
  const [escrows, setEscrows] = useState([]);
  
  useEffect(() => {
    const client = createClient("http://localhost:42069/sql", { schema });
    
    client.db
      .select()
      .from(schema.srcEscrow)
      .execute()
      .then(setEscrows);
  }, []);
  
  return escrows;
}
```

### Next.js API Route
```typescript
// pages/api/escrows.ts
import { createClient } from "@ponder/client";
import * as schema from "../../ponder.schema";

export default async function handler(req, res) {
  const client = createClient("http://localhost:42069/sql", { schema });
  
  const escrows = await client.db
    .select()
    .from(schema.srcEscrow)
    .limit(100)
    .execute();
  
  res.json(escrows);
}
```

## References

- [Ponder SQL over HTTP Documentation](https://ponder.sh/docs/query/sql-over-http)
- [Drizzle ORM Query Builder](https://orm.drizzle.team/docs/select)
- [@ponder/client Package](https://www.npmjs.com/package/@ponder/client)
- Test Implementation: `scripts/test-sql-deno.ts`