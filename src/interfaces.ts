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

export interface MetadataInfo {
  metaDataLocation?:string;
  httpsUrl?:string;
  authchainUpdates?: number

  tokenMetadata?: TokenMetadata | undefined
  metadataHashMatch?: boolean
  isOtrVerified?: boolean
  isSchemaValid?: boolean
  authchainHistory?: AuthchainEntry[]
}
