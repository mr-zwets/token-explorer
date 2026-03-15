import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import { BCMR } from '@mainnet-cash/bcmr'
import { utf8ToBin, sha256, binToHex, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth'
import React, { useEffect, useRef, useState } from 'react'
import { queryGenesisInfo, queryIssuingUtxos, queryAuthchain, queryAllTokenHolders, queryGenesisCategories } from '../utils/queryChainGraph'
import { countUniqueHolders, calculateTotalSupplyFT } from '../utils/calculations'
import { checkOtrVerified } from '../utils/otrRegistry'
import { IdentitySnapshotSchema } from '../utils/bcmrSchema'
import type { TokenInfo, ExtendedTokenInfo, MetadataInfo, TokenMetadata, AuthchainEntry, Diagnostic, ReservedSupplyUtxo, ElectrumVerification } from '@/interfaces'
import { CHAINGRAPH_URL, IPFS_GATEWAY } from '@/constants'
import { verifySupplyViaElectrum } from '@/utils/queryElectrum'
import { TokenSearch, MetadataDisplay, SupplyStats, AuthchainInfo } from '@/components'

export default function Home() {
  const [tokenId, setTokenId] = useState<string>("")
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState<boolean>(false)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>()
  const [extendedTokenInfo, setExtendedTokenInfo] = useState<ExtendedTokenInfo>()
  const [tokenInfoError, setTokenInfoError] = useState<string>()
  const [extendedTokenInfoError, setExtendedTokenInfoError] = useState<string>()
  const [metadataInfo, setMetadataInfo] = useState<MetadataInfo>()
  const [tokenIconUri, setTokenIconUri] = useState<string>("")
  const [electrumVerification, setElectrumVerification] = useState<ElectrumVerification>()

  useEffect(() => {
    const url = new URL(window.location.href)
    const params = new URLSearchParams(url.search)
    const readTokenId = params.get("tokenId")
    if (!readTokenId) return
    searchToken(readTokenId)
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
    if (tokenInfo) {
      setIsLoadingTokenInfo(false)
    }
  }, [tokenInfo])

  // Resolves when metadata has been set, so lookUpTokenData can wait briefly for it
  const metadataReadyRef = useRef<{ resolve: () => void } | null>(null)

  function searchToken(id: string) {
    setTokenId(id)
    setTokenInfo(undefined)
    setTokenInfoError(undefined)
    setExtendedTokenInfo(undefined)
    setExtendedTokenInfoError(undefined)
    setMetadataInfo(undefined)
    setTokenIconUri("")
    setElectrumVerification(undefined)
    setIsLoadingTokenInfo(true)
    const metadataReadyPromise = new Promise<void>(resolve => {
      metadataReadyRef.current = { resolve }
    })
    lookUpTokenData(id, metadataReadyPromise)
    fetchMetadata(id)
    checkOtrStatus(id)
    const params = new URLSearchParams(window.location.search)
    params.set("tokenId", id)
    window.history.replaceState({}, "", `${location.pathname}?${params}`)
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
          if (!tokenMetadata || typeof tokenMetadata !== 'object') {
            // Registry was fetched but doesn't contain an entry for this tokenId
            // This typically means the txid is not a token category
            console.log('No metadata entry found for this tokenId in the resolved registry')
          } else {
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
    metadataReadyRef.current?.resolve()
  }

  async function lookUpTokenData(tokenId: string, metadataReady: Promise<void>) {
    // Start holder query early so it runs in parallel, but await it in Phase 2
    const holderDataPromise = queryAllTokenHolders(tokenId)
    let network: 'mainnet' | 'chipnet' = 'mainnet'
    let authHead = ''
    let authHeadVout = 0
    let authHeadAddress: string | undefined

    try {
      // Start all queries in parallel, but don't block on the slow holder query
      console.time('initialDataLoad')

      const [
        respJsonGenesisSupply,
        respJsonIssuingUtxos,
        respJsonAuthchain
      ] = await Promise.all([
        queryGenesisInfo(tokenId),
        queryIssuingUtxos(tokenId),
        queryAuthchain(tokenId)
      ])

      if (!respJsonGenesisSupply || !respJsonIssuingUtxos || !respJsonAuthchain) {
        console.error("Error in Chaingraph fetches: one or more queries returned null")
        setTokenInfoError("Failed to load token data from Chaingraph")
        setIsLoadingTokenInfo(false)
        return
      }

      // Check if the transaction exists on-chain (authchain query finds it by hash)
      const validTxId = respJsonAuthchain.transaction.length > 0

      // Parse genesis supply
      const genesisTransaction = respJsonGenesisSupply.transaction[0]
      const genesisTx = genesisTransaction?.hash?.substring(2)
      const blockTimestamp = genesisTransaction?.block_inclusions?.[0]?.block?.timestamp
      const genesisTxTimestamp = blockTimestamp ? Number(blockTimestamp) : undefined
      const nodeName = respJsonAuthchain.transaction[0]?.block_inclusions?.[0]?.block?.accepted_by?.[0]?.node?.name
      network = nodeName?.includes('chipnet') ? 'chipnet' : 'mainnet'

      let genesisSupplyFT = 0
      let hasGenesisNFTs = false
      if (genesisTransaction?.outputs) {
        genesisSupplyFT = genesisTransaction.outputs.reduce(
          (total: number, output) => total + parseInt(output?.fungible_token_amount ?? '0'),
          0
        )
        hasGenesisNFTs = genesisTransaction.outputs.some(
          output => output.nonfungible_token_capability != null
        )
      }

      // Parse reserved supply UTXOs (minting + mutable NFT UTXOs)
      const reservedSupplyUtxos: ReservedSupplyUtxo[] = respJsonIssuingUtxos.output.map(o => ({
        txHash: (o.transaction_hash as string).slice(2),
        vout: Number(o.output_index),
        lockingBytecode: (o.locking_bytecode as string).slice(2),
        fungibleTokenAmount: parseInt(o.fungible_token_amount ?? "0"),
        nftCapability: o.nonfungible_token_capability as 'minting' | 'mutable'
      }))
      const hasActiveMintingToken = reservedSupplyUtxos.some(utxo => utxo.nftCapability === "minting")
      const covenantReservedFT = reservedSupplyUtxos.reduce(
        (total, u) => total + u.fungibleTokenAmount, 0
      )

      // Parse authchain data with intermediate variables
      const authchainData = respJsonAuthchain.transaction[0]?.authchains?.[0]
      const authheadData = authchainData?.authhead
      const identityOutput = authheadData?.identity_output?.[0]

      const authchainLength = authchainData?.authchain_length ?? 0
      authHead = authheadData?.hash?.slice(2) ?? ''
      const authheadReservedFT = +(identityOutput?.fungible_token_amount ?? 0)
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

      // Phase 1: set initial tokenInfo from fast queries
      console.timeEnd('initialDataLoad')
      const validTokenCategory = genesisSupplyFT > 0 || hasGenesisNFTs

      // If not a valid token category, check if this tx is a genesis tx for other categories
      let tokenCategoriesInTx: string[] | undefined
      if (!validTokenCategory && validTxId) {
        const respTokenOutputs = await queryGenesisCategories(tokenId)
        if (respTokenOutputs?.transaction?.[0]) {
          const tx = respTokenOutputs.transaction[0]
          const input0Hash = tx.inputs?.[0]?.outpoint_transaction_hash
          if (input0Hash) {
            const genesisCategories = new Set<string>()
            for (const output of tx.outputs ?? []) {
              if (output.token_category === input0Hash) {
                genesisCategories.add(output.token_category.slice(2))
              }
            }
            if (genesisCategories.size > 0) {
              tokenCategoriesInTx = [...genesisCategories]
            }
          }
        }
      }

      // Wait up to 200ms for metadata to arrive, to avoid a flash of content without metadata
      await Promise.race([
        metadataReady,
        new Promise(resolve => setTimeout(resolve, 200))
      ])

      // Add authhead identity output to reserved supply UTXOs if it holds FT
      authHeadVout = Number(identityOutput?.output_index ?? 0)
      const authHeadAlreadyIncluded = reservedSupplyUtxos.some(
        u => u.txHash === authHead && u.vout === authHeadVout
      )
      if (authHeadAlreadyIncluded) {
        // Mark the existing entry as authhead
        const existing = reservedSupplyUtxos.find(utxo => utxo.txHash === authHead && utxo.vout === authHeadVout)
        if (existing) existing.isAuthhead = true
      } else if (authheadReservedFT > 0 && authHeadLockingBytecode) {
        reservedSupplyUtxos.push({
          txHash: authHead,
          vout: authHeadVout,
          lockingBytecode: authHeadLockingBytecode.slice(2),
          fungibleTokenAmount: authheadReservedFT,
          nftCapability: identityOutput?.nonfungible_token_capability as 'minting' | 'mutable' | null ?? null,
          isAuthhead: true
        })
      }

      const reservedSupplyFT = covenantReservedFT + (authHeadAlreadyIncluded ? 0 : authheadReservedFT)

      setTokenInfo({
        validTxId,
        validTokenCategory,
        tokenCategoriesInTx,
        hasGenesisNFTs,
        genesisSupplyFT,
        hasActiveMintingToken,
        reservedSupplyUtxos,
        reservedSupplyFT,
        genesisTx,
        genesisTxTimestamp,
        authchainLength,
        authHead,
        authHeadAddress,
        authHeadTimestamp,
        authHeadIsMetadataUpdate,
        usesAuthGuard,
        network,
        authchainMigrations: filteredMigrations
      })
    } catch (error) {
      console.error("Error in initial data load:", error)
      setTokenInfoError("Failed to load token data from Chaingraph")
      setIsLoadingTokenInfo(false)
      return
    }

    // Phase 2: await holder data (already started in parallel)
    try {
      console.time('queryAllTokenHolders')
      const respJsonAllTokenHolders = await holderDataPromise
      console.timeEnd('queryAllTokenHolders')
      if (!respJsonAllTokenHolders) {
        setExtendedTokenInfoError("Failed to load holder & supply data")
        return
      }

      // Paginate queryAllTokenHolders (returns max 5000 per page)
      let allTokenOutputs = respJsonAllTokenHolders.output
      let lastBatchSize = allTokenOutputs.length
      let indexOffset = 0

      while (lastBatchSize === 5000) {
        indexOffset += 1
        console.time(`queryAllTokenHolders page ${indexOffset + 1}`)
        const nextPage = await queryAllTokenHolders(tokenId, 5000 * indexOffset)
        console.timeEnd(`queryAllTokenHolders page ${indexOffset + 1}`)
        if (!nextPage) {
          setExtendedTokenInfoError("Failed to load holder & supply data (pagination error)")
          return
        }
        allTokenOutputs = allTokenOutputs.concat(nextPage.output)
        lastBatchSize = nextPage.output.length
      }

      // Calculate totalSupplyNFTs
      const totalSupplyNFTs = allTokenOutputs.filter(
        (o: { nonfungible_token_capability: string | null }) => o.nonfungible_token_capability !== null
      ).length

      // Calculate supply stats
      const totalSupplyFT = calculateTotalSupplyFT(allTokenOutputs)

      // Calculate holder stats
      const { numberHolders, numberTokenAddresses, userSupplyFT, contractSupplyFT } = countUniqueHolders(allTokenOutputs)

      // Set extended token info (supply & holder data)
      setExtendedTokenInfo({
        totalSupplyFT,
        totalSupplyNFTs,
        numberHolders,
        numberTokenAddresses,
        userSupplyFT,
        contractSupplyFT,
      })

      // Phase 3: Verify supply via Electrum (background, non-blocking)
      verifySupplyViaElectrum(allTokenOutputs, tokenId, network, authHead ? { txHash: authHead, vout: authHeadVout, address: authHeadAddress } : undefined).then(
        result => setElectrumVerification(result),
        error => {
          console.error("Electrum verification failed:", error)
          setElectrumVerification({
            verified: false,
            totalChaingraphUtxos: allTokenOutputs.length,
            totalElectrumUtxos: 0,
            staleCount: 0,
            missingCount: 0,
            chaingraphTotalFT: 0,
            electrumTotalFT: 0,
            electrumReservedFT: 0,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      )
    } catch (error) {
      console.error("Error in queryAllTokenHolders:", error)
      setExtendedTokenInfoError("Failed to load holder & supply data")
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
            onSearch={() => searchToken(tokenId)}
          />

          {tokenInfoError && (
            <div style={{ marginTop: "20px", overflowWrap: "anywhere", maxWidth: "570px" }}>
              <div className={styles.description}>
                <div style={{ padding: "12px 16px", backgroundColor: "#fdecea", border: "1px solid #d9534f", borderRadius: "6px", color: "#1a1a1a" }}>
                  {tokenInfoError}
                </div>
              </div>
            </div>
          )}

          {tokenInfo && !tokenInfo.validTxId && (
            <div style={{ marginTop: "20px", overflowWrap: "anywhere", maxWidth: "570px" }}>
              <div className={styles.description}>
                <div style={{ padding: "12px 16px", backgroundColor: "#e8f4fd", border: "1px solid #7ab8d9", borderRadius: "6px", color: "#1a1a1a" }}>
                  This is not a valid CashTokens tokenId. No transaction with this hash was found on the blockchain.
                </div>
              </div>
            </div>
          )}

          {tokenInfo && tokenInfo.validTxId && tokenInfo.validTokenCategory === false && (
            <div style={{ marginTop: "20px", overflowWrap: "anywhere", maxWidth: "570px" }}>
              <div className={styles.description}>
                <div style={{ padding: "12px 16px", backgroundColor: "#e8f4fd", border: "1px solid #7ab8d9", borderRadius: "6px", color: "#1a1a1a" }}>
                  This is not a valid CashTokens tokenId. The transaction exists on-chain but no tokens were created with this ID.
                  {tokenInfo.tokenCategoriesInTx && tokenInfo.tokenCategoriesInTx.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      This is a genesis transaction for the following tokenId{tokenInfo.tokenCategoriesInTx.length > 1 ? 's' : ''}:
                      {tokenInfo.tokenCategoriesInTx.map(cat => (
                        <div key={cat} style={{ marginTop: "4px" }}>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              searchToken(cat)
                            }}
                            style={{ textDecoration: "none", wordBreak: "break-all" }}
                          >
                            {cat}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tokenInfo && tokenInfo.validTokenCategory && (
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
                  extendedInfo={extendedTokenInfo}
                  extendedInfoError={extendedTokenInfoError}
                  metadataInfo={metadataInfo}
                  electrumVerification={electrumVerification}
                />
                <AuthchainInfo
                  tokenInfo={tokenInfo}
                  metadataInfo={metadataInfo}
                  electrumVerification={electrumVerification}
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
