import Head from 'next/head'
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'
import { BCMR, utf8ToBin, sha256, binToHex } from 'mainnet-js'
import { useEffect, useState } from 'react'
import { queryTotalSupplyFT, queryActiveMinting, querySupplyNFTs, queryAuthchainLength } from '../utils/queryChainGraph';

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  interface tokenInfo {
    genesisSupplyFT:number;
    totalSupplyNFTs:number;
    hasActiveMintingToken:boolean;
    genesisTx: string,
    metaDataLocation?:string;
    httpsUrl?:string;
    tokenMetadata?: tokenMetadata | undefined
    authchainUpdates?: number
    authchainLength?: number
    authHead?: string
    metadataHashMatch?: boolean
  }

  interface tokenMetadata {
    name: string,
    description?: string,
    token?: {
      decimals?:number
    },
    uris: URIs
  }
  type URIs = {
    [identifier: string]: string;
  };

  const [tokenId, setTokenId] = useState<string>("");
  const [tokenInfo, setTokenInfo] = useState<tokenInfo>();

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
  const ipfsGateway = "https://ipfs.io/ipfs/";

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const readTokenId = params.get("tokenId");
    if(!readTokenId) return
    setTokenId(readTokenId);
    lookUpTokenData(readTokenId);
  },[]);

  useEffect(() => {
    if(!tokenInfo) return
    if(tokenInfo?.metaDataLocation !== undefined) return
    fetchMetadata();
  },[tokenInfo]);

  async function fetchMetadata(){
    let metadataInfo:tokenMetadata | undefined;
    let metaDataLocation= "";
    let httpsUrl= "";
    let authchainUpdates= 0;
    let metadataHashMatch = false;
    try{
      const authChain = await BCMR.fetchAuthChainFromChaingraph({
        chaingraphUrl: chaingraphUrl,
        transactionHash: tokenId,
        network: "mainnet"
      });
      if(authChain.at(-1)){
        try{
          authchainUpdates = authChain.length;
          const bcmrLocation = authChain.at(-1)?.uris[0];
          if(!bcmrLocation) return;
          httpsUrl = bcmrLocation;
          const providedHash = authChain.at(-1)?.contentHash;
          if(httpsUrl.startsWith("ipfs://")) httpsUrl = httpsUrl.replace("ipfs://", ipfsGateway);
          if(!httpsUrl.startsWith("http")) httpsUrl = `https://${bcmrLocation}`;
          await BCMR.addMetadataRegistryFromUri(httpsUrl);
          metadataInfo = BCMR.getTokenInfo(tokenId) as tokenMetadata;
          metaDataLocation = bcmrLocation;
          console.log("Importing an on-chain resolved BCMR!");

          const reponse = await fetch(httpsUrl);
          const bcmrContent = await reponse.text();
          const contentHash = binToHex(sha256.hash(utf8ToBin(bcmrContent)));
          metadataHashMatch = contentHash === providedHash;
        }catch(e){ console.log(e) }
      }
    } catch(error){ console.log(error) }

    if(!tokenInfo) return
    const newTokenInfo:tokenInfo = {...tokenInfo, metaDataLocation, tokenMetadata:metadataInfo, httpsUrl, authchainUpdates, metadataHashMatch}

    setTokenInfo(newTokenInfo);
  }

  const lookUpTokenData = async (tokenId:string) => {
    try{
      // get genesisSupplyFT
      const respJsonTotalSupply =  await queryTotalSupplyFT(tokenId,chaingraphUrl);
      const genesisTx = respJsonTotalSupply?.data?.transaction[0]?.hash?.substring(2);
      let genesisSupplyFT = 0;
      if(respJsonTotalSupply.data.transaction[0].outputs){
        genesisSupplyFT = respJsonTotalSupply.data.transaction[0].outputs.reduce(
          (total:number, output:{fungible_token_amount:string}) => 
            total + parseInt(output.fungible_token_amount),
          0
        );
      }
      // get totalSupplyNFTs
      let respJsonSupplyNFTs = await querySupplyNFTs(tokenId, chaingraphUrl);
      let totalSupplyNFTs = respJsonSupplyNFTs.data.output.length;
      let indexOffset = 0;
      // limit of items returned by chaingraphquery is 5000
      while (respJsonSupplyNFTs.data.output.length == 5000) {
        indexOffset += 1;
        respJsonSupplyNFTs = await querySupplyNFTs(tokenId, chaingraphUrl, 5000 * indexOffset);
        totalSupplyNFTs += respJsonSupplyNFTs.data.output.length;
      }
      // get hasActiveMintingToken
      const respJsonActiveMinting = await queryActiveMinting(tokenId,chaingraphUrl);
      const hasActiveMintingToken = Boolean(respJsonActiveMinting.data.output.length);
      // get autchainLength
      const respJsonAuthchainLength = await queryAuthchainLength(tokenId,chaingraphUrl);
      const authchainLength = respJsonAuthchainLength.data.transaction[0].authchains[0].authchain_length;
      const resultAuthHead = respJsonAuthchainLength.data.transaction[0].authchains[0].authhead.identity_output[0].transaction_hash;
      const authHead = resultAuthHead.slice(3);

      setTokenInfo({genesisSupplyFT,totalSupplyNFTs,hasActiveMintingToken, genesisTx, authchainLength, authHead});
    } catch(error){
      console.log(error);
      alert("The input is not a valid tokenId!")
      setTokenInfo(undefined);
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
              if(e.key === 'Enter') lookUpTokenData(tokenId);
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
                genesisSupplyFT: {tokenInfo.genesisSupplyFT} <br/><br/>
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
              </a>
              <br/><br/>
              {tokenInfo.metaDataLocation !== undefined? (
                tokenInfo.metaDataLocation !== ""?
                (<>
                  This token has metadata linked on-chain <br/><br/>
                </>):
                (<>
                  This token has no metadata linked on-chain <br/><br/>
                  </>)
              ):<> loading metadata...</>}
              {tokenInfo.tokenMetadata? (
                <>
                name: {tokenInfo.tokenMetadata.name} <br/><br/>
                description: {tokenInfo.tokenMetadata.description} <br/><br/>
                {tokenInfo.tokenMetadata.token?.decimals? (<>
                  <div>decimals: {tokenInfo.tokenMetadata.token?.decimals}</div><br/><br/>
                </>): null}
                {tokenInfo.tokenMetadata.uris?.icon ? <>
                    <span style={{ verticalAlign:"top"}}>icon: </span>
                    <img style={{ maxWidth: "60vw"}}
                      src={tokenInfo.tokenMetadata.uris?.icon.startsWith("ipfs://") ?
                        "https://dweb.link/ipfs/" + tokenInfo.tokenMetadata.uris?.icon.slice(7) :
                        tokenInfo.tokenMetadata.uris?.icon} />
                    <br/><br/>
                  </>:null}
                web url: {tokenInfo.tokenMetadata.uris?.web? <a href={tokenInfo.tokenMetadata.uris?.web} target='_blank' rel="noreferrer" style={{display: "inline-block", color: "#00E"}}>
                  {tokenInfo.tokenMetadata.uris?.web}
                </a>: "none"}
                <br/><br/>
                  other uris: {Object.keys(tokenInfo.tokenMetadata.uris).filter(uri => uri != "icon" && uri != "web").length ?
                    Object.keys(tokenInfo.tokenMetadata.uris).filter(uri => uri != "icon" && uri != "web").map((uriKey, index, array) =>
                      <>
                        <a key={uriKey} href={tokenInfo?.tokenMetadata?.uris[uriKey]} target='_blank' rel="noreferrer" style={{ display: "inline-block", color: "#00E" }}>{uriKey}</a>
                        {(index != array.length - 1) ? ", " : null}</>
                    ) : "none"} <br /><br />
                location metadata: 
                <a href={tokenInfo.httpsUrl} target="_blank" rel="noreferrer" style={{maxWidth: "570px", wordBreak: "break-all", display: "inline-block", color: "#00E"}}>
                  {tokenInfo.metaDataLocation}
                </a><br/>
              </>):null} <br/>
              {tokenInfo.authchainUpdates? <>
                authChain length: {tokenInfo.authchainLength}  <br/>
                authChain metadata updates: {tokenInfo.authchainUpdates}  <br/>
                authHead txid: <a href={"https://explorer.bitcoinunlimited.info/tx/"+tokenInfo.genesisTx} target="_blank" rel="noreferrer">
                  {tokenInfo.authHead}
                </a><br/>
                metadata hash matches: {tokenInfo.metadataHashMatch? "✅":"❌"}  <br/><br/>
              </> : null}
            </div>
        </div>}
        </div>
        
      </main>
    </>
  )
}
