import React from 'react'

interface PoolData {
  poolId: string;
  tokenA: string;
  tokenB: string;
  liquidity: number;
  totalValueLocked: number;
  apy: number;
  impermanentLoss: number;
  isReal: boolean;
  blockchain: {
    network: string;
    address: string;
    factoryContract: string;
  };
}

interface RealPoolCardProps {
  pool: PoolData;
  onClick?: () => void;
}

export function RealPoolCard({ pool, onClick }: RealPoolCardProps) {
  return (
    <div 
      className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-6 hover:border-purple-400/40 transition-all duration-300 cursor-pointer"
      onClick={onClick}
    >
      {/* Pool Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            {pool.tokenA}/{pool.tokenB}
            {pool.isReal && <span className="bg-green-500 text-green-900 px-2 py-1 rounded-full text-xs font-bold">REAL</span>}
          </h3>
          <p className="text-purple-300 text-sm">Pool ID: {pool.poolId}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">
            {pool.apy.toFixed(2)}%
          </div>
          <div className="text-purple-300 text-sm">APY</div>
        </div>
      </div>

      {/* Pool Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-700/30 p-3 rounded-lg">
          <div className="text-purple-300 text-sm">Liquidity</div>
          <div className="text-white font-semibold">{pool.liquidity.toLocaleString()} ADA</div>
        </div>
        <div className="bg-slate-700/30 p-3 rounded-lg">
          <div className="text-purple-300 text-sm">TVL</div>
          <div className="text-white font-semibold">${pool.totalValueLocked.toLocaleString()}</div>
        </div>
      </div>

      {/* IL Protection Status */}
      <div className="bg-slate-700/20 p-3 rounded-lg mb-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-purple-300 text-sm">Impermanent Loss</div>
            <div className={`font-bold ${pool.impermanentLoss >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {pool.impermanentLoss.toFixed(3)}%
            </div>
          </div>
          <div className="text-blue-400">
            🛡️ Protected
          </div>
        </div>
      </div>

      {/* Blockchain Info */}
      <div className="border-t border-slate-600 pt-3">
        <div className="flex justify-between items-center text-sm">
          <div>
            <span className="text-purple-300">Network:</span>
            <span className="text-white ml-2">{pool.blockchain.network}</span>
          </div>
          <div className="text-blue-400">
            ⚡ Live Data
          </div>
        </div>
        <div className="text-purple-300 text-xs mt-1 font-mono truncate">
          {pool.blockchain.address}
        </div>
      </div>
    </div>
  )
}