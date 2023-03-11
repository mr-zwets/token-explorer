import Head from 'next/head'
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'
import { TestNetWallet, BCMR, Network, DefaultProvider } from 'mainnet-js'
import { useEffect, useState } from 'react'
import { queryTotalSupplyFtFromGenesis, queryActiveMinting, querySupplyNFTs } from '../utils/queryChainGraph';

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  interface tokenInfo {
    genesisSupplyFT:number;
    totalSupplyNFTs:number;
    hasActiveMintingToken:boolean;
    genesisTx: string,
    hasMetaData?:boolean;
    tokenMetadata?: tokenMetadata | undefined
  }

  interface tokenMetadata {
    name: string,
    description?: string,
    token?: {
      decimals?:number
    },
  }

  const [tokenId, setTokenId] = useState<string>("");
  const [tokenInfo, setTokenInfo] = useState<tokenInfo>();

  const handleChange = (e:any) => {
    if((e.target as HTMLInputElement)) setTokenId(e.target.value);
  };

  useEffect(() => {
    if(tokenInfo?.hasMetaData !== undefined) return
    async function fetchMetadata(){
      let metadataInfo:tokenMetadata | undefined;
      let hasMetaData=false;
      try{
        DefaultProvider.servers.testnet = ["wss://chipnet.imaginary.cash:50004"]
        // Necessary to instantiate wallet to use addMetadataRegistryAuthChain
        const wallet = await TestNetWallet.named("mywallet");
        const authChain = await BCMR.addMetadataRegistryAuthChain({
          transactionHash: tokenId,
          followToHead: true,
          network: Network.TESTNET
        });
        if(authChain){
          console.log("Importing an on-chain resolved BCMR!");
          await BCMR.addMetadataRegistryFromUri(authChain[0].uri);
          metadataInfo = BCMR.getTokenInfo(tokenId);
          hasMetaData = true;
        }
      } catch(error){ console.log(error) }

      if(!tokenInfo) return
      const newTokenInfo:tokenInfo = {...tokenInfo, hasMetaData, tokenMetadata:metadataInfo}

      setTokenInfo(newTokenInfo);
    }
    
    fetchMetadata();

  },[tokenInfo]);

  const lookUpTokenData = async () => {
    try{
      // get genesisSupplyFT
      const respJsonTotalSupply =  await queryTotalSupplyFtFromGenesis(tokenId);
      const genesisTx = respJsonTotalSupply.data.transaction[0].hash.substring(2);
      let genesisSupplyFT = 0;
      if(respJsonTotalSupply.data.transaction[0].outputs){
        genesisSupplyFT = respJsonTotalSupply.data.transaction[0].outputs.reduce(
          (total:number, output:{fungible_token_amount:string}) => 
            total + parseInt(output.fungible_token_amount),
          0
        );
      }
      // get totalSupplyNFTs
      const respJsonSupplyNFTs = await querySupplyNFTs(tokenId);
      const totalSupplyNFTs = respJsonSupplyNFTs.data.output.length;
      // get hasActiveMintingToken
      const respJsonActiveMinting = await queryActiveMinting(tokenId);
      const hasActiveMintingToken = Boolean(respJsonActiveMinting.data.output.length);

      let tokenMetadata

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
        <div style={{display:"block"}}>
          <h2  className={styles.description}>Enter tokenId: </h2>
          <input
            className={styles.description}
            style={{width:"570px",padding:"10px 20px"}}
            type="text"
            id="tokenId"
            value={tokenId}
            onChange={(e) => handleChange(e)}
            onKeyDown ={(e) => {
              if(e.key === 'Enter') lookUpTokenData();
            }}
          ></input>

          {tokenInfo && <div style={{marginTop:"20px"}}>
            <p className={styles.description}>
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
              {tokenInfo.hasMetaData !== undefined? (
                tokenInfo.hasMetaData === true?
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
                decimals: {tokenInfo.tokenMetadata.token?.decimals} <br/><br/>
                </>
              ):null}        
            </p>
        </div>}
        </div>
        
      </main>
    </>
  )
}
