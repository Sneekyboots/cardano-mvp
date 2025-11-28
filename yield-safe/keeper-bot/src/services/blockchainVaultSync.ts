import { Lucid, Data } from 'lucid-cardano'
import { DatabaseService } from '../database/database.js'
import { logger } from '../utils/logger.js'
import fs from 'fs'
import path from 'path'

interface VaultData {
  vaultId: string
  owner: string
  poolId: string
  tokenA: string
  tokenB: string
  tokenAPolicyId: string
  tokenBPolicyId: string
  depositAmount: number
  tokenBAmount: number
  lpTokens: number
  entryPrice: number
  ilThreshold: number
  createdAt: number
  status: 'active' | 'protected' | 'withdrawn'
  emergencyWithdraw: boolean
}

export class BlockchainVaultSync {
  private lucid: Lucid
  private database: DatabaseService
  private vaultAddress: string

  constructor(lucid: Lucid, database: DatabaseService) {
    this.lucid = lucid
    this.database = database
    this.vaultAddress = ''
  }

  // Load vault validator and get address
  private async getVaultAddress(): Promise<string> {
    if (this.vaultAddress) return this.vaultAddress

    try {
      const plutusPath = path.resolve(process.cwd(), '../contracts/plutus.json')
      const plutusFile = fs.readFileSync(plutusPath, 'utf-8')
      const plutusCompiled = JSON.parse(plutusFile)
      
      const vaultValidator = plutusCompiled.validators.find(
        (v: any) => v.title === "vault.vault_validator"
      )
      
      if (!vaultValidator) {
        throw new Error("Vault validator not found in plutus.json")
      }
      
      const validator = {
        type: "PlutusV2" as const,
        script: vaultValidator.compiledCode
      }
      
      this.vaultAddress = this.lucid.utils.validatorToAddress(validator)
      logger.info(`🏦 Vault contract address: ${this.vaultAddress}`)
      return this.vaultAddress
    } catch (error) {
      logger.error('❌ Failed to load vault address:', error)
      throw error
    }
  }

  // Helper to convert hex to string
  private hexToString(hex: string): string {
    if (!hex) return 'ADA'
    try {
      return Buffer.from(hex, 'hex').toString('utf8')
    } catch {
      return hex.slice(0, 8)
    }
  }

