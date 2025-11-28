import React, { useEffect, useState } from 'react'

interface SystemStatus {
  factory: boolean;
  api: boolean;
  blockchain: boolean;
  lastUpdate: string;
}

export function SystemStatusIndicator() {
  const [status, setStatus] = useState<SystemStatus>({
    factory: false,
    api: false,
    blockchain: false,
    lastUpdate: new Date().toISOString()
  })

  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        // Check API health
        const apiResponse = await fetch('http://localhost:3001/api/health')
        const apiHealthy = apiResponse.ok

        // Check factory status
        const factoryResponse = await fetch('http://localhost:3001/api/factory/info')
        const factoryHealthy = factoryResponse.ok

        setStatus({
          api: apiHealthy,
          factory: factoryHealthy,
          blockchain: factoryHealthy, // If factory works, blockchain is accessible
          lastUpdate: new Date().toISOString()
        })
        setIsOnline(true)
      } catch (error) {
        setStatus(prev => ({
          ...prev,
          api: false,
          lastUpdate: new Date().toISOString()
        }))
        setIsOnline(false)
      }
    }

    // Initial check
    checkSystemStatus()
    
    // Check every 30 seconds
    const interval = setInterval(checkSystemStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (isHealthy: boolean) => {
    return isHealthy ? 'text-green-400' : 'text-red-400'
  }

  const getStatusIcon = (isHealthy: boolean) => {
    return isHealthy ? '✅' : '❌'
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        🔧 System Status
        {isOnline && <span className="bg-green-500 text-green-900 px-2 py-1 rounded-full text-xs font-bold">ONLINE</span>}
      </h3>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-purple-300">API Server</span>
          <span className={getStatusColor(status.api)}>
            {getStatusIcon(status.api)} {status.api ? 'Operational' : 'Down'}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-purple-300">Minswap Factory</span>
          <span className={getStatusColor(status.factory)}>
            {getStatusIcon(status.factory)} {status.factory ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-purple-300">Cardano Testnet</span>
          <span className={getStatusColor(status.blockchain)}>
            {getStatusIcon(status.blockchain)} {status.blockchain ? 'Synced' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-600">
        <div className="text-purple-300 text-xs">
          Last updated: {new Date(status.lastUpdate).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}