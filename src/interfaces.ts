export interface tokenInfo {
  genesisSupplyFT:number;
  genesisTxTimestamp:number | undefined;
  totalSupplyFT:number;
  reservedSupplyFT:number;
  totalSupplyNFTs:number;
  hasActiveMintingToken:boolean;
  genesisTx: string,
  authchainLength?: number
  authHead?: string
  numberHolders: number
  numberTokenAddresses: number
}

export interface metadataInfo {
  metaDataLocation?:string;
  httpsUrl?:string;
  authchainUpdates?: number
  
  tokenMetadata?: tokenMetadata | undefined
  metadataHashMatch?: boolean
}
export interface tokenMetadata {
  name: string,
  description?: string,
  token?: {
    symbol: string,
    decimals?:number
  },
  uris: URIs
}
type URIs = {
  [identifier: string]: string;
};