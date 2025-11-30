/**
 * Sample Midnight Network Rebalancing Transaction
 * Complete walkthrough of how the integration works
 */

import { midnightClient } from './midnightClient'
import { VaultData, RebalancingDecision, MidnightTransaction } from './midnightTypes'

/**
 * SAMPLE SCENARIO:
 * User has a vault with 6.5% IL in ADA/SNEK pool
 * IL threshold is 5.0%
 * AI decides to rebalance to ADA/DJED which would reduce IL to 2.1%
 * 
 * Flow:
 * 1. ✅ AI analyzes and decides to rebalance
 * 2. 🔐 Midnight generates ZK proof (private computation)
 * 3. 📋 User reviews transaction (fully transparent)
 * 4. ✍️  User signs with wallet
 * 5. ⛓️  Proof is verified on-chain
 * 6. 📤 Transaction submitted to blockchain
 * 7. ✅ Transaction confirmed
 */

// Step 1: Prepare vault data
const sampleVault: VaultData = {
  vaultId: 'vault_abc123def456',
  owner: 'addr_test1qpxs57t8f8d4zy0q4m93n7qkz95l5r2j6vf7x4v9m8n6l5h4g3c2b1a0z9y8x',
  currentPool: 'ADA/SNEK',
  tokenA: 'ADA',
  tokenB: 'SNEK',
  depositAmount: 500,
  currentIL: 6.5,
  ilThreshold: 5.0,
  entryPrice: 0.0020,
  status: 'protected',
  createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days ago
}

// Step 2: AI makes rebalancing decision
const aiDecision: RebalancingDecision = {
  vaultId: sampleVault.vaultId,
  fromPool: 'ADA/SNEK',
  toPool: 'ADA/DJED',
  currentIL: sampleVault.currentIL,
  expectedIL: 2.1,
  ilReduction: 6.5 - 2.1, // 4.4%
  confidence: 0.92, // 92% confidence
  reason: 'IL exceeded threshold and volatility spike detected in SNEK. DJED offers better risk profile.',
  timestamp: Date.now()
}

/**
 * Execute the complete transaction flow
 * This demonstrates how Midnight Network integration works
 */
export async function executeSampleMidnightTransaction(): Promise<MidnightTransaction> {
  console.log('\n' + '='.repeat(80))
  console.log('🌙 MIDNIGHT NETWORK REBALANCING TRANSACTION SAMPLE')
  console.log('='.repeat(80))

  console.log('\n📊 INITIAL STATE:')
  console.log('━'.repeat(80))
  console.log(`Vault ID: ${sampleVault.vaultId}`)
  console.log(`Owner: ${sampleVault.owner}`)
  console.log(`Current Position: ${sampleVault.currentPool}`)
  console.log(`Deposit: ${sampleVault.depositAmount} ADA`)
  console.log(`Current IL: ${sampleVault.currentIL}%`)
  console.log(`IL Threshold: ${sampleVault.ilThreshold}%`)
  console.log(`Status: ${sampleVault.status.toUpperCase()}`)

  console.log('\n🤖 AI ANALYSIS & DECISION:')
  console.log('━'.repeat(80))
  console.log(`Reason: ${aiDecision.reason}`)
  console.log(`Decision: Move from ${aiDecision.fromPool} → ${aiDecision.toPool}`)
  console.log(`Confidence: ${(aiDecision.confidence * 100).toFixed(1)}%`)
  console.log(`Expected Outcome:`)
  console.log(`  • Current IL: ${aiDecision.currentIL.toFixed(2)}%`)
  console.log(`  • Expected IL: ${aiDecision.expectedIL.toFixed(2)}%`)
  console.log(`  • IL Reduction: ${aiDecision.ilReduction.toFixed(2)}% ✅`)

  console.log('\n' + '─'.repeat(80))
  console.log('TRANSACTION EXECUTION')
  console.log('─'.repeat(80))

  try {
    // Execute the full transaction flow
    const transaction = await midnightClient.executeRebalancing(
      sampleVault,
      aiDecision,
      sampleVault.owner
    )

    // Print the result
    console.log('\n' + '═'.repeat(80))
    console.log('✅ TRANSACTION COMPLETED SUCCESSFULLY')
    console.log('═'.repeat(80))

    printTransactionSummary(transaction)

    return transaction
  } catch (error) {
    console.error('\n❌ Transaction failed:', error)
    throw error
  }
}

/**
 * Print transaction summary with all details
 */
