import { useState, useEffect } from 'react'
import { useWallet } from '../providers/WalletProvider'
import { RealVaultService } from '../lib/realVaultService'
import { config } from '../lib/apiConfig'
import { Data, Constr } from 'lucid-cardano'

// Vault info interface for component state
interface VaultInfo {
  vaultId: string
  lpTokens: number
  depositAmount: number
  tokenPair: string
  ilPercentage: number
  status: string
  entryPrice?: number
  currentPrice?: number
  createdAt?: number
  ilThreshold?: number
  type?: string
  issue?: string
  emergencyWithdraw?: boolean
}

export function VaultManagement() {
  const { isConnected, lucid, address, ensureWalletSelected } = useWallet()
  const [vaults, setVaults] = useState<VaultInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBrokenVaults, setShowBrokenVaults] = useState(false)
  const [vaultAddress, setVaultAddress] = useState<string | null>(null)

  // Fetch vault address from backend
  useEffect(() => {
    const fetchVaultAddress = async () => {
      try {
        const response = await fetch(config.api.endpoints.vaultAddress)
        const data = await response.json()
        if (data.success) {
          setVaultAddress(data.vaultAddress)
          console.log('✅ Vault address loaded:', data.vaultAddress)
          console.log(`   Network: ${data.networkDisplay || data.networkName}`)
        }
      } catch (error) {
        console.error('❌ Failed to fetch vault address:', error)
      }
    }
    fetchVaultAddress()
  }, [])

  useEffect(() => {
    if (isConnected && lucid && address && vaultAddress) {
      loadUserVaults()
    }
  }, [isConnected, lucid, address, vaultAddress, showBrokenVaults])

  const loadUserVaults = async () => {
    if (!address || !lucid || !vaultAddress) return
    
    setLoading(true)
    setError(null)
    try {
      console.log('🔍 Loading vaults for:', address)
      
      // Use RealVaultService to fetch from blockchain (same as RealDashboard)
      const vaultService = new RealVaultService(lucid, vaultAddress)
      const realVaults = await vaultService.getUserVaults(address)
      
      console.log(`✅ Found ${realVaults.length} vaults from blockchain`)
      
      // Transform RealVaultData to VaultInfo for display
      const transformedVaults: VaultInfo[] = realVaults.map(vault => {
        // Use actual token names from vault - no normalization needed
        // TOKEN was a placeholder used in old test vaults
        const tokenA = vault.tokenA || 'ADA'
        const tokenB = vault.tokenB || 'Unknown'
        
        return {
          vaultId: vault.vaultId,
          lpTokens: vault.lpTokens, // Use actual LP tokens from vault datum
          depositAmount: vault.depositAmount,
          tokenPair: `${tokenA}/${tokenB}`,
          ilPercentage: vault.currentIL || 0,
          status: vault.shouldTriggerProtection ? 'Protected' : 'Active',
          entryPrice: vault.entryPrice,
          currentPrice: vault.currentPrice,
          createdAt: vault.createdAt,
          ilThreshold: vault.ilThreshold,
          emergencyWithdraw: true
        }
      })
      
      setVaults(transformedVaults)
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('❌ Failed to load vaults:', errorMsg)
      setError(`Failed to load vaults: ${errorMsg}`)
      setVaults([])
    } finally {
      setLoading(false)
    }
  }

  const handleEmergencyExit = async (vault: VaultInfo) => {
    if (!lucid || !address) return
    
    const shouldProceed = confirm(
      '🚨 Emergency Exit Process:\n\n' +
      'Step 1: Exit vault (LP tokens → your wallet)\n' +
      'Step 2: Create Minswap withdraw order (LP → ADA + tokens)\n\n' +
      'Continue with exit?'
    )
    
    if (!shouldProceed) return
    
    // Quick check from API data
    if (!vault.emergencyWithdraw) {
      alert('❌ Emergency exit is NOT enabled for this vault. Owner must enable it first.')
      return
    }
    
    let toastMsg: string | null = null
    try {
      const vaultId = vault.vaultId
      console.log('🚨 Starting emergency exit for vault:', vaultId)
      toastMsg = '🔄 Fetching vault details...'
      console.log(toastMsg)
      
      // Get vault contract address AND validator script from backend API
      console.log('🔄 Fetching vault address and validator from backend...')
      const addressResponse = await fetch(config.api.endpoints.vaultAddress)
      if (!addressResponse.ok) {
        throw new Error(`Failed to get vault address: ${addressResponse.status}`)
      }
      const { vaultAddress, validator, networkDisplay } = await addressResponse.json()
      console.log('✅ Got vault address:', vaultAddress)
      console.log('✅ Network:', networkDisplay)
      console.log('✅ Got validator from backend:', validator.type)
      
      // Use user address from wallet provider
      const userAddress = address
      console.log('👤 User address:', userAddress)
      
      // FETCH UTXOs at vault address from blockchain
      console.log('🔄 Fetching UTXOs from blockchain...')
      const vaultUtxos = await lucid.utxosAt(vaultAddress)
      console.log('📦 Found', vaultUtxos.length, 'UTXOs at vault address')
      
      if (vaultUtxos.length === 0) {
        throw new Error('No UTXOs found at vault address')
      }
      
      // Extract transaction hash and output index from vaultId (format: "txHash#outputIndex")
      const [txHash, outputIndexStr] = vaultId.split('#')
      const outputIndex = parseInt(outputIndexStr)
      
      // Find the specific vault UTXO for this vault
      const vaultUtxo = vaultUtxos.find(utxo => 
        utxo.txHash === txHash && utxo.outputIndex === outputIndex
      )
      
      if (!vaultUtxo) {
        throw new Error(`Vault UTXO ${vaultId} not found at address ${vaultAddress}. Available: ${vaultUtxos.map(u => `${u.txHash}#${u.outputIndex}`).join(', ')}`)
      }
      
      console.log('✅ Found vault UTXO:', vaultUtxo.txHash + '#' + vaultUtxo.outputIndex)
      console.log('📋 UTXO assets:', Object.keys(vaultUtxo.assets))
      // Convert BigInt assets to strings for logging
      const assetsForLogging = Object.fromEntries(
        Object.entries(vaultUtxo.assets).map(([key, val]) => [key, val.toString()])
      )
      console.log('📋 UTXO asset details:', JSON.stringify(assetsForLogging, null, 2))
      console.log('📋 UTXO has datum:', !!vaultUtxo.datum)
      if (vaultUtxo.datum) {
        console.log('📋 UTXO datum value:', vaultUtxo.datum)
        console.log('📋 UTXO datum type:', typeof vaultUtxo.datum)
        try {
          const decodedDatum = Data.from(vaultUtxo.datum)
          console.log('📋 UTXO decoded datum:', JSON.stringify(decodedDatum, null, 2))
        } catch (e) {
          console.warn('⚠️ Could not decode datum:', e)
        }
      } else {
        console.warn('⚠️ UTXO has no datum! This may cause script validation to fail.')
      }
      console.log('📋 Full UTXO object:', {
        txHash: vaultUtxo.txHash,
        outputIndex: vaultUtxo.outputIndex,
        assets: assetsForLogging,
        datum: vaultUtxo.datum ? '[datum exists]' : null,
        scriptRef: vaultUtxo.scriptRef ? '[script ref exists]' : null
      })
      
      // Setup validator script
      const script = {
        type: "PlutusV2" as const,
        script: validator.script
      }
      
      // Create emergency exit redeemer matching vault.ak type definition
      // VaultRedeemer enum variants:
      //   0: Deposit { amount: Int }
      //   1: Withdraw { amount: Int, current_il: Int }
      //   2: UpdatePolicy { new_policy: UserPolicy }
      //   3: EmergencyExit (NO fields - simple variant)
      
      // EmergencyExit is index 3 with no fields
      // Lucid v0.10.7's collectFrom expects a serialized hex string for the redeemer
      const emergencyExitRedeemer = Data.to(new Constr(3, []))
      console.log('🔨 Emergency exit redeemer created (Constr 3)')
      console.log('🔨 Redeemer details:', {
        constrIndex: 3,
        fields: [],
        serializedHex: emergencyExitRedeemer,
        hexLength: emergencyExitRedeemer.length
      })

      
      // Build transaction
      // CRITICAL: Do NOT send a new UTxO back to the vault script
      // The validator expects no_output_to_script = True
      console.log('🔨 Building emergency exit transaction...')
      toastMsg = '⚙️ Building exit transaction...'
      
      console.log('🔨 collectFrom details:', {
        inputCount: 1,
        inputAssets: assetsForLogging,
        inputDatum: vaultUtxo.datum ? '[exists]' : '[missing]',
        redeemer: emergencyExitRedeemer,
        outputAddress: userAddress,
        outputAssets: assetsForLogging
      })
      
      // Helper function to properly handle assets with BigInt
      const safeAssets: Record<string, bigint> = {}
      for (const [key, value] of Object.entries(vaultUtxo.assets)) {
        // Ensure values are BigInt
        if (typeof value === 'bigint') {
          safeAssets[key] = value
        } else if (typeof value === 'number') {
          safeAssets[key] = BigInt(value)
        } else if (typeof value === 'string') {
          safeAssets[key] = BigInt(value)
        } else {
          safeAssets[key] = value as bigint
        }
      }
      
      console.log('💰 Assets count:', Object.keys(safeAssets).length)
      console.log('💰 Asset keys:', Object.keys(safeAssets))
      
      const txBuilder = lucid
        .newTx()
        .collectFrom([vaultUtxo], emergencyExitRedeemer)
        .attachSpendingValidator(script)
        .payToAddress(userAddress, safeAssets)
        .addSignerKey(lucid.utils.getAddressDetails(userAddress).paymentCredential!.hash)
      
      console.log('🔨 Completing transaction (calculating fees)...')
      const builtTx = await txBuilder.complete()
      console.log('✅ Exit transaction built successfully')
      console.log('🔍 Built transaction details:', {
        txSize: builtTx.toString().length,
        hasInputs: builtTx.toString().includes('input'),
        hasRedeemers: builtTx.toString().includes('redeemer'),
        hasDatum: builtTx.toString().includes('datum'),
        txHex: builtTx.toString().substring(0, 200) + '...'
      })
      toastMsg = '✅ Transaction built, awaiting wallet signature...'
      
      console.log('✍️ Requesting wallet to sign exit transaction...')
      
      // CRITICAL FIX: Ensure wallet is properly selected in lucid before signing
      await ensureWalletSelected()
      
      if (!lucid.wallet) {
        console.error('❌ Lucid wallet not set! This should not happen.')
        console.log('   Lucid instance:', lucid)
        console.log('   Lucid.wallet:', lucid.wallet)
        throw new Error('Wallet not connected to Lucid. Please disconnect and reconnect your wallet.')
      }
      
      console.log('✅ Lucid wallet is properly set:', lucid.wallet)
      
      // Sign the transaction with the wallet (already completed, just sign and submit)
      console.log('🔑 Signing transaction with wallet...')
      const signedTx = await builtTx.sign().complete()
      console.log('✅ Emergency exit transaction signed successfully')
      
      toastMsg = '📤 Submitting exit transaction...'
      console.log('📤 Submitting emergency exit transaction...')
      const exitTxHash = await signedTx.submit()
      console.log('✅ Emergency exit transaction submitted:', exitTxHash)
      
      console.log('✅ Emergency exit completed:', exitTxHash)
      alert(`✅ Step 1 Complete! Emergency exit TX: ${exitTxHash}\n\nWaiting for confirmation before creating withdraw order...`)
      
      // Wait for exit confirmation
      console.log('⏳ Waiting for exit confirmation...')
      await lucid.awaitTx(exitTxHash)
      console.log('✅ Exit confirmed!')
      
      // Now create Minswap withdraw order
      const shouldCreateOrder = confirm(
        '✅ Emergency Exit Complete!\n\n' +
        'Now create Minswap withdraw order to convert LP tokens → ADA + tokens?\n\n' +
        '(Order will be processed by Minswap batchers)'
      )
      
      if (shouldCreateOrder) {
        await createMinswapWithdrawOrder(vault, exitTxHash)
      }
      
      // Refresh vault list
      loadUserVaults()
      
    } catch (error) {
      console.error('❌ Emergency exit failed:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      alert(`❌ Emergency exit failed: ${errorMsg}`)
    }
  }

  const createMinswapWithdrawOrder = async (vault: VaultInfo, exitTxHash: string) => {
    try {
      console.log('🔄 Creating Minswap withdraw order...')
      
      // Mock pool reserves (in production, fetch from pool data API)
      const poolReserves = {
        reserveA: '10000000000', // 10,000 ADA
        reserveB: '15000000000', // 15,000 tokens
        totalLiquidity: '12247448714' // sqrt(10000 * 15000) * 10^6
      }
      
      const lpAsset = {
        policyId: 'd6aae2059baee188f74917493cf7637e679cd219bdfbbf4dcbeb1d0b',
        tokenName: '4144414449454400' // ADADJED in hex
      }
      
      // Request withdraw order data from backend
      const response = await fetch(config.api.endpoints.withdrawOrder, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lpAsset,
          lpAmount: Math.floor(vault.lpTokens * 1_000000).toString(),
          ...poolReserves,
          userAddress: address,
          slippage: 0.02
        })
      })
      
      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`)
      }
      
      const orderData = await response.json()
      console.log('✅ Got withdraw order data from backend')
      console.log('   Order Address:', orderData.orderAddress)
      console.log('   Min Token A:', orderData.minTokenA)
      console.log('   Min Token B:', orderData.minTokenB)
      
      // Build withdraw order transaction
      const orderAssets: any = {
        lovelace: BigInt(orderData.batcherFee),
        [`${lpAsset.policyId}${lpAsset.tokenName}`]: BigInt(orderData.lpAmount)
      }
      
      const orderTx = lucid!.newTx()
        .payToContract(
          orderData.orderAddress,
          { inline: orderData.orderDatum },
          orderAssets
        )
      
      console.log('🔨 Building withdraw order transaction...')
      const completedOrderTx = await orderTx.complete()
      
      console.log('✍️ Signing withdraw order transaction...')
      const signedOrderTx = await completedOrderTx.sign().complete()
      
      console.log('📤 Submitting withdraw order...')
      const orderTxHash = await signedOrderTx.submit()
      
      console.log('✅ Withdraw order created:', orderTxHash)
      alert(
        `🎯 Complete!\n\n` +
        `Exit TX: ${exitTxHash.slice(0, 20)}...\n` +
        `Order TX: ${orderTxHash.slice(0, 20)}...\n\n` +
        `Minswap batchers will process your order soon!`
      )
      
    } catch (error) {
      console.error('❌ Failed to create withdraw order:', error)
      alert(`⚠️ Emergency exit succeeded but withdraw order failed:\n${error}\n\nYou can manually create a withdraw order later.`)
    }
  }

  if (!isConnected) {
    return (
      <div className="text-center text-gray-400">
        Please connect your wallet to manage vaults
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Vault Management</h1>
        <p className="text-gray-400">Manage your LP positions and emergency exits</p>
        
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={() => {
              setShowBrokenVaults(!showBrokenVaults)
              loadUserVaults()
            }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              showBrokenVaults 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
          >
            {showBrokenVaults ? '🚫 Hide Broken Vaults' : '🔍 Show Old Broken Vaults'}
          </button>
          {showBrokenVaults && (
            <span className="text-yellow-400 text-sm">
              ⚠️ Old vaults show 96-99% IL due to wrong entry prices (unfixable)
            </span>
          )}
        </div>
      </div>
      
      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-4">
          <p className="text-red-400 font-medium">❌ Error loading vaults</p>
          <p className="text-red-300 text-sm mt-1">{error}</p>
          <button
            onClick={() => loadUserVaults()}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            🔄 Retry
          </button>
        </div>
      )}
      
      {loading ? (
        <div className="text-center text-blue-400">Loading your vaults...</div>
      ) : (
        <div className="space-y-4">
          {vaults.length === 0 ? (
            <div className="text-center text-gray-400">No vaults found</div>
          ) : (
            vaults.map(vault => (
              <div key={vault.vaultId} className={`border rounded-lg p-6 ${
                vault.type === 'broken' 
                  ? 'bg-red-900/20 border-red-500/30' 
                  : 'bg-gray-800/50 border-gray-700'
              }`}>
                
                {vault.type === 'broken' && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm font-medium">🚫 Broken Vault</p>
                    <p className="text-red-300 text-xs mt-1">{vault.issue}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <h3 className="text-sm text-gray-400">Token Pair</h3>
                    <p className="text-white font-medium">{vault.tokenPair}</p>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">LP Tokens</h3>
                    <p className="text-green-400 font-medium">{vault.lpTokens.toFixed(3)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Deposit</h3>
                    <p className="text-blue-400 font-medium">{vault.depositAmount} ADA</p>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Current IL</h3>
                    <p className="text-yellow-400 font-medium">{vault.ilPercentage.toFixed(2)}%</p>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Status</h3>
                    <p className={`font-medium ${vault.status === 'Active' ? 'text-green-400' : 'text-red-400'}`}>
                      {vault.status}
                    </p>
                  </div>
                </div>
                
                {vault.entryPrice && (
                  <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                    <div>
                      <span className="text-gray-400">Entry Price: </span>
                      <span className="text-blue-300">
                        {vault.entryPrice > 1 ? 
                          vault.entryPrice.toFixed(4) : 
                          vault.entryPrice.toFixed(6)
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Current Price: </span>
                      <span className="text-green-300">
                        {vault.currentPrice ? 
                          (vault.currentPrice > 1 ? 
                            vault.currentPrice.toFixed(4) : 
                            vault.currentPrice.toFixed(6)
                          ) : 'N/A'
                        }
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3">
                  {vault.type !== 'broken' ? (
                    <>
                      <button
                        onClick={() => handleEmergencyExit(vault)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                      >
                        🚨 Emergency Exit
                        <span className="text-xs opacity-75">(1% fee)</span>
                      </button>
                      <button 
                        onClick={() => {
                          // Extract tokens from tokenPair (e.g., "ADA/DJED" -> ["ADA", "DJED"])
                          const [tokenA, tokenB] = vault.tokenPair.split('/')
                          
                          // Calculate current IL using actual token pair
                          fetch(config.api.endpoints.ilStatus, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              tokenA,
                              tokenB, 
                              entryPrice: vault.entryPrice,
                              ilThreshold: vault.ilThreshold || 3.0
                            })
                          }).then(r => r.json()).then(data => {
                            alert(`${tokenA}/${tokenB} Current IL: ${data.ilPercentage.toFixed(4)}%\nShould trigger protection: ${data.shouldTriggerProtection}`)
                          }).catch(err => {
                            alert(`Failed to check IL: ${err.message}`)
                          })
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        📊 Check Real IL
                      </button>
                    </>
                  ) : (
                    <div className="bg-gray-600 text-gray-400 px-4 py-2 rounded-lg cursor-not-allowed">
                      🚫 Cannot exit broken vault (wrong entry price on-chain)
                    </div>
                  )}
                </div>
                
                <div className="mt-3 text-xs text-gray-400">
                  Vault ID: {vault.vaultId.slice(0, 20)}...
                  {vault.createdAt && (
                    <span className="ml-4">Created: {new Date(vault.createdAt).toLocaleTimeString()}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}