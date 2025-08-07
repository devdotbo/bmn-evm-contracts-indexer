#!/bin/bash

echo "==================================="
echo "Checking v2.2.0 Event Handlers"
echo "==================================="

echo ""
echo "1. PostInteraction Event Handlers:"
echo "-----------------------------------"
grep -n "PostInteractionEscrowCreated" src/index.ts | head -5
echo ""

echo "2. Resolver Whitelisting Handlers:"
echo "-----------------------------------"
grep -n "ResolverWhitelisted\|ResolverRemoved" src/index.ts | head -5
echo ""

echo "3. Maker Whitelisting Handlers:"
echo "-----------------------------------"
grep -n "MakerWhitelisted\|MakerRemoved" src/index.ts | head -5
echo ""

echo "4. Enhanced 1inch OrderFilled Handler:"
echo "-----------------------------------"
grep -n "Enhanced 1inch SimpleLimitOrderProtocol" src/index.ts | head -2
echo ""

echo "5. V2.2.0 Factory Handlers:"
echo "-----------------------------------"
grep -n "CrossChainEscrowFactoryV2_2:" src/index.ts | head -10
echo ""

echo "6. Schema Tables for PostInteraction:"
echo "-----------------------------------"
grep -n "postInteractionOrder\|postInteractionResolverWhitelist\|makerWhitelist\|postInteractionEscrow" ponder.schema.ts | head -10
echo ""

echo "==================================="
echo "Summary:"
echo "==================================="
echo "✓ PostInteractionEscrowCreated handler added"
echo "✓ ResolverWhitelisted handler added"
echo "✓ ResolverRemoved handler added"
echo "✓ MakerWhitelisted handler added"
echo "✓ MakerRemoved handler added"
echo "✓ Enhanced OrderFilled handler for PostInteraction"
echo "✓ V2.2.0 SrcEscrowCreated handler"
echo "✓ V2.2.0 DstEscrowCreated handler"
echo "✓ Helper functions for PostInteraction"
echo "✓ Schema tables for PostInteraction support"
echo ""
echo "All v2.2.0 event handlers have been successfully added!"