import Head from 'next/head'
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'
import { BCMR, utf8ToBin, sha256, binToHex } from 'mainnet-js'
import { useEffect, useMemo, useState } from 'react'
import { queryTotalSupplyFT, queryActiveMinting, querySupplyNFTs, queryAuthchainLength } from '../utils/queryChainGraph';

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  interface tokenInfo {
    genesisSupplyFT:number;
    reservedSupplyFT:number;
    totalSupplyNFTs:number;
    hasActiveMintingToken:boolean;
    genesisTx: string,
    authchainLength?: number
    authHead?: string
  }
  
  interface metadataInfo {
    metaDataLocation?:string;
    httpsUrl?:string;
    authchainUpdates?: number
    
    tokenMetadata?: tokenMetadata | undefined
    metadataHashMatch?: boolean
  }

  interface tokenMetadata {
    name: string,
    description?: string,
    token?: {
      symbol: string,
      decimals?:number
    },
    uris: URIs
  }
  type URIs = {
    [identifier: string]: string;
  };

  const [tokenId, setTokenId] = useState<string>("");
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

  const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql";
  
  const ipfsGateways = useMemo(() => [
    "https://w3s.link/ipfs/",
    "https://nftstorage.link/ipfs/",
    "https://ipfs.io/ipfs/"
  ],[])
  
  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const readTokenId = params.get("tokenId");
    if(!readTokenId) return
    setTokenId(readTokenId);
    lookUpTokenData(readTokenId);
    fetchMetadata(readTokenId);
  
  },[]);

  useEffect(() => {
    // Set Icon
    (async () => {
      if(metadataInfo?.tokenMetadata?.uris?.icon) {
        if (!metadataInfo?.tokenMetadata?.uris?.icon?.startsWith('ipfs://')) {
          return setTokenIconUri(metadataInfo?.tokenMetadata?.uris?.icon)
        }
        const path = metadataInfo?.tokenMetadata?.uris?.icon.replace('ipfs://','')
        for await(let ig of getIpfsGateway(ipfsGateways, path)) {
          if (ig) {
            setTokenIconUri(`${ig}${path}`)
            break
          }
        } 
      } 
    })()
    
  }, [metadataInfo, ipfsGateways])

  

  async function* getIpfsGateway(ipfsGateways: string[], cid: string) {
    
    for (let url of ipfsGateways) {
          try {
              let response = await fetch(`${url}${cid}`, { method: 'HEAD' });
              if (response.ok) {
                  yield url; // Yield the accessible URL
              }
          } catch (error: any) {
              console.error(`Error while checking ${url}: ${error.message}`);
          }
      }
  }

  async function fetchMetadata(tokenId:string){
    let metadataInfo:tokenMetadata | undefined;
    let metaDataLocation= "";
    let httpsUrl;
    let authchainUpdates= 0;
    let metadataHashMatch = false;
    try{
      const authChain = await BCMR.fetchAuthChainFromChaingraph({
        chaingraphUrl: chaingraphUrl,
        transactionHash: tokenId
      });
      console.log(authChain)
      if(authChain.at(-1)){
        try{
          authchainUpdates = authChain.length;
          const bcmrLocation = authChain.at(-1)?.uris[0];
          httpsUrl = authChain.at(-1)?.httpsUrl;
          if(!bcmrLocation || !httpsUrl) return;
          const providedHash = authChain.at(-1)?.contentHash;

          
          // use own gateway
          if(bcmrLocation.startsWith("ipfs://")) {
            const cid = bcmrLocation.replace("ipfs://", "")
            let ipfsGateway = ''
            for await(let ig of getIpfsGateway(ipfsGateways, cid)) {
              if (ig) {
                ipfsGateway = ig
                break
              }
            }
            if (!ipfsGateway) throw new Error("No accessible ipfs gateway, please try again later.")
            httpsUrl = bcmrLocation.replace("ipfs://", ipfsGateway);
          }
          metaDataLocation = bcmrLocation;
          await BCMR.addMetadataRegistryFromUri(httpsUrl);
          metadataInfo = BCMR.getTokenInfo(tokenId) as tokenMetadata;
          console.log("Importing an on-chain resolved BCMR!");

          const reponse = await fetch(httpsUrl);
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
      // get genesisSupplyFT, get totalSupplyNFTs, get totalSupplyNFTs & get hasActiveMintingToken
      const promiseTotalSupply = queryTotalSupplyFT(tokenId,chaingraphUrl);
      let promiseSupplyNFTs = querySupplyNFTs(tokenId, chaingraphUrl);
      const promiseActiveMinting = queryActiveMinting(tokenId,chaingraphUrl);
      const promiseAuthchainLength = queryAuthchainLength(tokenId,chaingraphUrl);
      const [respJsonTotalSupply,respJsonSupplyNFTs,respJsonActiveMinting,respJsonAuthchainLength] = await Promise.all(
        [promiseTotalSupply,promiseSupplyNFTs,promiseActiveMinting,promiseAuthchainLength]
      );
      // calculate genesisSupplyFT
      const genesisTx = respJsonTotalSupply?.data?.transaction[0]?.hash?.substring(2);
      let genesisSupplyFT = 0;
      if(respJsonTotalSupply.data.transaction[0].outputs){
        genesisSupplyFT = respJsonTotalSupply.data.transaction[0].outputs.reduce(
          (total:number, output:{fungible_token_amount:string}) => 
            total + parseInt(output.fungible_token_amount),
          0
        );
      }
      // calculate totalSupplyNFTs
      let totalSupplyNFTs = respJsonSupplyNFTs.data.output.length;
      let indexOffset = 0;
      // limit of items returned by chaingraphquery is 5000
      while (totalSupplyNFTs == 5000) {
        indexOffset += 1;
        const respJsonSupplyNFTs2 = await querySupplyNFTs(tokenId, chaingraphUrl, 5000 * indexOffset);
        totalSupplyNFTs += respJsonSupplyNFTs2.data.output.length;
      }
      // parse hasActiveMintingToken
      const hasActiveMintingToken = Boolean(respJsonActiveMinting.data.output.length);
      // parse autchainLength, authHead
      const authchainLength = respJsonAuthchainLength.data.transaction[0].authchains[0].authchain_length;
      const resultAuthHead = respJsonAuthchainLength.data.transaction[0].authchains[0].authhead.hash;
      const authHead = resultAuthHead.slice(2);
      // parse reservedSupplyFT
      const respReservedSupplyFT:string = respJsonAuthchainLength.data.transaction[0].authchains[0].authhead.identity_output[0].fungible_token_amount;
      const reservedSupplyFT:number = +respReservedSupplyFT;

      setTokenInfo({genesisSupplyFT, totalSupplyNFTs, hasActiveMintingToken, genesisTx, authchainLength, authHead, reservedSupplyFT});
    } catch(error){
      console.log(error);
      alert("The input is not a valid tokenId!")
      setTokenInfo(undefined);
    }
  }

  const toPercentage = (decimalNumber:number) => (Math.round(decimalNumber *10000)/100).toFixed(2)

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
          <h2  className={styles.description}>Enter tokenId: </h2>
          <input
             className={styles.description}
             style={{width:"80vw", maxWidth:"570px",padding:"10px 20px"}}
            type="text"
            id="tokenId"
            value={tokenId}
            onChange={(e) => handleChange(e)}
            onKeyDown ={(e) => {
              if(e.key === 'Enter'){
                lookUpTokenData(tokenId);
                fetchMetadata(tokenId);
              } 
            }}
          ></input>

          {tokenInfo && <div style={{marginTop:"20px", overflowWrap:"anywhere",maxWidth:"570px"}}>
            <div className={styles.description}>
              token type: 
              {(tokenInfo.genesisSupplyFT && !tokenInfo.totalSupplyNFTs)? " Fungible Tokens only":null} 
              {(!tokenInfo.genesisSupplyFT && tokenInfo.totalSupplyNFTs)? " NFTs only":null}
              {(tokenInfo.genesisSupplyFT && tokenInfo.totalSupplyNFTs)? " Both Fugible & Non-Fungible tokens":null} 
              <br/><br/>
              {tokenInfo.genesisSupplyFT? (
                <>
                genesis supply: {(tokenInfo.genesisSupplyFT).toLocaleString("en-GB")} <br/><br/>
                {tokenInfo.reservedSupplyFT? (
                  <>
                    circulating supply: {(tokenInfo.genesisSupplyFT - tokenInfo.reservedSupplyFT).toLocaleString("en-GB")}
                    {` (${toPercentage((tokenInfo.genesisSupplyFT - tokenInfo.reservedSupplyFT)/tokenInfo.genesisSupplyFT)}%)`}<br/><br/>
                    reserved supply: {(tokenInfo.reservedSupplyFT).toLocaleString("en-GB")}
                    {` (${toPercentage((tokenInfo.reservedSupplyFT)/tokenInfo.genesisSupplyFT)}%)`}<br/><br/>
                  </>
                ):null}
                </>
              ):null}
              {tokenInfo.totalSupplyNFTs? (
                <>
                totalAmountNFTs: {tokenInfo.totalSupplyNFTs} <br/><br/>
                hasActiveMintingToken: {tokenInfo.hasActiveMintingToken? "yes":"no"} <br/><br/>
                </>
              ):null}
              genesis tx: <a href={"https://explorer.bitcoinunlimited.info/tx/"+tokenInfo.genesisTx} target="_blank" rel="noreferrer">
                {tokenInfo.genesisTx}
              </a><br/>
              {metadataInfo?.metaDataLocation !== undefined? (
                metadataInfo.metaDataLocation !== ""?
                (<>
                  This token has BCMR metadata linked on-chain <br/><br/>
                </>):
                (<>
                  This token has no BCMR metadata linked on-chain <br/><br/>
                  </>)
              ):<> loading metadata...</>}
              {metadataInfo && metadataInfo.tokenMetadata? (
                <>
                name: {metadataInfo.tokenMetadata.name} <br/><br/>
                {metadataInfo.tokenMetadata.token? (<>
                  <div>symbol: {metadataInfo.tokenMetadata.token?.symbol}</div><br/>
                </>): null}
                description: {metadataInfo.tokenMetadata.description} <br/><br/>
                {metadataInfo.tokenMetadata.token?.decimals? (<>
                  <div>decimals: {metadataInfo.tokenMetadata.token?.decimals}</div><br/>
                </>): null}
                {metadataInfo.tokenMetadata.uris?.icon ? <>
                    <span style={{ verticalAlign:"top"}}>icon: </span>
                    <img style={{ maxWidth: "60vw"}}
                      src={tokenIconUri} />
                    <br/><br/>
                  </>:null}
                {metadataInfo.tokenMetadata.uris ? <>
                  web url: {metadataInfo.tokenMetadata.uris?.web? <a href={metadataInfo.tokenMetadata.uris?.web} target='_blank' rel="noreferrer" style={{display: "inline-block", color: "#00E"}}>
                    {metadataInfo.tokenMetadata.uris?.web}
                  </a>: "none"}
                  <br/><br/>
                    other uris: {Object.keys(metadataInfo.tokenMetadata.uris).filter(uri => uri != "icon" && uri != "web").length ?
                      Object.keys(metadataInfo.tokenMetadata.uris).filter(uri => uri != "icon" && uri != "web").map((uriKey, index, array) =>
                        <span key={uriKey}>
                          <a href={metadataInfo?.tokenMetadata?.uris[uriKey]} target='_blank' rel="noreferrer" style={{ display: "inline-block", color: "#00E" }}>{uriKey}</a>
                          {(index != array.length - 1) ? ", " : null}</span>
                      ) : "none"} <br /><br />
                </>:null} 
              </>):null}
              {metadataInfo?.httpsUrl ?
                (<>
                  location metadata: 
                  <a href={metadataInfo.httpsUrl} target="_blank" rel="noreferrer" style={{maxWidth: "570px", wordBreak: "break-all", display: "inline-block", color: "#00E"}}>
                    {metadataInfo.metaDataLocation}
                  </a><br/><br/>
                </>):null}
              {metadataInfo ? <>
                authChain length: {tokenInfo.authchainLength}  <br/>
                authChain metadata updates: {metadataInfo.authchainUpdates}  <br/>
                authHead txid: <a href={"https://explorer.bitcoinunlimited.info/tx/"+tokenInfo.authHead} target="_blank" rel="noreferrer">
                  {tokenInfo.authHead}
                </a><br/>
                {metadataInfo?.authchainUpdates? <>
                  metadata hash matches: {metadataInfo.metadataHashMatch? "✅":"❌"}  <br/><br/>
                </> : null}
              </> : null}
            </div>
        </div>}
        </div>
        
      </main>
    </>
  )
}
