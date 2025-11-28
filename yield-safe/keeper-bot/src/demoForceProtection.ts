// DEMO THAT GUARANTEES PROTECTION TRIGGER
import CompleteYieldSafeDemo from './demoCompleteSystem.js'

async function runProtectionTriggerDemo() {
  console.log('\n' + '═'.repeat(70))
  console.log('🚨 YIELD SAFE: PROTECTION TRIGGER DEMO')
  console.log('   Showing automatic protection when IL exceeds threshold')
  console.log('═'.repeat(70))

  const demo = new CompleteYieldSafeDemo()
  
  try {
    // Step 1: Create vault
    const vault = await demo.createDemoVault()
    
    // Step 2: Force high IL scenarios
    console.log('\n🔥 FORCING EXTREME MARKET VOLATILITY...')
    
    const poolFactory = demo.demoVaults.getPoolFactory()
    const scenarios = [
      { ratio: 0.5, desc: 'CRASH: -50% price drop', expectIL: 10 },
      { ratio: 2.5, desc: 'MOON: +150% price spike', expectIL: 15 },
      { ratio: 0.3, desc: 'BRUTAL: -70% collapse', expectIL: 25 }
    ]
    
    for (const scenario of scenarios) {
      console.log(`\n💥 ${scenario.desc}`)
      
      // Get vault details for monitoring
      const vaultData = demo.activeVaults.get(vault.id)!
      
      // Change price dramatically
      poolFactory.changePriceSimulation(vaultData.poolId, scenario.ratio)
      
      // Calculate actual IL
      const ilData = demo.demoVaults.calculateVaultIL(vault.id)
      
      console.log(`📊 Market Analysis:`)
      console.log(`   Entry Price: ${ilData.entryPrice.toFixed(6)}`)
      console.log(`   Current Price: ${ilData.currentPrice.toFixed(6)}`)
      console.log(`   Price Change: ${((ilData.currentPrice - ilData.entryPrice) / ilData.entryPrice * 100).toFixed(1)}%`)
      console.log(`   CALCULATED IL: ${ilData.il.toFixed(4)}%`)
      console.log(`   IL Threshold: ${vaultData.ilThreshold}%`)
      
      if (ilData.il > vaultData.ilThreshold) {
        console.log(`\n🚨 CRITICAL: IL EXCEEDS THRESHOLD!`)
        console.log(`   ${ilData.il.toFixed(4)}% > ${vaultData.ilThreshold}%`)
        console.log(`   Excess IL: ${(ilData.il - vaultData.ilThreshold).toFixed(4)}%`)
        
        // Execute protection
        const txHash = await demo.executeRealProtection(vaultData, ilData.il)
        
        console.log(`\n✅ PROTECTION SUCCESSFUL`)
        console.log(`   Transaction: ${txHash}`)
        console.log(`   Vault Status: PROTECTED`)
        console.log(`   User Loss Prevented: ~${(ilData.il * vaultData.lpTokens * 0.01).toFixed(2)} DJED`)
        
        break // Stop after first protection
        
      } else {
        const remaining = vaultData.ilThreshold - ilData.il
        console.log(`   ✅ Still safe (${remaining.toFixed(3)}% margin)`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    console.log('\n' + '═'.repeat(70))
    console.log('🎯 PROTECTION DEMO COMPLETE')
    console.log('   User assets protected from impermanent loss!')
    console.log('═'.repeat(70))
    
  } catch (error) {
    console.error('❌ Demo failed:', error)
  }
}

// Run the protection demo
runProtectionTriggerDemo().catch(console.error)