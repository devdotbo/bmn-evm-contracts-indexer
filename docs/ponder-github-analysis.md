# Ponder v0.12.0 GitHub Repository Analysis

## Overview

This document analyzes the ponder-sh/ponder GitHub repository to understand patterns and best practices for version 0.12.0. Based on examination of example projects, the following patterns emerge for modern Ponder development.

## Key Import Patterns

### Schema Imports
```typescript
// Modern import pattern (v0.12.0+)
import { onchainTable, index, primaryKey, relations } from "ponder";

// Schema usage in indexing files
import { account, transferEvent } from "ponder:schema";
// OR
import schema from "ponder:schema";
```

### Registry Imports
```typescript
import { ponder } from "ponder:registry";
```

### Config Imports
```typescript
import { createConfig, factory } from "ponder";
```

## Schema Definition Patterns

### Basic Table Definition
```typescript
// From examples/reference-erc20/ponder.schema.ts
import { onchainTable } from "ponder";

export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  balance: t.bigint().notNull(),
  isOwner: t.boolean().notNull(),
}));
```

### Tables with Composite Primary Keys
```typescript
// From examples/reference-erc20/ponder.schema.ts
import { onchainTable, primaryKey } from "ponder";

export const allowance = onchainTable(
  "allowance",
  (t) => ({
    owner: t.hex(),
    spender: t.hex(),
    amount: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.owner, table.spender] }),
  }),
);
```

### Tables with Indexes
```typescript
// From examples/reference-erc20/ponder.schema.ts
import { onchainTable, index } from "ponder";

export const transferEvent = onchainTable(
  "transfer_event",
  (t) => ({
    id: t.text().primaryKey(),
    amount: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    from: t.hex().notNull(),
    to: t.hex().notNull(),
  }),
  (table) => ({
    fromIdx: index("from_index").on(table.from),
  }),
);
```

### Relations Definition
```typescript
// From examples/reference-erc20/ponder.schema.ts
import { relations } from "ponder";

export const accountRelations = relations(account, ({ many }) => ({
  transferFromEvents: many(transferEvent, { relationName: "from_account" }),
  transferToEvents: many(transferEvent, { relationName: "to_account" }),
}));

export const transferEventRelations = relations(transferEvent, ({ one }) => ({
  fromAccount: one(account, {
    relationName: "from_account",
    fields: [transferEvent.from],
    references: [account.address],
  }),
  toAccount: one(account, {
    relationName: "to_account",
    fields: [transferEvent.to],
    references: [account.address],
  }),
}));
```

## Database Operations

### Insert with Conflict Handling
```typescript
// From examples/reference-erc20/src/index.ts
ponder.on("ERC20:Transfer", async ({ event, context }) => {
  // Upsert pattern - insert or update on conflict
  await context.db
    .insert(account)
    .values({ address: event.args.from, balance: 0n, isOwner: false })
    .onConflictDoUpdate((row) => ({
      balance: row.balance - event.args.amount,
    }));

  // Insert only if not exists
  await context.db
    .insert(account)
    .values({ address: event.args.to })
    .onConflictDoNothing();
});
```

### Simple Insert
```typescript
// From examples/reference-erc20/src/index.ts
await context.db.insert(transferEvent).values({
  id: event.id,
  amount: event.args.amount,
  timestamp: Number(event.block.timestamp),
  from: event.args.from,
  to: event.args.to,
});
```

### Update on Conflict with Specific Values
```typescript
// From examples/reference-erc20/src/index.ts
await context.db
  .insert(allowance)
  .values({
    spender: event.args.spender,
    owner: event.args.owner,
    amount: event.args.amount,
  })
  .onConflictDoUpdate({ amount: event.args.amount });
```

## Factory Pattern Implementation

### Config Setup with Factory
```typescript
// From examples/feature-factory/ponder.config.ts
import { parseAbiItem } from "abitype";
import { createConfig, factory } from "ponder";

const llamaFactoryEvent = parseAbiItem(
  "event LlamaInstanceCreated(address indexed deployer, string indexed name, address llamaCore, address llamaExecutor, address llamaPolicy, uint256 chainId)",
);

export default createConfig({
  chains: {
    sepolia: {
      id: 11155111,
      rpc: process.env.PONDER_RPC_URL_11155111,
    },
  },
  contracts: {
    LlamaCore: {
      chain: "sepolia",
      abi: LlamaCoreAbi,
      address: factory({
        address: "0xFf5d4E226D9A3496EECE31083a8F493edd79AbEB",
        event: llamaFactoryEvent,
        parameter: "llamaCore",
      }),
      startBlock: 4121269,
    },
    LlamaPolicy: {
      chain: "sepolia",
      abi: LlamaPolicyAbi,
      address: factory({
        address: "0xFf5d4E226D9A3496EECE31083a8F493edd79AbEB",
        event: llamaFactoryEvent,
        parameter: "llamaPolicy",
      }),
      startBlock: 4121269,
    },
  },
});
```

