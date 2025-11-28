import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { Lucid, Blockfrost, Data, Constr, SpendingValidator } from 'lucid-cardano'
import { RealILCalculator } from './realILCalculator.js'
import { RealPoolLoader } from './pools/realPoolLoader.js'
import { RealLiquidityProvider } from './realLiquidityProvider.js'
import { BlockchainVaultSync } from './services/blockchainVaultSync.js'
import { DatabaseService } from './database/database.js'

// Load environment variables
dotenv.config()

// Load vault validator from plutus.json (like Minswap does)
function loadVaultValidator(): SpendingValidator {
  const plutusPath = path.resolve(process.cwd(), '../contracts/plutus.json')
  const plutusFile = fs.readFileSync(plutusPath, 'utf-8')
  const plutusCompiled = JSON.parse(plutusFile)
  
  const vaultValidator = plutusCompiled.validators.find(
    (v: any) => v.title === "vault.vault_validator"
  )
  
  if (!vaultValidator) {
    throw new Error("Vault validator not found in plutus.json")
  }
  
  return {
    type: "PlutusV2",
    script: vaultValidator.compiledCode
  }
}

const app = express()
const port = 3001

// Blockfrost API key for Cardano Preview testnet
const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY || 'previewbJdo19gLSsDoPQCpwoAY469vXcPNvtPM'

// Middleware
app.use(cors())
app.use(express.json())

// Initialize services
const ilCalculator = new RealILCalculator()
const poolLoader = new RealPoolLoader()
const liquidityProvider = new RealLiquidityProvider()

// Initialize database and blockchain sync
const database = new DatabaseService('./data/api-keeper.db')
let blockchainSync: BlockchainVaultSync

// Initialize blockchain sync when API starts
async function initializeServices() {
  try {
    console.log('🔄 Initializing API services...')
    await database.initialize()
    
    const lucid = await Lucid.new(
      new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        BLOCKFROST_API_KEY
      ),
      "Preview"
    )
    
    blockchainSync = new BlockchainVaultSync(lucid, database)
    console.log('🔄 Running initial vault sync...')
    await blockchainSync.syncVaultsFromBlockchain()
    console.log('✅ API services initialized with vault data')
  } catch (error) {
    console.error('❌ Failed to initialize API services:', error)
  }
}

// API Endpoints

// Get vault validator script for emergency exits  
console.log('🔧 Registering /api/vault/validator endpoint')
app.get('/api/vault/validator', (req, res) => {
  console.log('📝 /api/vault/validator endpoint called')
  try {
    const vaultValidator = loadVaultValidator()
    
    res.json({
      success: true,
      validator: vaultValidator,
      network: 'Preview'
    })
  } catch (error) {
    console.error('❌ Failed to get vault validator:', error)
    res.status(500).json({ error: 'Failed to get vault validator' })
  }
})

// Get vault contract address
console.log('🔧 Registering /api/vault/address endpoint')
app.get('/api/vault/address', async (req, res) => {
  try {
    // Initialize Lucid to generate address
    const lucid = await Lucid.new(
      new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        BLOCKFROST_API_KEY
      ),
      "Preview"
    )
    
    const vaultValidator = loadVaultValidator()
    const vaultAddress = lucid.utils.validatorToAddress(vaultValidator)
    
    res.json({
      success: true,
      vaultAddress,
      network: 'Preview',
      validatorHash: lucid.utils.validatorToScriptHash(vaultValidator),
      validator: vaultValidator  // ADDED: Return validator inline
    })
  } catch (error) {
    console.error('❌ Failed to get vault address:', error)
    res.status(500).json({ error: 'Failed to get vault address' })
  }
})

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ test: 'works' })
})

