import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useWallet } from '../providers/WalletProvider'
import { YieldSafeAPI } from '../lib/yieldSafeAPI'

interface DemoRebalanceProps {
  isOpen: boolean
  onClose: () => void
}

interface DemoJob {
  id: string
  masumi_id: string
  scenario: 'high_il_emergency' | 'market_shift' | 'risk_optimization'
  status: 'analyzing' | 'executing' | 'verifying' | 'completed' | 'failed'
  progress: number
  fromPool: string
  toPool: string
  ilBefore: number
  ilAfter: number
  confidence: number
  timestamp: number
}

interface DemoScenario {
  id: string
  name: string
  description: string
  icon: string
  vaultState: {
    currentPool: string
    currentIL: number
    ilThreshold: number
    depositAmount: number
  }
  expectedOutcome: {
    newPool: string
    expectedIL: number
    ilSavings: number
    savingsAmount: number
  }
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'high_il_emergency',
    name: 'High IL Emergency Exit',
    description: 'Vault IL exceeded 8% - Emergency rebalance triggered',
    icon: '🚨',
    vaultState: {
      currentPool: 'ADA/SNEK',
      currentIL: 11.5,
      ilThreshold: 8.0,
      depositAmount: 5000
    },
    expectedOutcome: {
      newPool: 'ADA/USDC',
      expectedIL: 1.5,
      ilSavings: 10.0,
      savingsAmount: 500
    }
  },
  {
    id: 'market_shift',
    name: 'Market Shift Optimization',
    description: 'Detected favorable market conditions - Rebalance for better yield',
    icon: '📈',
    vaultState: {
      currentPool: 'ADA/DJED',
      currentIL: 6.8,
      ilThreshold: 5.0,
      depositAmount: 8500
    },
    expectedOutcome: {
      newPool: 'ADA/MIN',
      expectedIL: 3.1,
      ilSavings: 3.7,
      savingsAmount: 315
    }
  },
  {
    id: 'risk_optimization',
    name: 'Preventive Risk Mitigation',
    description: 'Risk score elevated - Rebalancing to safer pool proactively',
    icon: '🛡️',
    vaultState: {
      currentPool: 'ADA/AGIX',
      currentIL: 4.8,
      ilThreshold: 5.0,
      depositAmount: 7500
    },
    expectedOutcome: {
      newPool: 'ADA/USDC',
      expectedIL: 1.5,
      ilSavings: 3.3,
      savingsAmount: 248
    }
  }
]