function printTransactionSummary(tx: MidnightTransaction): void {
  console.log('\n📋 TRANSACTION SUMMARY:')
  console.log('━'.repeat(80))

  console.log('\nBasic Information:')
  console.log(`  Transaction ID: ${tx.txId}`)
  console.log(`  Status: ${tx.status.toUpperCase()}`)
  console.log(`  Blockchain Hash: ${tx.txHash?.substring(0, 32)}...`)

  console.log('\nRebalancing Details:')
  console.log(`  From: ${tx.rebalancing.fromPool} (IL: ${tx.rebalancing.currentIL.toFixed(2)}%)`)
  console.log(`  To: ${tx.rebalancing.toPool} (IL: ${tx.rebalancing.expectedIL.toFixed(2)}%)`)
  console.log(`  IL Reduction: ${tx.rebalancing.ilReduction.toFixed(2)}%`)
  console.log(`  AI Confidence: ${(tx.rebalancing.confidence * 100).toFixed(1)}%`)

  console.log('\nZero-Knowledge Proof:')
  console.log(`  Proof: ${tx.proof.proof.substring(0, 40)}...`)
  console.log(`  Constraints: ${tx.proof.metadata.constraints.toLocaleString()}`)
  console.log(`  IL Reduction Valid: ${tx.proof.publicSignals.ilReductionValid ? '✅' : '❌'}`)
  console.log(`  Rebalance Valid: ${tx.proof.publicSignals.rebalanceIsValid ? '✅' : '❌'}`)
  console.log(`  Confidence Check Passed: ${tx.proof.publicSignals.confidenceCheckPassed ? '✅' : '❌'}`)

  console.log('\nUser Authorization:')
  console.log(`  Signature: ${tx.userSignature?.substring(0, 20)}...`)
  console.log(`  Signed At: ${tx.signedAt ? new Date(tx.signedAt).toISOString() : 'N/A'}`)

  console.log('\nOn-Chain Verification:')
  if (tx.onChainVerification) {
    console.log(`  Status: ${tx.onChainVerification.verificationStatus.toUpperCase()}`)
    console.log(`  Verification Time: ${tx.onChainVerification.verificationTime}ms`)
    console.log(`  Block: #${tx.onChainVerification.blockNumber}`)
    console.log(`  Gas Used: ${tx.onChainVerification.gasUsed?.toLocaleString()} lovelace`)
  }

  console.log('\nTimeline:')
  const created = tx.createdAt
  const signed = tx.signedAt ? tx.signedAt - created : 0
  const verified = tx.onChainVerification ? (tx.submittedAt || 0) - created : 0
  const confirmed = tx.confirmedAt ? tx.confirmedAt - created : 0

  console.log(`  Created: ${new Date(tx.createdAt).toISOString()}`)
  if (tx.signedAt) console.log(`  Signed: +${signed}ms`)
  if (tx.onChainVerification) console.log(`  Verified: +${verified}ms`)
  if (tx.confirmedAt) console.log(`  Confirmed: +${confirmed}ms`)
  console.log(`  Total Duration: ${confirmed}ms (${(confirmed / 1000).toFixed(2)}s)`)

  console.log('\n' + '═'.repeat(80))
  console.log('KEY SECURITY FEATURES DEMONSTRATED:')
  console.log('═'.repeat(80))
  console.log('✅ Private Computation: AI analysis happens in Midnight (not visible)')
  console.log('✅ Zero-Knowledge Proof: Validity proven without revealing strategy')
  console.log('✅ User Control: Owner reviews and signs transaction')
  console.log('✅ On-Chain Verification: Proof verified by smart contract')
  console.log('✅ Audit Trail: All transaction details immutably recorded')
  console.log('✅ No Delegation: User maintains full control of keys')
}

/**
 * Example of how to use this in a component:
 * 
 * import { executeSampleMidnightTransaction } from './sampleTransaction'
 * 
 * export function MidnightDemoComponent() {
 *   const [transaction, setTransaction] = useState<MidnightTransaction | null>(null)
 *   const [loading, setLoading] = useState(false)
 * 
 *   const handleExecute = async () => {
 *     setLoading(true)
 *     try {
 *       const tx = await executeSampleMidnightTransaction()
 *       setTransaction(tx)
 *     } catch (error) {
 *       console.error('Failed:', error)
 *     } finally {
 *       setLoading(false)
 *     }
 *   }
 * 
 *   return (
 *     <button onClick={handleExecute} disabled={loading}>
 *       {loading ? 'Executing...' : 'Run Sample Transaction'}
 *     </button>
 *   )
 * }
 */
