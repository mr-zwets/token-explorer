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

Runtime validation of BCMR data uses Zod schemas in `src/utils/bcmrSchema.ts`. This is a manual Zod implementation since Zod cannot validate directly from JSON Schema or TypeScript types. For the official spec, see: https://cashtokens.org/bcmr-v2.schema.json

For the schema definitions, see:
- TypeScript schema: https://github.com/bitjson/chip-bcmr/blob/master/bcmr-v2.schema.ts
- JSON schema: https://cashtokens.org/bcmr-v2.schema.json

Validation is applied to:
- Token metadata from `BCMR.getTokenInfo()` (`TokenMetadataSchema`)
- OTR registry fetches (`RegistrySchema`)

### Token Data Types

The explorer handles three token scenarios:
- Fungible Tokens only (has `genesisSupplyFT`, no NFTs)
- NFTs only (has `totalSupplyNFTs`, no FT supply)
- Both FT and NFTs combined