  // Decode vault datum
  private decodeVaultDatum(datum: string, utxo: any): VaultData | null {
    try {
      // Decode directly as generic Data structure first - all vaults use Constr(0, [...])
      try {
        const decodedDatum = Data.from(datum) as any
        
        // Check if it's a Constr with the expected number of fields (should be 10)
        if (!decodedDatum.fields || decodedDatum.fields.length < 10) {
          throw new Error(`Expected Constr with 10+ fields, got ${decodedDatum.fields?.length || 0}`)
        }
        
        // Extract fields from Constr(0, [...]) structure (matching backend creation)
        const ownerHash = decodedDatum.fields[0]  // owner
        const ownerHex = (ownerHash && typeof ownerHash !== 'string')
          ? Buffer.from(ownerHash).toString('hex')
          : String(ownerHash || '')
        
        const poolIdRaw = decodedDatum.fields[1]  // pool_id (hex bytes or string)
        let poolIdStr = ''
        if (typeof poolIdRaw === 'string') {
          poolIdStr = this.hexToString(poolIdRaw) || 'minswap'
        } else {
          poolIdStr = this.hexToString(Buffer.from(poolIdRaw).toString('hex')) || 'minswap'
        }
        
        // Extract asset_a (should be Constr with [policyId, tokenName])
        const assetAFields = decodedDatum.fields[2]?.fields || ['', '']
        const tokenAPolicyId = assetAFields[0] || ''
        const tokenANameHex = assetAFields[1] || ''
        const tokenASymbol = this.hexToString(tokenANameHex) || 'ADA'
        
        // Extract asset_b (should be Constr with [policyId, tokenName])
        const assetBFields = decodedDatum.fields[3]?.fields || ['', '']
        const tokenBPolicyId = assetBFields[0] || ''
        const tokenBNameHex = assetBFields[1] || ''
        const tokenBSymbol = this.hexToString(tokenBNameHex)
        
        const depositAmount = Number(decodedDatum.fields[4]) / 1_000_000  // deposit_amount
        const tokenBAmount = Number(decodedDatum.fields[5]) / 1_000_000   // token_b_amount
        const lpTokens = Number(decodedDatum.fields[6]) / 1_000_000       // lp_tokens
        const depositTime = Number(decodedDatum.fields[7])                // deposit_time
        const ilThreshold = Number(decodedDatum.fields[8]) / 100          // il_threshold
        const entryPrice = Number(decodedDatum.fields[9]) / 1_000_000     // initial_price
        
        const vaultData: VaultData = {
          vaultId: `${utxo.txHash}#${utxo.outputIndex}`,
          owner: ownerHex,
          poolId: poolIdStr,
          tokenA: tokenASymbol,
          tokenB: tokenBSymbol || 'UNKNOWN',
          tokenAPolicyId: tokenAPolicyId,
          tokenBPolicyId: tokenBPolicyId,
          depositAmount: depositAmount,
          tokenBAmount: tokenBAmount,
          lpTokens: lpTokens,
          entryPrice: entryPrice,
          ilThreshold: ilThreshold,
          createdAt: depositTime * 1000,
          status: 'active',
          emergencyWithdraw: true
        }
        
        logger.info(`   📦 Decoded vault (Constr): ${vaultData.tokenA}/${vaultData.tokenB} @ ${entryPrice} (owner: ${ownerHex.slice(0,12)}...)`)
        logger.info(`   💰 Deposit: ${depositAmount} ADA + ${tokenBAmount} ${tokenBSymbol}, LP: ${lpTokens}, IL Threshold: ${ilThreshold}%`)
        return vaultData
        
      } catch (constrError: any) {
        logger.warn('   ⚠️ Constr format decode failed, trying legacy fallback:', constrError?.message || constrError)
      }
      
      // Fallback: Try generic Data.from() decode
      const decodedDatum = Data.from(datum) as any
      
      // Extract owner hash (index 0)
      const ownerHash = decodedDatum.fields[0]
      const ownerHex = (ownerHash && typeof ownerHash !== 'string')
        ? Buffer.from(ownerHash).toString('hex')
        : String(ownerHash || '')
      
      // Extract pool ID (index 1) - could be bytes or string
      const poolIdRaw = decodedDatum.fields[1]
      let poolIdStr = 'unknown'
      if (typeof poolIdRaw === 'string') {
        poolIdStr = this.hexToString(poolIdRaw) || poolIdStr
      } else {
        poolIdStr = this.hexToString(Buffer.from(poolIdRaw).toString('hex')) || poolIdStr
      }
      
      // Extract asset A (index 2) - should be Constr with [policyId, tokenName]
      const assetAFields = decodedDatum.fields[2]?.fields || ['', '']
      const tokenAPolicyId = assetAFields[0] || ''
      const tokenANameHex = assetAFields[1] || ''
      const tokenASymbol = this.hexToString(tokenANameHex) || 'ADA'
      
      // Extract asset B (index 3)
      const assetBFields = decodedDatum.fields[3]?.fields || ['', '']
      const tokenBPolicyId = assetBFields[0] || ''
      const tokenBNameHex = assetBFields[1] || ''
      const tokenBSymbol = this.hexToString(tokenBNameHex)
      
      // Extract amounts (indices 4, 5, 6)
      const adaAmount = Number(decodedDatum.fields[4]) / 1_000_000
      const tokenBAmount = Number(decodedDatum.fields[5]) / 1_000_000
      const lpTokens = Number(decodedDatum.fields[6]) / 1_000_000
      
      // Extract timestamp (index 7)
      const timestamp = Number(decodedDatum.fields[7])
      
      // Extract IL threshold (index 8)
      const ilThreshold = Number(decodedDatum.fields[8]) / 100
      
      // Extract initial price (index 9)
      const initialPrice = Number(decodedDatum.fields[9]) / 1_000_000
      
      const vaultData: VaultData = {
        vaultId: `${utxo.txHash}#${utxo.outputIndex}`,
        owner: ownerHex,
        poolId: poolIdStr,
        tokenA: tokenASymbol,
        tokenB: tokenBSymbol || 'UNKNOWN',
        tokenAPolicyId: tokenAPolicyId,
        tokenBPolicyId: tokenBPolicyId,
        depositAmount: adaAmount,
        tokenBAmount: tokenBAmount,
        lpTokens: lpTokens,
        entryPrice: initialPrice,
        ilThreshold: ilThreshold,
        createdAt: timestamp,
        status: 'active',
        emergencyWithdraw: true
      }
      
      logger.info(`   📦 Decoded vault: ${vaultData.tokenA}/${vaultData.tokenB} @ ${initialPrice} (pool: ${poolIdStr})`)
      logger.info(`   💰 Deposit: ${adaAmount} ADA + ${tokenBAmount} ${tokenBSymbol}`)
      logger.info(`   🎯 LP Tokens: ${lpTokens}, IL Threshold: ${ilThreshold}%`)
      
      return vaultData
    } catch (error) {
      logger.error('   ❌ Failed to decode vault datum:', error)
      return null
    }
  }

