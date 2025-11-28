import React, { useState, useEffect } from 'react'
import { useWallet } from '../providers/WalletProvider'
import { VaultCard } from '../components/VaultCard'
import { MetricsCard } from '../components/MetricsCard'
import { ActivityFeed } from '../components/ActivityFeed'
import { WalletBalance } from '../components/WalletBalance'
import { RealVaultService, RealVaultData } from '../lib/realVaultService'

export function Dashboard() {
  const { isConnected, lucid, address } = useWallet()
  const [realVaults, setRealVaults] = useState<RealVaultData[]>([])
  const [realMetrics, setRealMetrics] = useState({
    totalVaults: 0,
    totalValue: 0,
    averageIL: 0,
    protectedValue: 0
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isConnected && address) {
      fetchRealData()
      // Refresh every 10 seconds to show updated vaults
      const interval = setInterval(fetchRealData, 10000)
      return () => clearInterval(interval)
    }
  }, [isConnected, address])

  const fetchRealData = async () => {
    if (!address) return
    
    setLoading(true)
    try {
      // Call backend API to get user's vaults (faster than blockchain query)
      const response = await fetch('http://localhost:3001/api/vault/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address })
      })
      
      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`📊 Dashboard: Found ${data.vaults?.length || 0} real vaults for address ${address.slice(0, 20)}...`)
      console.log(`📊 Backend returned vaults:`, data.vaults)
      
      // Transform backend vault format to RealVaultData
      const transformedVaults: RealVaultData[] = (data.vaults || []).map((vault: any) => ({
        utxo: null,
        vaultId: vault.vaultId || `vault-${Date.now()}`,
        owner: vault.owner || '',
        poolId: vault.poolId || vault.tokenPair?.split('/')[1] || '',
        tokenA: vault.tokenPair?.split('/')[0] || 'ADA',
        tokenB: vault.tokenPair?.split('/')[1] || '',
        depositAmount: vault.depositAmount || 0,
        entryPrice: vault.entryPrice || 0,
        createdAt: vault.createdAt || Date.now(),
        ilThreshold: vault.ilThreshold || 10,
        status: (vault.ilPercentage || 0) > (vault.ilThreshold || 10) ? 'protected' : 'healthy',
        currentIL: vault.ilPercentage || 0,
        currentPrice: vault.currentPrice || vault.entryPrice,
        shouldTriggerProtection: (vault.ilPercentage || 0) > (vault.ilThreshold || 10)
      }))
      
      setRealVaults(transformedVaults)
      
      // Calculate metrics
      const metrics = {
        totalVaults: transformedVaults.length,
        totalValue: transformedVaults.reduce((sum, v) => sum + v.depositAmount, 0),
        averageIL: transformedVaults.length > 0 
          ? transformedVaults.reduce((sum, v) => sum + (v.currentIL || 0), 0) / transformedVaults.length
          : 0,
        protectedValue: transformedVaults
          .filter(v => v.shouldTriggerProtection)
          .reduce((sum, v) => sum + v.depositAmount, 0)
      }
      setRealMetrics(metrics)
      
      console.log('✅ Dashboard updated with real data from backend')
      
    } catch (error) {
      console.error('❌ Failed to fetch real data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Transform RealVaultData to Vault interface expected by VaultCard
  const transformVaultData = (realVault: RealVaultData) => ({
    id: realVault.vaultId,
    poolId: realVault.poolId,
    tokenA: realVault.tokenA,
    tokenB: realVault.tokenB,
    depositAmount: realVault.depositAmount,
    currentValue: realVault.depositAmount * 1.02, // Placeholder - should calculate actual current value
    ilPercentage: realVault.currentIL || 0,
    ilThreshold: realVault.ilThreshold,
    status: realVault.status === 'protected' ? 'danger' as const : realVault.status,
    lastUpdate: realVault.createdAt
  })

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-8 max-w-md mx-auto">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-white">Connect Your Wallet</h2>
          <p className="mt-2 text-gray-400">Please connect your Cardano wallet to view your Yield Safe dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Monitor your impermanent loss protection vaults</p>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricsCard
          title="Total Vaults"
          value={realMetrics.totalVaults}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <MetricsCard
          title="Total Value"
          value={`${realMetrics.totalValue.toLocaleString()} ADA`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          }
        />
        <MetricsCard
          title="Avg IL"
          value={`${realMetrics.averageIL.toFixed(1)}%`}
          status={realMetrics.averageIL > 4 ? 'warning' : 'healthy'}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <MetricsCard
          title="Protected"
          value={`${realMetrics.protectedValue} ADA`}
          status="healthy"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        />
      </div>

      {/* Vaults Grid */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Your Vaults</h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-400">Loading your vaults...</p>
          </div>
        ) : realVaults.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No vaults found for your wallet.</p>
            <p className="text-sm text-gray-500 mt-2">Create a vault to get started with IL protection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {realVaults.map((vault) => (
              <VaultCard key={vault.vaultId} vault={transformVaultData(vault)} />
            ))}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Recent Activity</h2>
        <ActivityFeed />
      </div>
    </div>
  )
}