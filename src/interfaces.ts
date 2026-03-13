import { z } from 'zod/v4'
import { IdentitySnapshotSchema, NftCategorySchema } from './utils/bcmrSchema'

export type TokenMetadata = z.infer<typeof IdentitySnapshotSchema>
export type NftCategory = z.infer<typeof NftCategorySchema>

export interface AuthchainEntry {
  txHash: string
  timestamp?: number
  isMetadataUpdate: boolean
  contentHash?: string
  httpsUrl?: string
  uris?: string[]
  opReturnHex?: string
}

export interface ReservedSupplyUtxo {
  txHash: string
  vout: number
  lockingBytecode: string
  fungibleTokenAmount: number
  nftCapability: 'minting' | 'mutable' | null
  isAuthhead?: boolean
}

export interface TokenInfo {
  genesisSupplyFT: number
  hasGenesisNFTs: boolean
  genesisTxTimestamp: number | undefined
  hasActiveMintingToken: boolean
  reservedSupplyUtxos: ReservedSupplyUtxo[]
  reservedSupplyFT: number
  genesisTx: string
  authchainLength?: number
  authHead?: string
  authHeadAddress?: string
  authHeadTimestamp?: number
  authHeadIsMetadataUpdate?: boolean
  usesAuthGuard?: boolean
  network: 'mainnet' | 'chipnet'
  authchainMigrations?: AuthchainEntry[]
  validTxId: boolean
  validTokenCategory: boolean
  tokenCategoriesInTx?: string[]
}

export interface ExtendedTokenInfo {
  totalSupplyFT: number
  totalSupplyNFTs: number
  numberHolders: number
  numberTokenAddresses: number
  userSupplyFT: number
  contractSupplyFT: number
}

export type DiagnosticType =
  | 'fetch_failed'      // CORS, network error, server down
  | 'http_error'        // Non-2xx HTTP status (403 Cloudflare, 404, 500...)
  | 'invalid_json'      // Server returned non-JSON (HTML error page, Cloudflare challenge)
  | 'schema_invalid'    // Zod validation failed — detail lists specific issues
  | 'hash_mismatch'     // On-chain hash doesn't match fetched content

export interface Diagnostic {
  type: DiagnosticType
  message: string
  details?: string
}

export interface MetadataInfo {
  metaDataLocation?:string;
  httpsUrl?:string;
  authchainUpdates?: number

  tokenMetadata?: TokenMetadata | undefined
  metadataHashMatch?: boolean
  isOtrVerified?: boolean
  isSchemaValid?: boolean
  authchainHistory?: AuthchainEntry[]
  diagnostics?: Diagnostic[]
}
