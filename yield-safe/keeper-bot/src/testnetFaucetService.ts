import axios from 'axios';

interface TestnetFaucetResponse {
  success: boolean;
  txHash?: string;
  amount?: number;
  error?: string;
}

class TestnetFaucetService {
  private previewFaucetUrl = 'https://faucet.preview.world.dev.cardano.org';
  private preprodFaucetUrl = 'https://faucet.preprod.world.dev.cardano.org';
  
  // API keys from the forum guide
  private previewApiKey = 'nohnuXahthoghaeNoht9Aow3ze4quohc';
  private preprodApiKey = 'ooseiteiquo7Wie9oochooyiequi4ooc';

  /**
   * Request testnet ADA from Preview faucet
   */
  async requestPreviewTestADA(walletAddress: string): Promise<TestnetFaucetResponse> {
    try {
      console.log(`\n💧 Requesting tADA from Preview faucet...`);
      console.log(`   Wallet: ${walletAddress.substring(0, 20)}...`);
      console.log(`   Network: Preview Testnet`);

      const response = await axios.post(
        `${this.previewFaucetUrl}/send-money/${walletAddress}?api_key=${this.previewApiKey}`,
        {},
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`\n✅ Faucet request successful:`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);

      return {
        success: true,
        txHash: response.data.txHash,
        amount: response.data.amount || 1000,
      };
    } catch (error) {
      console.error(`❌ Error requesting from Preview faucet:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Request testnet ADA from Pre-Production faucet
   */
  async requestPreprodTestADA(walletAddress: string): Promise<TestnetFaucetResponse> {
    try {
      console.log(`\n💧 Requesting tADA from Pre-Production faucet...`);
      console.log(`   Wallet: ${walletAddress.substring(0, 20)}...`);
      console.log(`   Network: Pre-Production Testnet`);

      const response = await axios.post(
        `${this.preprodFaucetUrl}/send-money/${walletAddress}?api_key=${this.preprodApiKey}`,
        {},
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`\n✅ Faucet request successful:`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);

      return {
        success: true,
        txHash: response.data.txHash,
        amount: response.data.amount || 1000,
      };
    } catch (error) {
      console.error(`❌ Error requesting from Pre-Production faucet:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Request delegation to a pool (for testing staking)
   */
  async requestDelegation(poolId: string, network: 'preview' | 'preprod'): Promise<TestnetFaucetResponse> {
    try {
      console.log(`\n🎯 Requesting delegation to pool...`);
      console.log(`   Pool ID: ${poolId}`);
      console.log(`   Network: ${network}`);

      const baseUrl = network === 'preview' ? this.previewFaucetUrl : this.preprodFaucetUrl;
      const response = await axios.get(`${baseUrl}/delegate/${poolId}`, {
        timeout: 30000
      });

      console.log(`\n✅ Delegation request successful:`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);

      return {
        success: true,
        txHash: response.data.txHash,
        amount: response.data.delegation || 10000000, // 10M ADA delegation
      };
    } catch (error) {
      console.error(`❌ Error requesting delegation:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get faucet URLs for manual access
   */
  getFaucetInfo() {
    return {
      preview: {
        webUI: 'https://faucet.preview.world.dev.cardano.org/basic-faucet',
        api: this.previewFaucetUrl
      },
      preprod: {
        webUI: 'https://faucet.preprod.world.dev.cardano.org/basic-faucet',
        api: this.preprodFaucetUrl
      }
    };
  }

  /**
   * Check if we can reach the faucet services
   */
  async checkFaucetAvailability(): Promise<{preview: boolean, preprod: boolean}> {
    console.log(`\n🔍 Checking testnet faucet availability...`);
    
    const results = {
      preview: false,
      preprod: false
    };

    try {
      await axios.get(`${this.previewFaucetUrl}/basic-faucet`, { timeout: 5000 });
      results.preview = true;
      console.log(`   Preview faucet: ✅ Available`);
    } catch (error) {
      console.log(`   Preview faucet: ❌ Unavailable`);
    }

    try {
      await axios.get(`${this.preprodFaucetUrl}/basic-faucet`, { timeout: 5000 });
      results.preprod = true;
      console.log(`   Pre-production faucet: ✅ Available`);
    } catch (error) {
      console.log(`   Pre-production faucet: ❌ Unavailable`);
    }

    return results;
  }

  /**
   * Generate instructions for manual faucet use
   */
  getManualInstructions(walletAddress: string) {
    console.log(`\n📋 MANUAL FAUCET INSTRUCTIONS:`);
    console.log(`═`.repeat(50));
    
    console.log(`\n1. Preview Testnet (Recommended):`);
    console.log(`   🌐 Visit: https://faucet.preview.world.dev.cardano.org/basic-faucet`);
    console.log(`   💳 Paste address: ${walletAddress}`);
    console.log(`   💧 Request: 1000 tADA`);
    
    console.log(`\n2. Pre-Production Testnet:`);
    console.log(`   🌐 Visit: https://faucet.preprod.world.dev.cardano.org/basic-faucet`);
    console.log(`   💳 Paste address: ${walletAddress}`);
    console.log(`   💧 Request: 1000 tADA`);
    
    console.log(`\n3. Command Line (Alternative):`);
    console.log(`   Preview: curl -X POST -s '${this.previewFaucetUrl}/send-money/${walletAddress}?api_key=${this.previewApiKey}'`);
    console.log(`   Preprod: curl -X POST -s '${this.preprodFaucetUrl}/send-money/${walletAddress}?api_key=${this.preprodApiKey}'`);
    
    console.log(`\n⏱️  Wait 1-2 minutes for funds to arrive`);
    console.log(`🔗 Verify on: https://preview.cexplorer.io/address/${walletAddress}`);
  }
}

export default TestnetFaucetService;
export { TestnetFaucetResponse };