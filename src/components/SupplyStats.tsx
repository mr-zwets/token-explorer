import type { TokenInfo, MetadataInfo, NftCategory } from '@/interfaces'

interface SupplyStatsProps {
  tokenInfo: TokenInfo
  metadataInfo: MetadataInfo | undefined
}

function NftParseDetails({ nfts }: { nfts: NftCategory }) {
  const types = nfts.parse.types
  const typeEntries = Object.entries(types)
  if (typeEntries.length === 0) return null

  const isSequential = !nfts.parse.bytecode
  const summaryLabel = isSequential
    ? `sequential NFT collection (${typeEntries.length} NFT entr${typeEntries.length > 1 ? 'ies' : 'y'} defined)`
    : `parsable BCMR metadata (${typeEntries.length} NFT type${typeEntries.length > 1 ? 's' : ''} defined)`

  return (
    <details>
      <summary>{summaryLabel}</summary>
      <div style={{ paddingLeft: '1em', marginTop: '0.5em' }}>
        {nfts.description && <div>collection description: {nfts.description}<br /><br /></div>}
        {nfts.parse.bytecode && <div>parse bytecode: {nfts.parse.bytecode}<br /><br /></div>}
        {nfts.fields && Object.keys(nfts.fields).length > 0 && (
          <div>
            fields:<br />
            {Object.entries(nfts.fields).map(([fieldId, field]) => (
              <div key={fieldId} style={{ paddingLeft: '1em' }}>
                - {field.name ?? fieldId} ({field.encoding.type}){field.description ? `: ${field.description}` : ''}
              </div>
            ))}
            <br />
          </div>
        )}
        {typeEntries.map(([typeId, nftType]) => (
          <details key={typeId} style={{ marginBottom: '0.5em' }}>
            <summary>{isSequential ? `#${typeId}` : `type "${typeId}"`}: {nftType.name}</summary>
            <div style={{ paddingLeft: '1em', marginTop: '0.3em' }}>
              {nftType.description && <div>description: {nftType.description}</div>}
              {nftType.fields && nftType.fields.length > 0 && (
                <div>fields: {nftType.fields.join(', ')}</div>
              )}
              {nftType.uris && Object.keys(nftType.uris).length > 0 && (
                <div>
                  uris: {Object.entries(nftType.uris).map(([key, val]) => (
                    <span key={key}> {key}: {val}</span>
                  ))}
                </div>
              )}
              {nftType.extensions && Object.keys(nftType.extensions).length > 0 && (
                <div>extensions: {JSON.stringify(nftType.extensions)}</div>
              )}
            </div>
          </details>
        ))}
      </div>
    </details>
  )
}

export function SupplyStats({ tokenInfo, metadataInfo }: SupplyStatsProps) {
  const decimals = metadataInfo?.tokenMetadata?.token?.decimals ?? 0
  const symbol = metadataInfo?.tokenMetadata?.token?.symbol ?? ''
  const nfts = metadataInfo?.tokenMetadata?.token?.nfts

  const displayTokenAmount = (amount: number) => {
    const amountDecimals = amount / (10 ** decimals)
    return amountDecimals.toLocaleString("en-GB") + ' ' + symbol
  }

  const toPercentage = (decimalNumber: number) =>
    (Math.round(decimalNumber * 10000) / 100).toFixed(2)

  const getTokenType = () => {
    if (tokenInfo.genesisSupplyFT && !tokenInfo.totalSupplyNFTs) return " Fungible Token"
    if (!tokenInfo.genesisSupplyFT && tokenInfo.totalSupplyNFTs) return " NFTs"
    if (tokenInfo.genesisSupplyFT && tokenInfo.totalSupplyNFTs) return " Both Fungible & Non-Fungible tokens"
    return ""
  }

  return (
    <>
      token type: {getTokenType()}<br /><br />

      {nfts && Object.keys(nfts.parse.types).length > 0 && (
        <><NftParseDetails nfts={nfts} /><br /></>
      )}

      {tokenInfo.genesisSupplyFT > 0 && (
        <>
          genesis supply: {displayTokenAmount(tokenInfo.genesisSupplyFT)} <br /><br />
        </>
      )}

      {tokenInfo.totalSupplyNFTs > 0 && (
        <>
          total amount NFTs: {tokenInfo.totalSupplyNFTs.toLocaleString("en-GB")}
          {tokenInfo.mintingNFTs > 0 && (
            <> (incl. {tokenInfo.mintingNFTs} minting NFT{tokenInfo.mintingNFTs > 1 ? 's' : ''})</>
          )}
          <br /><br />
        </>
      )}

      {metadataInfo?.tokenMetadata && tokenInfo.genesisSupplyFT > 0 && (
        <>
          {tokenInfo.genesisSupplyFT > tokenInfo.totalSupplyFT && (
            <>
              <span><i>NOTE:</i> burn calculations might be inaccurate</span><br />
              <span>burned: {displayTokenAmount(Math.max(0, tokenInfo.genesisSupplyFT - tokenInfo.totalSupplyFT))}</span>
              <div>supply excluding burns: {displayTokenAmount(tokenInfo.genesisSupplyFT - Math.max(0, tokenInfo.genesisSupplyFT - tokenInfo.totalSupplyFT))}</div><br />
            </>
          )}

          {tokenInfo.reservedSupplyFT ? (
            <>
              circulating supply: {displayTokenAmount(tokenInfo.totalSupplyFT - tokenInfo.reservedSupplyFT)}
              {` (${toPercentage((tokenInfo.totalSupplyFT - tokenInfo.reservedSupplyFT) / tokenInfo.totalSupplyFT)}%)`}<br /><br />
              reserved supply: {displayTokenAmount(tokenInfo.reservedSupplyFT)}
              {` (${toPercentage(tokenInfo.reservedSupplyFT / tokenInfo.totalSupplyFT)}%)`}<br /><br />
            </>
          ) : (
            <>No reserved supply (full supply circulating)<br /><br /></>
          )}
        </>
      )}

      {tokenInfo.totalSupplyNFTs > 0 && (
        <>
          has active minting NFT: {tokenInfo.hasActiveMintingToken ? "yes" : "no"} <br /><br />
        </>
      )}

      {metadataInfo?.httpsUrl && (
        <>
          number of user-addresses holding {symbol || 'the token'}: {tokenInfo.numberHolders.toLocaleString("en-GB")}<br /><br />
          total number of addresses holding {symbol || 'the token'} (including smart contracts): {tokenInfo.numberTokenAddresses.toLocaleString("en-GB")}<br /><br />
        </>
      )}
    </>
  )
}
