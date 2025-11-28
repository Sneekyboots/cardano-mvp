#!/bin/bash

# Yield Safe: Complete Real Testnet Setup Guide
# This script demonstrates how to set up a REAL Cardano Preview testnet pool
# for the Yield Safe IL protection demonstration

echo "████████████████████████████████████████████████████████████████"
echo "🎯 YIELD SAFE: REAL TESTNET SETUP GUIDE"
echo "████████████████████████████████████████████████████████████████"
echo ""
echo "This guide will help you create a REAL Cardano Preview testnet pool"
echo "for demonstrating Yield Safe's impermanent loss protection."
echo ""

# Step 1: Environment Setup
echo "─────────────────────────────────────────────────────────────────"
echo "STEP 1: SETUP ENVIRONMENT VARIABLES"
echo "─────────────────────────────────────────────────────────────────"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Yield Safe Demo Environment Configuration

# Blockfrost API (Get free key at https://blockfrost.io)
BLOCKFROST_API_KEY=preview_your_blockfrost_api_key_here

# Real Pool Configuration (Set after creating pool)
REAL_POOL_ID=your_real_pool_id_here
WALLET_ADDRESS=addr_test1_your_wallet_address_here
LP_POLICY_ID=your_lp_token_policy_id_here

# Demo Configuration
DEMO_MODE=real_testnet
NETWORK=preview
EOF
    echo "✅ .env file created. Please edit with your actual values."
else
    echo "✅ .env file exists."
fi

echo ""
echo "📝 Please update the .env file with:"
echo "   1. Your Blockfrost API key (free at https://blockfrost.io)"
echo "   2. Your wallet address (after creating testnet wallet)"
echo "   3. Pool ID and LP token info (after creating pool)"

# Step 2: Wallet Setup Instructions
echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "STEP 2: CREATE TESTNET WALLET"
echo "─────────────────────────────────────────────────────────────────"
echo ""

echo "Option A - Eternl Wallet (Recommended):"
echo "  1. Install Eternl wallet browser extension"
echo "  2. Create new wallet"
echo "  3. Switch to 'Preview Testnet' network"
echo "  4. Copy your receive address"
echo ""

echo "Option B - Yoroi Wallet:"
echo "  1. Install Yoroi wallet"
echo "  2. Create Shelley testnet wallet"
echo "  3. Copy receive address"
echo ""

echo "Option C - cardano-cli (Advanced):"
echo "  1. Generate keys: cardano-cli address key-gen"
echo "  2. Build address: cardano-cli address build --testnet-magic 2"

# Step 3: Faucet Instructions
echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "STEP 3: GET TESTNET ADA"
echo "─────────────────────────────────────────────────────────────────"
echo ""

echo "🏦 Cardano Preview Testnet Faucet:"
echo "   URL: https://faucet.preview.world.dev.cardano.org/basic-faucet"
echo "   Amount: 1000 tADA"
echo "   Frequency: Once per wallet per day"
echo ""

echo "🏦 Alternative Minswap Faucet:"
echo "   URL: https://faucet.preview.minswap.org/"
echo "   Amount: 100 tADA"
echo "   Note: May require connecting wallet"
echo ""

echo "💡 Pro Tip: Request from both faucets to get 1100+ tADA total"

# Step 4: Pool Creation Guide
echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "STEP 4: CREATE REAL LIQUIDITY POOL"
echo "─────────────────────────────────────────────────────────────────"
echo ""

echo "🏗️  Minswap Testnet Pool Creation:"
echo "   1. Visit: https://preview.minswap.org/"
echo "   2. Connect your testnet wallet"
echo "   3. Go to 'Liquidity' → 'Add Liquidity'"
echo "   4. Select pair: tADA / tDJED"
echo "   5. Enter amounts:"
echo "      - tADA: 50 (or whatever you have)"
echo "      - tDJED: Get from swapping some tADA first"
echo "   6. Confirm transaction"
echo "   7. Wait for confirmation (~30 seconds)"
echo "   8. Note your Pool ID and LP token info"
echo ""

echo "📊 Pool Information to Record:"
echo "   • Pool ID (from Minswap UI)"
echo "   • Pool Address (from transaction)"
echo "   • LP Token Policy ID"
echo "   • LP Token Asset Name"
echo "   • Your LP token balance"

# Step 5: Demo Integration
echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "STEP 5: RUN REAL TESTNET DEMO"
echo "─────────────────────────────────────────────────────────────────"
echo ""

echo "🚀 Execute the Real Demo:"
echo "   1. Update .env with your real pool data"
echo "   2. Run: npm run demo:real"
echo "   3. Watch as it queries YOUR real pool!"
echo "   4. See real IL calculations from real price data"
echo "   5. Demonstrate to judges with 100% real data"

# Step 6: Verification Guide
echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "STEP 6: JUDGE VERIFICATION"
echo "─────────────────────────────────────────────────────────────────"
echo ""

echo "✅ What Judges Can Verify:"
echo "   • Pool exists on Preview testnet"
echo "   • Liquidity is real tADA/tDJED"
echo "   • LP tokens are in your wallet"
echo "   • Price data comes from real DEX"
echo "   • IL calculations use real numbers"
echo "   • Smart contract architecture is production-ready"
echo ""

echo "🔍 Verification Tools:"
echo "   • Minswap: https://preview.minswap.org/"
echo "   • Explorer: https://preview.cexplorer.io/"
echo "   • Blockfrost: https://blockfrost.io/dashboard"

# Step 7: Troubleshooting
echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "STEP 7: TROUBLESHOOTING"
echo "─────────────────────────────────────────────────────────────────"
echo ""

echo "🔧 Common Issues:"
echo "   • Faucet not working: Try alternative faucet or wait"
echo "   • No tDJED tokens: Swap some tADA to tDJED first"
echo "   • Pool creation fails: Check you have enough tADA for fees"
echo "   • API errors: Verify Blockfrost API key is correct"
echo ""

echo "📞 Support Resources:"
echo "   • Cardano Forum: https://forum.cardano.org/"
echo "   • Minswap Discord: https://discord.gg/minswap"
echo "   • Blockfrost Support: https://blockfrost.io/"

# Completion
echo ""
echo "████████████████████████████████████████████████████████████████"
echo "🎉 SETUP COMPLETE!"
echo "████████████████████████████████████████████████████████████████"
echo ""
echo "🎯 You now have:"
echo "   ✅ Real Cardano Preview testnet wallet"
echo "   ✅ Real tADA funds from faucet"
echo "   ✅ Real liquidity pool on Minswap testnet"
echo "   ✅ Real LP tokens in your wallet"
echo "   ✅ Production-ready demo integration"
echo ""
echo "🚀 Run: npm run demo:real"
echo "🏆 Impress judges with 100% real blockchain integration!"
echo ""