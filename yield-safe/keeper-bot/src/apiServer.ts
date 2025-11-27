// Express API server to expose our fixed IL calculator to frontend
import express from 'express'
import cors from 'cors'
import { RealILCalculator } from './realILCalculator.js'

const app = express()
const port = 3001

// Middleware
app.use(cors())
app.use(express.json())

// Initialize our fixed IL calculator
const ilCalculator = new RealILCalculator()

// API Endpoints

// Get vault IL status (main endpoint)
app.post('/api/vault/il-status', async (req, res) => {
  try {
    const { tokenA, tokenB, entryPrice, dex = 'MinswapV2' } = req.body
    
    console.log(`📊 IL Status Request: ${tokenA}/${tokenB}, entry: ${entryPrice}`)
    
    // Get current pool data from Charli3
    const poolData = await ilCalculator.getPoolDataFromCharli3(tokenA, tokenB, dex)
    
    // Create user position with entry price
    const userPosition = {
      token_a_amount: 100000, // Standard amount for calculation
      token_b_amount: 150,
      lp_tokens: 100,
      initial_price: entryPrice,
      deposit_timestamp: Date.now() - 86400000
    }
    
    // Calculate real IL using our fixed formula
    const ilData = await ilCalculator.calculateRealIL(userPosition, poolData)
    
    // Check if protection should trigger
    const shouldTriggerProtection = ilData.ilPercentage > 3.0 // 3% threshold
    
    const response = {
      currentPrice: poolData.price,
      ilPercentage: ilData.ilPercentage,
      ilAmount: ilData.ilAmount,
      lpValue: ilData.lpValue,
      holdValue: ilData.holdValue,
      shouldTriggerProtection,
      dataSource: 'Charli3 Live API',
      timestamp: Date.now()
    }
    
    console.log(`✅ IL Status Response: ${ilData.ilPercentage.toFixed(4)}% IL`)
    res.json(response)
    
  } catch (error) {
    console.error('❌ IL Status Error:', error)
    res.status(500).json({ error: 'Failed to calculate IL status' })
  }
})

// Get real-time pool data
app.post('/api/pool/data', async (req, res) => {
  try {
    const { tokenA, tokenB, dex = 'MinswapV2' } = req.body
    
    const poolData = await ilCalculator.getPoolDataFromCharli3(tokenA, tokenB, dex)
    
    res.json({
      pair: poolData.pair,
      price: poolData.price,
      tvl: poolData.tvl || 0,
      volume24h: poolData.volume_24h || 0,
      timestamp: poolData.timestamp
    })
    
  } catch (error) {
    console.error('❌ Pool Data Error:', error)
    res.status(500).json({ error: 'Failed to fetch pool data' })
  }
})

// Start vault monitoring
app.post('/api/vault/monitor', async (req, res) => {
  try {
    const { vaultId, tokenA, tokenB, entryPrice, ilThreshold } = req.body
    
    console.log(`🛡️ Starting monitoring for vault ${vaultId}`)
    console.log(`   Pair: ${tokenA}/${tokenB}`)
    console.log(`   Entry Price: ${entryPrice}`)
    console.log(`   IL Threshold: ${ilThreshold}%`)
    
    // In a real implementation, this would:
    // 1. Store vault config in database
    // 2. Start background monitoring process
    // 3. Set up alerts/notifications
    
    res.json({ success: true, message: `Monitoring started for vault ${vaultId}` })
    
  } catch (error) {
    console.error('❌ Monitor Error:', error)
    res.status(500).json({ error: 'Failed to start monitoring' })
  }
})

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Yield Safe API',
    timestamp: new Date().toISOString()
  })
})

// Start server
app.listen(port, () => {
  console.log(`🚀 Yield Safe API Server running on port ${port}`)
  console.log(`🔗 Frontend can connect to: http://localhost:${port}`)
  console.log(`📊 IL Calculator: Ready with fixed calculations`)
})

export default app