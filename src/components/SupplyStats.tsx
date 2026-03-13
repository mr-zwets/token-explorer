import type { TokenInfo, ExtendedTokenInfo, MetadataInfo, NftCategory } from '@/interfaces'
import { lockingBytecodeToCashAddress, hexToBin } from '@bitauth/libauth'

interface SupplyStatsProps {
  tokenInfo: TokenInfo
  extendedInfo: ExtendedTokenInfo | undefined
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

export function SupplyStats({ tokenInfo, extendedInfo, metadataInfo }: SupplyStatsProps) {
  const decimals = metadataInfo?.tokenMetadata?.token?.decimals ?? 0
  const symbol = metadataInfo?.tokenMetadata?.token?.symbol ?? ''
  const nfts = metadataInfo?.tokenMetadata?.token?.nfts

  const displayTokenAmount = (amount: number) => {
    const amountDecimals = amount / (10 ** decimals)
    return amountDecimals.toLocaleString("en-GB") + ' ' + symbol
  }

  const toPercentage = (decimalNumber: number) => {
    const pct = decimalNumber * 100
    if (pct === 0 || pct === 100) return pct.toFixed(2)
    if (pct < 0.01) return pct.toPrecision(2)
    if (pct > 99.99) return (100 - Number((100 - pct).toPrecision(2))).toString()
    return pct.toFixed(2)
  }

  const getTokenType = () => {
    if (tokenInfo.genesisSupplyFT && !tokenInfo.hasGenesisNFTs) return " Fungible Token"
    if (!tokenInfo.genesisSupplyFT && tokenInfo.hasGenesisNFTs) return " NFTs"
    if (tokenInfo.genesisSupplyFT && tokenInfo.hasGenesisNFTs) return " Both Fungible & Non-Fungible tokens"
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

      {metadataInfo?.tokenMetadata && tokenInfo.genesisSupplyFT > 0 && (
        <>
          {extendedInfo ? (
            <>
              {tokenInfo.genesisSupplyFT > extendedInfo.totalSupplyFT && (
                <>
                  <span><i>NOTE:</i> burn calculations might be inaccurate</span><br />
                  <span>burned: {displayTokenAmount(Math.max(0, tokenInfo.genesisSupplyFT - extendedInfo.totalSupplyFT))}</span>
                  <div>supply excluding burns: {displayTokenAmount(tokenInfo.genesisSupplyFT - Math.max(0, tokenInfo.genesisSupplyFT - extendedInfo.totalSupplyFT))}</div><br />
                </>
              )}

              {tokenInfo.reservedSupplyFT ? (
                <>
                  circulating supply: {displayTokenAmount(extendedInfo.totalSupplyFT - tokenInfo.reservedSupplyFT)}
                  {` (${toPercentage((extendedInfo.totalSupplyFT - tokenInfo.reservedSupplyFT) / extendedInfo.totalSupplyFT)}%)`}<br /><br />
                  reserved supply: {displayTokenAmount(tokenInfo.reservedSupplyFT)}
                  {` (${toPercentage(tokenInfo.reservedSupplyFT / extendedInfo.totalSupplyFT)}%)`}<br /><br />
                  {(() => {
                    const covenantUtxos = tokenInfo.reservedSupplyUtxos.filter(utxo => !utxo.isAuthhead && !utxo.lockingBytecode.startsWith('76a914'))
                    const p2pkhUtxos = tokenInfo.reservedSupplyUtxos.filter(utxo => !utxo.isAuthhead && utxo.lockingBytecode.startsWith('76a914'))
                    const authheadUtxo = tokenInfo.reservedSupplyUtxos.find(utxo => utxo.isAuthhead)
                    const summaryParts: string[] = []
                    if (covenantUtxos.length > 0) summaryParts.push(`${covenantUtxos.length} issuing covenant UTXO${covenantUtxos.length > 1 ? 's' : ''}`)
                    if (p2pkhUtxos.length > 0) summaryParts.push(`${p2pkhUtxos.length} P2PKH UTXO${p2pkhUtxos.length > 1 ? 's' : ''}`)
                    if (authheadUtxo) summaryParts.push('identity output')
                    return (
                      <details>
                        <summary style={{ cursor: 'pointer' }}>reserved supply held on {summaryParts.join(' and ')}</summary>
                        <div style={{ marginTop: '8px', marginLeft: '8px' }}>
                          {tokenInfo.reservedSupplyUtxos.map(utxo => {
                            const isAuthhead = !!utxo.isAuthhead
                            const isCovenant = !utxo.lockingBytecode.startsWith('76a914')
                            return (
                              <div key={`${utxo.txHash}:${utxo.vout}`} style={{ marginBottom: '14px', paddingLeft: '8px', borderLeft: '2px solid #ccc', lineHeight: '1.6' }}>
                                <div>
                                  {utxo.nftCapability && (
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '1px 6px',
                                      fontSize: '0.85em',
                                      borderRadius: '4px',
                                      backgroundColor: utxo.nftCapability === 'minting' ? '#d4edda' : '#fff3cd',
                                      color: utxo.nftCapability === 'minting' ? '#155724' : '#856404'
                                    }}>
                                      {utxo.nftCapability}
                                    </span>
                                  )}
                                  {isCovenant && (
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '1px 6px',
                                      fontSize: '0.85em',
                                      borderRadius: '4px',
                                      marginLeft: utxo.nftCapability ? '4px' : undefined,
                                      backgroundColor: '#cce5ff',
                                      color: '#004085'
                                    }}>
                                      covenant
                                    </span>
                                  )}
                                  {isAuthhead && (
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '1px 6px',
                                      fontSize: '0.85em',
                                      borderRadius: '4px',
                                      marginLeft: utxo.nftCapability || isCovenant ? '4px' : undefined,
                                      backgroundColor: '#e2d9f3',
                                      color: '#3d2b6b'
                                    }}>
                                      authhead
                                    </span>
                                  )}
                                </div>
                                <div style={{ wordBreak: 'break-all' }}>
                                  outpoint: {utxo.txHash}:{utxo.vout}
                                </div>
                                {(() => {
                                  const result = lockingBytecodeToCashAddress({ bytecode: hexToBin(utxo.lockingBytecode), prefix: 'bitcoincash' })
                                  const address = typeof result === 'string' ? undefined : result.address
                                  return address ? <div style={{ wordBreak: 'break-all' }}>address: {address}</div> : null
                                })()}
                                <div>reserved FT: {displayTokenAmount(utxo.fungibleTokenAmount)}</div>
                              </div>
                            )
                          })}
                        </div>
                      </details>
                    )
                  })()}
                  <br />
                </>
              ) : (
                <>No reserved supply (full supply circulating)<br /><br /></>
              )}
            </>
          ) : (
            <>loading supply data...<br /><br /></>
          )}
        </>
      )}

      {extendedInfo && extendedInfo.totalSupplyNFTs > 0 && (
        <>
          total amount NFTs: {extendedInfo.totalSupplyNFTs.toLocaleString("en-GB")}
          {(() => {
            const mintingCount = tokenInfo.reservedSupplyUtxos.filter(utxo => utxo.nftCapability === 'minting').length
            return mintingCount > 0 && (
              <> (incl. {mintingCount} minting NFT{mintingCount > 1 ? 's' : ''})</>
            )
          })()}
          <br /><br />
          has active minting NFT: {tokenInfo.hasActiveMintingToken ? "yes" : "no"} <br /><br />
        </>
      )}

      {metadataInfo?.httpsUrl && (
        <>
          {extendedInfo ? (
            <>
              number of user-addresses holding {symbol || 'the token'}: {extendedInfo.numberHolders.toLocaleString("en-GB")}<br /><br />
              number of smart contract addresses holding {symbol || 'the token'}: {(extendedInfo.numberTokenAddresses - extendedInfo.numberHolders).toLocaleString("en-GB")}<br /><br />
              total number of addresses holding {symbol || 'the token'}: {extendedInfo.numberTokenAddresses.toLocaleString("en-GB")}<br /><br />
              {tokenInfo.genesisSupplyFT > 0 && extendedInfo.userSupplyFT > 0 && (
                <>circulating supply held on user addresses: {displayTokenAmount(extendedInfo.userSupplyFT)}<br /><br /></>
              )}
              {tokenInfo.genesisSupplyFT > 0 && extendedInfo.contractSupplyFT > 0 && (
                <>circulating supply held on smart contracts: {displayTokenAmount(extendedInfo.contractSupplyFT)}<br /><br /></>
              )}
            </>
          ) : (
            <>loading holder data...<br /><br /></>
          )}
        </>
      )}
    </>
  )
}
