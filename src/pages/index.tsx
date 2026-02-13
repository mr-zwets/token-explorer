import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import { BCMR } from '@mainnet-cash/bcmr'
import { utf8ToBin, sha256, binToHex, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth'
import { useEffect, useState } from 'react'
import { queryGenesisSupplyFT, queryActiveMinting, querySupplyNFTs, queryAuthchainLength, queryAllTokenHolders } from '../utils/queryChainGraph'
import { countUniqueHolders, calculateTotalSupplyFT, calculateCirculatingSupplyFT } from '../utils/calculations'
import { checkOtrVerified } from '../utils/otrRegistry'
import { TokenMetadataSchema } from '../utils/bcmrSchema'
import type { tokenInfo, metadataInfo, tokenMetadata } from '@/interfaces'
import { CHAINGRAPH_URL, IPFS_GATEWAY } from '@/constants'
import { TokenSearch, MetadataDisplay, SupplyStats, AuthchainInfo } from '@/components'

export default function Home() {
  const [tokenId, setTokenId] = useState<string>("")
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState<boolean>(false)
  const [tokenInfo, setTokenInfo] = useState<tokenInfo>()
  const [metadataInfo, setMetadataInfo] = useState<metadataInfo>()
  const [tokenIconUri, setTokenIconUri] = useState<string>("")

  useEffect(() => {
    const url = new URL(window.location.href)
    const params = new URLSearchParams(url.search)
    const readTokenId = params.get("tokenId")
    if (!readTokenId) return
    setTokenId(readTokenId)
    setIsLoadingTokenInfo(true)
    lookUpTokenData(readTokenId)
    fetchMetadata(readTokenId)
    checkOtrStatus(readTokenId)
  }, [])

  useEffect(() => {
    const imageOrIconUri = metadataInfo?.tokenMetadata?.uris?.image ?? metadataInfo?.tokenMetadata?.uris?.icon
    if (imageOrIconUri) {
      if (!imageOrIconUri.startsWith('ipfs://')) {
        setTokenIconUri(imageOrIconUri)
      } else {
        const path = imageOrIconUri.replace('ipfs://', '')
        setTokenIconUri(IPFS_GATEWAY + path)
      }
    }
  }, [metadataInfo])

  useEffect(() => {
    if (tokenInfo) setIsLoadingTokenInfo(false)
  }, [tokenInfo])

  function clearExistingInfo() {
    setTokenInfo(undefined)
    setMetadataInfo(undefined)
    setTokenIconUri("")
  }

  function handleSearch() {
    clearExistingInfo()
    setIsLoadingTokenInfo(true)
    lookUpTokenData(tokenId)
    fetchMetadata(tokenId)
    checkOtrStatus(tokenId)
  }

  async function checkOtrStatus(tokenId: string) {
    const isOtrVerified = await checkOtrVerified(tokenId)
    setMetadataInfo(prev => prev ? { ...prev, isOtrVerified } : { isOtrVerified })
  }

  async function fetchMetadata(tokenId: string) {
    let tokenMetadataResult: tokenMetadata | undefined
    let metaDataLocation = ""
    let httpsUrl: string | undefined
    let authchainUpdates = 0
    let metadataHashMatch: boolean | undefined = undefined
    let isSchemaValid: boolean | undefined = undefined

    try {
      const authChain = await BCMR.fetchAuthChainFromChaingraph({
        chaingraphUrl: CHAINGRAPH_URL,
        transactionHash: tokenId
      })
      console.log(authChain)

      const latestAuthChainEntry = authChain.at(-1)
      if (latestAuthChainEntry) {
        authchainUpdates = authChain.length
        const bcmrLocation = latestAuthChainEntry.uris[0]
        httpsUrl = latestAuthChainEntry.httpsUrl
        if (!bcmrLocation || !httpsUrl) return

        const providedHash = latestAuthChainEntry.contentHash
        if (bcmrLocation.startsWith("ipfs://")) {
          httpsUrl = bcmrLocation.replace("ipfs://", IPFS_GATEWAY)
        }
        metaDataLocation = bcmrLocation

        try {
          console.log("Importing an on-chain resolved BCMR!")
          await BCMR.addMetadataRegistryFromUri(httpsUrl)
          const rawTokenMetadata = BCMR.getTokenInfo(tokenId)

          // Validate token metadata against BCMR schema
          const validationResult = TokenMetadataSchema.safeParse(rawTokenMetadata)
          if (validationResult.success) {
            tokenMetadataResult = rawTokenMetadata as tokenMetadata
            isSchemaValid = true
          } else {
            console.error('Token metadata schema validation failed:', validationResult.error.issues)
            tokenMetadataResult = rawTokenMetadata as tokenMetadata
            isSchemaValid = false
          }

          const response = await fetch(httpsUrl)
          if (!response.ok) {
            metadataHashMatch = false
            throw new Error(`Failed to fetch BCMR content from ${httpsUrl}: ${response.status} ${response.statusText}`)
          }
          const bcmrContent = await response.text()
          const contentHash = binToHex(sha256.hash(utf8ToBin(bcmrContent)))
          metadataHashMatch = contentHash === providedHash
        } catch (e) {
          console.log(e)
        }
      }
    } catch (error) {
      console.log(error)
    }

    setMetadataInfo(prev => ({
      ...prev,
      metaDataLocation,
      tokenMetadata: tokenMetadataResult,
      httpsUrl,
      authchainUpdates,
      metadataHashMatch,
      isSchemaValid
    }))
  }

  async function lookUpTokenData(tokenId: string) {
    try {
      const [
        respJsonGenesisSupply,
        respJsonAllTokenHolders,
        respJsonSupplyNFTs,
        respJsonActiveMinting,
        respJsonAuthchainLength
      ] = await Promise.all([
        queryGenesisSupplyFT(tokenId),
        queryAllTokenHolders(tokenId),
        querySupplyNFTs(tokenId),
        queryActiveMinting(tokenId),
        queryAuthchainLength(tokenId)
      ])

      if (!respJsonGenesisSupply || !respJsonAllTokenHolders || !respJsonSupplyNFTs || !respJsonActiveMinting || !respJsonAuthchainLength) {
        throw new Error("Error in Chaingraph fetches")
      }

      // Parse genesis supply
      const genesisTransaction = respJsonGenesisSupply.transaction[0]
      const genesisTx = genesisTransaction?.hash?.substring(2)
      const blockTimestamp = genesisTransaction?.block_inclusions?.[0]?.block?.timestamp
      const genesisTxTimestamp = blockTimestamp ? Number(blockTimestamp) : undefined
      const nodeName = genesisTransaction?.block_inclusions?.[0]?.block?.accepted_by?.[0]?.node?.name
      const network = nodeName?.includes('chipnet') ? 'chipnet' : 'mainnet'

      let genesisSupplyFT = 0
      if (genesisTransaction?.outputs) {
        genesisSupplyFT = genesisTransaction.outputs.reduce(
          (total: number, output) => total + parseInt(output?.fungible_token_amount ?? '0'),
          0
        )
      }

      // Calculate totalSupplyNFTs with pagination
      let totalSupplyNFTs = respJsonSupplyNFTs.output.length
      let indexOffset = 0
      let fullListNftHolders = respJsonSupplyNFTs.output

      while (totalSupplyNFTs === 5000) {
        indexOffset += 1
        const respJsonSupplyNFTs2 = await querySupplyNFTs(tokenId, 5000 * indexOffset)
        if (!respJsonSupplyNFTs2) throw new Error("Error in querySupplyNFTs")
        fullListNftHolders = fullListNftHolders.concat(respJsonSupplyNFTs2.output)
        totalSupplyNFTs += respJsonSupplyNFTs2.output.length
      }

      // Count minting NFTs
      const mintingNFTs = fullListNftHolders.filter(
        (o: { nonfungible_token_capability: string | null }) => o.nonfungible_token_capability === 'minting'
      ).length

      // Parse hasActiveMintingToken
      const hasActiveMintingToken = Boolean(respJsonActiveMinting.output.length)

      // Parse authchain data with intermediate variables
      const authchainData = respJsonAuthchainLength.transaction[0]?.authchains?.[0]
      const authheadData = authchainData?.authhead
      const identityOutput = authheadData?.identity_output?.[0]

      const authchainLength = authchainData?.authchain_length ?? 0
      const authHead = authheadData?.hash?.slice(2) ?? ''
      const reservedSupplyFT = +(identityOutput?.fungible_token_amount ?? 0)
      const authHeadLockingBytecode = identityOutput?.locking_bytecode as string | undefined

      // Parse authhead timestamp and check if it's a metadata update
      const authHeadBlockTimestamp = authheadData?.block_inclusions?.[0]?.block?.timestamp
      const authHeadTimestamp = authHeadBlockTimestamp ? Number(authHeadBlockTimestamp) : undefined
      const authHeadOutputs = authheadData?.outputs as Array<{ output_index: number, locking_bytecode: string }> | undefined
      // BCMR OP_RETURN prefix: 6a (OP_RETURN) + 04 (OP_PUSH4) + 42434d52 ("BCMR")
      const BCMR_OP_RETURN_PREFIX = '6a0442434d52'
      const authHeadIsMetadataUpdate = authHeadOutputs?.some(
        output => output.locking_bytecode?.slice(2).toLowerCase().startsWith(BCMR_OP_RETURN_PREFIX)
      ) ?? false

      let authHeadAddress: string | undefined
      let usesAuthGuard = false
      if (authHeadLockingBytecode) {
        const bytecodeHex = authHeadLockingBytecode.slice(2)
        usesAuthGuard = bytecodeHex.startsWith('a914')
        const authHeadAddressResult = lockingBytecodeToCashAddress({
          bytecode: hexToBin(bytecodeHex),
          prefix: 'bitcoincash'
        })
        authHeadAddress = typeof authHeadAddressResult === 'string' ? undefined : authHeadAddressResult.address
      }

      // Calculate supply stats
      const totalSupplyFT = calculateTotalSupplyFT(respJsonAllTokenHolders.output)
      const circulatingSupplyFT = calculateCirculatingSupplyFT(respJsonAllTokenHolders.output, reservedSupplyFT)

      // Calculate holder stats
      const listHoldingAddresses = genesisSupplyFT ? respJsonAllTokenHolders.output : fullListNftHolders
      const { numberHolders, numberTokenAddresses } = countUniqueHolders(listHoldingAddresses)

      setTokenInfo({
        genesisSupplyFT,
        totalSupplyFT,
        totalSupplyNFTs,
        mintingNFTs,
        hasActiveMintingToken,
        genesisTx,
        genesisTxTimestamp,
        authchainLength,
        authHead,
        authHeadAddress,
        authHeadTimestamp,
        authHeadIsMetadataUpdate,
        usesAuthGuard,
        circulatingSupplyFT,
        reservedSupplyFT,
        numberHolders,
        numberTokenAddresses,
        network
      })
    } catch (error) {
      console.log(error)
      alert("The input is not a valid tokenId!")
      setTokenInfo(undefined)
    }
  }

  return (
    <>
      <Head>
        <title>Token Explorer</title>
        <meta name="description" content="Token explorer for CashTokens" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <h1 className={styles.title}>BCMR Token Explorer</h1>
        <div style={{ display: "block" }}>
          <TokenSearch
            tokenId={tokenId}
            isLoading={isLoadingTokenInfo}
            hasTokenInfo={!!tokenInfo}
            onTokenIdChange={setTokenId}
            onSearch={handleSearch}
          />

          {tokenInfo && (
            <div style={{ marginTop: "20px", overflowWrap: "anywhere", maxWidth: "570px" }}>
              <div className={styles.description}>
                {tokenInfo.network === 'chipnet' && (
                  <div style={{ marginBottom: "10px" }}>
                    Network: chipnet
                  </div>
                )}
                <MetadataDisplay
                  metadataInfo={metadataInfo}
                  tokenIconUri={tokenIconUri}
                />
                <SupplyStats
                  tokenInfo={tokenInfo}
                  metadataInfo={metadataInfo}
                />
                <AuthchainInfo
                  tokenInfo={tokenInfo}
                  metadataInfo={metadataInfo}
                />
                {tokenInfo.network === 'mainnet' && (
                  <div style={{ marginTop: "10px" }}>
                    Cross-check with{" "}
                    <a
                      href={`https://explorer.salemkode.com/token/${tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline", textDecoration: "none" }}
                    >
                      SalemKode explorer&apos;s token page
                    </a>
                  </div>
                )}
                <div style={{ marginTop: "10px" }}>
                  Paytaca BCMR indexer ({tokenInfo.network}):{" "}
                  <a
                    href={`https://${tokenInfo.network === 'chipnet' ? 'bcmr-chipnet' : 'bcmr'}.paytaca.com/api/tokens/${tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline", textDecoration: "none" }}
                  >
                    view /tokens endpoint
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
