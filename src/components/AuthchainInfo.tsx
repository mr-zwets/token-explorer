import type { TokenInfo, MetadataInfo } from '@/interfaces'
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
        </>
      )}
    </>
  )
}