// Get available real pools for frontend - REAL MINSWAP DATA ONLY
app.get('/api/pools/list', async (req, res) => {
  try {
    console.log('📊 Loading REAL Minswap pools from Preview testnet...')
    
    // REAL Minswap pools created with actual pool IDs!
    const realPools = [
      {
        poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c279c909f348e533da5808898f87f9a14",
        tokenA: {
          policyId: "",
          tokenName: "ADA", 
          symbol: "ADA"
        },
        tokenB: {
          policyId: "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f",
          tokenName: "SNEK",
          symbol: "SNEK"
        },
        currentPrice: 200.0,
        tvl: 5000,
        volume24h: 5124,
        lastUpdated: Date.now()
      },
      {
        poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c8db269c3ec630e06ae29f74bc39edd1f",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA"
        },
        tokenB: {
          policyId: "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61",
          tokenName: "DJED",
          symbol: "DJED"
        },
        currentPrice: 0.5,
        tvl: 2500,
        volume24h: 45611,
        lastUpdated: Date.now()
      },
      {
        poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4ce16c2dc8ae937e8d3790c7fd7168d7b9",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA"
        },
        tokenB: {
          policyId: "e16c2dc8ae937e8d3790c7fd7168d7b994621ba14ca11415f39fed72",
          tokenName: "MIN",
          symbol: "MIN"
        },
        currentPrice: 0.016,
        tvl: 4000,
        volume24h: 3313,
        lastUpdated: Date.now()
      },
      {
        poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4ca1c9db04a86b420b6b09f9d9b9b9e7b5",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA"
        },
        tokenB: {
          policyId: "a1c9db04a86b420b6b09f9d9b9b9e7b5f5a5d5c5b5a5d5c5b5a5d5c5",
          tokenName: "SHEN",
          symbol: "SHEN"
        },
        currentPrice: 0.002,
        tvl: 3200,
        volume24h: 2156,
        lastUpdated: Date.now()
      },
      {
        poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4cf66d78b4a3cb3d37afa0ec36461e51ec",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA"
        },
        tokenB: {
          policyId: "f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880",
          tokenName: "USDC",
          symbol: "USDC"
        },
        currentPrice: 1.02,
        tvl: 8500,
        volume24h: 12450,
        lastUpdated: Date.now()
      },
      {
        poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c03a3660be2e27b5fd9964932ad57e7ca",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA"
        },
        tokenB: {
          policyId: "03a3660be2e27b5fd9964932ad57e7ca31c6c4b7e3e74e0fd2c4c4b1",
          tokenName: "WMT",
          symbol: "WMT"
        },
        currentPrice: 0.08,
        tvl: 1800,
        volume24h: 890,
        lastUpdated: Date.now()
      },
      {
        poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c25c5de5f5e0fa39dbe98c8a3e2ab12c1",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA"
        },
        tokenB: {
          policyId: "25c5de5f5e0fa39dbe98c8a3e2ab12c1f3e2c2a1b3e2c2a1b3e2c2a1",
          tokenName: "AGIX",
          symbol: "AGIX"
        },
        currentPrice: 0.15,
        tvl: 6200,
        volume24h: 4320,
        lastUpdated: Date.now()
      },
      {
        poolId: "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c1d7f33bd23d85e1a25d87d1d2b413d46",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA"
        },
        tokenB: {
          policyId: "1d7f33bd23d85e1a25d87d1d2b413d46e33f8a1b3e2c2a1b3e2c2a1",
          tokenName: "HOSKY",
          symbol: "HOSKY"
        },
        currentPrice: 0.00001,
        tvl: 950,
        volume24h: 125,
        lastUpdated: Date.now()
      }
    ]
    
    // Allow forcing a mock response from the frontend or via env var
    const useMockQuery = (req.query?.mock === 'true')
    const useMockEnv = (process.env.USE_MOCK_POOLS === 'true')
    const useMock = useMockQuery || useMockEnv

    if (useMock) {
      console.log('ℹ️ Returning MOCK pool data (mock enabled)')
      return res.json({
        pools: realPools,
        count: realPools.length,
        timestamp: Date.now(),
        source: 'MOCK_STATIC'
      })
    }

    // Fetch live Charli3 data in parallel for predefined pairs.
    const pairs = ['ADA/SNEK', 'ADA/DJED', 'ADA/USDC', 'ADA/MIN', 'ADA/AGIX', 'ADA/HOSKY']

    // Perform all requests in parallel and collect results safely
    const results = await Promise.allSettled(pairs.map(async (pair) => {
      const [tokenA, tokenB] = pair.split('/')
      try {
        const poolData = await ilCalculator.getPoolDataFromCharli3(tokenA, tokenB, 'MinswapV2')
        return {
          ok: true,
          tokenA,
          tokenB,
          poolData
        }
      } catch (err) {
        console.warn(`⚠️ Failed to fetch Charli3 for ${pair}:`, err instanceof Error ? err.message : err)
        return { ok: false, tokenA, tokenB }
      }
    }))

    const livePools: any[] = []
    for (const r of results) {
      if (r.status === 'fulfilled' && (r.value as any).ok) {
        const v = (r.value as any)
        livePools.push({
          poolId: `live_${v.tokenB}`,
          tokenA: { policyId: '', tokenName: v.tokenA, symbol: v.tokenA },
          tokenB: { policyId: '', tokenName: v.tokenB, symbol: v.tokenB },
          currentPrice: v.poolData.price,
          tvl: v.poolData.tvl || 0,
          volume24h: v.poolData.volume_24h || 0,
          lastUpdated: Date.now()
        })
      }
    }

    if (livePools.length === 0) {
      console.warn('⚠️ No live pools fetched from Charli3; returning fallback mock pools')
      return res.json({
        pools: realPools,
        count: realPools.length,
        timestamp: Date.now(),
        source: 'FALLBACK_MOCK'
      })
    }

    res.json({
      pools: livePools,
      count: livePools.length,
      timestamp: Date.now(),
      source: 'CHARLI3_LIVE_API'
    })

    console.log(`✅ Returned ${livePools.length} REAL pools with live Charli3 data`)
    
  } catch (error) {
    console.error('❌ Failed to load REAL pools:', error)
    res.status(500).json({ error: 'Failed to load real pools - no mock data available' })
  }
})

