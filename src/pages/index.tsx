import Head from 'next/head'
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'
import { Wallet } from 'mainnet-js'
import { useEffect, useState } from 'react'
import { queryTotalSupplyFT, queryActiveMinting, querySupplyNFTs } from '../utils/queryChainGraph';

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  interface tokenInfo {
    genesisSupplyFT:number;
    totalSupplyNFTs:number;
    hasActiveMintingToken:boolean;
  }

  const [tokenId, setTokenId] = useState<string>("");
  const [tokenInfo, setTokenInfo] = useState<tokenInfo>();

  const handleChange = (e:any) => {
    if((e.target as HTMLInputElement)) setTokenId(e.target.value);
  };

  const lookUpTokenData = async () => {
    try{
      // get genesisSupplyFT
      const respJsonTotalSupply =  await queryTotalSupplyFT(tokenId);
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

      setTokenInfo({genesisSupplyFT,totalSupplyNFTs,hasActiveMintingToken});
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
          <div  className={styles.description}>Enter tokenId: </div>
          <input
            className={styles.description}
            style={{width:"550px",padding:"10px 20px"}}
            type="text"
            id="tokenId"
            value={tokenId}
            onChange={(e) => handleChange(e)}
            onKeyDown ={(e) => {
              if(e.key === 'Enter') lookUpTokenData();
            }}
          ></input>

          {tokenInfo && <div style={{marginTop:"50px"}}>
            <p className={styles.description}>
          genesisSupplyFT: {tokenInfo.genesisSupplyFT} <br/><br/>
          totalAmountNFTs: {tokenInfo.totalSupplyNFTs} <br/><br/>
          hasActiveMintingToken: {tokenInfo.hasActiveMintingToken? "yes":"no"}</p>
        </div>}
        </div>
        
      </main>
    </>
  )
}
