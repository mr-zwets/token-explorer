import type { tokenInfo, metadataInfo } from '@/interfaces'

interface SupplyStatsProps {
  tokenInfo: tokenInfo
  metadataInfo: metadataInfo | undefined
}

export function SupplyStats({ tokenInfo, metadataInfo }: SupplyStatsProps) {
  const decimals = metadataInfo?.tokenMetadata?.token?.decimals ?? 0
  const symbol = metadataInfo?.tokenMetadata?.token?.symbol ?? ''

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

      {tokenInfo.genesisSupplyFT > 0 && (
        <>
          genesis supply: {displayTokenAmount(tokenInfo.genesisSupplyFT)} <br /><br />
        </>
      )}

      {tokenInfo.totalSupplyNFTs > 0 && (
        <>
          total amount NFTs: {tokenInfo.totalSupplyNFTs.toLocaleString("en-GB")} <br /><br />
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
