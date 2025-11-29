import { Lucid, Data } from "lucid-cardano";
import { YieldSafeAPI } from "./yieldSafeAPI";

export interface RealVaultData {
    utxo: any;
    vaultId: string;
    owner: string;
    poolId: string;
    tokenA: string;
    tokenB: string;
    depositAmount: number;
    tokenBAmount?: number; // NEW - token B amount for IL calculation
    lpTokens: number; // LP token amount stored in vault
    entryPrice: number; // NEW - track entry price for IL calculation
    createdAt: number;
    ilThreshold: number;
    status: "healthy" | "warning" | "protected";
    currentIL?: number; // NEW - real IL percentage
    currentPrice?: number; // NEW - current token price
    shouldTriggerProtection?: boolean; // NEW - protection status
}

export class RealVaultService {
    private lucid: Lucid;
    private vaultAddress: string;
    private api: YieldSafeAPI; // NEW - API connection

    constructor(lucid: Lucid, vaultAddress: string) {
        this.lucid = lucid;
        this.vaultAddress = vaultAddress;
        this.api = new YieldSafeAPI(); // Connect to our fixed IL calculator
    }

    async getUserVaults(userAddress: string): Promise<RealVaultData[]> {
        try {
            console.log("🔍 Fetching real vaults from blockchain...");

            // Get all UTxOs at the vault contract address
            const vaultUtxos = await this.lucid.utxosAt(this.vaultAddress);
            console.log(
                `Found ${vaultUtxos.length} UTxOs at vault address: ${this.vaultAddress}`,
            );

            // Get user's payment credential hash
            const userDetails = this.lucid.utils.getAddressDetails(userAddress);
            const userPaymentHash = String(
                userDetails.paymentCredential?.hash || "",
            ).toLowerCase();
            if (!userPaymentHash) {
                throw new Error("Could not get user payment hash");
            }

            console.log(
                `👤 User wallet address: ${userAddress.slice(0, 30)}...`,
            );
            console.log(`👤 User payment hash: ${userPaymentHash}`);
            console.log(`👤 User payment hash type: ${typeof userPaymentHash}`);
            console.log(
                `👤 User payment hash length: ${userPaymentHash.length}`,
            );

            const userVaults: RealVaultData[] = [];

            for (const utxo of vaultUtxos) {
                try {
                    console.log(
                        `\n📦 Checking UTxO: ${utxo.txHash}#${utxo.outputIndex}`,
                    );
                    console.log(`   Datum present: ${!!utxo.datum}`);
                    console.log(
                        `   Assets:`,
                        Object.keys(utxo.assets).slice(0, 3),
                    );

                    if (utxo.datum) {
                        // Decode the datum to get real vault data
                        const datum = utxo.datum;
                        console.log(
                            "✅ Found vault UTxO with datum:",
                            utxo.txHash + "#" + utxo.outputIndex,
                        );

                        let vaultData: RealVaultData;

                        try {
                            // Decode generic datum first - NEW structure: Constr(0, [...]) with 6 nested fields
                            // VaultDatum { owner, policy, lp_asset, deposit_amount, deposit_time, initial_pool_state }
                            const decodedDatum = Data.from(datum) as any;

                            // Validate it's a Constr with expected number of fields (now 6)
                            if (
                                !decodedDatum.fields ||
                                decodedDatum.fields.length < 6
                            ) {
                                throw new Error(
                                    `Expected Constr with 6 fields, got ${decodedDatum.fields?.length || 0}`,
                                );
                            }

                            // Helper to convert hex to string
                            const hexToString = (
                                hex: string | Uint8Array,
                            ): string => {
                                if (!hex) return "ADA";
                                try {
                                    const hexStr =
                                        typeof hex === "string"
                                            ? hex
                                            : Buffer.from(hex).toString("hex");
                                    return Buffer.from(hexStr, "hex").toString(
                                        "utf8",
                                    );
                                } catch {
                                    return typeof hex === "string"
                                        ? hex.slice(0, 8)
                                        : "UNKNOWN";
                                }
                            };

                            // Extract fields from new Constr(0, [...]) structure (6 nested fields):
                            // [0] owner: ByteArray
                            // [1] policy: UserPolicy { max_il_percent, deposit_ratio, emergency_withdraw }
                            // [2] lp_asset: Asset { policy_id, token_name }
                            // [3] deposit_amount: Int
                            // [4] deposit_time: Int
                            // [5] initial_pool_state: PoolState { reserve_a, reserve_b, total_lp_tokens, last_update_time }

                            const ownerHash = decodedDatum.fields[0]; // owner
                            const ownerHex =
                                ownerHash && typeof ownerHash !== "string"
                                    ? Buffer.from(ownerHash).toString("hex")
                                    : String(ownerHash || "");

                            console.log(`   🔑 Owner from datum: ${ownerHex}`);

                            // FILTER: Only process vaults owned by this user
                            const ownerMatch =
                                ownerHex.toLowerCase() ===
                                userPaymentHash.toLowerCase();
                            console.log(`   🔍 Owner match: ${ownerMatch}`);

                            if (!ownerMatch) {
                                console.log(`   ⏭️ SKIPPING - owner mismatch`);
                                continue;
                            }

                            console.log(
                                `   ✅ Owner match! Processing vault for user`,
                            );

                            // Extract policy (index 1) - UserPolicy { max_il_percent, deposit_ratio, emergency_withdraw }
                            const policyFields =
                                decodedDatum.fields[1]?.fields || [];
                            const ilThresholdBasisPoints = Number(
                                policyFields[0] || 500,
                            ); // max_il_percent
                            const ilThreshold = ilThresholdBasisPoints / 100; // Convert to percentage

                            // deposit_ratio is nested: AssetRatio { asset_a_amount, asset_b_amount }
                            const depositRatioFields =
                                policyFields[1]?.fields || [];
                            const assetAAmount = Number(
                                depositRatioFields[0] || 0,
                            ); // in lovelace
                            const assetBAmount = Number(
                                depositRatioFields[1] || 0,
                            );

                            // Extract lp_asset (index 2) - Asset { policy_id, token_name }
                            const lpAssetFields = decodedDatum.fields[2]
                                ?.fields || ["", ""];
                            const lpPolicyId = lpAssetFields[0] || "";
                            const lpTokenName =
                                hexToString(lpAssetFields[1]) || "LP";

                            // Extract deposit_amount (index 3)
                            const lpTokens = Number(decodedDatum.fields[3]); // in micro units

                            // Extract deposit_time (index 4)
                            const depositTime = Number(decodedDatum.fields[4]);

                            // Extract initial_pool_state (index 5) - PoolState { reserve_a, reserve_b, total_lp_tokens, last_update_time }
                            const poolStateFields =
                                decodedDatum.fields[5]?.fields || [];
                            const initialReserveA = Number(
                                poolStateFields[0] || 0,
                            );
                            const initialReserveB = Number(
                                poolStateFields[1] || 0,
                            );

                            // Calculate entry price from initial pool state
                            // For ADA/TokenB pair, price should be TokenB/ADA ratio
                            const entryPrice =
                                initialReserveA > 0
                                    ? initialReserveB / initialReserveA
                                    : 0;

                            // Determine token symbols with better mapping
                            const tokenASymbol = "ADA";
                            
                            // Map policy IDs to known token symbols (matching backend apiServer.ts)
                            const tokenSymbolMap: { [key: string]: string } = {
                                // Use policy ID only (not full policy+asset concatenation)
                                "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61": "DJED",
                                "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f": "SNEK", 
                                "e4214b7cce62ac6fbba385d164df48e157eae5863521b4b67ca71d86": "MIN",
                                "25c5de5f5b286073c593edfd77b48abc7a48e5a4f3d4cd9d428ff9355": "USDC",
                                "d894897411707efa755a76deb66d26dfd50593f2e70863e1661e98a0": "SPACE",
                                "f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc53541474958": "AGIX",
                                "533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0": "HUNT",
                                "f6f49b186751e61f1fb8c64e7504e771f968cea9f4d11f5222b169e374756e65": "IAGON",
                                "3a888d65f16790950a72daee1f63aa05add6d268434107cfa5b67712": "iUSD",
                                "5dac8536653edc12f6f5e1045d8164b9f59998d3bdc300fc92843489544e": "IBTC",
                                "5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114": "NTX",
                                "25f0fc240e91bd95dcdaebd2ba7713fc5168ac77234a3d79449fc20c4f4f5054494d": "OPTIM",
                                "6c8642400a9f4c1e3d5f6f84e8d6e1c2a9b35f4321a34567890123456789abcd": "C3"
                            };
                            
                            // Extract just policy ID part from lpPolicyId (remove asset name suffix if present)
                            const cleanPolicyId = lpPolicyId && lpPolicyId.length > 56 
                                ? lpPolicyId.slice(0, 56)  // Standard policy ID length
                                : lpPolicyId;
                            
                            let tokenBSymbol = tokenSymbolMap[cleanPolicyId] || lpTokenName;
                            if (tokenBSymbol === "LP" || !tokenBSymbol) {
                                tokenBSymbol = "Loading..."; // Use Loading instead of TOKEN to match user report
                            }

                            console.log(`   🔍 LP Policy ID (full): ${lpPolicyId}`);
                            console.log(`   🔍 Clean Policy ID: ${cleanPolicyId}`);
                            console.log(`   🏷️ Token B resolved: ${tokenBSymbol}`);
                            console.log(`   💰 Entry Price: ${entryPrice}`);
                            console.log(
                                `   🎯 LP Tokens: ${lpTokens / 1_000_000}`,
                            );
                            console.log(`   🛡️ IL Threshold: ${ilThreshold}%`);

                            // Calculate token B amount for proper IL calculation
                            const tokenBAmount = assetBAmount / 1_000_000; // Convert to token units
                            
                            vaultData = {
                                utxo: utxo,
                                vaultId: utxo.txHash + "#" + utxo.outputIndex,
                                owner: ownerHex,
                                poolId: lpPolicyId || "minswap",
                                tokenA: tokenASymbol,
                                tokenB: tokenBSymbol,
                                depositAmount: assetAAmount / 1_000_000, // Convert lovelace to ADA for display
                                tokenBAmount: tokenBAmount, // Add token B amount
                                lpTokens: lpTokens / 1_000_000, // Convert to display units
                                entryPrice: entryPrice,
                                createdAt: depositTime, // Already in milliseconds from Date.now()
                                ilThreshold: ilThreshold,
                                status: "healthy",
                            };

                            console.log(
                                `   📊 Decoded vault: ${vaultData.tokenA}/${vaultData.tokenB} @ ${entryPrice}`,
                            );
                        } catch (decodeError) {
                            console.error(
                                "   ❌ Failed to decode vault datum:",
                                decodeError,
                            );
                            continue; // Skip this vault if we can't decode it
                        }

                        // NEW - Fetch real IL data from our fixed calculator
                        try {
                            const ilData = await this.api.getVaultILData(
                                vaultData.tokenA,
                                vaultData.tokenB,
                                vaultData.entryPrice,
                                vaultData.ilThreshold,
                                vaultData.depositAmount, // Pass actual ADA deposited (in ADA units)
                                vaultData.tokenBAmount, // Pass actual token B deposited (in token units)
                                vaultData.lpTokens, // Pass actual LP tokens deposited
                            );

                            // Update vault with real IL data
                            vaultData.currentIL = ilData.ilPercentage;
                            vaultData.currentPrice = ilData.currentPrice;
                            vaultData.shouldTriggerProtection =
                                ilData.shouldTriggerProtection;

                            // Update status based on real IL
                            if (ilData.shouldTriggerProtection) {
                                vaultData.status = "protected";
                            } else if (ilData.ilPercentage > 1.0) {
                                vaultData.status = "warning";
                            } else {
                                vaultData.status = "healthy";
                            }

                            console.log(
                                `✅ Vault ${vaultData.vaultId}: ${ilData.ilPercentage.toFixed(3)}% IL`,
                            );
                        } catch (error) {
                            console.warn(
                                "Could not fetch IL data for vault:",
                                error,
                            );
                        }

                        userVaults.push(vaultData);
                    }
                } catch (error) {
                    console.log("Could not decode vault datum:", error);
                }
            }

            console.log(
                `✅ Found ${userVaults.length} real vaults for user out of ${vaultUtxos.length} total UTxOs`,
            );
            return userVaults;
        } catch (error) {
            console.error("❌ Failed to fetch real vaults:", error);
            return [];
        }
    }

    async getRealMetrics(userVaults: RealVaultData[]) {
        const totalVaults = userVaults.length;
        const totalValue = userVaults.reduce(
            (sum, vault) => sum + vault.depositAmount,
            0,
        );
        const averageIL =
            userVaults.length > 0
                ? userVaults.reduce((sum, vault) => sum, 0) / userVaults.length
                : 0;
        const protectedValue = userVaults
            .filter((v) => v.status === "protected")
            .reduce((sum, vault) => sum + vault.depositAmount, 0);

        return {
            totalVaults,
            totalValue: Math.round(totalValue),
            averageIL: 0, // Would calculate from real pool data
            protectedValue: Math.round(protectedValue),
        };
    }

    async getRecentActivity(userAddress: string): Promise<any[]> {
        try {
            // Get recent transactions for the user
            // This would query transaction history
            console.log("🔍 Fetching real transaction history...");

            // For now, return empty - would implement real tx history
            return [];
        } catch (error) {
            console.error("❌ Failed to fetch activity:", error);
            return [];
        }
    }
}
