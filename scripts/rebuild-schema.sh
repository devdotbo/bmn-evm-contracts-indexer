#!/bin/bash

# BMN Indexer Schema Rebuild Script
# This script rebuilds the indexer to properly expose PostInteraction tables

set -e

echo "========================================="
echo "BMN Indexer Schema Rebuild"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}WARNING: This will reset the database and rebuild the indexer!${NC}"
echo -e "${YELLOW}All indexed data will be lost and need to be re-synced.${NC}"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Rebuild cancelled.${NC}"
    exit 1
fi

echo -e "\n${GREEN}Step 1: Stopping services...${NC}"
docker compose down

echo -e "\n${GREEN}Step 2: Cleaning Ponder cache...${NC}"
rm -rf .ponder
pnpm run clean

echo -e "\n${GREEN}Step 3: Regenerating TypeScript types...${NC}"
pnpm run codegen

echo -e "\n${GREEN}Step 4: Rebuilding Docker image...${NC}"
docker compose build --no-cache indexer

echo -e "\n${GREEN}Step 5: Starting PostgreSQL...${NC}"
docker compose up -d postgres

echo -e "\n${GREEN}Step 6: Waiting for PostgreSQL to be ready...${NC}"
sleep 10

echo -e "\n${GREEN}Step 7: Starting indexer with fresh schema...${NC}"
docker compose up -d indexer

echo -e "\n${GREEN}Step 8: Waiting for indexer to initialize...${NC}"
sleep 15

echo -e "\n${GREEN}Step 9: Checking service status...${NC}"
docker compose ps

echo -e "\n${GREEN}Step 10: Testing GraphQL endpoint...${NC}"
curl -s http://localhost:42069/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ GraphQL endpoint is healthy${NC}"
else
    echo -e "${RED}✗ GraphQL endpoint is not responding${NC}"
fi

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN}Rebuild complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Run ./scripts/verify-v2.2-deployment.sh to verify the deployment"
echo "2. Monitor docker logs with: docker compose logs -f indexer"
echo "3. Check GraphQL playground at: http://localhost:42069/graphql"
echo ""
echo -e "${YELLOW}Note: The indexer will need to re-sync all historical data.${NC}"
echo -e "${YELLOW}This may take some time depending on the chain state.${NC}"