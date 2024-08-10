import { graphql } from "gql.tada";
import { request } from 'graphql-request'

export async function queryTotalSupplyFT(tokenId:string, chaingraphUrl:string){
  const queryReqTotalSupply = graphql(`query {
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
  return await request(chaingraphUrl, queryReqTotalSupply)
}

export async function queryActiveMinting(tokenId:string, chaingraphUrl:string){
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
  return await request(chaingraphUrl, queryReqActiveMinting)
}

export async function querySupplyNFTs(tokenId:string, chaingraphUrl:string, offset:number =0){
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
  return await request(chaingraphUrl, queryReqTotalSupply)
}

export async function queryAuthchainLength(tokenId:string, chaingraphUrl:string){
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
  return await request(chaingraphUrl, queryReqAuthHead)
}