export function DemoRebalance({ isOpen, onClose }: DemoRebalanceProps) {
  const { address } = useWallet()
  const [activeJobs, setActiveJobs] = useState<DemoJob[]>([])
  const [completedJobs, setCompletedJobs] = useState<DemoJob[]>([])
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [notifications, setNotifications] = useState<string[]>([])
  const [showRealVaults, setShowRealVaults] = useState(false)
  const [realVaults, setRealVaults] = useState<any[]>([])
  const [loadingVaults, setLoadingVaults] = useState(false)
  const [cardAnimations, setCardAnimations] = useState<{ [key: string]: number }>({})

  const generateMasumiId = () => {
    return `masumi_onchain_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 12)}`
  }

  const addNotification = (message: string) => {
    setNotifications(prev => [message, ...prev.slice(0, 4)])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== message))
    }, 5000)
  }

  const fetchRealVaults = async () => {
    setLoadingVaults(true)
    try {
      // Use same API as VaultManagement for realistic IL calculation
      const api = new YieldSafeAPI()
      
      const response = await fetch('http://localhost:3001/api/vault/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address || 'test-user' })
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Transform vaults with live IL data using YieldSafeAPI (same as VaultManagement)
        const enhancedVaults = await Promise.all(
          (data.vaults || []).map(async (vault: any) => {
            try {
              // Get realistic IL using same method as VaultManagement
              const ilData = await api.getVaultILData(
                vault.tokenA || 'ADA',
                vault.tokenB || 'TOKEN',
                vault.entryPrice || 1.0,
                vault.ilThreshold || 10,
                vault.depositAmount || 1000,
                (vault.depositAmount || 1000) / (vault.entryPrice || 1.0),
                vault.lpTokens || 100
              )
              
              return {
                ...vault,
                ilPercentage: ilData.ilPercentage, // Real IL calculation
                currentPrice: ilData.currentPrice,
                status: ilData.shouldTriggerProtection ? 'Protected' : 
                        ilData.ilPercentage > (vault.ilThreshold || 10) * 0.8 ? 'Warning' : 'Healthy'
              }
            } catch (err) {
              console.warn(`Failed to calculate IL for vault:`, err)
              return vault // Return unchanged if calculation fails
            }
          })
        )
        
        setRealVaults(enhancedVaults)
        addNotification(`✅ Loaded ${enhancedVaults.length} real vaults with live IL data`)
        toast.success(`Loaded ${enhancedVaults.length} real vaults`)
      } else {
        console.warn('Backend response:', response.status)
        addNotification('⚠️ No vaults found for this address')
      }
    } catch (error) {
      console.error('Error fetching vaults:', error)
      addNotification('❌ Failed to load real vaults')
      toast.error('Failed to load real vaults')
    } finally {
      setLoadingVaults(false)
    }
  }

  const runDemoScenario = async (scenario: DemoScenario) => {
    setSelectedScenario(scenario)
    setIsRunning(true)
    setCardAnimations({})

    const jobId = `demo_${Date.now()}`
    const masumiId = generateMasumiId()

    const newJob: DemoJob = {
      id: jobId,
      masumi_id: masumiId,
      scenario: scenario.id as any,
      status: 'analyzing',
      progress: 0,
      fromPool: scenario.vaultState.currentPool,
      toPool: scenario.expectedOutcome.newPool,
      ilBefore: scenario.vaultState.currentIL,
      ilAfter: scenario.expectedOutcome.expectedIL,
      confidence: 0.92,
      timestamp: Date.now()
    }

    setActiveJobs([newJob])

    // Stage 1: Analyzing (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 1000))
    addNotification(`🔍 Analyzing: ${scenario.vaultState.currentPool} (IL: ${scenario.vaultState.currentIL}%)`)
    toast(`🔍 Analyzing vault: ${scenario.vaultState.currentPool}`, {
      icon: '🤖',
      duration: 3000
    })

    setActiveJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'analyzing', progress: 25 } : j))
    // Animate from pool card down
    setCardAnimations(prev => ({ ...prev, [scenario.vaultState.currentPool]: -1 }))
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Stage 2: Executing (5 seconds)
    addNotification(`⚡ Moving: ${scenario.vaultState.currentPool} → ${scenario.expectedOutcome.newPool}`)
    toast(`⚡ Executing rebalance...`, {
      icon: '🚀',
      duration: 4000
    })

    setActiveJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'executing', progress: 60 } : j))
    // Animate both moving
    setCardAnimations(prev => ({ 
      ...prev, 
      [scenario.vaultState.currentPool]: 0,
      [scenario.expectedOutcome.newPool]: 0.5
    }))
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Stage 3: On-chain Verification with Masumi (4 seconds)
    addNotification(`🔐 Verifying: Masumi Job ${masumiId.slice(-8)}`)
    toast(`🔐 Verifying on-chain with Masumi...`, {
      icon: '✓',
      duration: 4000
    })

    setActiveJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'verifying', progress: 85 } : j))
    // Target pool moves up
    setCardAnimations(prev => ({ ...prev, [scenario.expectedOutcome.newPool]: 1 }))
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Stage 4: Completed
    setActiveJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'completed', progress: 100 } : j))

    addNotification(`✅ Complete! IL: ${scenario.vaultState.currentIL}% → ${scenario.expectedOutcome.expectedIL}%`)
    toast.success(`✅ Rebalance Complete! Saved $${scenario.expectedOutcome.savingsAmount}`, {
      duration: 5000
    })

    // Move to completed after 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000))
    if (activeJobs.length > 0) {
      setCompletedJobs(prev => [{ ...activeJobs[0], status: 'completed' }, ...prev])
    }
    setActiveJobs([])
    setIsRunning(false)
    setCardAnimations({})
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
            <span>🎯</span>
            <span>AI Rebalancing Demo</span>
          </h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setShowRealVaults(!showRealVaults)
                if (!showRealVaults) fetchRealVaults()
              }}
              disabled={loadingVaults}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loadingVaults ? '⏳ Loading...' : '📊 Real Vaults'}
            </button>
           <button onClick={onClose} className="text-gray-400 hover:text-white">
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
</button>
          </div>
        </div>

        {/* Notifications Bar */}
        {notifications.length > 0 && (
          <div className="mb-6 space-y-2">
            {notifications.map((notif, idx) => (
              <div 
                key={idx} 
                className="bg-blue-900/40 border border-blue-500/60 rounded-lg p-3 text-blue-200 text-sm animate-fade-in flex items-center space-x-2"
              >
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                <span>{notif}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Demo Scenarios */}
          <div className="lg:col-span-2">
            <h3 className="text-xl font-semibold text-white mb-4">Select Demo Scenario</h3>
            <div className="space-y-3">
              {DEMO_SCENARIOS.map(scenario => (
                <button
                  key={scenario.id}
                  onClick={() => runDemoScenario(scenario)}
                  disabled={isRunning}
                  className={`w-full p-6 rounded-lg border-2 text-left transition-all duration-700 transform ${
                    cardAnimations[scenario.vaultState.currentPool] === -1
                      ? 'translate-y-12 opacity-50'
                      : cardAnimations[scenario.vaultState.currentPool] === 1
                      ? '-translate-y-12'
                      : 'translate-y-0'
                  } ${
                    isRunning && selectedScenario?.id === scenario.id
                      ? 'border-blue-500 bg-blue-900/20 shadow-lg shadow-blue-500/50'
                      : isRunning
                      ? 'border-gray-700 bg-gray-800/30 opacity-50 cursor-not-allowed'
                      : selectedScenario?.id === scenario.id
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800/70'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{scenario.icon}</span>
                      <div>
                        <h4 className="font-semibold text-white">{scenario.name}</h4>
                        <p className="text-sm text-gray-400">{scenario.description}</p>
                      </div>
                    </div>
                    {!isRunning && <div className="text-blue-400 text-xl">→</div>}
                    {isRunning && selectedScenario?.id === scenario.id && (
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>

                  {/* Scenario Details */}
                  <div className="bg-gray-800/50 rounded p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Current Position:</span>
                      <span className="text-white font-mono">
                        {scenario.vaultState.currentPool}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount:</span>
                      <span className="text-white font-mono">${scenario.vaultState.depositAmount.toLocaleString()} ADA</span>
                    </div>
                    <div className="border-t border-gray-700 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Expected Outcome:</span>
                        <span className="text-white font-mono">
                          {scenario.expectedOutcome.newPool}
                          <span className="text-green-400 ml-2">IL: {scenario.expectedOutcome.expectedIL}%</span>
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-400">IL Savings:</span>
                        <span className="text-green-400 font-semibold">
                          ↓{scenario.expectedOutcome.ilSavings}% (${scenario.expectedOutcome.savingsAmount})
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Live Job Execution */}
          <div className="lg:col-span-1">
            <h3 className="text-xl font-semibold text-white mb-4">Execution Status</h3>

            {activeJobs.length === 0 && completedJobs.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-400 text-sm">Select a scenario to run demo</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Jobs */}
                {activeJobs.map(job => (
                  <div key={job.id} className="bg-gray-800/70 border-2 border-blue-500/50 rounded-lg p-4 animate-pulse">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium text-white capitalize">
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{(job.confidence * 100).toFixed(0)}%</span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-400">From:</span>
                          <span className="text-red-400 font-mono">{job.fromPool}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">To:</span>
                          <span className="text-green-400 font-mono">{job.toPool}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>

                    {/* Stage Indicator */}
                    <div className="flex space-x-2 text-xs mb-3">
                      <div className={`flex-1 p-2 rounded text-center ${job.status === 'analyzing' || job.progress > 0 ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-700/50 text-gray-500'}`}>
                        Analyze
                      </div>
                      <div className={`flex-1 p-2 rounded text-center ${job.status === 'executing' || job.progress > 50 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-700/50 text-gray-500'}`}>
                        Execute
                      </div>
                      <div className={`flex-1 p-2 rounded text-center ${job.status === 'verifying' || job.progress > 85 ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-700/50 text-gray-500'}`}>
                        Verify
                      </div>
                    </div>

                    {/* Masumi Job ID */}
                    <div className="text-xs text-gray-500 font-mono bg-black/50 rounded p-2">
                      <div className="text-gray-600">Masumi Job:</div>
                      <div className="text-cyan-400 break-all">{job.masumi_id}</div>
                    </div>

                    {/* IL Reduction Summary */}
                    <div className="mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded">
                      <div className="text-xs text-green-300">
                        IL Reduction: <span className="font-bold">{job.ilBefore.toFixed(1)}% → {job.ilAfter.toFixed(1)}%</span>
                      </div>
                      <div className="text-xs text-green-300 mt-1">
                        Savings: <span className="font-bold">↓{(job.ilBefore - job.ilAfter).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Completed Jobs History */}
                {completedJobs.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">✅ History</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {completedJobs.map(job => (
                        <div key={job.id} className="bg-green-900/20 border border-green-500/30 rounded p-3 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-green-300 font-medium">✅ Complete</span>
                            <span className="text-gray-400">{new Date(job.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="text-gray-300">
                            {job.fromPool} → {job.toPool}
                          </div>
                          <div className="text-green-400 font-mono text-xs mt-1">
                            {job.masumi_id.slice(-8)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Real Vaults Display */}
        {showRealVaults && (
          <div className="mt-8 pt-6 border-t border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-4">📊 Real Blockchain Vaults</h3>
            {realVaults.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-400">No vaults found for this address</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {realVaults.map((vault: any) => (
                  <div key={vault.vaultId || vault.id} className="bg-gray-800/70 border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-white">{vault.tokenA}/{vault.tokenB}</h4>
                        <p className="text-xs text-gray-400">{vault.vaultId}</p>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded font-medium ${
                        vault.ilPercentage > vault.ilThreshold ? 'bg-red-500/20 text-red-300' :
                        vault.ilPercentage > vault.ilThreshold * 0.8 ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-green-500/20 text-green-300'
                      }`}>
                        IL: {vault.ilPercentage?.toFixed(1)}%
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-300">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Deposit:</span>
                        <span className="font-mono">${vault.depositAmount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current Price:</span>
                        <span className="font-mono text-xs">{vault.currentPrice?.toFixed(6) || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Entry Price:</span>
                        <span className="font-mono text-xs">{vault.entryPrice?.toFixed(6) || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs mt-2 pt-2 border-t border-gray-700">
                        <span className="text-gray-500">Status:</span>
                        <span className={`font-semibold ${
                          vault.status === 'Protected' ? 'text-red-400' :
                          vault.status === 'Warning' ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {vault.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              <span className="font-semibold">ℹ️ Demo Features:</span>
            </p>
            <ul className="text-sm text-blue-300 mt-2 space-y-1 ml-6">
              <li>• 🎯 <span className="font-semibold">Animated Cards</span> - Cards move up/down showing rebalancing flow</li>
              <li>• 🔔 <span className="font-semibold">Live Notifications</span> - Real-time status updates</li>
              <li>• 🔐 <span className="font-semibold">Masumi Verification</span> - On-chain job IDs shown</li>
              <li>• 📊 <span className="font-semibold">Real Vaults Button</span> - View your actual blockchain positions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}