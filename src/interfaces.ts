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

export interface TokenInfo {
  genesisSupplyFT:number;
  genesisTxTimestamp:number | undefined;
  totalSupplyFT:number;
  circulatingSupplyFT:number;
  reservedSupplyFT:number;
  totalSupplyNFTs:number;
  mintingNFTs:number;
  hasActiveMintingToken:boolean;
  genesisTx: string,
  authchainLength?: number
  authHead?: string
  authHeadAddress?: string
  authHeadTimestamp?: number
  authHeadIsMetadataUpdate?: boolean
  usesAuthGuard?: boolean
  numberHolders: number
  numberTokenAddresses: number
  network: 'mainnet' | 'chipnet'
  authchainMigrations?: AuthchainEntry[]
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
