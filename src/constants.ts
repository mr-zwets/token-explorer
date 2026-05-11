// The pat.mn fallback can time out on heavier queries (e.g. queryIssuingUtxos
// for tokens with many UTXOs), which surfaces as missing reserved-supply data.
// Override via NEXT_PUBLIC_CHAINGRAPH_URL to point at a more powerful instance.
export const CHAINGRAPH_URL =
  process.env.NEXT_PUBLIC_CHAINGRAPH_URL ?? "https://gql.chaingraph.pat.mn/v1/graphql";
export const IPFS_GATEWAY = "https://w3s.link/ipfs/";
export const BLOCK_EXPLORER_URL = "https://explorer.bch.ninja/tx/";
export const OTR_REGISTRY_URL = "https://otr.cash/.well-known/bitcoin-cash-metadata-registry.json";
export const ELECTRUM_MAINNET = "electrum.imaginary.cash";
export const ELECTRUM_CHIPNET = "chipnet.bch.ninja";
