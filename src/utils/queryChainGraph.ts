import { graphql, ChaingraphClient } from "chaingraph-ts";

const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql";
const chaingraphClient = new ChaingraphClient(chaingraphUrl);

export async function queryGenesisSupplyFT(tokenId:string){
  const queryReqGenesisSupply = graphql(`query GenesisSupplyFT (
    $tokenId: bytea
  ) {
      transaction(
        where: {
          inputs: {
            outpoint_transaction_hash: { _eq: $tokenId }
            outpoint_index: { _eq: 0 }
          }
        }
      ) {
        hash
        outputs(where: { token_category: { _eq: $tokenId } }) {
          fungible_token_amount
        }
        block_inclusions {
          block {
            timestamp
            height
          }
        }
      }
    }`);
  const variables = { tokenId: `\\x${tokenId}` }
  return (await chaingraphClient.query(queryReqGenesisSupply, variables)).data
}

export async function queryAllTokenHolders(tokenId:string){
  const queryReqTotalSupply = graphql(`query TotalSupplyFT (
    $tokenId: bytea
  ) {
      output(
        where: {
          token_category: { _eq: $tokenId }
          _not: { spent_by: {} }
        }
      ) {
        locking_bytecode
        fungible_token_amount
        nonfungible_token_capability
      }
    }`);
  const variables = { tokenId: `\\x${tokenId}` }
  return (await chaingraphClient.query(queryReqTotalSupply, variables)).data
}

export async function queryActiveMinting(tokenId:string){
  const queryReqActiveMinting = graphql(`query ActiveMinting (
    $tokenId: bytea
  ) {
      output(
        where: {
          token_category: { _eq: $tokenId }
          _and: { nonfungible_token_capability: { _eq: "minting" } }
          _not: { spent_by: {} }
        }
      ) {
        locking_bytecode
      }
    }`);
  const variables = { tokenId: `\\x${tokenId}` }
  return (await chaingraphClient.query(queryReqActiveMinting, variables)).data
}

export async function querySupplyNFTs(tokenId:string, offset:number =0){
  const queryReqTotalSupply = graphql(`query SupplyNFTs (
    $offset: Int,
    $tokenId: bytea
  ) {
      output(
        offset: $offset
        where: {
          token_category: {
            _eq: $tokenId
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
  const variables = { tokenId: `\\x${tokenId}`, offset }
  return (await chaingraphClient.query(queryReqTotalSupply, variables)).data
}

export async function queryAuthchainLength(tokenId:string){
  const queryReqAuthHead = graphql(`query AuthchainLength (
    $tokenId: bytea
  ) {
    transaction(
      where: {
        hash: {
          _eq: $tokenId
        }
      }
    ) {
      hash
      authchains {
        authhead {
          hash,
          identity_output {
            fungible_token_amount
            locking_bytecode
          }
        },
        authchain_length
      }
    }
  }`);
  const variables = { tokenId: `\\x${tokenId}` }
  return (await chaingraphClient.query(queryReqAuthHead, variables)).data
}