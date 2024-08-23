import { graphql } from "gql.tada";
import { Client, cacheExchange, fetchExchange } from 'urql';

const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql";

const client = new Client({
  url: chaingraphUrl,
  exchanges: [cacheExchange, fetchExchange],
});

export async function queryGenesisSupplyFT(tokenId:string){
  const queryReqGenesisSupply = graphql(`query {
      transaction(
        where: {
          inputs: {
            outpoint_transaction_hash: { _eq: "\\\\x${tokenId}" }
            outpoint_index: { _eq: 0 }
          }
        }
      ) {
        hash,
        outputs(where: { token_category: { _eq: "\\\\x${tokenId}" } }) {
          fungible_token_amount
        }
      }
    }`);
  return (await client.query(queryReqGenesisSupply, {})).data
}

export async function queryTotalSupplyFT(tokenId:string){
  const queryReqTotalSupply = `query {
      output(
        where: {
          token_category: { _eq: "\\\\x${tokenId}" }
          _not: { spent_by: {} }
        }
      ) {
        locking_bytecode
        fungible_token_amount
      }
    }`;
  return (await client.query(queryReqTotalSupply, {})).data
}

export async function queryActiveMinting(tokenId:string){
  const queryReqActiveMinting = graphql(`query {
      output(
        where: {
          token_category: { _eq: "\\\\x${tokenId}" }
          _and: { nonfungible_token_capability: { _eq: "minting" } }
          _not: { spent_by: {} }
        }
      ) {
        locking_bytecode
      }
    }`);
  return (await client.query(queryReqActiveMinting, {})).data
}

export async function querySupplyNFTs(tokenId:string, offset:number =0){
  const queryReqTotalSupply = graphql(`query {
      output(
        offset: "${offset}"
        where: {
          token_category: {
            _eq: "\\\\x${tokenId}"
          }
          _and: [
            { nonfungible_token_capability: { _eq: "none" } }
          ]
          _not: { spent_by: {} }
        }
      ) {
        locking_bytecode
      }
  }`);
  return (await client.query(queryReqTotalSupply, {})).data
}

export async function queryAuthchainLength(tokenId:string){
  const queryReqAuthHead = graphql(`query {
    transaction(
      where: {
        hash: {
          _eq: "\\\\x${tokenId}"
        }
      }
    ) {
      hash
      authchains {
        authhead {
          hash,
          identity_output {
            fungible_token_amount
          }
        },
        authchain_length
      }
    }
  }`);
  return (await client.query(queryReqAuthHead, {})).data
}