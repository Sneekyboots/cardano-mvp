// Demo Pool Factory - Creates fake pools that behave like real Minswap pools
interface DemoPool {
  poolId: string
  tokenA: string
  tokenB: string
  reserveA: number
  reserveB: number
  createdAt: number
  k: number // constant product
}

interface DemoLPToken {
  poolId: string
  amount: number
  tokenId: string
  owner: string
  entryPrice: number // Track entry price for IL calculation
}

class DemoPoolFactory {
  private pools: Map<string, DemoPool> = new Map()
  private lpTokens: DemoLPToken[] = []

  // Create a fake pool (like Minswap would)
  createPool(tokenA: string, tokenB: string, reserveA: number, reserveB: number): DemoPool {
    const poolId = `demo_pool_${Date.now()}`

    const pool: DemoPool = {
      poolId,
      tokenA,
      tokenB,
      reserveA,
      reserveB,
      createdAt: Date.now(),
      k: reserveA * reserveB // constant product formula
    }

    this.pools.set(poolId, pool)

    console.log(`✅ Created demo pool: ${tokenA}/${tokenB}`)
    console.log(`   Pool ID: ${poolId}`)
    console.log(`   Reserves: ${reserveA.toLocaleString()} ${tokenA}, ${reserveB.toLocaleString()} ${tokenB}`)
    console.log(`   Initial Price: ${(reserveB / reserveA).toFixed(6)} ${tokenB} per ${tokenA}`)

    return pool
  }

  // User provides liquidity to fake pool
  addLiquidity(poolId: string, amountA: number, amountB: number, userAddress: string): DemoLPToken {
    const pool = this.pools.get(poolId)
    if (!pool) throw new Error("Pool not found")

    // Calculate current price for entry tracking
    const entryPrice = pool.reserveB / pool.reserveA

    // Calculate LP tokens issued (simplified)
    const lpAmount = Math.sqrt(amountA * amountB)

    // Create LP token
    const lpToken: DemoLPToken = {
      poolId,
      amount: lpAmount,
      tokenId: `lp_${poolId}_${Date.now()}`,
      owner: userAddress,
      entryPrice: entryPrice
    }

    this.lpTokens.push(lpToken)

    // Update pool reserves
    pool.reserveA += amountA
    pool.reserveB += amountB
    pool.k = pool.reserveA * pool.reserveB

    console.log(`✅ Added liquidity to ${poolId}`)
    console.log(`   Deposited: ${amountA.toLocaleString()} ${pool.tokenA} + ${amountB.toLocaleString()} ${pool.tokenB}`)
    console.log(`   LP tokens issued: ${lpAmount.toFixed(2)}`)
    console.log(`   Entry price: ${entryPrice.toFixed(6)}`)
    console.log(`   LP Token ID: ${lpToken.tokenId}`)

    return lpToken
  }

  // Simulate price change in fake pool
  changePriceSimulation(poolId: string, newPriceRatio: number): number {
    const pool = this.pools.get(poolId)
    if (!pool) throw new Error("Pool not found")

    // Calculate new reserves maintaining constant product
    const newReserveA = Math.sqrt(pool.k / newPriceRatio)
    const newReserveB = Math.sqrt(pool.k * newPriceRatio)

    const oldPrice = pool.reserveB / pool.reserveA
    pool.reserveA = newReserveA
    pool.reserveB = newReserveB
    const newPrice = pool.reserveB / pool.reserveA

    console.log(`📊 Price changed in ${poolId}`)
    console.log(`   Old price: ${oldPrice.toFixed(6)}`)
    console.log(`   New price: ${newPrice.toFixed(6)}`)
    console.log(`   Price change: ${((newPrice - oldPrice) / oldPrice * 100).toFixed(2)}%`)
    console.log(`   New reserves: ${newReserveA.toFixed(2)} ${pool.tokenA}, ${newReserveB.toFixed(2)} ${pool.tokenB}`)

    return newPrice
  }

  // Get current pool state
  getPool(poolId: string): DemoPool | undefined {
    return this.pools.get(poolId)
  }

  // Get current pool price
  getPoolPrice(poolId: string): number {
    const pool = this.pools.get(poolId)
    if (!pool) throw new Error("Pool not found")
    return pool.reserveB / pool.reserveA
  }

  // Get user's LP tokens
  getUserLPTokens(userAddress: string): DemoLPToken[] {
    return this.lpTokens.filter(token => token.owner === userAddress)
  }

  // Get LP token by ID
  getLPToken(tokenId: string): DemoLPToken | undefined {
    return this.lpTokens.find(token => token.tokenId === tokenId)
  }

  // Get all pools
  getAllPools(): DemoPool[] {
    return Array.from(this.pools.values())
  }
}

export default DemoPoolFactory
export type { DemoPool, DemoLPToken }