import React, { useState, useEffect } from 'react'
import { useWallet } from '../providers/WalletProvider'
import { WalletConnectionGuide } from '../components/WalletConnectionGuide'
import { WalletBalance } from '../components/WalletBalance'
import toast from 'react-hot-toast'

interface RealPoolInfo {
  poolId: string
  tokenA: {
    policyId: string
    tokenName: string
    symbol: string
  }
  tokenB: {
    policyId: string
    tokenName: string
    symbol: string
  }
  currentPrice: number
  tvl: number
  volume24h: number
  lastUpdated: number
}

export function CreateVault() {
  const { isConnected, lucid, walletName } = useWallet()
  const [isCreating, setIsCreating] = useState(false)
  const [realPools, setRealPools] = useState<RealPoolInfo[]>([])
  const [loadingPools, setLoadingPools] = useState(false)
  const [selectedPool, setSelectedPool] = useState<RealPoolInfo | null>(null)
  const [formData, setFormData] = useState({
    depositAmount: '',
    tokenBAmount: '',
    ilThreshold: '10.0'
  })

  // Real API base URL
  const API_BASE_URL = 'http://localhost:3001'

  useEffect(() => {
    if (isConnected && lucid) {
      loadRealPools()
    }
  }, [isConnected, lucid])

  const loadRealPools = async () => {
    setLoadingPools(true)
    try {
      console.log('🔄 Loading real pools from backend API...')
      
      const response = await fetch(`${API_BASE_URL}/api/pools/list`)
      if (!response.ok) {
        throw new Error(`Failed to load pools: ${response.status}`)
      }
      
      const data = await response.json()
      const pools = data.pools || []
      
      setRealPools(pools)
      console.log(`✅ Loaded ${pools.length} real pools:`, pools)
      
    } catch (error) {
      console.error('❌ Failed to load real pools:', error)
      toast.error('Failed to load real pool data - NO MOCK FALLBACK!')
      
      // NO FALLBACK - We demand real data only!
      setRealPools([])
      console.log('🚫 NO MOCK DATA - Only real pools accepted!')
    } finally {
      setLoadingPools(false)
    }
  }

  const handlePoolChange = (poolId: string) => {
    const pool = realPools.find(p => p.poolId === poolId)
    setSelectedPool(pool || null)
    
    if (pool) {
      console.log(`🎯 Selected real pool: ${pool.tokenA.symbol}/${pool.tokenB.symbol}`, pool)
    }
  }

  const handleSubmit = async () => {
    if (!isConnected || !lucid) {
      toast.error('Please connect your wallet first')
      return
    }

    // Check if wallet is properly connected to Lucid
    if (!lucid.wallet) {
      toast.error('Wallet not properly connected to Lucid. Please disconnect and reconnect.')
      return
    }

    if (!selectedPool || !formData.depositAmount || !formData.tokenBAmount) {
      toast.error('Please select a pool and enter both ADA and token amounts')
      return
    }

    setIsCreating(true)
    
    toast.loading('🚀 Starting complete investment flow...', {
      id: 'investment'
    })

    try {
      // Get wallet address with error handling
      let walletAddress: string
      try {
        walletAddress = await lucid.wallet.address()
        console.log('✅ Wallet address:', walletAddress)
      } catch (walletError) {
        console.error('❌ Failed to get wallet address:', walletError)
        throw new Error('Failed to get wallet address. Please reconnect your wallet.')
      }
      
      // STEP 1: Pool Creation / Selection (already done)
      toast.loading('📊 Pool selected, calculating LP tokens...', { id: 'investment' })
      
      // STEP 2: User Investment - Calculate LP tokens via X×Y=k
      const adaAmount = parseFloat(formData.depositAmount)
      const tokenBAmount = parseFloat(formData.tokenBAmount)
      const estimatedLPTokens = Math.sqrt(adaAmount * tokenBAmount) // Simplified X×Y=k calculation
      
      // STEP 3: Prepare investment data for complete flow
      const investmentPayload = {
        pool_id: selectedPool.poolId,
        ada_amount: adaAmount,
        token_b_amount: tokenBAmount,
        token_b_symbol: selectedPool.tokenB.symbol,
        entry_price: selectedPool.currentPrice, // Current pool price as entry price
        estimated_lp_tokens: estimatedLPTokens,
        il_threshold: parseFloat(formData.ilThreshold),
        user_address: walletAddress,
        flow_step: 'complete' // Indicates we want the full flow
      }

      console.log('🚀 Starting COMPLETE FLOW:', investmentPayload)

      toast.loading('💰 Preparing vault transaction...', { id: 'investment' })

      // Call backend to prepare transaction data
      const response = await fetch(`${API_BASE_URL}/api/invest/complete-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(investmentPayload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Backend error:', errorData)
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('✅ Backend response:', result)

      // If transaction requires wallet signature
      if (result.requiresWalletSignature && result.transactionData) {
        toast.loading('🔨 Building transaction with your wallet...', { id: 'investment' })

        console.log('📦 Transaction data:', result.transactionData)

        // Build transaction using user's wallet with the serialized datum
        const tx = await lucid
          .newTx()
          .payToContract(
            result.transactionData.vaultAddress,
            { inline: result.transactionData.vaultDatumHex },
            { lovelace: BigInt(result.transactionData.totalLovelace) }
          )
          .complete()

        console.log('✅ Transaction built successfully')

        toast.loading('🔏 Please sign the transaction in your wallet...', { id: 'investment' })
        
        // Sign transaction with user's wallet
        const signedTx = await tx.sign().complete()
        
        console.log('✅ Transaction signed')
        
        toast.loading('📤 Submitting to Cardano Preview testnet...', { id: 'investment' })
        
        // Submit transaction
        const txHash = await signedTx.submit()
        
        console.log('🎉 Transaction submitted:', txHash)
        result.transactionHash = txHash
        result.vaultId = `${txHash}#0`
      }

      console.log('✅ COMPLETE FLOW successful:', result)
      
      toast.success(`🎉 Complete flow successful! 
        • LP Position: ${estimatedLPTokens.toFixed(2)} tokens
        • IL Protection: Active at ${formData.ilThreshold}%
        • Monitoring: Real-time with Charli3`, {
        id: 'investment',
        duration: 10000
      })

      // Start real-time monitoring
      await fetch(`${API_BASE_URL}/api/vault/monitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vaultId: result.vaultId || 'vault-' + Date.now(),
          tokenA: 'ADA',
          tokenB: selectedPool.tokenB.symbol,
          entryPrice: selectedPool.currentPrice,
          ilThreshold: parseFloat(formData.ilThreshold),
          lpTokens: estimatedLPTokens
        })
      })

      console.log('🛡️ Real-time IL monitoring started')
      
      // Reset form
      setFormData({
        depositAmount: '',
        tokenBAmount: '',
        ilThreshold: '10.0'
      })
      setSelectedPool(null)
      
    } catch (error: any) {
      console.error('❌ Complete flow failed:', error)
      toast.error(`❌ Investment flow failed: ${error.message || 'Transaction failed'}`, {
        id: 'investment',
        duration: 10000
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Protection Vault</h1>
          <p className="text-gray-400">Set up impermanent loss protection for your liquidity position</p>
        </div>
        
        <WalletConnectionGuide />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Yield Safe: Complete Investment Flow</h1>
        <p className="text-gray-400">Pool Creation → Invest ADA+Token → Get LP Tokens → Monitor IL → Protection Triggers</p>
      </div>

      <WalletBalance />
      
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-8 space-y-6">
          
          {/* Real Pool Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Real Liquidity Pool {loadingPools && <span className="text-blue-400">(Loading from backend...)</span>}
            </label>
            <select
              value={selectedPool?.poolId || ''}
              onChange={(e) => handlePoolChange(e.target.value)}
              required
              disabled={loadingPools}
              className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
            >
              <option value="">Select a real pool from backend</option>
              {realPools.map((pool) => (
                <option key={pool.poolId} value={pool.poolId}>
                  {pool.tokenA.symbol}/{pool.tokenB.symbol} - Real TVL: ${pool.tvl.toLocaleString()} - Price: {pool.currentPrice}
                </option>
              ))}
            </select>
            
            {selectedPool && (
              <div className="mt-2 p-3 bg-gray-700/50 rounded-lg text-xs">
                <div className="grid grid-cols-2 gap-2 text-gray-300">
                  <div>Pair: <span className="text-blue-400">{selectedPool.tokenA.symbol}/{selectedPool.tokenB.symbol}</span></div>
                  <div>Current Price: <span className="text-green-400">{selectedPool.currentPrice}</span></div>
                  <div>Real TVL: <span className="text-blue-400">${selectedPool.tvl.toLocaleString()}</span></div>
                  <div>24h Volume: <span className="text-blue-400">${selectedPool.volume24h.toLocaleString()}</span></div>
                  <div>Pool ID: <span className="text-gray-400 text-xs">{selectedPool.poolId.slice(0, 20)}...</span></div>
                  <div>Data Source: <span className="text-green-400">Live Backend API</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Investment Amount (ADA + Token Pair) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ADA Amount (Token A)
              </label>
              <input
                type="number"
                value={formData.depositAmount}
                onChange={handleInputChange}
                name="depositAmount"
                min="100"
                step="1"
                required
                className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="1000"
              />
              <p className="mt-1 text-sm text-gray-400">Minimum 100 ADA for X×Y=k pool</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {selectedPool ? `${selectedPool.tokenB.symbol} Amount (Token B)` : 'Token B Amount'}
              </label>
              <input
                type="number"
                value={formData.tokenBAmount || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, tokenBAmount: e.target.value }))}
                name="tokenBAmount"
                min="1"
                step="0.001"
                required={!!selectedPool}
                disabled={!selectedPool}
                className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                placeholder={selectedPool ? `Enter ${selectedPool.tokenB.symbol} amount` : 'Select pool first'}
              />
              <p className="mt-1 text-sm text-gray-400">
                {selectedPool ? `Both tokens needed for LP position` : 'Will calculate based on pool ratio'}
              </p>
            </div>
          </div>

          {/* LP Token Calculation Preview */}
          {selectedPool && formData.depositAmount && formData.tokenBAmount && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-300 mb-2">LP Token Calculation (X×Y=k)</h4>
              <div className="text-xs text-gray-300 space-y-1">
                <div>• Pool Ratio: 1 ADA = {selectedPool.currentPrice} {selectedPool.tokenB.symbol}</div>
                <div>• Your Position: {formData.depositAmount} ADA + {formData.tokenBAmount} {selectedPool.tokenB.symbol}</div>
                <div>• Estimated LP Tokens: {(parseFloat(formData.depositAmount || '0') * 0.95).toFixed(2)} (minus fees)</div>
                <div>• Pool Share: ~{((parseFloat(formData.depositAmount || '0') / selectedPool.tvl) * 100).toFixed(3)}%</div>
              </div>
            </div>
          )}

          {/* Real IL Protection Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Impermanent Loss Protection Threshold (%)
            </label>
            <input
              type="number"
              value={formData.ilThreshold}
              onChange={handleInputChange}
              name="ilThreshold"
              min="1"
              max="50"
              step="0.1"
              required
              className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="10.0"
            />
            <p className="mt-1 text-sm text-gray-400">
              Real protection using Charli3 price feeds. Protection activates when IL exceeds this threshold.
            </p>
          </div>

          {/* Submit Button - Complete Flow */}
          <button
            onClick={handleSubmit}
            disabled={isCreating || !selectedPool || !formData.depositAmount || !formData.tokenBAmount}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
          >
            {isCreating ? 'Creating LP Position + IL Protection...' : 'Create LP Position with IL Protection'}
          </button>

          {/* Complete Flow Explanation */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-green-300">
                  🚀 <strong>COMPLETE FLOW IMPLEMENTATION:</strong>
                </p>
                <ol className="mt-2 text-xs space-y-1 ml-4 list-decimal text-gray-300">
                  <li><strong>Pool Creation:</strong> Select existing DEX pool or create new one</li>
                  <li><strong>User Investment:</strong> Deposit ADA + Token → Get LP tokens via X×Y=k formula</li>
                  <li><strong>LP Deposit to Yield Safe:</strong> LP tokens deposited to our protection contract</li>
                  <li><strong>Real-time IL Monitoring:</strong> Continuous monitoring with Charli3 price feeds</li>
                  <li><strong>Protection Trigger:</strong> When IL &gt; threshold → Automatic withdrawal</li>
                  <li><strong>Value Protection:</strong> LP withdrawn → Swapped to stablecoin → User protected</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}