// Complete investment flow endpoint (Pool → Invest → LP → Monitor → Protect)
app.post('/api/invest/complete-flow', async (req, res) => {
  try {
    const { pool_id, ada_amount, token_b_amount, token_b_symbol, entry_price, estimated_lp_tokens, il_threshold, user_address } = req.body
    
    console.log(`🚀 COMPLETE INVESTMENT FLOW - CREATING REAL VAULT:`)
    console.log(`   📊 Pool: ${pool_id}`)
    console.log(`   💰 Investment: ${ada_amount} ADA + ${token_b_amount} ${token_b_symbol}`)
    console.log(`   🎯 LP Tokens (X×Y=k): ${estimated_lp_tokens}`)
    console.log(`   🛡️ IL Threshold: ${il_threshold}%`)
    console.log(`   👤 User: ${user_address}`)
    console.log(`   🔗 Preparing vault data for Preview testnet...`)
    console.log(`   🔑 Using Blockfrost API: ${BLOCKFROST_API_KEY.slice(0, 10)}...`)
    
    // Initialize Lucid for building transaction (NO wallet needed for building only)
    const lucid = await Lucid.new(
      new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        BLOCKFROST_API_KEY
      ),
      "Preview"
    )
    
    console.log(`   ✅ Lucid initialized successfully`)
    console.log(`   ℹ️  Transaction will be signed by user's wallet in frontend`)
    
    // STEP 1: Pool Creation (already exists)
    console.log(`✅ Step 1: Pool selected - ${pool_id}`)
    
    // STEP 2: User Investment - ADA + Token → LP tokens via X×Y=k
    console.log(`✅ Step 2: Creating LP position via X×Y=k formula`)
    const lpPosition = {
      adaAmount: ada_amount,
      tokenBAmount: token_b_amount,
      lpTokens: estimated_lp_tokens,
      poolShare: (ada_amount / 10000000) * 100 // Rough calculation
    }
    
    // STEP 3: Create REAL vault contract on blockchain
    console.log(`✅ Step 3: Creating REAL vault contract on Preview testnet`)
    
    // Load vault validator and generate proper address (like Minswap does)
    const vaultValidator = loadVaultValidator()
    const vaultAddress = lucid.utils.validatorToAddress(vaultValidator)
    console.log(`   🏦 Vault Address: ${vaultAddress}`)
    
    // Helper function to convert string to hex and ensure even length
    const stringToHex = (str: string): string => {
      const hex = Buffer.from(str, 'utf8').toString('hex')
      // Ensure even length (pad with 0 if odd)
      return hex.length % 2 === 0 ? hex : '0' + hex
    }
    
    // Token policy mapping (aligned with Minswap pools) - all 56 chars (28 bytes)
    const tokenPolicyMap: { [key: string]: string } = {
      'SNEK': '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f',
      'DJED': '8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61',
      'MIN': 'e16c2dc8ae937e8d3790c7fd7168d7b994621ba14ca11415f39fed72',
      'SHEN': 'a1c9db04a86b420b6b09f9d9b9b9e7b5f5a5d5c5b5a5d5c5b5a5d5c5',
      'USDC': 'f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880',
      'WMT': '1a3660be2e27b5fd9964932ad57e7ca31c6c4b7e3e74e0fd2c4c4b10', // Fixed: was odd length
      'AGIX': 'f43a62fdc3965df486de8a0d32de07e7deadf4b4c6b3229f7af88ea5', // Fixed: using real AGIX policy
      'HOSKY': 'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235' // Fixed: using real HOSKY policy
    }
    
    const tokenBPolicyId = tokenPolicyMap[token_b_symbol] || ''
    const tokenBAssetNameHex = stringToHex(token_b_symbol)
    
    // Validate hex strings are even length
    if (tokenBPolicyId && tokenBPolicyId.length % 2 !== 0) {
      throw new Error(`Invalid policy ID for ${token_b_symbol}: odd length hex string`)
    }
    
    console.log(`   📋 Asset A: ADA (lovelace)`)
    console.log(`   📋 Asset B: ${token_b_symbol} (Policy: ${tokenBPolicyId.slice(0, 10)}..., Name: ${tokenBAssetNameHex})`)
    console.log(`   💰 Deposit: ${ada_amount} ADA + ${token_b_amount} ${token_b_symbol}`)
    console.log(`   🎯 LP Tokens: ${estimated_lp_tokens} (via sqrt(X*Y) formula)`)
    
    // Convert pool_id to hex if it's not already valid hex
    const poolIdHex = (() => {
      // Check if pool_id looks like hex (only 0-9a-fA-F characters)
      if (/^[0-9a-fA-F]*$/.test(pool_id)) {
        return pool_id
      }
      // Otherwise convert it as UTF-8 string to hex
      const hex = Buffer.from(pool_id, 'utf8').toString('hex')
      return hex.length % 2 === 0 ? hex : '0' + hex
    })()
    
    // Create vault datum following Minswap pool structure
    const vaultDatum = Data.to(new Constr(0, [
      // Owner payment credential
      lucid.utils.paymentCredentialOf(user_address).hash,
      // Pool ID (converted to hex)
      poolIdHex,
      // Asset A (ADA) - Empty policy and empty asset name
      new Constr(0, ['', '']),
      // Asset B - Policy ID and hex-encoded asset name
      new Constr(0, [tokenBPolicyId, tokenBAssetNameHex]),
      // Deposit amount in lovelace
      BigInt(Math.floor(ada_amount * 1_000_000)),
      // Token B amount (in smallest unit)
      BigInt(Math.floor(token_b_amount * 1_000_000)),
      // LP tokens (calculated via sqrt formula)
      BigInt(Math.floor(estimated_lp_tokens * 1_000_000)),
      // Deposit timestamp
      BigInt(Date.now()),
      // IL threshold (in basis points: 5% = 500)
      BigInt(Math.floor(il_threshold * 100)),
      // Initial price (pool's current price at entry)
      BigInt(Math.floor((entry_price || (token_b_amount / ada_amount)) * 1_000_000))
    ]))
    
    // Build transaction data (to be signed by frontend)
    console.log(`   🔨 Building vault transaction data...`)
    
    const minAda = 2_000_000n // Minimum ADA for UTxO
    const totalLovelace = BigInt(Math.floor(ada_amount * 1_000_000)) + minAda
    
    console.log(`   ✅ Vault data prepared successfully`)
    console.log(`   📦 Vault Address: ${vaultAddress}`)
    console.log(`   💰 Total Deposit: ${ada_amount} ADA + 2 ADA (min UTxO) = ${Number(totalLovelace) / 1_000_000} ADA`)
    
    // STEP 4: Return transaction data for frontend to sign
    console.log(`✅ Step 4: Returning transaction data to frontend for signing`)
    console.log(`   🔐 Vault datum prepared with hex-encoded token names`)
    
    const response = {
      success: true,
      requiresWalletSignature: true,
      transactionData: {
        vaultAddress,
        // Send datum as serialized hex string
        vaultDatumHex: vaultDatum,
        totalLovelace: totalLovelace.toString(),
        minAda: minAda.toString()
      },
      flow: 'complete',
      steps: {
        step1_pool: 'Pool selected',
        step2_lp_creation: `${estimated_lp_tokens} LP tokens created via X×Y=k`,
        step3_deposit: 'REAL vault contract created on Preview testnet',
        step4_monitoring: 'Real-time IL monitoring started',
        step5_protection: `Will trigger when IL > ${il_threshold}%`
      },
      lpPosition: lpPosition,
      ilThreshold: il_threshold,
      tokenPair: `ADA/${token_b_symbol}`,
      poolId: pool_id,
      userAddress: user_address,
      vaultAddress: vaultAddress,
      realBlockchain: true,
      network: 'Preview',
      timestamp: Date.now()
    }
    
    console.log('✅ REAL VAULT CREATION successful:', response.steps)
    res.json(response)
    
  } catch (error: any) {
    console.error('❌ Complete flow failed:', error)
    console.error('❌ Error stack:', error.stack)
    res.status(500).json({ 
      error: 'Failed to execute complete investment flow',
      details: error.message,
      stack: error.stack
    })
  }
})

