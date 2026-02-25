import type { TokenInfo, MetadataInfo, AuthchainEntry, Diagnostic } from '@/interfaces'
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

function AuthchainTimeline({ migrations, bcmrEntries, genesisTx, authHead }: { migrations?: AuthchainEntry[], bcmrEntries?: AuthchainEntry[], genesisTx?: string, authHead?: string }) {
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
          <div key={entry.txHash} style={{ marginBottom: '14px', paddingLeft: '8px', borderLeft: '2px solid #ccc', lineHeight: '1.6' }}>
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
              {entry.txHash === genesisTx && (
                <span style={{
                  display: 'inline-block',
                  padding: '1px 6px',
                  fontSize: '0.85em',
                  borderRadius: '4px',
                  marginLeft: '4px',
                  backgroundColor: '#cce5ff',
                  color: '#004085'
                }}>
                  token genesis
                </span>
              )}
              {entry.txHash === authHead && (
                <span style={{
                  display: 'inline-block',
                  padding: '1px 6px',
                  fontSize: '0.85em',
                  borderRadius: '4px',
                  marginLeft: '4px',
                  backgroundColor: '#e2d9f3',
                  color: '#3d2b6b'
                }}>
                  authhead
                </span>
              )}
            </div>
            <div>
              tx:{' '}
              <a href={BLOCK_EXPLORER_URL + entry.txHash} target="_blank" rel="noreferrer" style={{ color: 'black', display: 'inline', textDecoration: 'none' }}>
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

const diagnosticLabels: Record<string, string> = {
  fetch_failed: 'Fetch Failed',
  http_error: 'HTTP Error',
  invalid_json: 'Invalid JSON',
  schema_invalid: 'Schema Invalid',
  hash_mismatch: 'Hash Mismatch'
}

// Parse OP_RETURN script into data pushes (skipping opcodes)
function parseOpReturnPushes(hex: string): string[] {
  const pushes: string[] = []
  let i = 0
  // Skip OP_RETURN (6a)
  if (hex.slice(0, 2) === '6a') i = 2
  while (i < hex.length) {
    const opcode = parseInt(hex.slice(i, i + 2), 16)
    i += 2
    let len = 0
    if (opcode >= 0x01 && opcode <= 0x4b) {
      len = opcode
    } else if (opcode === 0x4c) { // OP_PUSHDATA1
      len = parseInt(hex.slice(i, i + 2), 16); i += 2
    } else if (opcode === 0x4d) { // OP_PUSHDATA2
      len = parseInt(hex.slice(i + 2, i + 4) + hex.slice(i, i + 2), 16); i += 4
    } else {
      continue
    }
    pushes.push(hex.slice(i, i + len * 2))
    i += len * 2
  }
  return pushes
}

function hexToUtf8(hex: string): string {
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

function LatestPublicationOutput({ migrations, lastMetadataUpdateTimestamp }: {
  migrations?: AuthchainEntry[]
  lastMetadataUpdateTimestamp?: number
}) {
  // Find the last metadata update migration that has opReturnHex
  const latestPublication = migrations ? [...migrations].reverse().find(m => m.isMetadataUpdate && m.opReturnHex) : undefined
  if (!latestPublication?.opReturnHex) return null

  const rawHex = latestPublication.opReturnHex
  const pushes = parseOpReturnPushes(rawHex)
  // pushes[0] = "BCMR" (42434d52), pushes[1] = content hash, pushes[2+] = URIs

  return (
    <>
      {lastMetadataUpdateTimestamp && (
        <div style={{ marginTop: '14px' }}>last metadata update: {formatTimestamp(lastMetadataUpdateTimestamp)}</div>
      )}
      <details style={{ marginTop: '14px' }}>
        <summary style={{ cursor: 'pointer' }}>latest publication output</summary>
        <div style={{ marginLeft: '8px', marginTop: '4px' }}>
          <div style={{ marginTop: '4px' }}>
            <strong>raw hex:</strong>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85em', wordBreak: 'break-all', marginTop: '2px' }}>{rawHex}</div>
          </div>
          {pushes.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <strong>data pushes:</strong>
              {pushes.map((push, i) => (
                <div key={i} style={{ fontFamily: 'monospace', fontSize: '0.85em', wordBreak: 'break-all', marginTop: '2px' }}>
                  [{i}] {push}
                </div>
              ))}
            </div>
          )}
          {pushes.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <strong>decoded:</strong>
              {pushes.map((push, i) => (
                <div key={i} style={{ wordBreak: 'break-all', marginTop: '2px' }}>
                  [{i}] {i === 1 ? `<${push.length / 2}_byte_hash>` : hexToUtf8(push)}
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
      <br />
    </>
  )
}

function DiagnosticsSection({ diagnostics }: { diagnostics?: Diagnostic[] }) {
  if (!diagnostics || diagnostics.length === 0) return null
  return (
    <details style={{ marginBottom: '8px' }}>
      <summary style={{ cursor: 'pointer' }}>
        diagnostics ({diagnostics.length} issue{diagnostics.length !== 1 ? 's' : ''})
      </summary>
      <div style={{ marginTop: '8px', marginLeft: '8px' }}>
        {diagnostics.map((diag, i) => (
          <div key={i} style={{
            marginBottom: '8px',
            padding: '8px',
            borderRadius: '4px',
            backgroundColor: '#fff3cd',
            color: '#856404'
          }}>
            <div><strong>{diagnosticLabels[diag.type] ?? diag.type}</strong></div>
            <div style={{ marginTop: '2px' }}>{diag.message}</div>
            {diag.details && (
              <pre style={{
                marginTop: '4px',
                fontSize: '0.85em',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                backgroundColor: 'rgba(0,0,0,0.05)',
                padding: '4px',
                borderRadius: '2px'
              }}>{diag.details}</pre>
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
              <br />
            </>
          )}

          <LatestPublicationOutput
            migrations={tokenInfo.authchainMigrations}
            lastMetadataUpdateTimestamp={
              !tokenInfo.authHeadIsMetadataUpdate
                ? [...(tokenInfo.authchainMigrations ?? [])].reverse().find(m => m.isMetadataUpdate)?.timestamp
                : undefined
            }
          />

          <AuthchainTimeline
            migrations={tokenInfo.authchainMigrations}
            bcmrEntries={metadataInfo.authchainHistory}
            genesisTx={tokenInfo.genesisTx}
            authHead={tokenInfo.authHead}
          />
          <br />

          {tokenInfo.authHeadAddress && (
            <>authHead address: {tokenInfo.authHeadAddress}<br /></>
          )}

          {tokenInfo.usesAuthGuard && (
            <div style={{ marginTop: '14px' }}>uses authGuard standard: ✅</div>
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

          <DiagnosticsSection diagnostics={metadataInfo.diagnostics} />
        </>
      )}
    </>
  )
}
