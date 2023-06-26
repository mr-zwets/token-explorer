import Head from 'next/head'
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'
import { BCMR } from 'mainnet-js'
import { useEffect, useState } from 'react'
import { queryTotalSupplyFT, queryActiveMinting, querySupplyNFTs } from '../utils/queryChainGraph';

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
    autchainLength?: number
  }

  interface tokenMetadata {
    name: string,
    description?: string,
    token?: {
      decimals?:number
    },
    uris?: URIs
  }
  interface URIs {
    icon?: string
  }

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
    let autchainLength= 0;
    try{
      const authChain = await BCMR.fetchAuthChainFromChaingraph({
        chaingraphUrl: chaingraphUrl,
        transactionHash: tokenId,
        network: "mainnet"
      });
      if(authChain.at(-1)){
        try{
          autchainLength = authChain.length;
          const bcmrLocation = authChain.at(-1)?.uris[0];
          if(!bcmrLocation) return;
          httpsUrl = bcmrLocation;
          if(httpsUrl.startsWith("ipfs://")) httpsUrl = httpsUrl.replace("ipfs://", ipfsGateway);
          if(!httpsUrl.startsWith("http")) httpsUrl = `https://${bcmrLocation}`;
          await BCMR.addMetadataRegistryFromUri(httpsUrl);
          metadataInfo = BCMR.getTokenInfo(tokenId);
          metaDataLocation = authChain[0].uris[0];
          console.log("Importing an on-chain resolved BCMR!");
        }catch(e){ console.log(e) }
      }
    } catch(error){ console.log(error) }

    if(!tokenInfo) return
    const newTokenInfo:tokenInfo = {...tokenInfo, metaDataLocation, tokenMetadata:metadataInfo, httpsUrl, autchainLength}

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

      setTokenInfo({genesisSupplyFT,totalSupplyNFTs,hasActiveMintingToken, genesisTx});
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
              genesis tx: <a href={"https://chipnet.chaingraph.cash/tx/"+tokenInfo.genesisTx} target="_blank" rel="noreferrer">
                {tokenInfo.genesisTx}
              </a>
              <br/><br/><br/>
              {tokenInfo.metaDataLocation !== undefined? (
                tokenInfo.metaDataLocation !== ""?
                (<>
                  This token has metadata linked on-chain. <br/><br/>
                </>):
                (<>
                  This token has no metadata linked on-chain. <br/><br/>
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
                    <span style={{verticalAlign:"top"}}>icon: </span>
                    <img style={{maxWidth: "80vw"}} 
                      src={tokenInfo.tokenMetadata.uris?.icon.startsWith("ipfs://") ? 
                      "https://dweb.link/ipfs/"+tokenInfo.tokenMetadata.uris?.icon.slice(7) : 
                      tokenInfo.tokenMetadata.uris?.icon}
                    /> <br/><br/>
                  </>:null}
                location metadata: 
                <a href={tokenInfo.httpsUrl} target="_blank" rel="noreferrer" style={{maxWidth: "570px", wordBreak: "break-all"}}>{tokenInfo.metaDataLocation}</a> <br/>
                </>
              ):null} <br/>
              authChain length: {tokenInfo.autchainLength} <br/>
            </div>
        </div>}
        </div>
        
      </main>
    </>
  )
}
