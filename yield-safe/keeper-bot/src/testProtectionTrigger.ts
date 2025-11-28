// Dramatic demo showing protection trigger
import DemoVaultWithPools from './demoVaultWithPools.js'

async function dramaticProtectionDemo() {
  console.log('\n')
  console.log('🚨 YIELD SAFE: PROTECTION TRIGGER DEMO')
  console.log('   Showing IL Protection in Action')
  console.log('═'.repeat(50))
  console.log('\n')

  const demoVault = new DemoVaultWithPools()
  
  // Setup with extreme volatility scenario
  const { pool, vault } = await demoVault.setupDemoScenario()
  
  console.log('💥 SIMULATING EXTREME MARKET CRASH...\n')
  
  // Force protection trigger with extreme price movements
  const extremeScenarios = [
    { ratio: 2.0, desc: '2x price pump', sleep: 1500 },
    { ratio: 4.0, desc: '4x price pump', sleep: 1500 },
    { ratio: 10.0, desc: '10x price moon mission!', sleep: 2000 }
  ]

  const poolFactory = demoVault.getPoolFactory()

  for (let scenario of extremeScenarios) {
    const newPrice = poolFactory.changePriceSimulation(pool.poolId, scenario.ratio)
    const { il } = demoVault.calculateVaultIL(vault.vaultId)
    
    console.log(`\n${scenario.desc}`)
    console.log(`   New Price: ${newPrice.toFixed(6)}`)
    console.log(`   IL: ${il.toFixed(3)}%`)
    
    if (il > vault.ilThreshold) {
      console.log(`   🚨 PROTECTION TRIGGERED!`)
      console.log(`   ✅ User protected from ${il.toFixed(2)}% loss`)
      break
    } else {
      console.log(`   ⚠️  Getting close... (${(vault.ilThreshold - il).toFixed(2)}% margin)`)
    }
    
    await new Promise(resolve => setTimeout(resolve, scenario.sleep))
  }
  
  console.log('\n🎯 Protection Demo Complete!\n')
}

dramaticProtectionDemo().catch(console.error)