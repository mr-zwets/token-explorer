import { initializeElectrumClient, fetchUnspentTransactionOutputs } from '@electrum-cash/protocol'
import { lockingBytecodeToCashAddress, hexToBin } from '@bitauth/libauth'
import { ELECTRUM_MAINNET, ELECTRUM_CHIPNET } from '@/constants'
import type { ElectrumVerification } from '@/interfaces'

interface ChaingraphOutput {
  transaction_hash: string
  output_index: string
  locking_bytecode: string
  fungible_token_amount?: string | null
  nonfungible_token_capability?: string | null
}

export async function verifySupplyViaElectrum(
  chaingraphOutputs: ChaingraphOutput[],
  tokenId: string,
  network: 'mainnet' | 'chipnet'
): Promise<ElectrumVerification> {
  const hostname = network === 'chipnet' ? ELECTRUM_CHIPNET : ELECTRUM_MAINNET
  const prefix = network === 'chipnet' ? 'bchtest' : 'bitcoincash'

  console.time('electrum:total')

  // Group Chaingraph outputs by locking bytecode
  const outputsByBytecode = new Map<string, ChaingraphOutput[]>()
  for (const output of chaingraphOutputs) {
    const bc = output.locking_bytecode.slice(2) // remove \x prefix
    const existing = outputsByBytecode.get(bc)
    if (existing) {
      existing.push(output)
    } else {
      outputsByBytecode.set(bc, [output])
    }
  }

  // Build bytecode → CashAddress map
  const bytecodeToAddress = new Map<string, string>()
  for (const bc of outputsByBytecode.keys()) {
    const result = lockingBytecodeToCashAddress({ bytecode: hexToBin(bc), prefix })
    if (typeof result !== 'string') {
      bytecodeToAddress.set(bc, result.address)
    }
  }

  // Build Chaingraph UTXO set for matching
  const chaingraphUtxoSet = new Set<string>()
  for (const output of chaingraphOutputs) {
    const txHash = (output.transaction_hash as string).slice(2) // remove \x prefix
    const vout = output.output_index
    chaingraphUtxoSet.add(`${txHash}:${vout}`)
  }

  let chaingraphTotalFT = 0
  for (const output of chaingraphOutputs) {
    chaingraphTotalFT += parseInt(output.fungible_token_amount ?? '0')
  }

  // Deduplicate addresses
  const uniqueAddresses = [...new Set(bytecodeToAddress.values())]
  console.log(`electrum: ${chaingraphOutputs.length} UTXOs across ${uniqueAddresses.length} unique addresses`)

  console.time('electrum:connect')
  const client = await initializeElectrumClient('Token Explorer', hostname, {
    disableBrowserVisibilityHandling: true,
  })
  console.timeEnd('electrum:connect')

  try {
    let totalElectrumUtxos = 0
    let electrumTotalFT = 0
    let electrumReservedFT = 0
    const electrumUtxoSet = new Set<string>()

    console.time('electrum:queries')
    const allResults = await Promise.all(
      uniqueAddresses.map(address => fetchUnspentTransactionOutputs(client, address, true, true))
    )
    console.timeEnd('electrum:queries')

    for (const utxos of allResults) {
      const tokenUtxos = utxos.filter(u =>
        u.token_data && u.token_data.category === tokenId
      )

      totalElectrumUtxos += tokenUtxos.length

      for (const utxo of tokenUtxos) {
        const key = `${utxo.tx_hash}:${utxo.tx_pos}`
        electrumUtxoSet.add(key)

        const ftAmount = parseInt(utxo.token_data?.amount ?? '0')
        electrumTotalFT += ftAmount

        // Reserved = FT on minting or mutable NFT outputs
        const capability = utxo.token_data?.nft?.capability
        if (capability === 'minting' || capability === 'mutable') {
          electrumReservedFT += ftAmount
        }
      }
    }

    // Count stale: in Chaingraph but not in Electrum
    let staleCount = 0
    for (const key of chaingraphUtxoSet) {
      if (!electrumUtxoSet.has(key)) {
        staleCount++
      }
    }

    // Count missing: in Electrum but not in Chaingraph
    let missingCount = 0
    for (const key of electrumUtxoSet) {
      if (!chaingraphUtxoSet.has(key)) {
        missingCount++
      }
    }

    const verified = staleCount === 0 && missingCount === 0
    console.timeEnd('electrum:total')
    console.log(`electrum: result — ${totalElectrumUtxos} UTXOs, ${staleCount} stale, ${missingCount} missing, verified=${verified}`)

    return {
      verified,
      totalChaingraphUtxos: chaingraphOutputs.length,
      totalElectrumUtxos,
      staleCount,
      missingCount,
      chaingraphTotalFT,
      electrumTotalFT,
      electrumReservedFT,
    }
  } finally {
    try { await client.disconnect() } catch { /* ignore disconnect errors */ }
  }
}
