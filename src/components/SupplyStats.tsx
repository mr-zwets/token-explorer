import type { TokenInfo, ExtendedTokenInfo, MetadataInfo, NftCategory, ElectrumVerification, ReservedSupplyUtxo } from '@/interfaces'
import { lockingBytecodeToCashAddress, hexToBin } from '@bitauth/libauth'
import styles from '@/styles/Home.module.css'
import { Badge, SectionTitle, Stat, StatGrid, Row, Rows } from './ui'

interface SupplyStatsProps {
  tokenInfo: TokenInfo
  extendedInfo: ExtendedTokenInfo | undefined
  extendedInfoError: string | undefined
  metadataInfo: MetadataInfo | undefined
  electrumVerification?: ElectrumVerification
  electrumEnabled: boolean
}

function NftParseDetails({ nfts }: { nfts: NftCategory }) {
  const types = nfts.parse.types
  const typeEntries = Object.entries(types)
  if (typeEntries.length === 0) return null

  const isSequential = !nfts.parse.bytecode
  const summaryLabel = isSequential
    ? `Sequential NFT collection (${typeEntries.length} NFT entr${typeEntries.length > 1 ? 'ies' : 'y'} defined)`
    : `Parsable BCMR metadata (${typeEntries.length} NFT type${typeEntries.length > 1 ? 's' : ''} defined)`

  return (
    <details className="disclosure">
      <summary>{summaryLabel}</summary>
      <div className="disclosure-body">
        {nfts.description && <div style={{ marginTop: '10px' }}>collection description: {nfts.description}</div>}
        {nfts.parse.bytecode && <div style={{ marginTop: '10px', wordBreak: 'break-all' }}>parse bytecode: {nfts.parse.bytecode}</div>}
        {nfts.fields && Object.keys(nfts.fields).length > 0 && (
          <div style={{ marginTop: '10px' }}>
            fields:
            {Object.entries(nfts.fields).map(([fieldId, field]) => (
              <div key={fieldId} style={{ paddingLeft: '1em' }}>
                - {field.name ?? fieldId} ({field.encoding.type}){field.description ? `: ${field.description}` : ''}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: '10px' }}>
          {typeEntries.map(([typeId, nftType]) => (
            <details key={typeId} className="disclosure-inline">
              <summary>{isSequential ? `#${typeId}` : `type "${typeId}"`}: {nftType.name}</summary>
              <div style={{ paddingLeft: '1.2em', marginTop: '4px' }}>
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
      </div>
    </details>
  )
}

function ElectrumVerificationBadge({ verification }: { verification: ElectrumVerification }) {
  if (verification.error) {
    return (
      <div className="note note-muted">
        Electrum verification unavailable: {verification.error}
      </div>
    )
  }

  if (verification.verified) {
    return (
      <div className="note note-success">
        Chaingraph data verified with Electrum ({verification.totalElectrumUtxos.toLocaleString("en-GB")} UTXOs match)
      </div>
    )
  }

  return (
    <div className="note note-warn">
      <div style={{ fontWeight: 700, marginBottom: '4px' }}>
        Chaingraph data may be stale — Electrum could not confirm all UTXOs
      </div>
      <div>Chaingraph UTXOs: {verification.totalChaingraphUtxos.toLocaleString("en-GB")} — Electrum verified {verification.totalElectrumUtxos.toLocaleString("en-GB")} of those</div>
      {verification.staleCount > 0 && (
        <div>{verification.staleCount.toLocaleString("en-GB")} UTXO{verification.staleCount > 1 ? 's' : ''} in Chaingraph not confirmed by Electrum (likely already spent)</div>
      )}
      {verification.missingCount > 0 && (
        <div>{verification.missingCount.toLocaleString("en-GB")} UTXO{verification.missingCount > 1 ? 's' : ''} found by Electrum but not in Chaingraph (not yet indexed)</div>
      )}
      <div style={{ marginTop: '4px' }}>Detailed supply stats below may be inaccurate due to this stale data.</div>
    </div>
  )
}

function UtxoEntry({ utxo, network, displayTokenAmount }: { utxo: ReservedSupplyUtxo; network: 'mainnet' | 'chipnet'; displayTokenAmount: (amount: bigint) => string }) {
  const isAuthhead = !!utxo.isAuthhead
  const isCovenant = !utxo.lockingBytecode.startsWith('76a914')
  const result = lockingBytecodeToCashAddress({ bytecode: hexToBin(utxo.lockingBytecode), prefix: network === 'chipnet' ? 'bchtest' : 'bitcoincash' })
  const address = typeof result === 'string' ? undefined : result.address
  return (
    <div className={styles.entry}>
      {(utxo.nftCapability || isCovenant || isAuthhead) && (
        <div className={styles.entryHead}>
          {utxo.nftCapability && (
            <Badge tone={utxo.nftCapability === 'minting' ? 'success' : 'warn'}>{utxo.nftCapability}</Badge>
          )}
          {isCovenant && <Badge tone="info">covenant</Badge>}
          {isAuthhead && <Badge tone="purple">authhead</Badge>}
        </div>
      )}
      <div style={{ wordBreak: 'break-all' }}>
        <span style={{ color: 'var(--text-muted)' }}>outpoint:</span> <span className="mono">{utxo.txHash}:{utxo.vout}</span>
      </div>
      {address && <div style={{ wordBreak: 'break-all' }}><span style={{ color: 'var(--text-muted)' }}>address:</span> <span className="mono">{address}</span></div>}
      <div><span style={{ color: 'var(--text-muted)' }}>FT amount:</span> {displayTokenAmount(utxo.fungibleTokenAmount)}</div>
    </div>
  )
}

export function SupplyStats({ tokenInfo, extendedInfo, extendedInfoError, metadataInfo, electrumVerification, electrumEnabled }: SupplyStatsProps) {
  const decimals = metadataInfo?.tokenMetadata?.token?.decimals ?? 0
  const symbol = metadataInfo?.tokenMetadata?.token?.symbol ?? ''
  const nfts = metadataInfo?.tokenMetadata?.token?.nfts

  const displayTokenAmount = (amount: bigint) => {
    if (decimals === 0) return amount.toLocaleString("en-GB") + (symbol ? ' ' + symbol : '')
    const negative = amount < 0n
    const absAmount = negative ? -amount : amount
    const divisor = 10n ** BigInt(decimals)
    const whole = absAmount / divisor
    const fractional = absAmount % divisor
    const wholeStr = whole.toLocaleString("en-GB")
    const fractionalStr = fractional.toString().padStart(decimals, '0').replace(/0+$/, '')
    const sign = negative ? '-' : ''
    if (fractionalStr === '') return `${sign}${wholeStr}${symbol ? ' ' + symbol : ''}`
    return `${sign}${wholeStr}.${fractionalStr}${symbol ? ' ' + symbol : ''}`
  }

  const hasFT = tokenInfo.genesisSupplyFT > 0n
  const showPrimarySupply = !tokenInfo.issuingUtxosError && !!metadataInfo?.tokenMetadata && hasFT

  // Resolve the Electrum-verified reserved / naive-circulating figures.
  const supply = (() => {
    if (!showPrimarySupply) return null
    if (!electrumVerification) {
      if (!electrumEnabled) {
        if (!tokenInfo.reservedSupplyFT) return { state: 'none' } as const
        return {
          state: 'chaingraph' as const,
          reservedFT: tokenInfo.reservedSupplyFT,
          naiveCirculating: tokenInfo.genesisSupplyFT - tokenInfo.reservedSupplyFT
        }
      }
      return { state: extendedInfo ? 'fetching-electrum' : 'loading' } as const
    }
    if (electrumVerification.error) {
      if (!tokenInfo.reservedSupplyFT) return { state: 'none' } as const
      return {
        state: 'unverified' as const,
        reservedFT: tokenInfo.reservedSupplyFT,
        naiveCirculating: tokenInfo.genesisSupplyFT - tokenInfo.reservedSupplyFT
      }
    }
    const reservedFT = electrumVerification.electrumReservedFT
    if (!reservedFT) return { state: 'none' } as const
    return {
      state: 'verified' as const,
      reservedFT,
      naiveCirculating: tokenInfo.genesisSupplyFT - reservedFT,
      exactMatch: electrumVerification.electrumReservedFT === tokenInfo.reservedSupplyFT
    }
  })()

  // Chaingraph-derived burned & circulating-excl-burns figures.
  const burned = extendedInfo ? tokenInfo.genesisSupplyFT - extendedInfo.totalSupplyFT : undefined
  const circulatingExclBurns = extendedInfo ? extendedInfo.totalSupplyFT - tokenInfo.reservedSupplyFT : undefined

  const reservedUtxos = tokenInfo.reservedSupplyUtxos.filter(utxo => utxo.isAuthhead || utxo.fungibleTokenAmount > 0n)
  const covenantUtxos = reservedUtxos.filter(utxo => !utxo.isAuthhead && !utxo.lockingBytecode.startsWith('76a914'))
  const p2pkhUtxos = reservedUtxos.filter(utxo => !utxo.isAuthhead && utxo.lockingBytecode.startsWith('76a914'))
  const authheadUtxo = reservedUtxos.find(utxo => utxo.isAuthhead)
  const reservedSummaryParts: string[] = []
  if (covenantUtxos.length > 0) reservedSummaryParts.push(`${covenantUtxos.length} issuing covenant UTXO${covenantUtxos.length > 1 ? 's' : ''}`)
  if (p2pkhUtxos.length > 0) reservedSummaryParts.push(`${p2pkhUtxos.length} P2PKH UTXO${p2pkhUtxos.length > 1 ? 's' : ''}`)
  if (authheadUtxo) reservedSummaryParts.push('identity output')

  // Only relevant as a comparison against Electrum figures — when verification is off,
  // the headline "Reserved supply" already shows the same Chaingraph number.
  const showElectrumChaingraphReserved = !tokenInfo.issuingUtxosError && !!extendedInfo && !!metadataInfo?.tokenMetadata && hasFT &&
    (electrumEnabled || !!electrumVerification) &&
    !(!!electrumVerification && !electrumVerification.error && electrumVerification.electrumReservedFT === tokenInfo.reservedSupplyFT)

  const mintingCount = tokenInfo.reservedSupplyUtxos.filter(utxo => utxo.nftCapability === 'minting').length

  return (
    <div className={`card ${styles.section}`}>
      <SectionTitle>Supply</SectionTitle>

      {(tokenInfo.genesisInfoError || tokenInfo.issuingUtxosError) && (
        <div className="note note-warn" style={{ marginBottom: '16px' }}>
          {tokenInfo.genesisInfoError && <div>{tokenInfo.genesisInfoError} — genesis supply and NFT presence can&apos;t be shown.</div>}
          {tokenInfo.issuingUtxosError && <div>{tokenInfo.issuingUtxosError} — reserved supply can&apos;t be shown.</div>}
        </div>
      )}

      {/* Headline supply figures */}
      {(hasFT || (extendedInfo && extendedInfo.totalSupplyNFTs > 0)) && (
        <StatGrid>
          {hasFT && (
            <Stat label="Genesis supply" value={displayTokenAmount(tokenInfo.genesisSupplyFT)} />
          )}

          {supply?.state === 'verified' && (
            <>
              <Stat label="Circulating supply (naive)" value={displayTokenAmount(supply.naiveCirculating)} />
              <Stat label="Reserved supply" value={displayTokenAmount(supply.reservedFT)} />
            </>
          )}
          {(supply?.state === 'unverified' || supply?.state === 'chaingraph') && (
            <>
              <Stat label="Circulating supply (naive)" value={displayTokenAmount(supply.naiveCirculating)} />
              <Stat label="Reserved supply" value={displayTokenAmount(supply.reservedFT)} sub={supply.state === 'unverified' ? '(unverified)' : undefined} />
            </>
          )}
          {(supply?.state === 'loading' || supply?.state === 'fetching-electrum') && (
            <Stat label="Circulating supply" value={<span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.9rem' }}>{supply.state === 'loading' ? 'loading…' : 'verifying via Electrum…'}</span>} />
          )}

          {burned !== undefined && burned > 0n && (
            <Stat label="Burned" value={displayTokenAmount(burned)} />
          )}
          {circulatingExclBurns !== undefined && hasFT && (
            <Stat label="Circulating (excl. burns)" value={displayTokenAmount(circulatingExclBurns)} />
          )}

          {extendedInfo && extendedInfo.totalSupplyNFTs > 0 && (
            <Stat
              label="Total NFTs"
              value={extendedInfo.totalSupplyNFTs.toLocaleString("en-GB")}
              sub={!tokenInfo.issuingUtxosError && mintingCount > 0 ? `incl. ${mintingCount} minting` : undefined}
            />
          )}
        </StatGrid>
      )}

      {/* Verification note for the primary supply figures */}
      {supply?.state === 'verified' && (
        <div style={{ marginTop: '14px' }}>
          {supply.exactMatch ? (
            <div className="note note-success">Supply verified via Electrum.</div>
          ) : (
            <div className="note note-info">Used Electrum to select the accurate UTXOs from Chaingraph (Chaingraph reported some stale reserves).</div>
          )}
        </div>
      )}
      {supply?.state === 'none' && (
        <div className="note note-success" style={{ marginTop: '14px' }}>No reserved supply — the full supply is circulating.</div>
      )}

      {/* Reserved-supply UTXO breakdown */}
      {(supply?.state === 'verified' || supply?.state === 'unverified' || supply?.state === 'chaingraph') && reservedSummaryParts.length > 0 && (
        <details className="disclosure" style={{ marginTop: '14px' }}>
          <summary>Reserved supply held on {reservedSummaryParts.join(' and ')}</summary>
          <div className="disclosure-body">
            <div style={{ marginTop: '10px' }}>
              {reservedUtxos.map(utxo => (
                <UtxoEntry key={`${utxo.txHash}:${utxo.vout}`} utxo={utxo} network={tokenInfo.network} displayTokenAmount={displayTokenAmount} />
              ))}
            </div>
          </div>
        </details>
      )}

      {/* NFT parse metadata */}
      {nfts && Object.keys(nfts.parse.types).length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <NftParseDetails nfts={nfts} />
        </div>
      )}

      {/* NFT minting state + all minting/mutable UTXOs */}
      {extendedInfo && extendedInfo.totalSupplyNFTs > 0 && !tokenInfo.issuingUtxosError && (
        <div style={{ marginTop: '14px' }}>
          <Rows>
            <Row label="Has active minting NFT">{tokenInfo.hasActiveMintingToken ? 'yes' : 'no'}</Row>
          </Rows>
          {tokenInfo.reservedSupplyUtxos.length > 0 && (
            <details className="disclosure" style={{ marginTop: '14px' }}>
              <summary>Minting &amp; mutable NFT UTXOs ({tokenInfo.reservedSupplyUtxos.length})</summary>
              <div className="disclosure-body">
                <div style={{ marginTop: '10px' }}>
                  {tokenInfo.reservedSupplyUtxos.map(utxo => (
                    <UtxoEntry key={`${utxo.txHash}:${utxo.vout}`} utxo={utxo} network={tokenInfo.network} displayTokenAmount={displayTokenAmount} />
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Detailed supply + holders */}
      {(metadataInfo?.httpsUrl || extendedInfo || showElectrumChaingraphReserved) && (
        <>
          <div className={styles.sectionTitle} style={{ marginTop: '24px' }}>Holders &amp; detailed supply</div>

          {extendedInfo && (electrumEnabled || electrumVerification) && (
            <div style={{ marginBottom: '14px' }}>
              {electrumVerification ? (
                <ElectrumVerificationBadge verification={electrumVerification} />
              ) : (
                <div className="note note-muted">Fetching supply info from Electrum…</div>
              )}
            </div>
          )}

          {showElectrumChaingraphReserved && (
            <Rows>
              <Row label="Reserved supply (Chaingraph)">{displayTokenAmount(tokenInfo.reservedSupplyFT)}</Row>
            </Rows>
          )}

          {metadataInfo?.httpsUrl && (
            extendedInfo ? (
              <StatGrid>
                <Stat label={`User addresses holding ${symbol || 'token'}`} value={extendedInfo.numberHolders.toLocaleString("en-GB")} />
                <Stat label="Smart-contract addresses" value={(extendedInfo.numberTokenAddresses - extendedInfo.numberHolders).toLocaleString("en-GB")} />
                <Stat label="Total holding addresses" value={extendedInfo.numberTokenAddresses.toLocaleString("en-GB")} />
                {hasFT && extendedInfo.userSupplyFT > 0n && (
                  <Stat label="Circulating on user addresses" value={displayTokenAmount(extendedInfo.userSupplyFT)} />
                )}
                {hasFT && extendedInfo.contractSupplyFT > 0n && (
                  <Stat label="Circulating on smart contracts" value={displayTokenAmount(extendedInfo.contractSupplyFT)} />
                )}
              </StatGrid>
            ) : extendedInfoError ? (
              <div className="note note-danger">{extendedInfoError}</div>
            ) : (
              <div className="note note-muted">Loading holder data…</div>
            )
          )}
        </>
      )}
    </div>
  )
}
