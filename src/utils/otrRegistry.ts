import type { Registry } from '@mainnet-cash/bcmr'
import { OTR_REGISTRY_URL } from '@/constants'

let otrRegistry: Registry | null = null
let otrRegistryPromise: Promise<Registry | null> | null = null

async function fetchOtrRegistry(): Promise<Registry | null> {
  try {
    const response = await fetch(OTR_REGISTRY_URL)
    if (!response.ok) {
      console.error(`Failed to fetch OTR registry: ${response.status}`)
      return null
    }
    return await response.json() as Registry
  } catch (error) {
    console.error('Error fetching OTR registry:', error)
    return null
  }
}

export async function checkOtrVerified(tokenId: string): Promise<boolean> {
  // Use cached registry if available
  if (!otrRegistry) {
    // Avoid multiple concurrent fetches
    if (!otrRegistryPromise) {
      otrRegistryPromise = fetchOtrRegistry()
    }
    otrRegistry = await otrRegistryPromise
  }

  console.log(otrRegistry)
  if (!otrRegistry?.identities) {
    return false
  }

  console.log(tokenId in otrRegistry.identities)
  return tokenId in otrRegistry.identities
}
