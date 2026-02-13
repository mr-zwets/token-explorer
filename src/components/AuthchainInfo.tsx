import type { TokenInfo, MetadataInfo, AuthchainEntry } from '@/interfaces'
import { formatTimestamp } from '@/utils/utils'
import { BLOCK_EXPLORER_URL } from '@/constants'

interface AuthchainInfoProps {
  tokenInfo: TokenInfo
  metadataInfo: MetadataInfo | undefined
}

const getBaseDomain = (url: string) => {
  try {
    const parts = new URL(url).hostname.split('.')
    return parts.slice(-2).join('.')
  } catch { return undefined }
}

function AuthchainTimeline({ migrations, bcmrEntries }: { migrations?: AuthchainEntry[], bcmrEntries?: AuthchainEntry[] }) {
  if (!migrations || migrations.length === 0) return null

  // Merge: use migrations as the base timeline, enrich with BCMR data
  const bcmrMap = new Map<string, AuthchainEntry>()
  if (bcmrEntries) {
    for (const entry of bcmrEntries) {
      bcmrMap.set(entry.txHash, entry)
    }
  }

  const entries = migrations.map(m => {
    const bcmrData = bcmrMap.get(m.txHash)
    if (bcmrData) {
      return { ...m, ...bcmrData, timestamp: m.timestamp, isMetadataUpdate: true }
    }
    return m
  })

  return (
    <details>
      <summary style={{ cursor: 'pointer' }}>
        authchain history ({entries.length} transaction{entries.length !== 1 ? 's' : ''})
      </summary>
      <div style={{ marginTop: '8px', marginLeft: '8px' }}>
        {entries.map((entry, index) => (
          <div key={entry.txHash} style={{ marginBottom: '8px', paddingLeft: '8px', borderLeft: '2px solid #ccc' }}>
            <div>
              <strong>#{index}</strong>{' '}
              <span style={{
                display: 'inline-block',
                padding: '1px 6px',
                fontSize: '0.85em',
                borderRadius: '4px',
                backgroundColor: entry.isMetadataUpdate ? '#d4edda' : '#fff3cd',
                color: entry.isMetadataUpdate ? '#155724' : '#856404'
              }}>
                {entry.isMetadataUpdate ? 'metadata update' : 'identity transfer'}
              </span>
            </div>
            <div>
              tx:{' '}
              <a href={BLOCK_EXPLORER_URL + entry.txHash} target="_blank" rel="noreferrer" style={{ color: 'black' }}>
                {entry.txHash.substring(0, 16)}...{entry.txHash.substring(entry.txHash.length - 8)}
              </a>
            </div>
            {entry.timestamp && (
              <div>{formatTimestamp(entry.timestamp)}</div>
            )}
            {entry.isMetadataUpdate && (entry.contentHash || entry.uris) && (
              <details style={{ marginTop: '4px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.9em' }}>BCMR details</summary>
                <div style={{ marginLeft: '8px', fontSize: '0.9em' }}>
                  {entry.contentHash && <div>content hash: {entry.contentHash}</div>}
                  {entry.httpsUrl && (
                    <div>https url:{' '}
                      <a href={entry.httpsUrl} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
                        {entry.httpsUrl}
                      </a>
                    </div>
                  )}
                  {entry.uris && entry.uris.length > 0 && (
                    <div>uri{entry.uris.length > 1 ? 's' : ''}: {entry.uris.join(', ')}</div>
                  )}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}

export function AuthchainInfo({ tokenInfo, metadataInfo }: AuthchainInfoProps) {
  const webUrl = metadataInfo?.tokenMetadata?.uris?.web
  const bcmrBaseDomain = metadataInfo?.httpsUrl ? getBaseDomain(metadataInfo.httpsUrl) : undefined
  const webBaseDomain = webUrl ? getBaseDomain(webUrl) : undefined
  const bcmrOriginMatchesWeb = bcmrBaseDomain && webBaseDomain ? bcmrBaseDomain === webBaseDomain : undefined

  return (
    <>
      genesis transaction: {' '}
      <a href={BLOCK_EXPLORER_URL + tokenInfo.genesisTx} target="_blank" rel="noreferrer" style={{ color: "black" }}>
        {tokenInfo.genesisTx}
      </a><br />
      timestamp genesis transaction: {tokenInfo.genesisTxTimestamp ? formatTimestamp(tokenInfo.genesisTxTimestamp) : "N/A"} <br /><br />

      {metadataInfo && (
        <>
          authChain length: {tokenInfo.authchainLength} <br /><br />
          authChain metadata updates: {metadataInfo.authchainUpdates} <br /><br />

          authHead txid: {' '}
          <a href={BLOCK_EXPLORER_URL + tokenInfo.authHead} target="_blank" rel="noreferrer" style={{ color: "black" }}>
            {tokenInfo.authHead}
          </a><br />

          {tokenInfo.authHeadTimestamp && (
            <>
              last authChain update: {formatTimestamp(tokenInfo.authHeadTimestamp)}
              {tokenInfo.authHeadIsMetadataUpdate ? ' (metadata update)' : ' (identity transfer)'}
              <br /><br />
            </>
          )}

          <AuthchainTimeline
            migrations={tokenInfo.authchainMigrations}
            bcmrEntries={metadataInfo.authchainHistory}
          />
          <br />

          {tokenInfo.authHeadAddress && (
            <>authHead address: {tokenInfo.authHeadAddress}<br /></>
          )}

          {tokenInfo.usesAuthGuard && (
            <>uses authGuard standard: ✅<br /></>
          )}
          <br />

          {metadataInfo.httpsUrl && (
            <>
              location metadata: {' '}
              <a
                href={metadataInfo.httpsUrl}
                target="_blank"
                rel="noreferrer"
                style={{ maxWidth: "570px", wordBreak: "break-all", display: "inline-block" }}
              >
                {metadataInfo.metaDataLocation}
              </a><br /><br />
            </>
          )}

          {metadataInfo.isSchemaValid !== undefined && (
            <>
              BCMR schema valid: {metadataInfo.isSchemaValid ? '✅' : '❌'}<br /><br />
            </>
          )}

          {metadataInfo.authchainUpdates !== undefined && metadataInfo.authchainUpdates > 0 && (
            <>
              metadata hash matches: {metadataInfo.metadataHashMatch ? "✅" : metadataInfo.metadataHashMatch === false ? "❌" : "❔"} <br /><br />
            </>
          )}

          {bcmrOriginMatchesWeb && (
            <>
              BCMR origin matches web url: ✅<br /><br />
            </>
          )}

          {metadataInfo.isOtrVerified && (
            <>
              OpenTokenRegistry (OTR) verified: ✅<br /><br />
            </>
          )}
        </>
      )}
    </>
  )
}
