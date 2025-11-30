/**
 * Midnight Network Integration Demo Component
 * Interactive showcase of how the Midnight integration works
 */

import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { MidnightTransaction } from './midnightTypes'
import { executeSampleMidnightTransaction } from './sampleTransaction'

type Stage = 'idle' | 'analyzing' | 'generating-proof' | 'user-approval' | 'verifying' | 'submitting' | 'confirmed'

export function MidnightDemo() {
  const [stage, setStage] = useState<Stage>('idle')
  const [transaction, setTransaction] = useState<MidnightTransaction | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`])
  }

  const handleExecute = async () => {
    setLogs([])
    setTransaction(null)

    try {
      addLog('🚀 Starting Midnight Network transaction...')

      // Capture console logs
      const originalLog = console.log
      const originalError = console.error
      const originalWarn = console.warn

      console.log = (...args) => {
        addLog(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
        originalLog(...args)
      }
      console.error = (...args) => {
        addLog(`❌ ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`)
        originalError(...args)
      }
      console.warn = (...args) => {
        addLog(`⚠️  ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`)
        originalWarn(...args)
      }

      setStage('analyzing')
      const tx = await executeSampleMidnightTransaction()
      setTransaction(tx)
      setStage('confirmed')

      toast.success('✅ Transaction completed successfully!')

      // Restore console
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    } catch (error) {
      addLog(`❌ Error: ${error}`)
      setStage('idle')
      toast.error('Failed to execute transaction')
    }
  }

  const getStageIcon = (s: Stage): string => {
    const icons: Record<Stage, string> = {
      idle: '🌙',
      analyzing: '🤖',
      'generating-proof': '🔐',
      'user-approval': '✍️',
      verifying: '⛓️',
      submitting: '📤',
      confirmed: '✅'
    }
    return icons[s]
  }

  const getStageLabel = (s: Stage): string => {
    const labels: Record<Stage, string> = {
      idle: 'Ready',
      analyzing: 'AI Analyzing',
      'generating-proof': 'Generating Proof',
      'user-approval': 'Awaiting Approval',
      verifying: 'Verifying On-Chain',
      submitting: 'Submitting',
      confirmed: 'Confirmed'
    }
    return labels[s]
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 to-black rounded-lg p-8 max-w-4xl mx-auto border border-purple-500/20">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center space-x-3">
          <span className="text-4xl">🌙</span>
          <span>Midnight Network Integration Demo</span>
        </h2>
        <p className="text-gray-400">
          See how privacy-preserving smart contracts enable autonomous AI without delegation
        </p>
      </div>

      {/* Stage Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {(['idle', 'analyzing', 'generating-proof', 'user-approval', 'verifying', 'submitting', 'confirmed'] as Stage[]).map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full text-lg transition-all ${
                  stage === s
                    ? 'bg-purple-600 text-white scale-110 shadow-lg shadow-purple-500/50'
                    : ['idle', 'analyzing', 'generating-proof', 'user-approval', 'verifying', 'submitting', 'confirmed'].indexOf(s) < ['idle', 'analyzing', 'generating-proof', 'user-approval', 'verifying', 'submitting', 'confirmed'].indexOf(stage)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {getStageIcon(s)}
              </div>
              {idx < 6 && <div className="w-8 h-1 bg-gray-700 mx-1" />}
            </div>
          ))}
        </div>
        <div className="text-center text-sm font-medium">
          <span className="text-purple-400">{getStageLabel(stage)}</span>
        </div>
      </div>

      {/* Transaction Details */}
      {transaction && (
        <div className="mb-8 bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4">📊 Transaction Details</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-sm text-gray-400">Transaction ID</div>
              <div className="text-white font-mono text-sm">{transaction.txId}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Status</div>
              <div className={`font-bold ${transaction.status === 'confirmed' ? 'text-green-400' : 'text-yellow-400'}`}>
                {transaction.status.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">From Pool</div>
              <div className="text-white font-mono">{transaction.rebalancing.fromPool}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">To Pool</div>
              <div className="text-white font-mono">{transaction.rebalancing.toPool}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Current IL</div>
              <div className="text-red-400 font-mono">{transaction.rebalancing.currentIL.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Expected IL</div>
              <div className="text-green-400 font-mono">{transaction.rebalancing.expectedIL.toFixed(2)}%</div>
            </div>
            <div className="col-span-2">
              <div className="text-sm text-gray-400">IL Reduction</div>
              <div className="text-green-400 font-bold text-lg">✅ {transaction.rebalancing.ilReduction.toFixed(2)}%</div>
            </div>
          </div>

          {/* Proof Details */}
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-4">
            <h4 className="font-bold text-purple-300 mb-3">🔐 Zero-Knowledge Proof</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Proof Hash:</span>
                <span className="text-purple-300 font-mono">{transaction.proof.proof.substring(0, 32)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Constraints:</span>
                <span className="text-white">{transaction.proof.metadata.constraints.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">IL Calculation Valid:</span>
                <span className="text-green-400">✅ {transaction.proof.publicSignals.ilReductionValid ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rebalance Beneficial:</span>
                <span className="text-green-400">✅ {transaction.proof.publicSignals.rebalanceIsValid ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Confidence Threshold Met:</span>
                <span className="text-green-400">✅ {transaction.proof.publicSignals.confidenceCheckPassed ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h4 className="font-bold text-blue-300 mb-3">⏱️ Transaction Timeline</h4>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Created:</span>
                <span className="text-white">{new Date(transaction.createdAt).toLocaleTimeString()}</span>
              </div>
              {transaction.signedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Signed:</span>
                  <span className="text-white">+{transaction.signedAt - transaction.createdAt}ms</span>
                </div>
              )}
              {transaction.confirmedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Confirmed:</span>
                  <span className="text-green-400">+{transaction.confirmedAt - transaction.createdAt}ms</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-white mb-3">📝 Execution Logs</h3>
        <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto border border-gray-700 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-gray-500">Logs will appear here...</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="text-gray-300 mb-1">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <button
          onClick={handleExecute}
          disabled={stage !== 'idle'}
          className={`flex-1 py-3 rounded-lg font-bold transition-all ${
            stage === 'idle'
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 text-white'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {stage === 'idle' ? '🚀 Run Sample Transaction' : 'Running...'}
        </button>
        <button
          onClick={() => {
            setLogs([])
            setTransaction(null)
            setStage('idle')
          }}
          className="px-6 py-3 rounded-lg font-bold bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h4 className="font-bold text-blue-300 mb-2">ℹ️ How This Works</h4>
        <ul className="text-sm text-blue-100 space-y-1 ml-4">
          <li>• <span className="font-bold">Private Computation</span>: Midnight Network calculates IL privately</li>
          <li>• <span className="font-bold">ZK Proof</span>: Generates cryptographic proof of correctness</li>
          <li>• <span className="font-bold">User Control</span>: You see full transaction before signing</li>
          <li>• <span className="font-bold">On-Chain Verification</span>: Blockchain verifies proof without revealing logic</li>
          <li>• <span className="font-bold">Audit Trail</span>: All actions immutably recorded on-chain</li>
        </ul>
      </div>
    </div>
  )
}
