import type { tokenInfo, metadataInfo } from '@/interfaces'
import { formatTimestamp } from '@/utils/utils'
import { BLOCK_EXPLORER_URL } from '@/constants'

interface AuthchainInfoProps {
  tokenInfo: tokenInfo
  metadataInfo: metadataInfo | undefined
}

export function AuthchainInfo({ tokenInfo, metadataInfo }: AuthchainInfoProps) {
  return (
    <>
      genesis transaction: {' '}
      <a href={BLOCK_EXPLORER_URL + tokenInfo.genesisTx} target="_blank" rel="noreferrer">
        {tokenInfo.genesisTx}
      </a><br />
      timestamp genesis transaction: {tokenInfo.genesisTxTimestamp ? formatTimestamp(tokenInfo.genesisTxTimestamp) : "N/A"} <br /><br />

      {metadataInfo && (
        <>
          authChain length: {tokenInfo.authchainLength} <br /><br />
          authChain metadata updates: {metadataInfo.authchainUpdates} <br /><br />

          authHead txid: {' '}
          <a href={BLOCK_EXPLORER_URL + tokenInfo.authHead} target="_blank" rel="noreferrer">
            {tokenInfo.authHead}
          </a><br />

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
                style={{ maxWidth: "570px", wordBreak: "break-all", display: "inline-block", color: "#00E" }}
              >
                {metadataInfo.metaDataLocation}
              </a><br /><br />
            </>
          )}

          {metadataInfo.authchainUpdates > 0 && (
            <>
              metadata hash matches: {metadataInfo.metadataHashMatch ? "✅" : metadataInfo.metadataHashMatch === false ? "❌" : "❔"} <br /><br />
            </>
          )}
        </>
      )}
    </>
  )
}
