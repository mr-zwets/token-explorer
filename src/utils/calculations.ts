interface OutputWithLockingBytecode {
  locking_bytecode: string
  fungible_token_amount?: string | null
  nonfungible_token_capability?: string | null
}

export function countUniqueHolders(outputs: OutputWithLockingBytecode[]): { numberHolders: number, numberTokenAddresses: number } {
  const uniqueLockingBytecodes = new Set(outputs.map(output => output.locking_bytecode.slice(2)));
  const numberHolders = Array.from(uniqueLockingBytecodes).filter(locking_bytecode =>
    locking_bytecode.startsWith('76a914')
  ).length;
  const numberTokenAddresses = uniqueLockingBytecodes.size;
  return { numberHolders, numberTokenAddresses }
}

export function calculateTotalSupplyFT(outputs: OutputWithLockingBytecode[]): number {
  return outputs.reduce(
    (total:number, output) =>
      total + parseInt(output.fungible_token_amount ?? "0"),
    0
  );
}

export function calculateCirculatingSupplyFT(outputs: OutputWithLockingBytecode[], reservedSupplyFT: number): number {
  const supplyFtMinusMintingCovenants = outputs.reduce(
    (total:number, output) => output.fungible_token_amount && output.nonfungible_token_capability != "minting" ?
      total + parseInt(output.fungible_token_amount) : 0,
    0
  );
  return supplyFtMinusMintingCovenants - reservedSupplyFT;
}
