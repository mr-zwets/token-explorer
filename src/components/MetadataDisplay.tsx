import type { MetadataInfo } from '@/interfaces'

interface MetadataDisplayProps {
  metadataInfo: MetadataInfo | undefined
  tokenIconUri: string
}

export function MetadataDisplay({ metadataInfo, tokenIconUri }: MetadataDisplayProps) {
  if (metadataInfo?.metaDataLocation !== undefined) {
    if (metadataInfo.metaDataLocation === "") {
      return <> This token has no BCMR metadata linked on-chain <br /><br /></>
    }
  } else {
    return <> loading metadata... <br /><br /></>
  }

  const tokenMetadata = metadataInfo?.tokenMetadata
  if (!tokenMetadata) return null

  const otherUriKeys = tokenMetadata.uris
    ? Object.keys(tokenMetadata.uris).filter(uri => uri !== "icon" && uri !== "image" && uri !== "web")
    : []

  return (
    <>
      name: {tokenMetadata.name} <br /><br />

      {tokenMetadata.token && (
        <>
          <div>symbol: {tokenMetadata.token.symbol}</div><br />
        </>
      )}

      {tokenMetadata.token?.decimals !== undefined && (
        <>
          <div>decimals: {tokenMetadata.token.decimals}</div><br />
        </>
      )}

      description: {tokenMetadata.description} <br /><br />

      {tokenMetadata.uris && (
        <>
          web url: {tokenMetadata.uris.web ? (
            <a
              href={tokenMetadata.uris.web}
              target='_blank'
              rel="noreferrer"
              style={{ display: "inline-block" }}
            >
              {tokenMetadata.uris.web}
            </a>
          ) : "none"}<br /><br />

          other uris: {otherUriKeys.length ? (
            otherUriKeys.map((uriKey, index, array) => (
              <span key={uriKey}>
                <a
                  href={tokenMetadata.uris?.[uriKey]}
                  target='_blank'
                  rel="noreferrer"
                  style={{ display: "inline-block" }}
                >
                  {uriKey}
                </a>
                {index !== array.length - 1 ? ", " : null}
              </span>
            ))
          ) : "none"} <br /><br />
        </>
      )}

      {(tokenMetadata.uris?.icon || tokenMetadata.uris?.image) && tokenIconUri && (
        <>
          <span style={{ verticalAlign: "top" }}>icon: </span>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <img
              className='tokenImage'
              style={{ width: "60vw", maxWidth: "400px" }}
              src={tokenIconUri}
              alt="tokenIcon"
            />
          </div>
        </>
      )}

      {metadataInfo.isOtrVerified && (
        <>
          OpenTokenRegistry (OTR) verified: ✅<br /><br />
        </>
      )}
    </>
  )
}
