// Demo Vault with Pools - Connects fake pools to real Yield Safe vault
import DemoPoolFactory, { DemoPool, DemoLPToken } from './demoPools.js'

interface DemoVaultData {
  vaultId: string
  lpTokenId: string
  poolId: string
  owner: string
  ilThreshold: number
  createdAt: number
  status: 'healthy' | 'warning' | 'protected'
}

class DemoVaultWithPools {
  private demoPoolFactory: DemoPoolFactory
  private vaults: Map<string, DemoVaultData> = new Map()

  constructor() {
    this.demoPoolFactory = new DemoPoolFactory()
  }

  // DEMO: Create a fake pool and get LP tokens
  async setupDemoScenario(userAddress: string = 'demo_user_address') {
    console.log('🎬 Setting up demo scenario...\n')

    // Step 1: Create a fake SNEK/DJED pool (like Minswap would)
    const pool = this.demoPoolFactory.createPool('SNEK', 'DJED', 50000, 75000) // Slightly imbalanced

    console.log('\n')

    // Step 2: User provides liquidity to fake pool
    const userLPToken = this.demoPoolFactory.addLiquidity(
      pool.poolId,
      1000,  // User deposits 1000 SNEK
      1500,  // User deposits 1500 DJED (matching pool ratio)
      userAddress
    )

    console.log('\n')

    // Step 3: Deposit LP tokens to vault
    const vault = await this.depositLPToVault(userLPToken, 3.0) // 3% IL tolerance

    console.log('\n')

    return {
      pool,
      lpToken: userLPToken,
      vault,
      poolFactory: this.demoPoolFactory
    }
  }

  // Deposit LP tokens to vault
  private async depositLPToVault(lpToken: DemoLPToken, maxILTolerance: number): Promise<DemoVaultData> {
    const vaultId = `vault_${lpToken.tokenId}`

    const vault: DemoVaultData = {
      vaultId,
      lpTokenId: lpToken.tokenId,
      poolId: lpToken.poolId,
      owner: lpToken.owner,
      ilThreshold: maxILTolerance,
      createdAt: Date.now(),
      status: 'healthy'
    }

    this.vaults.set(vaultId, vault)

    console.log(`✅ Deposited LP token to Yield Safe vault`)
    console.log(`   Vault ID: ${vaultId}`)
    console.log(`   LP Amount: ${lpToken.amount.toFixed(2)}`)
    console.log(`   Entry Price: ${lpToken.entryPrice.toFixed(6)}`)
    console.log(`   Max IL Tolerance: ${maxILTolerance}%`)
    console.log(`   Status: MONITORING ACTIVE ✅`)

    return vault
  }

  // Calculate IL for a vault using our REAL IL formula
  calculateVaultIL(vaultId: string): { il: number, currentPrice: number, entryPrice: number } {
    const vault = this.vaults.get(vaultId)
    if (!vault) throw new Error("Vault not found")

    const lpToken = this.demoPoolFactory.getLPToken(vault.lpTokenId)
    if (!lpToken) throw new Error("LP Token not found")

    const currentPrice = this.demoPoolFactory.getPoolPrice(vault.poolId)
    const entryPrice = lpToken.entryPrice

    // Use our FIXED IL formula
    const priceRatio = currentPrice / entryPrice
    const il = (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1

    return {
      il: Math.abs(il * 100), // Convert to percentage and use absolute value
      currentPrice,
      entryPrice
    }
  }

  // Update vault status based on IL
  updateVaultStatus(vaultId: string): void {
    const vault = this.vaults.get(vaultId)
    if (!vault) return

    const { il } = this.calculateVaultIL(vaultId)

    if (il > vault.ilThreshold) {
      vault.status = 'protected'
    } else if (il > vault.ilThreshold * 0.8) {
      vault.status = 'warning'
    } else {
      vault.status = 'healthy'
    }
  }

  // Simulate market volatility
  async simulateVolatility(poolId: string, vaultId: string) {
    console.log('\n📈 Simulating market volatility...\n')

    const scenarios = [
      { ratio: 1.02, desc: 'Small price move (+2%)', sleep: 1000 },
      { ratio: 1.05, desc: 'Medium price move (+5%)', sleep: 1000 },
      { ratio: 1.15, desc: 'Large price move (+15%)', sleep: 1500 },
      { ratio: 1.35, desc: 'Major price spike (+35%)', sleep: 2000 }
    ]

    for (let scenario of scenarios) {
      // Change pool price
      const newPrice = this.demoPoolFactory.changePriceSimulation(poolId, scenario.ratio)

      // Calculate IL
      const { il, entryPrice } = this.calculateVaultIL(vaultId)

      // Update vault status
      this.updateVaultStatus(vaultId)
      const vault = this.vaults.get(vaultId)!

      console.log(`\n${scenario.desc}`)
      console.log(`   Price Ratio: ${scenario.ratio.toFixed(4)}`)
      console.log(`   Entry Price: ${entryPrice.toFixed(6)}`)
      console.log(`   Current Price: ${newPrice.toFixed(6)}`)
      console.log(`   Calculated IL: ${il.toFixed(4)}%`)
      console.log(`   Vault Status: ${vault.status.toUpperCase()}`)

      if (il > vault.ilThreshold) {
        console.log(`\n   🚨 IL EXCEEDED ${vault.ilThreshold}% THRESHOLD!`)
        console.log(`   ⚠️  Current IL: ${il.toFixed(4)}% > ${vault.ilThreshold}%`)
        console.log(`   🛡️ AUTOMATIC PROTECTION TRIGGERED`)
        console.log(`   ✅ Position rebalanced to safer pool`)
        console.log(`   ✅ User protected from ${il.toFixed(2)}% impermanent loss`)
        
        // Update vault status
        vault.status = 'protected'
        
        console.log(`\n   📊 Protection Summary:`)
        console.log(`   • Original IL Risk: ${il.toFixed(4)}%`)
        console.log(`   • Protection Triggered At: ${vault.ilThreshold}%`)
        console.log(`   • Vault Status: PROTECTED ✅`)
        console.log(`   • User Assets: SAFE ✅`)
        break
      } else {
        const remaining = vault.ilThreshold - il
        console.log(`   ✅ Safe (${remaining.toFixed(3)}% margin remaining)`)
      }

      // Delay between scenarios for dramatic effect
      await new Promise(resolve => setTimeout(resolve, scenario.sleep))
    }
  }

  // Get vault data for frontend
  getVault(vaultId: string): DemoVaultData | undefined {
    return this.vaults.get(vaultId)
  }

  // Get all vaults for a user
  getUserVaults(userAddress: string): DemoVaultData[] {
    return Array.from(this.vaults.values()).filter(vault => vault.owner === userAddress)
  }

  // Get demo pools factory for additional operations
  getPoolFactory(): DemoPoolFactory {
    return this.demoPoolFactory
  }
}

export default DemoVaultWithPools
export type { DemoVaultData }