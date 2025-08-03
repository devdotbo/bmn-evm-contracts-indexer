# Ponder Schema API Research - Version 0.12.0

## Overview

Ponder uses a TypeScript-based schema definition system built on top of Drizzle ORM. The schema is defined in `ponder.schema.ts` using the `onchainTable` function and related utilities.

## Import Statements

```typescript
import { 
  onchainTable, 
  onchainEnum, 
  primaryKey, 
  index, 
  relations,
  hex,
  bigint
} from "ponder";
```

Additional imports available from the core index:
```typescript
// From drizzle-orm/pg-core
import {
  boolean,
  char,
  date,
  doublePrecision,
  integer,
  json,
  jsonb,
  numeric,
  real,
  smallint,
  text,
  time,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  foreignKey
} from "ponder";
```

## Table Creation Patterns

### Basic Table Definition

```typescript
export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  balance: t.bigint().notNull(),
  isOwner: t.boolean().notNull(),
}));
```

### Table with Composite Primary Key

```typescript
export const allowance = onchainTable(
  "allowance",
  (t) => ({
    owner: t.hex(),
    spender: t.hex(),
    amount: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.owner, table.spender] }),
  })
);
```

### Table with Indexes

```typescript
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
  })
);
```

## Column Types

### Core Ponder Types

1. **`t.hex()`** - For Ethereum addresses and hex-encoded data
   - Stored as `bytea` in PostgreSQL
   - Used for addresses, transaction hashes, etc.

2. **`t.bigint()`** - For large integers (uint256/int256)
   - Handles Ethereum's 256-bit integers
   - Used for balances, token amounts, etc.

3. **`t.text()`** - For string values
   - UTF-8 encoded strings
   - Used for names, URIs, etc.

4. **`t.integer()`** - For regular integers
   - 4-byte signed integer
   - Used for counts, timestamps, etc.

5. **`t.boolean()`** - For true/false values
   - Used for flags and binary states

6. **`t.bytes()`** - For arbitrary byte data
   - Used for calldata, raw byte arrays

7. **`t.json()` / `t.jsonb()`** - For JSON data
   - `json()` stores exact text representation
   - `jsonb()` stores binary format (preferred for querying)

### Additional PostgreSQL Types

Available through direct imports:

```typescript
// Numeric types
t.doublePrecision()  // Floating point numbers
t.real()             // Single precision float
t.numeric()          // Precise decimal
t.smallint()         // 2-byte integer

// Date/Time types
t.timestamp()        // Date and time
t.date()            // Date only
t.time()            // Time only

// String types
t.varchar()          // Variable length string with limit
t.char()             // Fixed length string
t.uuid()             // UUID values

// Other types
t.interval()         // Time intervals
```

## Column Modifiers

- **`.primaryKey()`** - Marks column as primary key
- **`.notNull()`** - Makes column required (non-nullable)
- **`.array()`** - Creates array column
- **`.default(value)`** - Sets default value
- **`.$type<T>()`** - Specifies TypeScript type

## Enums

```typescript
export const tradeType = onchainEnum("trade_type", ["BUY", "SELL"]);

export const tradeEvent = onchainTable("trade_event", (t) => ({
  id: t.text().primaryKey(),
  tradeType: tradeType().notNull(),
  // ... other columns
}));
```

## Relations

```typescript
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

### Insert Operations

```typescript
// Single insert
await context.db.insert(account).values({
  address: event.args.address,
  balance: 0n,
  isOwner: false,
});

// Insert with conflict handling
await context.db
  .insert(allowance)
  .values({
    owner: event.args.owner,
    spender: event.args.spender,
    amount: event.args.amount,
  })
  .onConflictDoUpdate({ amount: event.args.amount });
```

### Find Operations

```typescript
// Find by primary key
const account = await context.db.find(account, {
  address: event.args.address,
});
```

### Update Operations

```typescript
await context.db.update(account, {
  address: event.args.address,
}).set({
  balance: newBalance,
});
```

## Version-Specific Considerations

### Version 0.12.0 Changes

1. **Lowercase Addresses**: All address values are automatically lowercased
   - `event.block.miner`, `event.log.address`, etc. are always lowercase
   - No need to manually lowercase addresses in schema or indexing functions

2. **Exit Code Changes**: 
   - Exit code 75 for retryable errors (RPC/database issues)
   - Exit code 1 for fatal errors

### Migration from Previous Versions

The `onchainTable` function replaced the older `createSchema` pattern:

```typescript
// Old (pre-0.12)
import { createSchema } from "@ponder/core";
export default createSchema((p) => ({
  Account: p.createTable({
    id: p.hex(),
    balance: p.bigint(),
  }),
}));

// New (0.12+)
import { onchainTable } from "ponder";
export const account = onchainTable("account", (t) => ({
  id: t.hex().primaryKey(),
  balance: t.bigint().notNull(),
}));
```

## Best Practices

1. **Always use `.primaryKey()` on at least one column**
2. **Use `.notNull()` for required fields**
3. **Choose appropriate column types**:
   - `hex()` for addresses and hashes
   - `bigint()` for token amounts and large numbers
   - `integer()` for block numbers and timestamps
   - `text()` for general strings
4. **Create indexes on frequently queried columns**
5. **Use composite primary keys for many-to-many relationships**
6. **Define relations for complex queries**

## Common Patterns

### ERC20 Token Schema

```typescript
export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  balance: t.bigint().notNull(),
}));

export const transferEvent = onchainTable("transfer_event", (t) => ({
  id: t.text().primaryKey(),
  from: t.hex().notNull(),
  to: t.hex().notNull(),
  amount: t.bigint().notNull(),
  timestamp: t.integer().notNull(),
}));
```

### NFT Collection Schema

```typescript
export const token = onchainTable("token", (t) => ({
  id: t.bigint().primaryKey(),
  owner: t.hex().notNull(),
  uri: t.text(),
}));

export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  tokenCount: t.integer().notNull().default(0),
}));
```

### Multi-chain Support

Schema definitions work across multiple chains without modification. Chain-specific data is handled at the indexing level, not the schema level.

## References

- [Ponder Documentation](https://ponder.sh/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Example Projects](https://github.com/ponder-sh/ponder/tree/main/examples)