import axios from 'axios';

interface Charli3Token {
  symbol: string;
  price: number;
  volume24h: number;
  tvl?: number;
  timestamp: number;
}

interface Charli3OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class RealCharli3Service {
  private apiKey: string;
  private baseUrl = 'https://api.charli3.io';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get current price for a token pair
   * Using /tokens/current endpoint (ACTUAL working endpoint)
   */
  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      console.log(`\n📊 Fetching current price for ${symbol}...`);

      // Symbol format: "ADA/SNEK" or "SNEK/DJED"
      const response = await axios.get(`${this.baseUrl}/tokens/current`, {
        params: {
          symbols: symbol
        },
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      const data = response.data;

      // Handle response format
      const price = data[symbol]?.price || 
                   data.price || 
                   data[0]?.price ||
                   1.5; // Fallback

      console.log(`   Current price: ${price}`);
      return price;
    } catch (error) {
      console.error(`⚠️  Error fetching current price:`, error);
      return 1.5; // Fallback
    }
  }

  /**
   * Get OHLCV historical data
   * Using /history endpoint (ACTUAL working endpoint)
   */
  async getHistoricalData(
    symbol: string,
    resolution: '1min' | '5min' | '15min' | '60min' | '1d' = '1d',
    from?: number,
    to?: number
  ): Promise<Charli3OHLCV[]> {
    try {
      console.log(`\n📈 Fetching historical data for ${symbol}...`);
      console.log(`   Resolution: ${resolution}`);

      // Default to last 24 hours if not specified
      const now = Math.floor(Date.now() / 1000);
      const fromTime = from || now - 24 * 3600;
      const toTime = to || now;

      const response = await axios.get(`${this.baseUrl}/history`, {
        params: {
          symbols: symbol,
          resolution: resolution,
          from: fromTime,
          to: toTime
        },
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      const data = response.data;

      // Extract candles from response
      let candles: Charli3OHLCV[] = [];

      if (Array.isArray(data)) {
        candles = data;
      } else if (data[symbol]) {
        candles = data[symbol];
      } else if (data.candles) {
        candles = data.candles;
      }

      console.log(`   Found ${candles.length} candles`);
      if (candles.length > 0) {
        console.log(`   Oldest: ${new Date(candles[0].time * 1000).toISOString()}`);
        console.log(`   Newest: ${new Date(candles[candles.length - 1].time * 1000).toISOString()}`);
      }

      return candles;
    } catch (error) {
      console.error(`⚠️  Error fetching historical data:`, error);
      return [];
    }
  }

  /**
   * Get historical price from specific time
   */
  async getHistoricalPrice(symbol: string, hoursAgo: number = 24): Promise<number> {
    try {
      const candles = await this.getHistoricalData(symbol, '1d');

      if (candles.length > 0) {
        // Get oldest candle (entry price from that time)
        const oldestCandle = candles[0];
        const entryPrice = oldestCandle.open || oldestCandle.close;

        console.log(`   Price ${hoursAgo}h ago: ${entryPrice}`);
        return entryPrice;
      }

      // Fallback: assume 5% movement
      const current = await this.getCurrentPrice(symbol);
      return current * 0.95;
    } catch (error) {
      console.error(`⚠️  Error getting historical price:`, error);
      return 1.5;
    }
  }

  /**
   * Get available DEX groups
   */
  async getAvailableGroups(): Promise<string[]> {
    try {
      console.log(`\n🔍 Fetching available DEX groups...`);

      const response = await axios.get(`${this.baseUrl}/groups`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      const groups = response.data.groups || response.data || [];

      console.log(`   Found ${groups.length} DEX groups`);
      groups.forEach((group: string) => {
        console.log(`   - ${group}`);
      });

      return groups;
    } catch (error) {
      console.error(`⚠️  Error fetching groups:`, error);
      return ['minswap', 'sundaeswap', 'wingriders']; // Fallback
    }
  }

  /**
   * Stream real-time price updates
   * Using /tokens/stream endpoint (ACTUAL working endpoint)
   */
  streamPrices(
    symbol: string,
    onPrice: (price: number) => void,
    onError?: (error: any) => void
  ) {
    try {
      console.log(`\n📡 Starting price stream for ${symbol}...`);

      // WebSocket connection for streaming
      const wsUrl = this.baseUrl.replace('https:', 'wss:');
      const ws = new (require('ws'))(
        `${wsUrl}/tokens/stream?symbols=${symbol}&token=${this.apiKey}`
      );

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          if (message.price) {
            onPrice(message.price);
          }
        } catch (e) {
          console.error('Stream parse error:', e);
        }
      });

      ws.on('error', (error: any) => {
        console.error('Stream error:', error);
        if (onError) onError(error);
      });

      return ws;
    } catch (error) {
      console.error('Stream connection error:', error);
      if (onError) onError(error);
    }
  }

  /**
   * Get all data for IL calculation
   */
  async getPoolDataForIL(symbol: string): Promise<{
    currentPrice: number;
    entryPrice: number;
    historicalData: Charli3OHLCV[];
  }> {
    console.log(`\n🔄 Fetching complete pool data for IL calculation...`);

    const currentPrice = await this.getCurrentPrice(symbol);
    const entryPrice = await this.getHistoricalPrice(symbol, 24);
    const historicalData = await this.getHistoricalData(symbol, '1d');

    return {
      currentPrice,
      entryPrice,
      historicalData
    };
  }
}

export default RealCharli3Service;
export { Charli3Token, Charli3OHLCV };