### Factory Event Handling
```typescript
// From examples/feature-factory/src/LlamaCore.ts
import { ponder } from "ponder:registry";

ponder.on("LlamaCore:ActionCreated", async ({ event }) => {
  console.log(
    `Handling ActionCreated event from LlamaCore @ ${event.log.address}`,
  );
});

ponder.on("LlamaPolicy:Initialized", async ({ event }) => {
  console.log(
    `Handling Initialized event from LlamaPolicy @ ${event.log.address}`,
  );
});
```

## Multi-Chain Configuration

```typescript
// From examples/feature-multichain/ponder.config.ts
import { createConfig } from "ponder";

export default createConfig({
  ordering: "multichain",
  chains: {
    mainnet: {
      id: 1,
      rpc: process.env.PONDER_RPC_URL_1,
      ws: process.env.PONDER_WS_URL_1,
    },
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453,
      ws: process.env.PONDER_WS_URL_8453,
    },
    optimism: {
      id: 10,
      rpc: process.env.PONDER_RPC_URL_10,
      ws: process.env.PONDER_WS_URL_10,
    },
    polygon: {
      id: 137,
      rpc: process.env.PONDER_RPC_URL_137,
      ws: process.env.PONDER_WS_URL_137,
    },
  },
  contracts: {
    weth9: {
      abi: weth9Abi,
      startBlock: "latest",
      chain: {
        mainnet: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
        base: { address: "0x4200000000000000000000000000000000000006" },
        optimism: { address: "0x4200000000000000000000000000000000000006" },
        polygon: { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" },
      },
    },
  },
});
```

## Key Differences from Earlier Versions

### 1. No More `createSchema` Function
- **Old Pattern**: `createSchema((p) => ({ ... }))`
- **New Pattern**: Direct exports using `onchainTable()`

### 2. Import Changes
- **Old**: Import from `@ponder/core`
- **New**: Import from `"ponder"`, `"ponder:schema"`, `"ponder:registry"`

### 3. Table Definition Syntax
- **Old**: `p.createTable()`
- **New**: `onchainTable()`

### 4. Column Types
- **Old**: `p.string()`, `p.int()`
- **New**: `t.text()`, `t.integer()`, `t.hex()`, `t.bigint()`

### 5. Database Operations
- **Old**: Custom database methods
- **New**: Drizzle-like syntax with `insert()`, `values()`, `onConflictDoUpdate()`

## Common Patterns Observed

### 1. Event ID as Primary Key
Most examples use `event.id` as the primary key for event tables:
```typescript
id: t.text().primaryKey(),
```

### 2. Timestamp Storage
Timestamps are typically stored as integers:
```typescript
timestamp: t.integer().notNull(),
// Usage: Number(event.block.timestamp)
```

### 3. Address Storage
Addresses use the `hex` type:
```typescript
address: t.hex().primaryKey(),
owner: t.hex().notNull(),
```

### 4. Amount/Balance Storage
Large numbers use `bigint`:
```typescript
balance: t.bigint().notNull(),
amount: t.bigint().notNull(),
```

### 5. Upsert Pattern
Common pattern for maintaining cumulative state:
```typescript
.onConflictDoUpdate((row) => ({
  balance: row.balance + event.args.amount,
}))
```

## Best Practices

1. **Always use `.notNull()` for required fields** to ensure data integrity
2. **Use composite primary keys** for many-to-many relationships
3. **Add indexes** on frequently queried fields
4. **Define relations** separately from table definitions
5. **Use typed imports** from "ponder:schema" for better TypeScript support
6. **Handle conflicts explicitly** with `onConflictDoUpdate` or `onConflictDoNothing`

## Factory Pattern Best Practices

1. **Parse factory events** using `parseAbiItem` from `abitype`
2. **Use the `factory()` helper** in contract configuration
3. **Specify the parameter** that contains the deployed contract address
4. **Handle events from all deployed instances** - the framework automatically tracks them

## Conclusion

Ponder v0.12.0 uses a more standardized approach with:
- Drizzle-inspired database operations
- Clear separation of schema, configuration, and indexing logic
- Built-in support for factory patterns
- Multi-chain configurations
- Type-safe operations throughout

The examples show consistent patterns that can be applied to any indexing use case, with the factory pattern being particularly well-supported for tracking dynamically deployed contracts.