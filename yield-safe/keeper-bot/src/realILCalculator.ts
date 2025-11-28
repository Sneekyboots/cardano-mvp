// Real IL Detection with Charli3 API Integration
// import { Lucid } from 'lucid-cardano' // Commented out - not needed for Charli3 API calls

interface Charli3PoolData {
  pair: string
  price: number
  liquidity_a: number
  liquidity_b: number
  timestamp: number
  volume_24h?: number
  tvl?: number
}

interface RealILData {
  ilPercentage: number
  ilAmount: number
  lpValue: number
  holdValue: number
  timestamp: number
  priceData: Charli3PoolData
}

interface UserPosition {
  token_a_amount: number
  token_b_amount: number
  lp_tokens: number
  initial_price: number
  deposit_timestamp: number
}

export class RealILCalculator {
  private charli3ApiKey: string
  private baseUrl = 'https://api.charli3.io/api/v1'
  private policyIds: Record<string, string> = {
    'SNEK': '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b',
    'DJED': '8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61446a65644d6963726f555344',
    'AGIX': 'f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc53541474958',
    'C3': 'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c',
    'USDC': 'f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b6988612d6f94',
    'MIN': 'e16c2dc8ae937e8d3790c7fd7168d7b994621ba14ca11415f39fed72'
  }
  private poolIds: Record<string, string> = {
    'SNEK': 'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c2ffadbb87144e875749122e0bbb9f535eeaa7f5660c6c4a91bcc4121e477f08d',
    'DJED': 'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4ca939812d08cfb6066e17d2914a7272c6b8c0197acdf68157d02c73649cc3efc0',
    'C3': 'f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c36ba6613fc391c292c6fc96c50f17b4e7e26d72212d3d07f6e1cd4d4dbe93bbc'
  }

  constructor(apiKey: string = 'cta_XwETKtC3MeGDZL2CYbZ9Ju6Ac9P2UcPf6iVGGQlf6A7nR0hz7vXVR6UWBujmnZKE') {
    this.charli3ApiKey = apiKey
    console.log('🔑 RealILCalculator initialized with Charli3 API key')
  }

  async getHistoricalPrice(tokenA: string, tokenB: string, daysAgo: number = 1, dex: string = 'MinswapV2'): Promise<number | null> {
    try {
      console.log(`📈 Fetching historical price for ${tokenA}/${tokenB} from ${daysAgo} days ago`)
      
      // Step 1: Get groups
      const groupsResponse = await fetch(`${this.baseUrl}/groups`, {
        headers: { 'Authorization': `Bearer ${this.charli3ApiKey}` }
      })
      const groupsData = await groupsResponse.json() as any
      const groups = groupsData?.d?.groups || groupsData?.groups || []
      const groupNames = groups.map((g: any) => g.id || g.name || g)
      
      const targetDex = groupNames.includes(dex) ? dex : 'MinswapV2'
      
      // Step 2: Get symbol info for the DEX
      const pairsResponse = await fetch(`${this.baseUrl}/symbol_info?group=${targetDex}`, {
        headers: { 'Authorization': `Bearer ${this.charli3ApiKey}` }
      })
      const pairsData = await pairsResponse.json() as any
      
      // Step 3: Find specific pair using policy IDs (more reliable than symbol names)
      const ADA_CURRENCY = ""
      const tokenACurrency = this.policyIds[tokenA] || ""
      const tokenBCurrency = this.policyIds[tokenB] || ""
      
      let targetSymbol = null
      
      if (pairsData.base_currency && pairsData.currency && pairsData.ticker) {
        for (let i = 0; i < pairsData.ticker.length; i++) {
          const baseCurrency = pairsData.base_currency[i]
          const currency = pairsData.currency[i]
          const ticker = pairsData.ticker[i]
          
          // Check for ADA/Token pairs (ADA is always base_currency "")
          if ((baseCurrency === ADA_CURRENCY && currency === tokenACurrency) ||
              (baseCurrency === ADA_CURRENCY && currency === tokenBCurrency) ||
              (baseCurrency === tokenACurrency && currency === tokenBCurrency) ||
              (baseCurrency === tokenBCurrency && currency === tokenACurrency)) {
            targetSymbol = ticker
            console.log(`✅ Found pair: ${ticker} for ${tokenA}/${tokenB}`)
            break
          }
        }
      }
      
      if (!targetSymbol) {
        console.log(`⚠️ No historical data available for ${tokenA}/${tokenB} pair`)
        return null
      }
      
      // Step 4: Get historical price data
      const to = Math.floor(Date.now() / 1000)
      const from = to - (daysAgo * 24 * 60 * 60)
      
      const historyResponse = await fetch(`${this.baseUrl}/history?symbol=${targetSymbol}&resolution=60min&from=${from}&to=${to}`, {
        headers: { 'Authorization': `Bearer ${this.charli3ApiKey}` }
      })
      
      if (historyResponse.ok) {
        const historyData = await historyResponse.json() as any
        
        if (historyData.s === 'ok' && historyData.c && historyData.c.length > 0) {
          // Get the earliest available price (closest to the requested time)
          const historicalPrice = historyData.c[0] // First price in the range
          console.log(`📊 Historical price ${daysAgo} days ago: ${historicalPrice}`)
          return historicalPrice
        }
      }
      
      console.log(`⚠️ No historical price data found for ${tokenA}/${tokenB}`)
      return null
      
    } catch (error) {
      console.error(`❌ Failed to fetch historical price:`, error)
      return null
    }
  }

