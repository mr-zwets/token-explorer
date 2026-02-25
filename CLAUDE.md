# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm install      # Install dependencies
pnpm dev          # Start development server (http://localhost:3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript type checking (includes JSX/TSX)
```

## Architecture Overview

This is a Next.js 15 application (Pages Router) that explores CashTokens metadata on Bitcoin Cash mainnet & chipnet. It displays BCMR (Bitcoin Cash Metadata Registries) token information including genesis supply, NFT counts, circulating supply, authchain data, and metadata verification.

BCMR is the metadata standard for CashTokens on BCH. It uses "authchains" (zeroth-descendant transaction chains) to authenticate and update metadata on-chain. Spec: https://github.com/bitjson/chip-bcmr

### Key Data Flow

1. User enters a tokenId (transaction hash) in the input field
2. Two parallel data fetches occur:
   - `lookUpTokenData()` - Queries Chaingraph for on-chain token info (genesis supply, NFT counts, holders, authchain)
   - `fetchMetadata()` - Uses mainnet-js BCMR library to resolve and validate on-chain linked metadata

### External Dependencies

- **@mainnet-cash/bcmr** - Used for resolving on-chain BCMR metadata:
  - `BCMR.fetchAuthChainFromChaingraph()` - Fetches the authchain to find the metadata URI
  - `BCMR.addMetadataRegistryFromUri()` - Imports a registry from the resolved URL
  - `BCMR.getTokenInfo()` - Retrieves token metadata after importing
- **@bitauth/libauth** - Cryptographic primitives, transaction encoding (https://libauth.org/)
- **chaingraph-ts** - Typed GraphQL client for Chaingraph queries

### OTR (OpenTokenRegistry) Verification

The app checks if tokens are registered in the OpenTokenRegistry (https://otr.cash). Currently only checks if the tokenId is present in the registry, not whether the metadata matches. The registry is cached in memory for the session. See `src/utils/otrRegistry.ts`.

### BCMR Schema Validation

Runtime validation of BCMR data uses Zod schemas in `src/utils/bcmrSchema.ts`. This is a manual Zod implementation since Zod cannot validate directly from JSON Schema or TypeScript types.

For the schema definitions, see:
- TypeScript schema: https://github.com/bitjson/chip-bcmr/blob/master/bcmr-v2.schema.ts
- JSON schema: https://cashtokens.org/bcmr-v2.schema.json

### Authchain History Timeline

The `queryAuthchain()` Chaingraph query fetches the full authchain using the `migrations` field (ordered by `migration_index`). Each migration is classified as a "metadata update" or "identity transfer" by checking outputs for the BCMR OP_RETURN prefix (`6a0442434d52`).

Two data sources are merged in the UI:
- `tokenInfo.authchainMigrations` — basic entries from Chaingraph (txHash, timestamp, isMetadataUpdate, opReturnHex)
- `metadataInfo.authchainHistory` — BCMR-enriched entries from `BCMR.fetchAuthChainFromChaingraph()` (contentHash, httpsUrl, uris)

The `AuthchainTimeline` component in `AuthchainInfo.tsx` merges these by txHash, using migrations as the base and enriching with BCMR data. Pre-genesis migrations (from the funding tx) are filtered out using the genesis txHash.

The `LatestPublicationOutput` component decodes the raw OP_RETURN hex from the latest metadata update migration, parsing it into BCMR data pushes (protocol prefix, content hash, URIs) per the BCMR spec.

### Network Detection

The app detects chipnet vs mainnet from the node name in the genesis transaction's block inclusion data. This affects external links (Paytaca BCMR indexer URL) and is displayed in the UI.

### Verification Checks & Diagnostics

- **BCMR schema validation** — Zod schemas in `src/utils/bcmrSchema.ts`
- **Metadata hash match** — compares on-chain content hash with fetched content
- **BCMR origin match** — checks if the BCMR hosting domain matches the token's web URL
- **OTR verification** — checks if tokenId is present in the OpenTokenRegistry

When verification fails or metadata can't be fetched, `fetchMetadata()` populates a `diagnostics` array on `MetadataInfo` with structured errors (type, message, details). Error classification is IPFS-aware. The `DiagnosticsSection` component renders these in an expandable details block.

### Token Data Types

The explorer handles three token scenarios:
- Fungible Tokens only (has `genesisSupplyFT`, no NFTs)
- NFTs only (has `totalSupplyNFTs`, no FT supply)
- Both FT and NFTs combined

NFT display includes sequential collection detection and parsable NFT commitment info.
