import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import { BCMR } from '@mainnet-cash/bcmr'
import { utf8ToBin, sha256, binToHex, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth'
import { useEffect, useState } from 'react'
import { queryGenesisSupplyFT, queryActiveMinting, querySupplyNFTs, queryAuthchain, queryAllTokenHolders } from '../utils/queryChainGraph'
import { countUniqueHolders, calculateTotalSupplyFT, calculateCirculatingSupplyFT } from '../utils/calculations'
import { checkOtrVerified } from '../utils/otrRegistry'
import { IdentitySnapshotSchema } from '../utils/bcmrSchema'
import type { TokenInfo, MetadataInfo, TokenMetadata, AuthchainEntry, Diagnostic } from '@/interfaces'
import { CHAINGRAPH_URL, IPFS_GATEWAY } from '@/constants'
import { TokenSearch, MetadataDisplay, SupplyStats, AuthchainInfo } from '@/components'

export default function Home() {
  const [tokenId, setTokenId] = useState<string>("")
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState<boolean>(false)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>()
  const [metadataInfo, setMetadataInfo] = useState<MetadataInfo>()
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
    let tokenMetadataResult: TokenMetadata | undefined
    let metaDataLocation = ""
    let httpsUrl: string | undefined
    let authchainUpdates = 0
    let metadataHashMatch: boolean | undefined = undefined
    let isSchemaValid: boolean | undefined = undefined
    let authchainHistory: AuthchainEntry[] | undefined = undefined
    const diagnostics: Diagnostic[] = []

    try {
      const authChain = await BCMR.fetchAuthChainFromChaingraph({
        chaingraphUrl: CHAINGRAPH_URL,
        transactionHash: tokenId
      })
      console.log(authChain)

      const latestAuthChainEntry = authChain.at(-1)
      if (latestAuthChainEntry) {
        authchainUpdates = authChain.length

        // Store BCMR authchain entries for enrichment in the component
        authchainHistory = authChain.map(entry => ({
          txHash: entry.txHash,
          isMetadataUpdate: true,
          contentHash: entry.contentHash,
          httpsUrl: entry.httpsUrl,
          uris: entry.uris
        }))

        const bcmrLocation = latestAuthChainEntry.uris[0]
        httpsUrl = latestAuthChainEntry.httpsUrl
        if (!bcmrLocation || !httpsUrl) return

        const providedHash = latestAuthChainEntry.contentHash
        if (bcmrLocation.startsWith("ipfs://")) {
          httpsUrl = bcmrLocation.replace("ipfs://", IPFS_GATEWAY)
        }
        metaDataLocation = bcmrLocation

        // Step A: Import metadata registry from URL
        const isIpfs = bcmrLocation.startsWith('ipfs://') || httpsUrl.includes('/ipfs/')
        let importSucceeded = false
        try {
          console.log("Importing an on-chain resolved BCMR!")
          await BCMR.addMetadataRegistryFromUri(httpsUrl)
          importSucceeded = true
        } catch (e) {
          console.log(e)
          if (e instanceof TypeError && (e.message.includes('Failed to fetch') || e.message.includes('fetch'))) {
            diagnostics.push({
              type: 'fetch_failed',
              message: isIpfs
                ? 'Unable to fetch metadata from IPFS gateway. The gateway may be down, slow, or the content may not be pinned.'
                : 'Unable to fetch metadata from URL. This is likely a CORS issue — the server needs to include an Access-Control-Allow-Origin header.',
              details: `URL: ${httpsUrl}\nError: ${e.message}`
            })
          } else if (e instanceof SyntaxError) {
            diagnostics.push({
              type: 'invalid_json',
              message: isIpfs
                ? 'IPFS gateway returned non-JSON content. The gateway may be returning an error page or the pinned content is not valid JSON.'
                : 'Server returned non-JSON content. The URL may be serving an HTML error page or Cloudflare challenge.',
              details: `URL: ${httpsUrl}\nError: ${e.message}`
            })
          } else {
            diagnostics.push({
              type: 'fetch_failed',
              message: `Failed to import metadata registry: ${e instanceof Error ? e.message : String(e)}`,
              details: `URL: ${httpsUrl}`
            })
          }
        }

        if (importSucceeded) {
          // Step B: Schema validation
          const tokenMetadata = BCMR.getTokenInfo(tokenId)
          const validationResult = IdentitySnapshotSchema.safeParse(tokenMetadata)
          if (validationResult.success) {
            tokenMetadataResult = tokenMetadata as TokenMetadata
            isSchemaValid = true
          } else {
            console.error('Token metadata schema validation failed:', validationResult.error.issues)
            tokenMetadataResult = tokenMetadata as TokenMetadata
            isSchemaValid = false
            const issueMessages = validationResult.error.issues.map(
              issue => `${issue.path.join('.')}: ${issue.message}`
            ).join('\n')
            diagnostics.push({
              type: 'schema_invalid',
              message: 'Token metadata does not fully conform to the BCMR schema.',
              details: issueMessages
            })
          }

          // Step C: Hash verification
          try {
            const response = await fetch(httpsUrl)
            if (!response.ok) {
              metadataHashMatch = false
              diagnostics.push({
                type: 'http_error',
                message: `HTTP ${response.status} when fetching metadata for hash verification.`,
                details: `URL: ${httpsUrl}\nStatus: ${response.status} ${response.statusText}`
              })
            } else {
              const bcmrContent = await response.text()
              const contentHash = binToHex(sha256.hash(utf8ToBin(bcmrContent)))
              metadataHashMatch = contentHash === providedHash
              if (!metadataHashMatch) {
                diagnostics.push({
                  type: 'hash_mismatch',
                  message: 'On-chain content hash does not match the fetched metadata content.',
                  details: `expected: ${providedHash}\nactual: ${contentHash}`
                })
              }
            }
          } catch (e) {
            console.log(e)
            if (e instanceof TypeError && (e.message.includes('Failed to fetch') || e.message.includes('fetch'))) {
              diagnostics.push({
                type: 'fetch_failed',
                message: isIpfs
                  ? 'Unable to re-fetch metadata from IPFS gateway for hash verification.'
                  : 'Unable to re-fetch metadata for hash verification (likely CORS).',
                details: `URL: ${httpsUrl}\nError: ${(e as Error).message}`
              })
            } else {
              diagnostics.push({
                type: 'fetch_failed',
                message: `Hash verification fetch failed: ${e instanceof Error ? e.message : String(e)}`,
                details: `URL: ${httpsUrl}`
              })
            }
          }
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
      isSchemaValid,
      authchainHistory,
      diagnostics: diagnostics.length > 0 ? diagnostics : undefined
    }))
  }

  async function lookUpTokenData(tokenId: string) {
    try {
      const [
        respJsonGenesisSupply,
        respJsonAllTokenHolders,
        respJsonSupplyNFTs,
        respJsonActiveMinting,
        respJsonAuthchain
      ] = await Promise.all([
        queryGenesisSupplyFT(tokenId),
        queryAllTokenHolders(tokenId),
        querySupplyNFTs(tokenId),
        queryActiveMinting(tokenId),
        queryAuthchain(tokenId)
      ])

      if (!respJsonGenesisSupply || !respJsonAllTokenHolders || !respJsonSupplyNFTs || !respJsonActiveMinting || !respJsonAuthchain) {
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
      const authchainData = respJsonAuthchain.transaction[0]?.authchains?.[0]
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

      // Parse authchain migrations into AuthchainEntry[]
      const migrations = authchainData?.migrations

      const authchainMigrations: AuthchainEntry[] = (migrations ?? []).map(m => {
        const tx = Array.isArray(m.transaction) ? m.transaction[0] : m.transaction
        const txHash = (tx?.hash ?? '').slice(2)
        const blockTimestamp = tx?.block_inclusions?.[0]?.block?.timestamp
        const timestamp = blockTimestamp ? Number(blockTimestamp) : undefined
        const bcmrOutput = tx?.outputs?.find(
          output => output.locking_bytecode?.slice(2).toLowerCase().startsWith(BCMR_OP_RETURN_PREFIX)
        )
        const isMetadataUpdate = !!bcmrOutput
        const opReturnHex = bcmrOutput ? bcmrOutput.locking_bytecode?.slice(2) : undefined
        return { txHash, timestamp, isMetadataUpdate, opReturnHex }
      })
      // Remove pre-genesis migrations (Chaingraph includes the funding tx)
      const genesisIndex = authchainMigrations.findIndex(m => m.txHash === genesisTx)
      const filteredMigrations = genesisIndex >= 0 ? authchainMigrations.slice(genesisIndex) : authchainMigrations

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
        network,
        authchainMigrations: filteredMigrations
      })
    } catch (error) {
      console.log(error)
      alert("The input is not a valid tokenId!")
      setTokenInfo(undefined)
      setIsLoadingTokenInfo(false)
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
                  <div>
                    <hr />
                    <div style={{ marginTop: "10px" }}>Cross-check with{" "}
                    <a
                      href={`https://explorer.salemkode.com/token/${tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline", textDecoration: "none" }}
                    >
                      SalemKode explorer&apos;s token page
                    </a>
                    </div>
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