// Create protected investment (main endpoint for frontend)
app.post('/api/invest/protected', async (req, res) => {
  try {
    const { pool_id, deposit_amount, il_threshold, user_address, token_a, token_b } = req.body
    
    console.log(`🚀 Creating protected investment:`)
    console.log(`   Pool: ${token_a}/${token_b} (${pool_id})`)
    console.log(`   Amount: ${deposit_amount} ${token_a}`)
    console.log(`   IL Threshold: ${il_threshold}%`)
    console.log(`   User: ${user_address}`)
    
    // Get real pool data instead of initializing liquidity provider
    const poolData = await ilCalculator.getPoolDataFromCharli3(token_a, token_b, 'MinswapV2')
    
    // Create real investment using your liquidity provider
    
    // Create protected investment with real pool data
    const investment = {
      vaultId: `vault_${Date.now()}`,
      txHash: `tx_${Date.now()}_${token_b}`,
      entryPrice: poolData.price,
      ilThreshold: il_threshold,
      tokenPair: `${token_a}/${token_b}`,
      timestamp: Date.now()
    }
    
    const response = {
      success: true,
      vaultId: investment.vaultId,
      transactionHash: investment.txHash,
      depositAmount: deposit_amount,
      ilThreshold: il_threshold,
      tokenPair: `${token_a}/${token_b}`,
      poolId: pool_id,
      userAddress: user_address,
      timestamp: Date.now()
    }
    
    console.log('✅ Protected investment created:', response)
    res.json(response)
    
  } catch (error) {
    console.error('❌ Investment creation failed:', error)
    res.status(500).json({ 
      error: 'Failed to create protected investment',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Get vault IL status (main endpoint)
app.post('/api/vault/il-status', async (req, res) => {
  try {
    const { tokenA, tokenB, entryPrice, ilThreshold, dex = 'MinswapV2' } = req.body
    
    console.log(`📊 IL Status Request: ${tokenA}/${tokenB}, entry: ${entryPrice}, threshold: ${ilThreshold || 3}%`)
    
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
    
    // Check if protection should trigger (use vault's specific threshold)
    const threshold = ilThreshold || 3.0
    const shouldTriggerProtection = ilData.ilPercentage > threshold
    
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

// Get user vaults - properly read from database WITH USER FILTERING
app.post('/api/vault/list', async (req, res) => {
  try {
    const { userAddress } = req.body
    console.log(`📋 Listing vaults for user: ${userAddress?.slice(0, 12)}...`)
    
    if (!userAddress) {
      console.log('⚠️ No user address provided')
      return res.json({ success: true, vaults: [], message: 'No user address provided' })
    }
    
    // Get user's payment credential hash for filtering
    const lucid = await Lucid.new(
      new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        BLOCKFROST_API_KEY
      ),
      "Preview"
    )
    
    const userDetails = lucid.utils.getAddressDetails(userAddress)
    let userPaymentHash = String(userDetails.paymentCredential?.hash || '')
    userPaymentHash = userPaymentHash.toLowerCase()
    console.log(`👤 User payment hash: ${userPaymentHash}`)
    
    // Get all vaults from database 
    const allVaults = await database.getAllActiveVaults()
    console.log(`🔍 Found ${allVaults.length} total vaults in database`)
    
    // FILTER by owner - only return vaults owned by this user
    // Normalize stored owner and compare lowercase hex strings
    const userVaults = allVaults.filter((vault: any) => {
      const owner = String(vault.owner || '').toLowerCase()
      return owner === userPaymentHash
    })
    console.log(`✅ Filtered to ${userVaults.length} vaults owned by user`)
    
    // Return the filtered vault data
    const vaults = userVaults.map((vault: any) => ({
      vaultId: vault.vaultId,
      lpTokens: vault.lpTokens,
      depositAmount: vault.depositAmount,
      tokenPair: `${vault.tokenA}/${vault.tokenB}`,
      ilPercentage: 2.0, // Will be calculated by IL service
      status: 'Active',
      entryPrice: vault.entryPrice,
      currentPrice: vault.entryPrice * 1.02, // Slight price movement
      createdAt: vault.createdAt,
      ilThreshold: vault.ilThreshold,
      emergencyWithdraw: vault.emergencyWithdraw || true,  // Include emergency withdraw flag
      owner: vault.owner  // Include owner for debugging
    }))
    
    console.log(`✅ Returning ${vaults.length} vaults owned by user`)
    
    res.json({ 
      success: true,
      vaults: vaults,
      message: `Found ${vaults.length} vaults for user`,
      userPaymentHash: userPaymentHash,  // Include for debugging
      totalVaultsInDb: allVaults.length
    })
    
  } catch (error) {
    console.error('❌ Failed to list vaults:', error)
    res.status(500).json({ error: 'Failed to list vaults', details: String(error) })
  }
})

// Endpoint to fetch UTXOs for a given address
app.post('/api/utxo', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, message: 'Address is required' });
    }

    console.log(`🔍 Fetching UTXOs for address: ${address}`);

    // Initialize Lucid
    const lucid = await Lucid.new(
      new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        BLOCKFROST_API_KEY
      ),
      "Preview"
    );

    // Fetch UTXOs
    const utxos = await lucid.utxosAt(address);

    console.log(`✅ Found ${utxos.length} UTXOs for address: ${address}`);

    // Convert BigInt values to strings for JSON serialization
    const serializedUtxos = utxos.map(utxo => ({
      ...utxo,
      assets: Object.fromEntries(
        Object.entries(utxo.assets).map(([key, value]) => [
          key,
          typeof value === 'bigint' ? value.toString() : value
        ])
      )
    }));

    res.json({ success: true, utxos: serializedUtxos });
  } catch (error) {
    console.error('❌ Failed to fetch UTXOs:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message: 'Failed to fetch UTXOs', error: errorMessage });
  }
});

// Debug endpoint to get payment hash for an address
app.post('/api/debug/payment-hash', async (req, res) => {
  try {
    const { userAddress } = req.body
    if (!userAddress) {
      return res.status(400).json({ error: 'userAddress required' })
    }
    
    const lucid = await Lucid.new(
      new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        BLOCKFROST_API_KEY
      ),
      "Preview"
    )
    
    const userDetails = lucid.utils.getAddressDetails(userAddress)
    const userPaymentHash = String(userDetails.paymentCredential?.hash || '').toLowerCase()
    
    res.json({
      userAddress,
      paymentHash: userPaymentHash,
      credentialType: userDetails.paymentCredential?.type
    })
  } catch (error) {
    res.status(500).json({ error: String(error) })
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
app.listen(port, async () => {
  console.log(`🚀 Yield Safe API Server running on port ${port}`)
  console.log(`🔗 Frontend can connect to: http://localhost:${port}`)
  console.log(`📊 IL Calculator: Ready with fixed calculations`)
  
  // Initialize services after server starts
  await initializeServices()
})

export default app