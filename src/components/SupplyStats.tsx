import type { TokenInfo, ExtendedTokenInfo, MetadataInfo, NftCategory, ElectrumVerification } from '@/interfaces'
import { lockingBytecodeToCashAddress, hexToBin } from '@bitauth/libauth'

interface SupplyStatsProps {
  tokenInfo: TokenInfo
  extendedInfo: ExtendedTokenInfo | undefined
  extendedInfoError: string | undefined
  metadataInfo: MetadataInfo | undefined
  electrumVerification?: ElectrumVerification
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

function ElectrumVerificationBadge({ verification }: { verification: ElectrumVerification }) {
  if (verification.error) {
    return (
      <div style={{ padding: '8px 12px', backgroundColor: '#f5f5f5', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.9em', color: '#666' }}>
        Electrum verification unavailable: {verification.error}
      </div>
    )
  }

  if (verification.verified) {
    return (
      <div style={{ padding: '8px 12px', backgroundColor: '#d4edda', border: '1px solid #28a745', borderRadius: '6px', fontSize: '0.9em', color: '#155724' }}>
        chaingraph data verified with Electrum ({verification.totalElectrumUtxos.toLocaleString("en-GB")} UTXOs match)
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 12px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '0.9em', color: '#856404' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
        Chaingraph data may be stale — Electrum could not confirm all UTXOs
      </div>
      <div>Chaingraph UTXOs: {verification.totalChaingraphUtxos.toLocaleString("en-GB")} — Electrum verified {verification.totalElectrumUtxos.toLocaleString("en-GB")} of those</div>
      {verification.staleCount > 0 && (
        <div>{verification.staleCount.toLocaleString("en-GB")} UTXO{verification.staleCount > 1 ? 's' : ''} in Chaingraph not confirmed by Electrum (likely already spent)</div>
      )}
      {verification.missingCount > 0 && (
        <div>{verification.missingCount.toLocaleString("en-GB")} UTXO{verification.missingCount > 1 ? 's' : ''} found by Electrum but not in Chaingraph (not yet indexed)</div>
      )}
      <div style={{ marginTop: '4px' }}>Advanced Chaingraph stats below may be inaccurate due to this stale data.</div>
    </div>
  )
}

export function SupplyStats({ tokenInfo, extendedInfo, extendedInfoError, metadataInfo, electrumVerification }: SupplyStatsProps) {
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
          {/* Naive circulating supply: genesis - reserved (only shown with Electrum verification) */}
          {(() => {
            if (!electrumVerification) {
              if (!extendedInfo) return <>loading supply data...<br /><br /></>
              return <>fetching supply info from Electrum...<br /><br /></>
            }
            if (electrumVerification.error) {
              return tokenInfo.reservedSupplyFT ? (
                <>
                  circulating supply: {displayTokenAmount(tokenInfo.genesisSupplyFT - tokenInfo.reservedSupplyFT)}
                  <br /><br />
                  reserved supply: {displayTokenAmount(tokenInfo.reservedSupplyFT)}
                  <span style={{ fontSize: '0.85em', color: '#666' }}> (unverified)</span>
                  <br /><br />
                </>
              ) : (
                <>No reserved supply (full supply circulating)<br /><br /></>
              )
            }
            const reservedFT = electrumVerification.electrumReservedFT
            const naiveCirculating = tokenInfo.genesisSupplyFT - reservedFT

            return reservedFT ? (
              <>
                circulating supply: {displayTokenAmount(naiveCirculating)}
                <br /><br />
                reserved supply: {displayTokenAmount(reservedFT)}
                <br /><br />
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
                                const result = lockingBytecodeToCashAddress({ bytecode: hexToBin(utxo.lockingBytecode), prefix: tokenInfo.network === 'chipnet' ? 'bchtest' : 'bitcoincash' })
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
                {electrumVerification.electrumReservedFT === tokenInfo.reservedSupplyFT ? (
                  <div style={{ padding: '8px 12px', marginTop: '8px', backgroundColor: '#d4edda', border: '1px solid #28a745', borderRadius: '6px', fontSize: '0.9em', color: '#155724' }}>
                    supply verified via Electrum
                  </div>
                ) : (
                  <div style={{ padding: '8px 12px', marginTop: '8px', backgroundColor: '#e8f4fd', border: '1px solid #7ab8d9', borderRadius: '6px', fontSize: '0.9em', color: '#0c5460' }}>
                    used Electrum to select the accurate UTXOs from Chaingraph (Chaingraph reported some stale reserves)
                  </div>
                )}
                <br />
              </>
            ) : (
              <>No reserved supply (full supply circulating)<br /><br /></>
            )
          })()}
          

        </>
      )}

      <hr />
      <div style={{ marginTop: '10px' }}><strong>Advanced ChainGraph Info</strong></div><br />

      {extendedInfo && (
        electrumVerification ? (
          <><ElectrumVerificationBadge verification={electrumVerification} /><br /></>
        ) : (
          <>fetching supply info from Electrum...<br /><br /></>
        )
      )}

      {extendedInfo && metadataInfo?.tokenMetadata && tokenInfo.genesisSupplyFT > 0 && (
        <>
          {(() => {
            const burned = tokenInfo.genesisSupplyFT - extendedInfo.totalSupplyFT
            const advancedCirculating = extendedInfo.totalSupplyFT - tokenInfo.reservedSupplyFT
            return (
              <>
                reserved supply (Chaingraph): {displayTokenAmount(tokenInfo.reservedSupplyFT)}<br /><br />
                {burned > 0 && (
                  <>
                    burned: {displayTokenAmount(burned)}<br />
                  </>
                )}
                circulating supply excl. burns (Chaingraph): {displayTokenAmount(advancedCirculating)}<br /><br />
              </>
            )
          })()}
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
          ) : extendedInfoError ? (
            <><span style={{ color: '#b33' }}>{extendedInfoError}</span><br /><br /></>
          ) : (
            <>loading holder data...<br /><br /></>
          )}
        </>
      )}
    </>
  )
}
