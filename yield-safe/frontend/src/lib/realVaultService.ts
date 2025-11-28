import { Lucid, Data } from 'lucid-cardano'
import { YieldSafeAPI } from './yieldSafeAPI'

export interface RealVaultData {
  utxo: any
  vaultId: string
  owner: string
  poolId: string
  tokenA: string
  tokenB: string
  depositAmount: number
  entryPrice: number // NEW - track entry price for IL calculation
  createdAt: number
  ilThreshold: number
  status: 'healthy' | 'warning' | 'protected'
  currentIL?: number // NEW - real IL percentage
  currentPrice?: number // NEW - current token price
  shouldTriggerProtection?: boolean // NEW - protection status
}

export class RealVaultService {
  private lucid: Lucid
  private vaultAddress: string
  private api: YieldSafeAPI // NEW - API connection

  constructor(lucid: Lucid, vaultAddress: string) {
    this.lucid = lucid
    this.vaultAddress = vaultAddress
    this.api = new YieldSafeAPI() // Connect to our fixed IL calculator
  }

  async getUserVaults(userAddress: string): Promise<RealVaultData[]> {
    try {
      console.log('🔍 Fetching real vaults from blockchain...')
      
      // Get all UTxOs at the vault contract address
      const vaultUtxos = await this.lucid.utxosAt(this.vaultAddress)
      console.log(`Found ${vaultUtxos.length} UTxOs at vault address: ${this.vaultAddress}`)
      
      // Get user's payment credential hash
      const userDetails = this.lucid.utils.getAddressDetails(userAddress)
      const userPaymentHash = String(userDetails.paymentCredential?.hash || '').toLowerCase()
      if (!userPaymentHash) {
        throw new Error('Could not get user payment hash')
      }
      
      console.log(`👤 User wallet address: ${userAddress.slice(0, 30)}...`)
      console.log(`👤 User payment hash: ${userPaymentHash}`)
      console.log(`👤 User payment hash type: ${typeof userPaymentHash}`)
      console.log(`👤 User payment hash length: ${userPaymentHash.length}`)

      const userVaults: RealVaultData[] = []

      for (const utxo of vaultUtxos) {
        try {
          console.log(`\n📦 Checking UTxO: ${utxo.txHash}#${utxo.outputIndex}`)
          console.log(`   Datum present: ${!!utxo.datum}`)
          console.log(`   Assets:`, Object.keys(utxo.assets).slice(0, 3))
          
          if (utxo.datum) {
            // Decode the datum to get real vault data
            const datum = utxo.datum
            console.log('✅ Found vault UTxO with datum:', utxo.txHash + '#' + utxo.outputIndex)
            
            let vaultData: RealVaultData
            
            try {
              // Decode generic datum first - backend creates Constr(0, [...]) with 10 fields
              const decodedDatum = Data.from(datum) as any
              
              // Validate it's a Constr with expected number of fields
              if (!decodedDatum.fields || decodedDatum.fields.length < 10) {
                throw new Error(`Expected Constr with 10 fields, got ${decodedDatum.fields?.length || 0}`)
              }
              
              // Helper to convert hex to string
              const hexToString = (hex: string | Uint8Array): string => {
                if (!hex) return 'ADA'
                try {
                  const hexStr = typeof hex === 'string' ? hex : Buffer.from(hex).toString('hex')
                  return Buffer.from(hexStr, 'hex').toString('utf8')
                } catch {
                  return typeof hex === 'string' ? hex.slice(0, 8) : 'UNKNOWN'
                }
              }
              
              // Extract fields from Constr(0, [...]) structure (10 fields)
              const ownerHash = decodedDatum.fields[0]  // owner
              const ownerHex = (ownerHash && typeof ownerHash !== 'string')
                ? Buffer.from(ownerHash).toString('hex')
                : String(ownerHash || '')
              
              console.log(`   🔑 Owner from datum: ${ownerHex}`)
              
              // FILTER: Only process vaults owned by this user
              const ownerMatch = ownerHex.toLowerCase() === userPaymentHash.toLowerCase()
              console.log(`   🔍 Owner match: ${ownerMatch}`)
              
              if (!ownerMatch) {
                console.log(`   ⏭️ SKIPPING - owner mismatch`)
                continue
              }
              
              console.log(`   ✅ Owner match! Processing vault for user`)
              
              // Extract pool ID (index 1)
              const poolIdRaw = decodedDatum.fields[1]
              let poolIdStr = 'minswap'
              if (typeof poolIdRaw === 'string') {
                poolIdStr = hexToString(poolIdRaw) || poolIdStr
              } else if (poolIdRaw) {
                poolIdStr = hexToString(Buffer.from(poolIdRaw).toString('hex')) || poolIdStr
              }
              
              // Extract asset_a (index 2) - Constr with [policyId, tokenName]
              const assetAFields = decodedDatum.fields[2]?.fields || ['', '']
              const tokenASymbol = hexToString(assetAFields[1]) || 'ADA'
              
              // Extract asset_b (index 3) - Constr with [policyId, tokenName]
              const assetBFields = decodedDatum.fields[3]?.fields || ['', '']
              const tokenBPolicyId = assetBFields[0] || ''
              const tokenBSymbol = hexToString(assetBFields[1])
              
              // Extract amounts (indices 4, 5, 6)
              const depositAmount = Number(decodedDatum.fields[4]) / 1_000_000  // deposit_amount
              const tokenBAmount = Number(decodedDatum.fields[5]) / 1_000_000   // token_b_amount
              const lpTokens = Number(decodedDatum.fields[6]) / 1_000_000       // lp_tokens
              
              // Extract timestamp (index 7) and IL threshold (index 8)
              const depositTime = Number(decodedDatum.fields[7])                // deposit_time
              const ilThreshold = Number(decodedDatum.fields[8]) / 100          // il_threshold
              const entryPrice = Number(decodedDatum.fields[9]) / 1_000_000     // initial_price
              
              console.log(`   🏷️ Token B: ${tokenBSymbol}`)
              console.log(`   💰 Entry Price: ${entryPrice}`)
              console.log(`   🛡️ IL Threshold: ${ilThreshold}%`)
              
              vaultData = {
                utxo: utxo,
                vaultId: utxo.txHash + '#' + utxo.outputIndex,
                owner: ownerHex,
                poolId: poolIdStr,
                tokenA: tokenASymbol,
                tokenB: tokenBSymbol || 'UNKNOWN',
                depositAmount: depositAmount,
                entryPrice: entryPrice,
                createdAt: depositTime * 1000, // Convert to milliseconds
                ilThreshold: ilThreshold,
                status: 'healthy'
              }
              
              console.log(`   📊 Decoded vault: ${vaultData.tokenA}/${vaultData.tokenB} @ ${entryPrice}`)
            } catch (decodeError) {
              console.error('   ❌ Failed to decode vault datum:', decodeError)
              continue  // Skip this vault if we can't decode it
            }
            
            // NEW - Fetch real IL data from our fixed calculator
            try {
              const ilData = await this.api.getVaultILData(
                vaultData.tokenA, 
                vaultData.tokenB, 
                vaultData.entryPrice,
                vaultData.ilThreshold
              )
              
              // Update vault with real IL data
              vaultData.currentIL = ilData.ilPercentage
              vaultData.currentPrice = ilData.currentPrice
              vaultData.shouldTriggerProtection = ilData.shouldTriggerProtection
              
              // Update status based on real IL
              if (ilData.shouldTriggerProtection) {
                vaultData.status = 'protected'
              } else if (ilData.ilPercentage > 1.0) {
                vaultData.status = 'warning'  
              } else {
                vaultData.status = 'healthy'
              }
              
              console.log(`✅ Vault ${vaultData.vaultId}: ${ilData.ilPercentage.toFixed(3)}% IL`)
              
            } catch (error) {
              console.warn('Could not fetch IL data for vault:', error)
            }
            
            userVaults.push(vaultData)
          }
        } catch (error) {
          console.log('Could not decode vault datum:', error)
        }
      }

      console.log(`✅ Found ${userVaults.length} real vaults for user out of ${vaultUtxos.length} total UTxOs`)
      return userVaults

    } catch (error) {
      console.error('❌ Failed to fetch real vaults:', error)
      return []
    }
  }

  async getRealMetrics(userVaults: RealVaultData[]) {
    const totalVaults = userVaults.length
    const totalValue = userVaults.reduce((sum, vault) => sum + vault.depositAmount, 0)
    const averageIL = userVaults.length > 0 
      ? userVaults.reduce((sum, vault) => sum, 0) / userVaults.length 
      : 0
    const protectedValue = userVaults.filter(v => v.status === 'protected')
      .reduce((sum, vault) => sum + vault.depositAmount, 0)

    return {
      totalVaults,
      totalValue: Math.round(totalValue),
      averageIL: 0, // Would calculate from real pool data
      protectedValue: Math.round(protectedValue)
    }
  }

  async getRecentActivity(userAddress: string): Promise<any[]> {
    try {
      // Get recent transactions for the user
      // This would query transaction history
      console.log('🔍 Fetching real transaction history...')
      
      // For now, return empty - would implement real tx history
      return []
      
    } catch (error) {
      console.error('❌ Failed to fetch activity:', error)
      return []
    }
  }
}