  // Sync all vaults from blockchain to database
  async syncVaultsFromBlockchain(): Promise<number> {
    try {
      logger.info('🔄 Syncing vaults from blockchain...')
      
      const vaultAddress = await this.getVaultAddress()
      
      // Get all UTxOs at vault contract address
      const vaultUtxos = await this.lucid.utxosAt(vaultAddress)
      logger.info(`   Found ${vaultUtxos.length} UTxOs at vault address`)
      
      let syncedCount = 0
      
      for (const utxo of vaultUtxos) {
        if (!utxo.datum) {
          logger.debug(`   ⏭️  Skipping UTxO without datum: ${utxo.txHash}#${utxo.outputIndex}`)
          continue
        }
        
        const vaultId = `${utxo.txHash}#${utxo.outputIndex}`
        
        // Check if vault already exists in database
        const existingVault = await this.database.getVault(vaultId)
        if (existingVault) {
          logger.debug(`   ⏭️  Vault already in database: ${vaultId}`)
          continue
        }
        
        // Decode and store new vault
        logger.info(`\n📦 Processing new vault: ${vaultId}`)
        const vaultData = this.decodeVaultDatum(utxo.datum, utxo)
        
        if (vaultData) {
          // Store vault in database
          await this.database.storeVault(vaultData)
          logger.info(`   ✅ Vault synced to database: ${vaultData.tokenA}/${vaultData.tokenB}`)
          syncedCount++
        }
      }
      
      logger.info(`\n✅ Blockchain sync complete: ${syncedCount} new vaults synced`)
      return syncedCount
    } catch (error) {
      logger.error('❌ Blockchain vault sync failed:', error)
      throw error
    }
  }

  // Periodic sync - run every 5 minutes
  async startPeriodicSync(intervalMinutes: number = 5): Promise<void> {
    logger.info(`⏰ Starting periodic vault sync every ${intervalMinutes} minutes`)
    
    // Initial sync
    await this.syncVaultsFromBlockchain()
    
    // Schedule periodic sync
    setInterval(async () => {
      try {
        await this.syncVaultsFromBlockchain()
      } catch (error) {
        logger.error('❌ Periodic sync failed:', error)
      }
    }, intervalMinutes * 60 * 1000)
  }

  // Remove vaults that no longer exist on-chain
  async pruneClosedVaults(): Promise<void> {
    try {
      logger.info('🧹 Checking for closed vaults...')
      
      const vaultAddress = await this.getVaultAddress()
      const vaultUtxos = await this.lucid.utxosAt(vaultAddress)
      const onChainVaultIds = new Set(
        vaultUtxos.map(utxo => `${utxo.txHash}#${utxo.outputIndex}`)
      )
      
      // Get all vaults from database
      const dbVaults = await this.database.getAllActiveVaults()
      
      for (const vault of dbVaults) {
        if (!onChainVaultIds.has(vault.vaultId)) {
          logger.info(`   🔒 Marking vault as withdrawn: ${vault.vaultId}`)
          await this.database.updateVaultStatus(vault.vaultId, 'withdrawn')
        }
      }
      
      logger.info('✅ Vault pruning complete')
    } catch (error) {
      logger.error('❌ Vault pruning failed:', error)
    }
  }
}
