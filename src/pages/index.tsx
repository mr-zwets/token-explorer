import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import { BCMR } from '@mainnet-cash/bcmr'
import { utf8ToBin, sha256, binToHex } from 'mainnet-js'
import { useEffect, useState } from 'react'
import { queryGenesisSupplyFT, queryActiveMinting, querySupplyNFTs, queryAuthchainLength, queryAllTokenHolders } from '../utils/queryChainGraph';
import { formatTimestamp } from '@/utils/utils'
import type { tokenInfo, metadataInfo, tokenMetadata } from '@/interfaces'

const blockExplorerUrl = "https://cashnode.bch.ninja/tx/";
const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql";
const ipfsGateway = "https://w3s.link/ipfs/";;

export default function Home() {
  const [tokenId, setTokenId] = useState<string>("");
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState<boolean>(false);
  const [tokenInfo, setTokenInfo] = useState<tokenInfo>();
  const [metadataInfo, setMetadataInfo] = useState<metadataInfo>();
  const [tokenIconUri, setTokenIconUri] = useState<string>("")

  const handleChange = (e:any) => {
    if((e.target as HTMLInputElement)){
      const tokenId = e.target.value;
      setTokenId(tokenId);
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      params.set("tokenId", tokenId);
      window.history.replaceState({}, "", `${location.pathname}?${params}`);
    }
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const readTokenId = params.get("tokenId");
    if(!readTokenId) return
    setTokenId(readTokenId);
    setIsLoadingTokenInfo(true);
    lookUpTokenData(readTokenId);
    fetchMetadata(readTokenId);
  },[]);

  // Sets tokenIconUri when metadataInfo changes
  useEffect(() => {
    (async () => {
      const imageOrIconUri = metadataInfo?.tokenMetadata?.uris?.image ?? metadataInfo?.tokenMetadata?.uris?.icon
      if(imageOrIconUri) {
        if (!imageOrIconUri?.startsWith('ipfs://')) return setTokenIconUri(imageOrIconUri)
        const path = imageOrIconUri.replace('ipfs://','')
        setTokenIconUri(ipfsGateway + path)
      } 
    })()
  }, [metadataInfo])

  useEffect(() => {
    if(tokenInfo) setIsLoadingTokenInfo(false)
  }, [tokenInfo])

  async function clearExistingInfo(){
    setTokenInfo(undefined);
    setMetadataInfo(undefined)
    setTokenIconUri("")
  }

  async function fetchMetadata(tokenId:string){
    let metadataInfo:tokenMetadata | undefined;
    let metaDataLocation= "";
    let httpsUrl;
    let authchainUpdates= 0;
    let metadataHashMatch = undefined;
    try{
      const authChain = await BCMR.fetchAuthChainFromChaingraph({
        chaingraphUrl: chaingraphUrl,
        transactionHash: tokenId
      });
      console.log(authChain)
      if(authChain.at(-1)){
        authchainUpdates = authChain.length;
        const bcmrLocation = authChain.at(-1)?.uris[0];
        httpsUrl = authChain.at(-1)?.httpsUrl;
        if(!bcmrLocation || !httpsUrl) return;
        const providedHash = authChain.at(-1)?.contentHash;
        // use own gateway
        if(bcmrLocation.startsWith("ipfs://")) httpsUrl = bcmrLocation.replace("ipfs://", ipfsGateway);
        metaDataLocation = bcmrLocation;

        // fetch httpsUrl of BCMR for tokenInfo
        try{
          console.log("Importing an on-chain resolved BCMR!");
          await BCMR.addMetadataRegistryFromUri(httpsUrl);
          metadataInfo = BCMR.getTokenInfo(tokenId) as tokenMetadata;
          const reponse = await fetch(httpsUrl);
          if(!reponse.ok){
            metadataHashMatch = false;
            throw new Error(`Failed to fetch BCMR content from ${httpsUrl}: ${reponse.status} ${reponse.statusText}`);
          }
          const bcmrContent = await reponse.text();
          const contentHash = binToHex(sha256.hash(utf8ToBin(bcmrContent)));
          metadataHashMatch = contentHash === providedHash;
        }catch(e){ console.log(e) }
      }
    } catch(error){ console.log(error) }

    const newMetadataInfo:metadataInfo = {...tokenInfo, metaDataLocation, tokenMetadata:metadataInfo, httpsUrl, authchainUpdates, metadataHashMatch}

    setMetadataInfo(newMetadataInfo);
  }

  const lookUpTokenData = async (tokenId:string) => {
    try{
      const promiseGenesisSupply = queryGenesisSupplyFT(tokenId);
      const promiseAllTokenHolders = queryAllTokenHolders(tokenId);
      const promiseSupplyNFTs = querySupplyNFTs(tokenId);
      const promiseActiveMinting = queryActiveMinting(tokenId);
      const promiseAuthchainLength = queryAuthchainLength(tokenId);
      const [respJsonGenesisSupply,respJsonAllTokenHolders,respJsonSupplyNFTs,respJsonActiveMinting,respJsonAuthchainLength] = await Promise.all(
        [promiseGenesisSupply,promiseAllTokenHolders,promiseSupplyNFTs,promiseActiveMinting,promiseAuthchainLength]
      );
      if(!respJsonGenesisSupply || !respJsonAllTokenHolders || !respJsonSupplyNFTs || !respJsonActiveMinting || !respJsonAuthchainLength){
        throw new Error("Error in Chaingraph fetches")
      }
      // calculate genesisSupplyFT
      const genesisTx = respJsonGenesisSupply?.transaction[0]?.hash?.substring(2);
      const blockTimestamp = respJsonGenesisSupply.transaction[0].block_inclusions?.[0]?.block?.timestamp;
      const genesisTxTimestamp = blockTimestamp ? Number(blockTimestamp) : undefined;
      let genesisSupplyFT = 0;
      if(respJsonGenesisSupply.transaction[0].outputs){
        genesisSupplyFT = respJsonGenesisSupply.transaction[0].outputs.reduce(
          (total:number, output) => 
            total + parseInt(output?.fungible_token_amount ?? '0'),
          0
        );
      }
      // calculate totalSupplyNFTs
      let totalSupplyNFTs = respJsonSupplyNFTs.output.length;
      let indexOffset = 0;
      // limit of items returned by chaingraphquery is 5000
      let fullListNftHolders = respJsonSupplyNFTs.output
      while (totalSupplyNFTs == 5000) {
        indexOffset += 1;
        const respJsonSupplyNFTs2 = await querySupplyNFTs(tokenId, 5000 * indexOffset);
        if(!respJsonSupplyNFTs2) throw new Error("Error in querySupplyNFTs")
        fullListNftHolders = fullListNftHolders.concat(respJsonSupplyNFTs2.output);
        totalSupplyNFTs += respJsonSupplyNFTs2.output.length;
      }
      // parse hasActiveMintingToken
      const hasActiveMintingToken = Boolean(respJsonActiveMinting.output.length);
      // parse autchainLength, authHead
      const authchainLength = respJsonAuthchainLength.transaction[0].authchains[0].authchain_length ?? 0;
      const resultAuthHead = respJsonAuthchainLength.transaction[0].authchains?.[0]?.authhead?.hash as string;
      const authHead = resultAuthHead.slice(2);
      // parse reservedSupplyFT
      const respReservedSupplyFT = respJsonAuthchainLength.transaction[0].authchains?.[0]?.authhead?.identity_output?.[0].fungible_token_amount as string;
      const reservedSupplyFT:number = +respReservedSupplyFT;

      const supplyFtMinusMintingCovenants = respJsonAllTokenHolders.output.reduce(
        (total:number, output) => output.fungible_token_amount && output.nonfungible_token_capability != "minting" ?
          total + parseInt(output.fungible_token_amount) : 0,
        0
      );
      const circulatingSupplyFT = supplyFtMinusMintingCovenants - reservedSupplyFT;
      const totalSupplyFT = respJsonAllTokenHolders.output.reduce(
        (total:number, output) => 
          total + parseInt(output.fungible_token_amount ?? "0"),
        0
      );
      const listHoldingAddresses = genesisSupplyFT ? respJsonAllTokenHolders.output : fullListNftHolders 
      const uniqueLockingBytecodes = new Set(listHoldingAddresses.map(output => output.locking_bytecode.slice(2)));
      const numberHolders = Array.from(uniqueLockingBytecodes).filter(locking_bytecode =>
        locking_bytecode.startsWith('76a914')
      ).length;
      const numberTokenAddresses = uniqueLockingBytecodes.size;

      setTokenInfo({
        genesisSupplyFT,
        totalSupplyFT,
        totalSupplyNFTs,
        hasActiveMintingToken,
        genesisTx,
        genesisTxTimestamp,
        authchainLength,
        authHead,
        circulatingSupplyFT,
        reservedSupplyFT,
        numberHolders,
        numberTokenAddresses
      });
    } catch(error){
      console.log(error);
      alert("The input is not a valid tokenId!")
      setTokenInfo(undefined);
    }
  }

  const toPercentage = (decimalNumber:number) => (Math.round(decimalNumber *10000)/100).toFixed(2)

  const displayTokenAmount = (amount:number) => {
    const amountDecimals = amount / (10 ** (metadataInfo?.tokenMetadata?.token?.decimals ?? 0))
    return amountDecimals.toLocaleString("en-GB") + ' ' + (metadataInfo?.tokenMetadata?.token?.symbol ?? '')
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
        <div style={{display:"block"}}>      
          <h2 className={styles.description}>Enter tokenId: </h2>
          <input
             className={styles.description}
             style={{width:"80vw", maxWidth:"570px",padding:"10px 20px"}}
            type="text"
            id="tokenId"
            value={tokenId}
            onChange={(e) => handleChange(e)}
            onKeyDown ={(e) => {
              if(e.key === 'Enter'){
                clearExistingInfo()
                setIsLoadingTokenInfo(true);
                lookUpTokenData(tokenId);
                fetchMetadata(tokenId);
              } 
            }}
          ></input>
          { isLoadingTokenInfo && !tokenInfo && <div className={styles.description} style={{marginTop:"20px"}}>
              loading on-chain tokenInfo...
          </div>}

          {tokenInfo && <div style={{marginTop:"20px", overflowWrap:"anywhere",maxWidth:"570px"}}>
            <div className={styles.description}>

              {metadataInfo?.metaDataLocation !== undefined? (
                metadataInfo.metaDataLocation == ""?
                (<> This token has no BCMR metadata linked on-chain <br/><br/> </>) : null
              ):<> loading metadata... <br/><br/></>}
              {metadataInfo && metadataInfo.tokenMetadata? (
                <>
                name: {metadataInfo.tokenMetadata.name} <br/><br/>
              </>):null}
              token type: 
                {(tokenInfo.genesisSupplyFT && !tokenInfo.totalSupplyNFTs)? " Fungible Token":null} 
                {(!tokenInfo.genesisSupplyFT && tokenInfo.totalSupplyNFTs)? " NFTs":null}
                {(tokenInfo.genesisSupplyFT && tokenInfo.totalSupplyNFTs)? " Both Fugible & Non-Fungible tokens":null} 
              <br/><br/>
              {metadataInfo && metadataInfo.tokenMetadata? (
                <>
                {metadataInfo.tokenMetadata.token? (<>
                  <div>symbol: {metadataInfo.tokenMetadata.token?.symbol}</div><br/>
                </>): null}
                {metadataInfo.tokenMetadata.token?.decimals? (<>
                  <div>decimals: {metadataInfo.tokenMetadata.token?.decimals}</div><br/>
                </>): null}
              </>):null}
              {/* tokenInfo.circulatingSupplyFT? (
                <>
                circulating supply: {
                  displayTokenAmount(tokenInfo.circulatingSupplyFT)
                } <br/><br/>
              </>):null */}
              {tokenInfo.genesisSupplyFT? (
                <>
                genesis supply: {
                  displayTokenAmount(tokenInfo.genesisSupplyFT)
                } <br/><br/>
              </>):null}
              {tokenInfo.totalSupplyNFTs? (
                <>total amount NFTs: {tokenInfo.totalSupplyNFTs.toLocaleString("en-GB")} <br/><br/></>
              ):null}
              {metadataInfo && metadataInfo.tokenMetadata? (
                <>
                  description: {metadataInfo?.tokenMetadata?.description} <br/><br/>
                  {metadataInfo?.tokenMetadata?.uris ? <>
                    web url: {metadataInfo.tokenMetadata.uris?.web? <a href={metadataInfo.tokenMetadata.uris?.web} target='_blank' rel="noreferrer" style={{display: "inline-block", color: "#00E"}}>
                      {metadataInfo.tokenMetadata.uris?.web}
                    </a>: "none"}<br/><br/>
                      other uris: {Object.keys(metadataInfo.tokenMetadata.uris).filter(uri => uri != "icon" && uri != "web").length ?
                        Object.keys(metadataInfo.tokenMetadata.uris).filter(uri => uri != "icon" && uri != "web").map((uriKey, index, array) =>
                          <span key={uriKey}>
                            <a href={metadataInfo?.tokenMetadata?.uris[uriKey]} target='_blank' rel="noreferrer" style={{ display: "inline-block", color: "#00E" }}>{uriKey}</a>
                            {(index != array.length - 1) ? ", " : null}
                          </span>
                        ) : "none"} <br /><br />
                  </>:null}
                {metadataInfo.tokenMetadata.uris?.icon && tokenIconUri ? <>
                <span style={{ verticalAlign:"top"}}>icon: </span>
                <div style={{ display:"flex", justifyContent: "center", marginBottom:"20px"}}>
                  <img className='tokenImage' style={{ width:"60vw", maxWidth: "400px"}} src={tokenIconUri} alt="tokenIcon"/>
                  <br/><br/>
                </div></>:null}
                {tokenInfo.genesisSupplyFT? (
                <>
                  {tokenInfo.genesisSupplyFT != tokenInfo.totalSupplyFT ? (
                  <>
                  <span> burned: {displayTokenAmount(tokenInfo.genesisSupplyFT - tokenInfo.totalSupplyFT)}</span>
                  <div>supply excluding burns: {displayTokenAmount(tokenInfo.totalSupplyFT)} </div><br/>
                  </>
                  ): null}
                  {tokenInfo.reservedSupplyFT? (
                    <>
                      circulating supply: {displayTokenAmount(tokenInfo.totalSupplyFT - tokenInfo.reservedSupplyFT)}
                      {` (${toPercentage((tokenInfo.totalSupplyFT - tokenInfo.reservedSupplyFT)/tokenInfo.totalSupplyFT)}%)`}<br/><br/>
                      reserved supply: {displayTokenAmount(tokenInfo.reservedSupplyFT)}
                      {` (${toPercentage((tokenInfo.reservedSupplyFT)/tokenInfo.totalSupplyFT)}%)`}<br/><br/>
                    </>
                  ):
                  <>No reserved supply (full supply circulating)<br/><br/></>}
                </>
              ):null}
              {tokenInfo.totalSupplyNFTs? (
                <>
                  has active minting NFT: {tokenInfo.hasActiveMintingToken? "yes":"no"} <br/><br/>
                </>
              ):null}
              {metadataInfo?.httpsUrl ?
                (<>
                number of user-addresses holding {metadataInfo?.tokenMetadata?.token?.symbol ?? 'the token'}: 
                {tokenInfo.numberHolders.toLocaleString("en-GB")}<br/><br/>
                total number of addresses holding {metadataInfo?.tokenMetadata?.token?.symbol ?? 'the token'} (including smart contracts): 
                {tokenInfo.numberTokenAddresses.toLocaleString("en-GB")}<br/><br/>
              </>):null}
            </>):null}
            genesis transaction: <a href={blockExplorerUrl+tokenInfo.genesisTx} target="_blank" rel="noreferrer">
              {tokenInfo.genesisTx}
            </a><br/>
            timestamp genesis transaction: {tokenInfo.genesisTxTimestamp ? formatTimestamp(tokenInfo.genesisTxTimestamp) : "N/A"} <br/><br/>
            {metadataInfo ? <>
              authChain length: {tokenInfo.authchainLength} <br/><br/>
              authChain metadata updates: {metadataInfo.authchainUpdates} <br/><br/>
              authHead txid: <a href={blockExplorerUrl+tokenInfo.authHead} target="_blank" rel="noreferrer">
                {tokenInfo.authHead}
              </a><br/>
              {metadataInfo?.httpsUrl ?
              (<>
                location metadata: 
                <a href={metadataInfo.httpsUrl} target="_blank" rel="noreferrer" style={{maxWidth: "570px", wordBreak: "break-all", display: "inline-block", color: "#00E"}}>
                  {metadataInfo.metaDataLocation}
                </a><br/><br/>
              </>):null}
              {metadataInfo?.authchainUpdates? <>
                metadata hash matches: {metadataInfo.metadataHashMatch? "✅": metadataInfo.metadataHashMatch == false ? "❌" : "❔"}  <br/><br/>
              </> : null}
            </> : null}
          </div>
        </div>}
        </div>
        
      </main>
    </>
  )
}
