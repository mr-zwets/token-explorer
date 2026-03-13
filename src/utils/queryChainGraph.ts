import { graphql, ChaingraphClient } from "chaingraph-ts";
import { CHAINGRAPH_URL } from "@/constants";

const chaingraphClient = new ChaingraphClient(CHAINGRAPH_URL);

export async function queryGenesisInfo(tokenId:string){
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
          nonfungible_token_capability
        }
        block_inclusions {
          block {
            timestamp
          }
        }
      }
    }`);
  const variables = { tokenId: `\\x${tokenId}` }
  return (await chaingraphClient.query(queryReqGenesisSupply, variables)).data
}

export async function queryAllTokenHolders(tokenId:string, offset:number = 0){
  const queryReqTotalSupply = graphql(`query TotalSupplyFT (
    $offset: Int,
    $tokenId: bytea
  ) {
      output(
        offset: $offset
        limit: 5000
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
  const variables = { tokenId: `\\x${tokenId}`, offset }
  return (await chaingraphClient.query(queryReqTotalSupply, variables)).data
}

export async function queryIssuingUtxos(tokenId:string){
  const queryReqIssuingUtxos = graphql(`query IssuingUtxos (
    $tokenId: bytea
  ) {
      output(
        where: {
          token_category: { _eq: $tokenId }
          nonfungible_token_capability: { _in: ["minting", "mutable"] }
          _not: { spent_by: {} }
        }
      ) {
        transaction_hash
        output_index
        locking_bytecode
        fungible_token_amount
        nonfungible_token_capability
      }
    }`);
  const variables = { tokenId: `\\x${tokenId}` }
  return (await chaingraphClient.query(queryReqIssuingUtxos, variables)).data
}


export async function queryGenesisCategories(txHash:string){
  const queryReqTokenOutputs = graphql(`query TokenOutputs (
    $txHash: bytea
  ) {
    transaction(
      where: {
        hash: {
          _eq: $txHash
        }
      }
    ) {
      inputs(order_by: { input_index: asc }) {
        outpoint_transaction_hash
        outpoint_index
      }
      outputs(where: { token_category: { _is_null: false } }) {
        token_category
      }
    }
  }`);
  const variables = { txHash: `\\x${txHash}` }
  return (await chaingraphClient.query(queryReqTokenOutputs, variables)).data
}

export async function queryAuthchain(tokenId:string){
  const queryReqAuthHead = graphql(`query Authchain (
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
      block_inclusions {
        block {
          accepted_by {
            node {
              name
            }
          }
        }
      }
      authchains {
        authhead {
          hash,
          identity_output {
            fungible_token_amount
            locking_bytecode
          }
          block_inclusions {
            block {
              timestamp
            }
          }
          outputs {
            output_index
            locking_bytecode
          }
        },
        authchain_length,
        migrations(order_by: { migration_index: asc }) {
          migration_index
          transaction {
            hash
            block_inclusions {
              block {
                timestamp
              }
            }
            outputs {
              output_index
              locking_bytecode
            }
          }
        }
      }
    }
  }`);
  const variables = { tokenId: `\\x${tokenId}` }
  return (await chaingraphClient.query(queryReqAuthHead, variables)).data
}