import DemoWithRealTestnetPool from './demoWithRealTestnetPool';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Execute the complete real Cardano testnet demonstration
 * This script shows the REAL integration with Cardano Preview testnet
 */
async function main() {
  console.log('🚀 Starting REAL Cardano Preview Testnet Demo...\n');

  try {
    // Initialize with optional Blockfrost API key
    const blockfrostKey = process.env.BLOCKFROST_API_KEY;
    const demo = new DemoWithRealTestnetPool(blockfrostKey);

    // Optional: Use real pool ID and wallet address if provided
    const poolId = process.env.REAL_POOL_ID || undefined;
    const walletAddress = process.env.WALLET_ADDRESS || undefined;

    console.log('📋 Demo Configuration:');
    console.log(`   Blockfrost API: ${blockfrostKey ? '✅ Configured' : '⚠️ Using fallback'}`);
    console.log(`   Target Pool: ${poolId || 'Auto-discover from testnet'}`);
    console.log(`   Wallet Address: ${walletAddress ? `${walletAddress.substring(0, 20)}...` : 'Demo position'}`);

    // Run the complete demonstration
    await demo.runDemo(poolId, walletAddress);

    console.log('\n🎯 Demo completed successfully!');
    console.log('🔗 Verify results at: https://preview.minswap.org/');

  } catch (error) {
    console.error('\n❌ Error running real testnet demo:', error);
    console.log('\n💡 Make sure you have:');
    console.log('   • BLOCKFROST_API_KEY environment variable set');
    console.log('   • Internet connection for API calls');
    console.log('   • Optional: REAL_POOL_ID and WALLET_ADDRESS for real data');
    
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);