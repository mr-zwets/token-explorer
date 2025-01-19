import Head from 'next/head'
import { Inter } from 'next/font/google'
import styles from '@/styles/Home.module.css'
import { BCMR, utf8ToBin, sha256, binToHex } from 'mainnet-js'
import { useEffect, useState } from 'react'
import { queryGenesisSupplyFT, queryActiveMinting, querySupplyNFTs, queryAuthchainLength, queryAllTokenHolders } from '../utils/queryChainGraph';

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  interface tokenInfo {
    genesisSupplyFT:number;
    totalSupplyFT:number;
    reservedSupplyFT:number;
    totalSupplyNFTs:number;
    hasActiveMintingToken:boolean;
    genesisTx: string,
    authchainLength?: number
    authHead?: string
    numberHolders: number
    numberTokenAddresses: number
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
  const ipfsGateway = "https://w3s.link/ipfs/";

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const readTokenId = params.get("tokenId");
    if(!readTokenId) return
    setTokenId(readTokenId);
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
    let metadataHashMatch = false;
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
      while (totalSupplyNFTs == 5000) {
        indexOffset += 1;
        const respJsonSupplyNFTs2 = await querySupplyNFTs(tokenId, 5000 * indexOffset);
        if(!respJsonSupplyNFTs2) throw new Error("Error in querySupplyNFTs")
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

      const totalSupplyFT = respJsonAllTokenHolders.output.reduce(
        (total:number, output) => 
          total + parseInt(output.fungible_token_amount ?? "0"),
        0
      );
      const uniqueLockingBytecodes = new Set(respJsonAllTokenHolders.output.map(output => output.locking_bytecode.slice(2)));
      const numberHolders = Array.from(uniqueLockingBytecodes).filter(locking_bytecode =>
        locking_bytecode.startsWith('76a914')
      ).length;
      const numberTokenAddresses = uniqueLockingBytecodes.size;

      setTokenInfo({genesisSupplyFT, totalSupplyFT, totalSupplyNFTs, hasActiveMintingToken, genesisTx, authchainLength, authHead, reservedSupplyFT, numberHolders, numberTokenAddresses});
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
                clearExistingInfo()
                lookUpTokenData(tokenId);
                fetchMetadata(tokenId);
              } 
            }}
          ></input>

          {tokenInfo && <div style={{marginTop:"20px", overflowWrap:"anywhere",maxWidth:"570px"}}>
            <div className={styles.description}>

              {metadataInfo?.metaDataLocation !== undefined? (
                metadataInfo.metaDataLocation == ""?
                (<> This token has no BCMR metadata linked on-chain <br/><br/> </>) : null
              ):<> loading metadata... <br/><br/></>}
              {metadataInfo && metadataInfo.tokenMetadata? (
                <>
                name: {metadataInfo.tokenMetadata.name} <br/><br/>
                token type: 
                {(tokenInfo.genesisSupplyFT && !tokenInfo.totalSupplyNFTs)? " Fungible Token":null} 
                {(!tokenInfo.genesisSupplyFT && tokenInfo.totalSupplyNFTs)? " NFTs":null}
                {(tokenInfo.genesisSupplyFT && tokenInfo.totalSupplyNFTs)? " Both Fugible & Non-Fungible tokens":null} 
              <br/><br/>
                {metadataInfo.tokenMetadata.token? (<>
                  <div>symbol: {metadataInfo.tokenMetadata.token?.symbol}</div><br/>
                </>): null}
                {metadataInfo.tokenMetadata.token?.decimals? (<>
                  <div>decimals: {metadataInfo.tokenMetadata.token?.decimals}</div><br/>
                </>): null}
              </>):null}
              {tokenInfo.genesisSupplyFT? (
                <>
                genesis supply: {
                  (tokenInfo.genesisSupplyFT / (10 ** (metadataInfo?.tokenMetadata?.token?.decimals ?? 0))).toLocaleString("en-GB")
                  + ' ' + metadataInfo?.tokenMetadata?.token?.symbol
                } <br/><br/>
              </>):null}
              {tokenInfo.totalSupplyNFTs? (
                <>total amount NFTs: {tokenInfo.totalSupplyNFTs} <br/><br/></>
              ):null}
              description: {metadataInfo?.tokenMetadata?.description} <br/><br/>
              genesis transaction: <a href={"https://explorer.electroncash.de/tx/"+tokenInfo.genesisTx} target="_blank" rel="noreferrer">
                {tokenInfo.genesisTx}
              </a><br/>
              {tokenInfo.totalSupplyNFTs? (
                <>
                has active minting NFT: {tokenInfo.hasActiveMintingToken? "yes":"no"} <br/><br/>
                </>
              ):null}
              {metadataInfo && metadataInfo.tokenMetadata? (
                <>
                {metadataInfo.tokenMetadata.uris?.icon && tokenIconUri ? <>
                <span style={{ verticalAlign:"top"}}>icon: </span>
                <div style={{ display:"flex", justifyContent: "center"}}>
                  <img className='tokenImage' style={{ width:"60vw", maxWidth: "400px"}} src={tokenIconUri} alt="tokenIcon"/>
                  <br/><br/>
                </div></>:null}
                {tokenInfo.genesisSupplyFT? (
                <>
                  {tokenInfo.genesisSupplyFT != tokenInfo.totalSupplyFT ? (<></>
                  /*
                  <>supply excluding burns: {(tokenInfo.totalSupplyFT).toLocaleString("en-GB")} 
                  <span> (burned: {(tokenInfo.genesisSupplyFT - tokenInfo.totalSupplyFT).toLocaleString("en-GB")})</span><br/><br/></>
                  */): null}
                  {tokenInfo.reservedSupplyFT? (
                    <>
                      circulating supply: {(
                        (tokenInfo.totalSupplyFT - tokenInfo.reservedSupplyFT) / (10 ** (metadataInfo?.tokenMetadata?.token?.decimals ?? 0))
                        ).toLocaleString("en-GB") + ' ' + metadataInfo?.tokenMetadata?.token?.symbol
                      }
                      {` (${toPercentage((tokenInfo.totalSupplyFT - tokenInfo.reservedSupplyFT)/tokenInfo.totalSupplyFT)}%)`}<br/><br/>
                      reserved supply: {(
                        (tokenInfo.reservedSupplyFT) / (10 ** (metadataInfo?.tokenMetadata?.token?.decimals ?? 0))
                        ).toLocaleString("en-GB") + ' ' + metadataInfo?.tokenMetadata?.token?.symbol
                      }
                      {` (${toPercentage((tokenInfo.reservedSupplyFT)/tokenInfo.totalSupplyFT)}%)`}<br/><br/>
                    </>
                  ):null}
                </>
              ):null}
              {metadataInfo?.httpsUrl ?
                (<>
                Number of user-addresses holding {metadataInfo?.tokenMetadata?.token?.symbol ?? 'the token'}: {tokenInfo.numberHolders}<br/><br/>
                Total number of addresses holding {metadataInfo?.tokenMetadata?.token?.symbol ?? 'the token'} (including smart contracts): 
                {tokenInfo.numberTokenAddresses}<br/><br/>
              </>):null}
              {metadataInfo.tokenMetadata.uris ? <>
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
            </>):null}
            {metadataInfo?.httpsUrl ?
              (<>
                location metadata: 
                <a href={metadataInfo.httpsUrl} target="_blank" rel="noreferrer" style={{maxWidth: "570px", wordBreak: "break-all", display: "inline-block", color: "#00E"}}>
                  {metadataInfo.metaDataLocation}
                </a><br/><br/>
              </>):null}
            {metadataInfo ? <>
              authChain length: {tokenInfo.authchainLength}  <br/><br/>
              authChain metadata updates: {metadataInfo.authchainUpdates}  <br/><br/>
              authHead txid: <a href={"https://explorer.electroncash.de/tx/"+tokenInfo.authHead} target="_blank" rel="noreferrer">
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
