#!/bin/bash

# Check v2.2.0 PostInteraction Tables in GraphQL Schema
# This script verifies that all v2.2.0 schema additions are accessible

echo "=========================================="
echo "Checking v2.2.0 PostInteraction Tables"
echo "=========================================="
echo ""

GRAPHQL_URL="http://localhost:42069/graphql"

# Wait for GraphQL to be ready
echo "Waiting for GraphQL endpoint to be ready..."
for i in {1..10}; do
    if curl -s -o /dev/null -w "%{http_code}" "$GRAPHQL_URL" | grep -q "200\|400"; then
        echo "GraphQL endpoint is ready!"
        break
    fi
    echo "Attempt $i/10: GraphQL not ready yet..."
    sleep 3
done

echo ""
echo "1. Checking GraphQL Schema for PostInteraction Tables..."
echo "----------------------------------------------------------"

# Query to check schema
INTROSPECTION_QUERY='{
  __schema {
    types {
      name
      kind
      description
    }
  }
}'

# Execute introspection query
RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"$INTROSPECTION_QUERY\"}" 2>/dev/null)

# Check for v2.2.0 tables in the schema
echo "Checking for PostInteractionOrder table..."
if echo "$RESPONSE" | grep -q "PostInteractionOrder"; then
    echo "✅ PostInteractionOrder table found in GraphQL schema"
else
    echo "❌ PostInteractionOrder table NOT found in GraphQL schema"
fi

echo ""
echo "Checking for PostInteractionResolverWhitelist table..."
if echo "$RESPONSE" | grep -q "PostInteractionResolverWhitelist"; then
    echo "✅ PostInteractionResolverWhitelist table found in GraphQL schema"
else
    echo "❌ PostInteractionResolverWhitelist table NOT found in GraphQL schema"
fi

echo ""
echo "Checking for MakerWhitelist table..."
if echo "$RESPONSE" | grep -q "MakerWhitelist"; then
    echo "✅ MakerWhitelist table found in GraphQL schema"
else
    echo "❌ MakerWhitelist table NOT found in GraphQL schema"
fi

echo ""
echo "Checking for PostInteractionEscrow table..."
if echo "$RESPONSE" | grep -q "PostInteractionEscrow"; then
    echo "✅ PostInteractionEscrow table found in GraphQL schema"
else
    echo "❌ PostInteractionEscrow table NOT found in GraphQL schema"
fi

echo ""
echo "2. Testing Sample Queries for v2.2.0 Tables..."
echo "------------------------------------------------"

# Test query for PostInteractionOrder
echo ""
echo "Testing PostInteractionOrder query..."
QUERY_POST_ORDER='{
  postInteractionOrders(limit: 1) {
    items {
      id
      orderHash
      maker
      status
      chainId
    }
  }
}'

RESULT=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"$(echo $QUERY_POST_ORDER | sed 's/"/\\"/g')\"}" 2>/dev/null)

if echo "$RESULT" | grep -q "postInteractionOrders"; then
    echo "✅ PostInteractionOrder query executed successfully"
elif echo "$RESULT" | grep -q "Cannot query field"; then
    echo "❌ PostInteractionOrder query failed - field not found"
else
    echo "⚠️  PostInteractionOrder query returned: $RESULT"
fi

# Test query for MakerWhitelist
echo ""
echo "Testing MakerWhitelist query..."
QUERY_MAKER_WL='{
  makerWhitelists(limit: 1) {
    items {
      id
      maker
      isWhitelisted
      chainId
    }
  }
}'

RESULT=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"$(echo $QUERY_MAKER_WL | sed 's/"/\\"/g')\"}" 2>/dev/null)

if echo "$RESULT" | grep -q "makerWhitelists"; then
    echo "✅ MakerWhitelist query executed successfully"
elif echo "$RESULT" | grep -q "Cannot query field"; then
    echo "❌ MakerWhitelist query failed - field not found"
else
    echo "⚠️  MakerWhitelist query returned: $RESULT"
fi

echo ""
echo "3. Checking Database Tables..."
echo "--------------------------------"

# Check if tables exist in PostgreSQL
echo ""
echo "Checking database tables directly..."

# Get list of tables from database
TABLES=$(docker compose exec -T postgres psql -U ponder -d bmn_indexer -c "\dt" 2>/dev/null | grep -E "post_interaction|maker_whitelist")

if echo "$TABLES" | grep -q "post_interaction_order"; then
    echo "✅ post_interaction_order table exists in database"
else
    echo "❌ post_interaction_order table NOT found in database"
fi

if echo "$TABLES" | grep -q "post_interaction_resolver_whitelist"; then
    echo "✅ post_interaction_resolver_whitelist table exists in database"
else
    echo "❌ post_interaction_resolver_whitelist table NOT found in database"
fi

if echo "$TABLES" | grep -q "maker_whitelist"; then
    echo "✅ maker_whitelist table exists in database"
else
    echo "❌ maker_whitelist table NOT found in database"
fi

if echo "$TABLES" | grep -q "post_interaction_escrow"; then
    echo "✅ post_interaction_escrow table exists in database"
else
    echo "❌ post_interaction_escrow table NOT found in database"
fi

echo ""
echo "=========================================="
echo "v2.2.0 PostInteraction Verification Complete"
echo "=========================================="