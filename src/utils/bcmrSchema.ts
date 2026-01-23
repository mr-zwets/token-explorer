import { z } from 'zod/v4'

// Zod implementation of the BCMR v2 schema for runtime validation.
// This is a manual implementation since Zod cannot validate from JSON Schema
// or TypeScript types directly. For the official JSON schema, see:
// https://cashtokens.org/bcmr-v2.schema.json

// URIs: mapping of identifiers to URI strings
export const URIsSchema = z.record(z.string(), z.string())

// Extensions: string or nested string mappings (up to 2 levels deep)
// Using z.unknown() for values since real-world data may have variations
export const ExtensionsSchema = z.record(z.string(), z.unknown())

// Tag definition
export const TagSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  uris: URIsSchema.optional(),
  extensions: ExtensionsSchema.optional(),
})

// NFT type definition
export const NftTypeSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  fields: z.array(z.string()).optional(),
  uris: URIsSchema.optional(),
  extensions: ExtensionsSchema.optional(),
})

// NFT field encoding
const NftFieldEncodingSchema = z.union([
  z.object({
    type: z.enum(['binary', 'boolean', 'hex', 'https-url', 'ipfs-cid', 'utf8', 'locktime']),
  }),
  z.object({
    type: z.literal('number'),
    aggregate: z.literal('add').optional(),
    decimals: z.number().int().min(0).max(18).optional(),
    unit: z.string().optional(),
  }),
])

// NFT category field
export const NftCategoryFieldSchema = z.record(
  z.string(),
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    encoding: NftFieldEncodingSchema,
    uris: URIsSchema.optional(),
    extensions: ExtensionsSchema.optional(),
  })
)

// NFT category
// parse.bytecode is optional: SequentialNftCollection has only types,
// ParsableNftCollection has bytecode + types
export const NftCategorySchema = z.object({
  description: z.string().optional(),
  fields: NftCategoryFieldSchema.optional(),
  parse: z.object({
    bytecode: z.string().optional(),
    types: z.record(z.string(), NftTypeSchema),
  }),
})

// Token category
export const TokenCategorySchema = z.object({
  category: z.string(),
  symbol: z.string(),
  decimals: z.number().int().min(0).max(18).optional(),
  nfts: NftCategorySchema.optional(),
})

// Identity snapshot
export const IdentitySnapshotSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  migrated: z.string().optional(),
  token: TokenCategorySchema.optional(),
  status: z.enum(['active', 'burned', 'inactive']).optional(),
  splitId: z.string().optional(),
  uris: URIsSchema.optional(),
  extensions: ExtensionsSchema.optional(),
})

// Chain snapshot (for native currency)
export const ChainSnapshotSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  token: z.object({
    symbol: z.string(),
    decimals: z.number().int().min(0).max(18).optional(),
  }),
  status: z.enum(['active', 'burned', 'inactive']).optional(),
  splitId: z.string().optional(),
  uris: URIsSchema.optional(),
  extensions: ExtensionsSchema.optional(),
})

// Identity history: timestamp-keyed map of snapshots
export const IdentityHistorySchema = z.record(z.string(), IdentitySnapshotSchema)

// Chain history: timestamp-keyed map of chain snapshots
export const ChainHistorySchema = z.record(z.string(), ChainSnapshotSchema)

// Off-chain registry identity (subset of IdentitySnapshot)
export const OffChainRegistryIdentitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  uris: URIsSchema.optional(),
  tags: z.array(z.string()).optional(),
  extensions: ExtensionsSchema.optional(),
})

// Version object
export const VersionSchema = z.object({
  major: z.number().int().min(0),
  minor: z.number().int().min(0),
  patch: z.number().int().min(0),
})

// Full Registry schema
export const RegistrySchema = z.object({
  $schema: z.string().optional(),
  version: VersionSchema,
  latestRevision: z.string(),
  registryIdentity: z.union([OffChainRegistryIdentitySchema, z.string()]),
  identities: z.record(z.string(), IdentityHistorySchema).optional(),
  tags: z.record(z.string(), TagSchema).optional(),
  defaultChain: z.string().optional(),
  chains: z.record(z.string(), ChainHistorySchema).optional(),
  license: z.string().optional(),
  extensions: ExtensionsSchema.optional(),
})

export type ValidatedRegistry = z.infer<typeof RegistrySchema>

// Schema for validating token metadata returned by BCMR.getTokenInfo()
export const TokenMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  token: z.object({
    symbol: z.string(),
    decimals: z.number().int().min(0).max(18).optional(),
  }).optional(),
  uris: URIsSchema,
})
