#!/bin/bash

# Export Ponder schema for external client usage
# Usage: ./scripts/export-schema.sh [target_directory]
# Example: ./scripts/export-schema.sh ../my-client-app/src/schema

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default target directory
TARGET_DIR=${1:-"./exported-schema"}

echo -e "${YELLOW}📦 Ponder Schema Export Tool${NC}"
echo "================================="

# Check if ponder.schema.ts exists
if [ ! -f "ponder.schema.ts" ]; then
    echo -e "${RED}❌ Error: ponder.schema.ts not found in current directory${NC}"
    exit 1
fi

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

echo -e "${GREEN}✓${NC} Target directory: $TARGET_DIR"

# Step 1: Copy schema file
echo -e "${YELLOW}→${NC} Copying ponder.schema.ts..."
cp ponder.schema.ts "$TARGET_DIR/ponder.schema.ts"

# Step 2: Generate TypeScript declarations if ponder-env.d.ts exists
if [ -f "ponder-env.d.ts" ]; then
    echo -e "${YELLOW}→${NC} Copying type declarations..."
    cp ponder-env.d.ts "$TARGET_DIR/ponder-env.d.ts"
fi

# Step 3: Create package.json for the schema if it doesn't exist
if [ ! -f "$TARGET_DIR/package.json" ]; then
    echo -e "${YELLOW}→${NC} Creating package.json for schema..."
    cat > "$TARGET_DIR/package.json" << 'EOF'
{
  "name": "@bmn/indexer-schema",
  "version": "1.0.0",
  "description": "BMN EVM Contracts Indexer Schema",
  "main": "ponder.schema.js",
  "types": "ponder.schema.ts",
  "files": [
    "ponder.schema.ts",
    "ponder.schema.js",
    "ponder-env.d.ts"
  ],
  "dependencies": {
    "ponder": "^0.12.0"
  },
  "scripts": {
    "build": "tsc ponder.schema.ts --declaration --esModuleInterop --skipLibCheck"
  }
}
EOF
fi

# Step 4: Create usage example
echo -e "${YELLOW}→${NC} Creating usage example..."
cat > "$TARGET_DIR/example-usage.ts" << 'EOF'
/**
 * Example usage of the exported Ponder schema
 * 
 * Install dependencies:
 *   pnpm add @ponder/client ponder
 */

import { createClient, eq, desc } from "@ponder/client";
import * as schema from "./ponder.schema";

// Initialize client
const INDEXER_URL = process.env.INDEXER_URL || "http://localhost:42069";
const client = createClient(`${INDEXER_URL}/sql`, { schema });

// Example queries
async function queryExamples() {
  // Query source escrows
  const srcEscrows = await client.db
    .select()
    .from(schema.srcEscrow)
    .where(eq(schema.srcEscrow.status, "Active"))
    .limit(10)
    .execute();

  // Query BMN token holders
  const holders = await client.db
    .select()
    .from(schema.bmnTokenHolder)
    .orderBy(desc(schema.bmnTokenHolder.balance))
    .limit(10)
    .execute();

  // Live query subscription
  const { unsubscribe } = client.live(
    (db) => db.select().from(schema.chainStatistics).execute(),
    (data) => console.log("Stats updated:", data),
    (error) => console.error("Error:", error)
  );

  return { srcEscrows, holders, unsubscribe };
}

export { client, queryExamples };
EOF

# Step 5: Create README
echo -e "${YELLOW}→${NC} Creating README..."
cat > "$TARGET_DIR/README.md" << 'EOF'
# BMN Indexer Schema

This directory contains the exported Ponder schema from the BMN EVM Contracts Indexer.

## Installation

```bash
# Install required dependencies
pnpm add @ponder/client ponder
```

## Usage

```typescript
import { createClient } from "@ponder/client";
import * as schema from "./ponder.schema";

const client = createClient("http://localhost:42069/sql", { schema });

// Query data
const escrows = await client.db
  .select()
  .from(schema.srcEscrow)
  .execute();
```

## Available Tables

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

## Publishing to NPM

To publish this schema as an NPM package:

```bash
npm login
npm publish --access public
```

Then use in other projects:

```typescript
import * as schema from "@bmn/indexer-schema";
```

## Type Safety

The schema provides full TypeScript type safety for all queries. The types are automatically inferred from the Ponder schema definitions.

## Support

For issues or questions, refer to the main indexer repository.
EOF

# Step 6: Create .gitignore
echo -e "${YELLOW}→${NC} Creating .gitignore..."
cat > "$TARGET_DIR/.gitignore" << 'EOF'
node_modules/
*.js
*.d.ts
!ponder-env.d.ts
!example-usage.ts
dist/
.DS_Store
EOF

# Summary
echo ""
echo -e "${GREEN}✅ Schema export completed successfully!${NC}"
echo ""
echo "📁 Exported to: $TARGET_DIR"
echo ""
echo "📋 Exported files:"
echo "   - ponder.schema.ts (Schema definitions)"
[ -f "$TARGET_DIR/ponder-env.d.ts" ] && echo "   - ponder-env.d.ts (Type declarations)"
echo "   - package.json (Package configuration)"
echo "   - example-usage.ts (Usage examples)"
echo "   - README.md (Documentation)"
echo "   - .gitignore (Git ignore rules)"
echo ""
echo "📦 Next steps:"
echo "   1. cd $TARGET_DIR"
echo "   2. pnpm install"
echo "   3. Use the schema in your client application"
echo ""
echo "💡 Tip: You can publish this as an NPM package for easier sharing"