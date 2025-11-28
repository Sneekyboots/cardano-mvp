import { Lucid, Data } from 'lucid-cardano'
import { Buffer } from 'buffer'

// Helper function to convert string to hex
function stringToHex(str: string): string {
  if (!str) return ''
  // If already looks like hex (only 0-9, a-f), return as is
  if (/^[0-9a-fA-F]*$/.test(str)) {
    return str.toLowerCase()
  }
  // Otherwise convert UTF-8 to hex
  return Buffer.from(str, 'utf8').toString('hex')
}

// Vault datum structure matching your Aiken contract
const VaultDatum = Data.Object({
  owner: Data.Bytes(),
  pool_id: Data.Bytes(),
  asset_a: Data.Object({
    policy_id: Data.Bytes(),
    token_name: Data.Bytes(),
  }),
  asset_b: Data.Object({
    policy_id: Data.Bytes(),
    token_name: Data.Bytes(),
  }),
  deposit_amount: Data.Integer(),
  deposit_time: Data.Integer(),
  initial_pool_state: Data.Object({
    reserve_a: Data.Integer(),
    reserve_b: Data.Integer(),
    total_lp_tokens: Data.Integer(),
  }),
  il_protection_policy: Data.Object({
    max_il_percentage: Data.Integer(),
    protection_fee_rate: Data.Integer(),
    emergency_exit_fee_rate: Data.Integer(),
  })
})

type VaultDatum = Data.Static<typeof VaultDatum>

// Vault redeemer structure
const VaultRedeemer = Data.Enum([
  Data.Object({ Deposit: Data.Object({}) }),
  Data.Object({ Withdraw: Data.Object({ amount: Data.Integer() }) }),
  Data.Object({ UpdatePolicy: Data.Object({ new_max_il: Data.Integer() }) }),
  Data.Object({ EmergencyExit: Data.Object({}) })
])

type VaultRedeemer = Data.Static<typeof VaultRedeemer>

export class VaultTransactionBuilder {
  private lucid: Lucid
  private vaultAddress: string

  constructor(lucid: Lucid, vaultAddress: string) {
    this.lucid = lucid
    this.vaultAddress = vaultAddress
  }

  async createVault(params: {
    poolId: string
    depositAmount: number
    ilThreshold: number
    tokenA: { policyId: string; tokenName: string }
    tokenB: { policyId: string; tokenName: string }
  }): Promise<string> {
    try {
      // Check if wallet is properly connected
      if (!this.lucid.wallet) {
        throw new Error('Wallet not connected to Lucid instance')
      }

      const ownerAddress = await this.lucid.wallet.address()
      if (!ownerAddress) {
        throw new Error('Could not get wallet address')
      }

      const addressDetails = this.lucid.utils.getAddressDetails(ownerAddress)
      const ownerPubKeyHash = addressDetails.paymentCredential?.hash

      if (!ownerPubKeyHash) {
        throw new Error('Could not extract owner public key hash from address')
      }

      // Create vault datum
      const vaultDatum: VaultDatum = {
        owner: ownerPubKeyHash,
        pool_id: stringToHex(params.poolId || 'unknown'),
        asset_a: {
          policy_id: params.tokenA.policyId || '',
          token_name: stringToHex(params.tokenA.tokenName || 'ADA')
        },
        asset_b: {
          policy_id: params.tokenB.policyId || '',
          token_name: stringToHex(params.tokenB.tokenName || '')
        },
        deposit_amount: BigInt(Math.floor(params.depositAmount * 1000000)), // Convert ADA to lovelace
        deposit_time: BigInt(Math.floor(Date.now() / 1000)), // Unix timestamp in seconds
        initial_pool_state: {
          reserve_a: BigInt(1000000000000), // Mock initial reserves
          reserve_b: BigInt(500000000000),
          total_lp_tokens: BigInt(100000000)
        },
        il_protection_policy: {
          max_il_percentage: BigInt(Math.floor(params.ilThreshold * 100)), // Convert % to basis points
          protection_fee_rate: BigInt(50), // 0.5%
          emergency_exit_fee_rate: BigInt(100) // 1%
        }
      }

      // Build transaction
      const tx = await this.lucid
        .newTx()
        .payToContract(
          this.vaultAddress,
          { inline: Data.to(vaultDatum, VaultDatum) },
          { lovelace: BigInt(params.depositAmount * 1000000 + 2000000) } // Deposit + min UTxO
        )
        .complete()

      const signedTx = await tx.sign().complete()
      const txHash = await signedTx.submit()

      console.log('✅ Vault creation transaction submitted:', txHash)
      return txHash

    } catch (error) {
      console.error('❌ Vault creation failed:', error)
      throw error
    }
  }

  async withdrawFromVault(vaultUtxo: any, withdrawAmount: number): Promise<string> {
    try {
      const redeemer: VaultRedeemer = { Withdraw: { amount: BigInt(withdrawAmount * 1000000) } }

      const tx = await this.lucid
        .newTx()
        .collectFrom([vaultUtxo], Data.to(redeemer, VaultRedeemer))
        .attachSpendingValidator(vaultUtxo.scriptRef) // Assuming script is referenced
        .complete()

      const signedTx = await tx.sign().complete()
      const txHash = await signedTx.submit()

      console.log('✅ Vault withdrawal transaction submitted:', txHash)
      return txHash

    } catch (error) {
      console.error('❌ Vault withdrawal failed:', error)
      throw error
    }
  }

  async getVaultUtxos(ownerAddress: string): Promise<any[]> {
    try {
      const utxos = await this.lucid.utxosAt(this.vaultAddress)
      
      // Filter UTxOs belonging to the owner
      const ownerPubKeyHash = this.lucid.utils.getAddressDetails(ownerAddress).paymentCredential?.hash
      
      return utxos.filter(utxo => {
        try {
          const datum = Data.from(utxo.datum!, VaultDatum)
          return datum.owner === ownerPubKeyHash
        } catch {
          return false
        }
      })
    } catch (error) {
      console.error('❌ Failed to fetch vault UTxOs:', error)
      return []
    }
  }
}

export { VaultDatum, VaultRedeemer }