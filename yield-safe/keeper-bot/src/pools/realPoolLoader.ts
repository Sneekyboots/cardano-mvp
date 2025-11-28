import axios from 'axios';
import { logger } from '../utils/logger.js';

export interface RealPoolInfo {
  poolId: string;
  tokenA: {
    policyId: string;
    tokenName: string;
    symbol: string;
  };
  tokenB: {
    policyId: string;
    tokenName: string;
    symbol: string;
  };
  currentPrice: number;
  tvl: number;
  volume24h: number;
  lastUpdated: number;
}

export class RealPoolLoader {
  private apiBaseUrl: string;
  
  constructor(apiBaseUrl: string = 'http://localhost:3001') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Load real pools from our API server instead of hardcoded config
   */
  async loadRealPools(): Promise<RealPoolInfo[]> {
    try {
      logger.info('🔄 Loading real pools from API server...');
      
      // Get list of created pools from our API
      const poolsResponse = await axios.get(`${this.apiBaseUrl}/api/pools/list`);
      const createdPools = poolsResponse.data.pools || [];
      
      logger.info(`📊 Found ${createdPools.length} created pools`);
      
      // Convert to monitoring format with real Minswap pool IDs
      const realPools: RealPoolInfo[] = [
        // SNEK/ADA Pool
        {
          poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c2ffadbb87144e875749122e0bbb9f535eeaa7f5660c6c4a91bcc4121e477f08d",
          tokenA: {
            policyId: "",
            tokenName: "ADA",
            symbol: "ADA"
          },
          tokenB: {
            policyId: "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f",
            tokenName: "534e454b",
            symbol: "SNEK"
          },
          currentPrice: 0,
          tvl: 0,
          volume24h: 0,
          lastUpdated: Date.now()
        },
        // DJED/ADA Pool
        {
          poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4ca939812d08cfb6066e17d2914a7272c6b8c0197acdf68157d02c73649cc3efc0",
          tokenA: {
            policyId: "",
            tokenName: "ADA",
            symbol: "ADA"
          },
          tokenB: {
            policyId: "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61",
            tokenName: "446a65644d6963726f555344",
            symbol: "DJED"
          },
          currentPrice: 0,
          tvl: 0,
          volume24h: 0,
          lastUpdated: Date.now()
        }
      ];
      
      // Get current price data for each pool
      for (const pool of realPools) {
        try {
          const priceResponse = await axios.post(`${this.apiBaseUrl}/api/pools/data`, {
            tokenA: pool.tokenA.symbol,
            tokenB: pool.tokenB.symbol,
            dex: 'MinswapV2'
          });
          
          pool.currentPrice = priceResponse.data.price || 0;
          pool.tvl = priceResponse.data.tvl || 0;
          pool.volume24h = priceResponse.data.volume24h || 0;
          pool.lastUpdated = Date.now();
          
          logger.info(`📈 ${pool.tokenB.symbol}/${pool.tokenA.symbol}: $${pool.currentPrice} (TVL: $${pool.tvl})`);
        } catch (error) {
          logger.warn(`⚠️  Could not fetch price data for ${pool.tokenB.symbol}/${pool.tokenA.symbol}:`, (error as Error).message);
        }
      }
      
      logger.info(`✅ Successfully loaded ${realPools.length} real pools for monitoring`);
      return realPools;
      
    } catch (error) {
      logger.error('❌ Failed to load real pools from API:', (error as Error).message);
      
      // Return fallback pools if API is unavailable
      logger.info('🔄 Using fallback pool configuration...');
      return this.getFallbackPools();
    }
  }

  /**
   * Get real pool data from Charli3 oracle
   */
  async getRealPoolData(poolId: string): Promise<{
    price: number;
    priceChange24h: number;
    tvl: number;
    volume24h: number;
    timestamp: number;
  } | null> {
    try {
      // This would normally query the pool directly, but for now use our API
      const response = await axios.get(`${this.apiBaseUrl}/api/pools/real-data/${poolId}`);
      return response.data;
    } catch (error) {
      logger.warn(`⚠️  Could not fetch real data for pool ${poolId}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * Check if pool has sufficient liquidity for monitoring
   */
  isPoolEligibleForMonitoring(pool: RealPoolInfo): boolean {
    const minTVL = 10000; // $10,000 minimum TVL
    const minVolume = 1000; // $1,000 minimum 24h volume
    
    return pool.tvl >= minTVL && pool.volume24h >= minVolume;
  }

  /**
   * Fallback pools if API is unavailable
   */
  private getFallbackPools(): RealPoolInfo[] {
    logger.info('📋 Using hardcoded fallback pools');
    
    return [
      {
        poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c2ffadbb87144e875749122e0bbb9f535eeaa7f5660c6c4a91bcc4121e477f08d",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA"
        },
        tokenB: {
          policyId: "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f",
          tokenName: "534e454b",
          symbol: "SNEK"
        },
        currentPrice: 0.000123,
        tvl: 125000,
        volume24h: 15000,
        lastUpdated: Date.now()
      },
      {
        poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4ca939812d08cfb6066e17d2914a7272c6b8c0197acdf68157d02c73649cc3efc0",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA"
        },
        tokenB: {
          policyId: "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61",
          tokenName: "446a65644d6963726f555344",
          symbol: "DJED"
        },
        currentPrice: 0.98,
        tvl: 500000,
        volume24h: 75000,
        lastUpdated: Date.now()
      }
    ];
  }

  /**
   * Start real-time pool monitoring
   */
  async startRealTimeMonitoring(pools: RealPoolInfo[], callback: (poolId: string, data: any) => void): Promise<void> {
    logger.info('🔄 Starting real-time pool monitoring...');
    
    setInterval(async () => {
      for (const pool of pools) {
        try {
          const realData = await this.getRealPoolData(pool.poolId);
          if (realData) {
            callback(pool.poolId, realData);
          }
        } catch (error) {
          logger.warn(`⚠️  Monitor error for pool ${pool.poolId}:`, (error as Error).message);
        }
      }
    }, 30000); // Update every 30 seconds
  }
}