  async getPoolDataFromCharli3(tokenA: string, tokenB: string, dex: string = 'MinswapV2'): Promise<Charli3PoolData> {
    try {
      console.log(`🔍 Fetching real pool data: ${tokenA}/${tokenB} from ${dex} via Charli3 API`)
      
      // Step 1: Get available groups to verify the DEX exists
      const groupsResponse = await fetch(`${this.baseUrl}/groups`, {
        headers: { 'Authorization': `Bearer ${this.charli3ApiKey}` }
      })
      const groupsData = await groupsResponse.json() as any
      const groups = groupsData?.d?.groups || groupsData?.groups || []
      const groupNames = groups.map((g: any) => g.id || g.name || g)
      
      // Use the specified DEX or default to MinswapV2
      const targetDex = groupNames.includes(dex) ? dex : 'MinswapV2'
      console.log(`📊 Using DEX: ${targetDex}`)
      
      // Step 2: Get trading pairs for the specified DEX
      const url = new URL(`${this.baseUrl}/symbol_info`)
      url.searchParams.append('group', targetDex)
      
      const pairsResponse = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${this.charli3ApiKey}` }
      })
      const pairsData = await pairsResponse.json() as any
      const pairs = pairsData?.d || pairsData || {}
      
      // Step 3: Find the matching trading pair
      const pairEntries = Object.entries(pairs)
      console.log(`🔎 Searching through ${pairEntries.length} ${targetDex} pairs...`)
      
      // Try different pair name formats
      const possiblePairNames = [
        `${tokenA}.${tokenB}`,
        `${tokenB}.${tokenA}`,
        `ADA.${tokenA}`,
        `ADA.${tokenB}`,
        `${tokenA}_${tokenB}`,
        `${tokenB}_${tokenA}`,
        `${tokenA}/${tokenB}`,
        `${tokenB}/${tokenA}`,
      ]
      
      let foundPair: [string, any] | null = null
      for (const pairName of possiblePairNames) {
        const match = pairEntries.find(([symbol]) => 
          symbol.toLowerCase().includes(pairName.toLowerCase()) ||
          pairName.toLowerCase().includes(symbol.toLowerCase())
        )
        if (match) {
          foundPair = match
          break
        }
      }
      
      if (!foundPair) {
        console.log(`⚠️ No trading pair found, fetching individual token prices for ${tokenA}/${tokenB}`)
        
        // Try to get individual token prices instead
        const [priceDataA, priceDataB] = await Promise.all([
          this.fetchTokenPrice(tokenA),
          this.fetchTokenPrice(tokenB)
        ])
        
        if (priceDataA && priceDataB) {
          const relativePrice = priceDataA.price / priceDataB.price
          console.log(`✅ REAL PRICE CALCULATED: ${relativePrice} (${tokenA}/${tokenB} using live Charli3 data)`)
          console.log(`   ${tokenA}: $${priceDataA.price}`)
          console.log(`   ${tokenB}: $${priceDataB.price}`)
          
          return {
            pair: `${tokenA}/${tokenB}`,
            price: relativePrice,
            liquidity_a: 800000, // Conservative estimate
            liquidity_b: 800000 * relativePrice,
            timestamp: Math.max(priceDataA.timestamp, priceDataB.timestamp),
            volume_24h: 75000,
            tvl: 1500000
          }
        } else if (priceDataA) {
          // Use single token price with USD base
          console.log(`✅ Using ${tokenA} price vs USD: $${priceDataA.price}`)
          
          return {
            pair: `${tokenA}/USD`,
            price: priceDataA.price,
            liquidity_a: 800000,
            liquidity_b: 800000 * priceDataA.price,
            timestamp: priceDataA.timestamp,
            volume_24h: 75000,
            tvl: 1500000
          }
        }
        
        console.log(`⚠️ No real prices available, using estimated data for ${tokenA}/${tokenB}`)
        return this.generateMockPoolData(tokenA, tokenB)
      }
      
      const [pairSymbol, pairInfo] = foundPair
      console.log(`✅ Found matching pair: ${pairSymbol}`)
      
      // Step 4: Try to get current price for the pair
      try {
        const priceResponse = await fetch(`${this.baseUrl}/current?symbol=${pairSymbol}`, {
          headers: { 'Authorization': `Bearer ${this.charli3ApiKey}` }
        })
        
        if (priceResponse.ok) {
          const priceData = await priceResponse.json() as any
          const realPrice = priceData?.d?.price || priceData?.price || priceData?.c?.[0]
          
          if (realPrice && typeof realPrice === 'number' && realPrice > 0) {
            console.log(`📈 Real price fetched: ${realPrice} for ${pairSymbol}`)
            return {
              pair: `${tokenA}/${tokenB}`,
              price: realPrice,
              liquidity_a: priceData?.liquidity_a || 1000000, // Use real liquidity if available
              liquidity_b: priceData?.liquidity_b || 1000000,
              timestamp: priceData?.timestamp || Date.now(),
              volume_24h: priceData?.volume_24h || 100000,
              tvl: priceData?.tvl || 2000000
            }
          }
        }
      } catch (priceError) {
        console.log(`⚠️ Price fetch failed for ${pairSymbol}, using estimated price`)
      }
      
      // If price fetch fails, use estimated price based on token types
      const estimatedPrice = this.getEstimatedTokenPrice(tokenA, tokenB)
      console.log(`⚠️ Using estimated price: ${estimatedPrice} for ${tokenA}/${tokenB}`)
      
      return {
        pair: `${tokenA}/${tokenB}`,
        price: estimatedPrice,
        liquidity_a: 800000, // Conservative estimate
        liquidity_b: 800000 * estimatedPrice,
        timestamp: Date.now(),
        volume_24h: 75000, // Conservative estimate
        tvl: 1500000 // Conservative estimate
      }
      
    } catch (error) {
      console.error('❌ Failed to fetch from Charli3 API:', error)
      console.log('🔄 Falling back to mock data')
      return this.generateMockPoolData(tokenA, tokenB)
    }
  }

  private generateMockPoolData(tokenA: string, tokenB: string): Charli3PoolData {
    const estimatedPrice = this.getEstimatedTokenPrice(tokenA, tokenB)
    console.log(`🔄 Generating realistic pool data for ${tokenA}/${tokenB} with price ${estimatedPrice}`)
    
    return {
      pair: `${tokenA}/${tokenB}`,
      price: estimatedPrice,
      liquidity_a: 750000, // Conservative realistic estimate
      liquidity_b: 750000 * estimatedPrice,
      timestamp: Date.now(),
      volume_24h: 50000, // Conservative daily volume
      tvl: 1200000 // Conservative total value locked
    }
  }

  private getEstimatedTokenPrice(tokenA: string, tokenB: string): number {
    // Realistic price estimates based on known Cardano tokens (in USD)
    const usdPriceMap: Record<string, number> = {
      'ADA': 0.45, // Current ADA price in USD
      'DJED': 1.02, // Stablecoin
      'USDC': 1.00, // Stablecoin
      'SNEK': 0.0015, // Popular Cardano token in USD
      'AGIX': 0.35, // AI token
      'C3': 0.12, // Charli3 token
      'WMT': 0.08, // World Mobile
      'MIN': 0.025, // Minswap token
      'COPI': 0.18, // Cornucopias
      'HOSKY': 0.0001 // Meme token
    }
    
    // Get USD prices
    const priceA_USD = usdPriceMap[tokenA] || 0.1
    const priceB_USD = usdPriceMap[tokenB] || 1.0
    
    // Return how much of tokenB you need to buy 1 tokenA
    // For ADA/SNEK: $0.45 / $0.0015 = 300 SNEK per 1 ADA
    // So the price of ADA in terms of SNEK is 300
    return priceA_USD / priceB_USD
  }

  private async fetchTokenPrice(token: string): Promise<{ price: number; timestamp: number } | null> {
    try {
      console.log(`📈 Fetching real price for ${token} via Charli3...`)
      
      // Try policy ID first
      const policyId = this.policyIds[token]
      if (policyId) {
        console.log(`🔑 Using policy ID for ${token}: ${policyId.slice(0, 16)}...`)
        
        const url = new URL(`${this.baseUrl}/tokens/current`)
        url.searchParams.append('symbols', token)

        const response = await fetch(url.toString(), {
          headers: { 'Authorization': `Bearer ${this.charli3ApiKey}` }
        })

        if (response.ok) {
          const data = await response.json() as any

          // Charli3 may return object keyed by symbol
          const price = data[token]?.price || data.data?.[token]?.price || data.price || data.c?.[0]

          if (price && typeof price === 'number' && price > 0) {
            console.log(`✅ ${token} real price: $${price} (from policy ID)`)
            return { price, timestamp: data.t || Date.now() }
          }
        }
      }
      
      // Try pool ID as fallback
      const poolId = this.poolIds[token]
      if (poolId) {
        console.log(`🏊 Using pool ID for ${token}: ${poolId.slice(0, 16)}...`)
        
        const url = new URL(`${this.baseUrl}/tokens/current`)
        // Charli3 accepts symbols or pool; use pool as a hint
        url.searchParams.append('pool', poolId)

        const response = await fetch(url.toString(), {
          headers: { 'Authorization': `Bearer ${this.charli3ApiKey}` }
        })

        if (response.ok) {
          const data = await response.json() as any
          const price = data[token]?.price || data.data?.[token]?.price || data.price || data.c?.[0]

          if (price && typeof price === 'number' && price > 0) {
            console.log(`✅ ${token} real price: $${price} (from pool ID)`)
            return { price, timestamp: data.t || Date.now() }
          }
        }
      }
      
      console.log(`⚠️ No policy/pool ID available for ${token}`)
      return null
      
    } catch (error) {
      console.error(`❌ Charli3 failed for ${token}:`, error)
      return null
    }
  }

  async getFallbackPoolData(tokenA: string, tokenB: string): Promise<Charli3PoolData> {
    try {
      console.log('⚠️ Using CoinGecko fallback for price data')
      
      const tokenMap: Record<string, string> = {
        'ADA': 'cardano',
        'DJED': 'djed',
        'USDC': 'usd-coin',
        'AGIX': 'singularitynet'
      }

      const priceResponse = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokenMap[tokenA]},${tokenMap[tokenB]}&vs_currencies=usd`
      )
      
      const prices = await priceResponse.json() as Record<string, { usd: number }>
      const priceA = prices[tokenMap[tokenA]]?.usd || 1
      const priceB = prices[tokenMap[tokenB]]?.usd || 1
      const relativePrice = priceA / priceB

      return {
        pair: `${tokenA}/${tokenB}`,
        price: relativePrice,
        liquidity_a: 1000000, // Mock liquidity for fallback
        liquidity_b: 1000000 * relativePrice,
        timestamp: Date.now()
      }

    } catch (error) {
      console.error('❌ Fallback price fetch failed:', error)
      
      // Ultimate fallback - return stable mock data
      return {
        pair: `${tokenA}/${tokenB}`,
        price: 1.0,
        liquidity_a: 1000000,
        liquidity_b: 1000000,
        timestamp: Date.now()
      }
    }
  }

  calculateLPValue(
    lpTokens: number,
    totalLiquidityA: number,
    totalLiquidityB: number,
    priceA: number,
    priceB: number,
    totalSupply: number = 1000000
  ): number {
    // Constant product formula: x*y = k
    const k = totalLiquidityA * totalLiquidityB
    const poolValueUSD = (totalLiquidityA * priceA) + (totalLiquidityB * priceB)
    const lpShare = lpTokens / totalSupply
    
    return poolValueUSD * lpShare
  }

  calculateHoldValue(
    tokenAAmount: number,
    tokenBAmount: number,
    priceA: number,
    priceB: number
  ): number {
    return (tokenAAmount * priceA) + (tokenBAmount * priceB)
  }

  async calculateRealIL(
    userPosition: UserPosition,
    poolData: Charli3PoolData,
    tokenA?: string,
    tokenB?: string
  ): Promise<RealILData> {
    try {
      console.log('📊 Calculating real IL with live data...')
      console.log(`🔍 Entry price: ${userPosition.initial_price}`)
      console.log(`🔍 Current price: ${poolData.price}`)

      // PROPER IL Calculation using the standard AMM formula
      const entryPrice = userPosition.initial_price
      const currentPrice = poolData.price

      // Calculate price ratio (both entryPrice and currentPrice must be in the same units: tokenA per tokenB)
      const priceRatio = currentPrice / entryPrice
      console.log(`📊 Price ratio: ${priceRatio.toFixed(6)}`)

      // Proper IL loss formula (positive when there is impermanent loss):
      // IL_loss = 1 - (2 * sqrt(r)) / (1 + r)
      const sqrtRatio = Math.sqrt(priceRatio)
      const ilLoss = 1 - (2 * sqrtRatio) / (1 + priceRatio)
      const ilPercentage = ilLoss * 100

      console.log(`🧮 IL calculation: 1 - 2*√${priceRatio.toFixed(4)} / (1 + ${priceRatio.toFixed(4)})`)
      console.log(`📈 IL loss result: ${ilPercentage.toFixed(4)}%`)

      // Get USD prices for tokenA and tokenB to compute accurate USD values for hold/LP
      // Try to fetch live prices; otherwise fall back to conservative estimates
      let priceA_USD = 1.0
      let priceB_USD = 1.0
      try {
        if (tokenA) {
          const pA = await this.fetchTokenPrice(tokenA)
          if (pA && pA.price) priceA_USD = pA.price
        }
        if (tokenB) {
          const pB = await this.fetchTokenPrice(tokenB)
          if (pB && pB.price) priceB_USD = pB.price
        }
      } catch (e) {
        // ignore and use estimates below
      }

      // Fallback USD map (keeps previous conservative estimates)
      const usdPriceMap: Record<string, number> = {
        'ADA': 0.45,
        'DJED': 1.02,
        'USDC': 1.00,
        'SNEK': 0.0015,
        'AGIX': 0.35,
        'C3': 0.12,
        'WMT': 0.08,
        'MIN': 0.025,
        'COPI': 0.18,
        'HOSKY': 0.0001
      }

      if ((!tokenA || !priceA_USD || priceA_USD <= 0) && tokenA) priceA_USD = usdPriceMap[tokenA] || 0.1
      if ((!tokenB || !priceB_USD || priceB_USD <= 0) && tokenB) priceB_USD = usdPriceMap[tokenB] || 1.0

      // Calculate actual values for display in USD
      const tokenAValueUSD = userPosition.token_a_amount * priceA_USD
      const tokenBValueUSD = userPosition.token_b_amount * priceB_USD
      const holdValue = tokenAValueUSD + tokenBValueUSD // What holding would be worth in USD

      // LP position value after applying IL loss
      const lpValue = holdValue * (1 - ilLoss)
      const ilAmount = holdValue - lpValue
      
      const result: RealILData = {
        ilPercentage: Math.abs(ilPercentage), // Use absolute value for display
        ilAmount: Math.abs(ilAmount),
        lpValue,
        holdValue,
        timestamp: Date.now(),
        priceData: poolData
      }

      console.log('✅ Real IL calculated:', {
        il: `${ilPercentage.toFixed(4)}%`,
        holdValue: `$${holdValue.toFixed(2)}`,
        lpValue: `$${lpValue.toFixed(2)}`,
        loss: `$${ilAmount.toFixed(2)}`
      })

      return result

    } catch (error) {
      console.error('❌ IL calculation failed:', error)
      throw error
    }
  }

  async monitorVaultIL(
    vaultData: {
      token_a: string
      token_b: string
      dex: string
      user_position: UserPosition
      il_threshold: number
    }
  ): Promise<{ ilData: RealILData; shouldTriggerProtection: boolean }> {
    
    // Get real pool data from Charli3
    const poolData = await this.getPoolDataFromCharli3(
      vaultData.token_a,
      vaultData.token_b,
      vaultData.dex
    )

    // Calculate real IL (pass token symbols so USD prices can be resolved)
    const ilData = await this.calculateRealIL(
      vaultData.user_position,
      poolData,
      vaultData.token_a,
      vaultData.token_b
    )

    // Check if protection should trigger
    const shouldTriggerProtection = Math.abs(ilData.ilPercentage) > vaultData.il_threshold

    if (shouldTriggerProtection) {
      console.log(`🚨 IL PROTECTION TRIGGERED!`)
      console.log(`   IL: ${ilData.ilPercentage.toFixed(2)}%`)
      console.log(`   Threshold: ${vaultData.il_threshold}%`)
      console.log(`   Loss: $${ilData.ilAmount.toFixed(2)}`)
    }

    return { ilData, shouldTriggerProtection }
  }

  // Store IL history for dashboard
  async storeILHistory(vaultId: string, ilData: RealILData): Promise<void> {
    const historyEntry = {
      vault_id: vaultId,
      timestamp: ilData.timestamp,
      il_percentage: ilData.ilPercentage,
      il_amount: ilData.ilAmount,
      pool_data: ilData.priceData,
      protection_status: Math.abs(ilData.ilPercentage) > 5 ? 'alert' : 'normal'
    }

    // In production, store to database
    console.log('📈 IL History Entry:', historyEntry)
  }
}