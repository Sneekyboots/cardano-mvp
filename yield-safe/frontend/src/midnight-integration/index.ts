/**
 * Midnight Network Integration - Public API
 * Export all components and utilities for easy integration
 */

// Types
export type {
  VaultData,
  RebalancingDecision,
  ZeroKnowledgeProof,
  MidnightTransaction,
  ProofVerificationResult,
  MidnightConfig,
  MidnightContractCall
} from './midnightTypes'

// Client
export { MidnightClient, midnightClient } from './midnightClient'

// Sample Transaction
export { executeSampleMidnightTransaction } from './sampleTransaction'

// React Component
export { MidnightDemo } from './MidnightDemo'

/**
 * Quick Start Examples
 */

// Example 1: Generate a proof
// import { midnightClient } from './midnight-integration'
// const proof = await midnightClient.generateProof(vault, decision)

// Example 2: Execute full transaction
// import { midnightClient } from './midnight-integration'
// const tx = await midnightClient.executeRebalancing(vault, decision, userAddress)

// Example 3: Use the demo component
// import { MidnightDemo } from './midnight-integration'
// export function App() {
//   return <MidnightDemo />
// }

// Example 4: Run the sample transaction
// import { executeSampleMidnightTransaction } from './midnight-integration'
// const tx = await executeSampleMidnightTransaction()
