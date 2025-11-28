import { useState, useEffect } from 'react'
import { useWallet } from '../providers/WalletProvider'
import { Data } from 'lucid-cardano'

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
  const { isConnected, lucid } = useWallet()
  const [vaults, setVaults] = useState<VaultInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [showBrokenVaults, setShowBrokenVaults] = useState(false)
  
  useEffect(() => {
    if (isConnected && lucid) {
      loadUserVaults()
    }
  }, [isConnected, lucid])

  const loadUserVaults = async () => {
    setLoading(true)
    try {
      const userAddress = await lucid!.wallet.address()
      console.log('🔍 Loading vaults for:', userAddress)
      
      // Try to get vault data from backend API first
      try {
        const response = await fetch('http://localhost:3001/api/vault/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userAddress,
            includeOldVaults: showBrokenVaults 
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('✅ Loaded vaults from backend:', data.vaults)
          console.log('🔍 Debug info:', {
            userPaymentHash: data.userPaymentHash,
            totalVaultsInDb: data.totalVaultsInDb,
            returnedVaults: data.vaults?.length || 0,
            message: data.message
          })
          setVaults(data.vaults || [])
          return
        }
      } catch (apiError) {
        console.log('⚠️ Backend API not available:', apiError)
        setVaults([])
      }
      
    } catch (error) {
      console.error('❌ Failed to load vaults:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEmergencyExit = async (vault: VaultInfo) => {
    if (!lucid || !confirm('Emergency exit will charge a 1% fee. Continue?')) return
    
    // Quick check from API data
    if (!vault.emergencyWithdraw) {
      alert('❌ Emergency exit is NOT enabled for this vault. Owner must enable it first.')
      return
    }
    
    try {
      const vaultId = vault.vaultId
      console.log('🚨 Starting emergency exit for vault:', vaultId)
      
      // Get vault contract address AND validator script from backend API
      console.log('🔄 Fetching vault address and validator from backend...')
      const addressResponse = await fetch('http://localhost:3001/api/vault/address')
      if (!addressResponse.ok) {
        throw new Error(`Failed to get vault address: ${addressResponse.status}`)
      }
      const { vaultAddress, validator } = await addressResponse.json()
      console.log('✅ Got vault address:', vaultAddress)
      console.log('✅ Got validator from backend:', validator.type)
      
      // Get user address
      const userAddress = await lucid.wallet.address()
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
      console.log('📋 UTXO has datum:', !!vaultUtxo.datum)
      
      // Setup validator script
      const script = {
        type: "PlutusV2" as const,
        script: validator.script
      }
      
      // Create emergency exit redeemer  
      // Use the same structure as vaultTransactions.ts
      const VaultRedeemerSchema = Data.Enum([
        Data.Object({ Deposit: Data.Object({}) }),
        Data.Object({ Withdraw: Data.Object({ amount: Data.Integer() }) }),
        Data.Object({ UpdatePolicy: Data.Object({ new_max_il: Data.Integer() }) }),
        Data.Object({ EmergencyExit: Data.Object({}) })
      ])
      
      // Create the redeemer as variant 3 (EmergencyExit)
      const redeemer = { EmergencyExit: {} } as any
      const emergencyExitRedeemer = Data.to(redeemer, VaultRedeemerSchema)
      console.log('🔨 Emergency exit redeemer created')
      
      // Build transaction
      // CRITICAL: Do NOT send a new UTxO back to the vault script
      // The validator expects no_output_to_script = True
      console.log('🔨 Building transaction...')
      const tx = await lucid
        .newTx()
        .collectFrom([vaultUtxo], emergencyExitRedeemer)
        .attachSpendingValidator(script)
        .payToAddress(userAddress, vaultUtxo.assets)  // Send all vault assets to user
        .complete()
      
      console.log('✍️ Signing transaction with wallet...')
      const signedTx = await tx.sign().complete()
      console.log('✅ Transaction signed successfully')
      
      console.log('📤 Submitting signed transaction to blockchain...')
      const txHash_result = await signedTx.submit()
      
      alert(`🎯 Emergency exit successful! TX: ${txHash_result}`)
      console.log('✅ Emergency exit completed:', txHash_result)
      
      // Refresh vault list
      loadUserVaults()
      
    } catch (error) {
      console.error('❌ Emergency exit failed:', error)
      alert(`❌ Emergency exit failed: ${error instanceof Error ? error.message : String(error)}`)
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
                      <span className="text-blue-300">{vault.entryPrice.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Current Price: </span>
                      <span className="text-green-300">{vault.currentPrice?.toFixed(6) || 'N/A'}</span>
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
                          fetch('http://localhost:3001/api/vault/il-status', {
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