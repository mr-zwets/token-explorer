interface OutputWithLockingBytecode {
  locking_bytecode: string
  fungible_token_amount?: string | null
  nonfungible_token_capability?: string | null
}

export function countUniqueHolders(outputs: OutputWithLockingBytecode[]): { numberHolders: number, numberTokenAddresses: number, issuingCovenantUtxos: number } {
  const uniqueLockingBytecodes = new Set(outputs.map(output => output.locking_bytecode.slice(2)));
  const numberHolders = Array.from(uniqueLockingBytecodes).filter(locking_bytecode =>
    locking_bytecode.startsWith('76a914')
  ).length;
  const numberTokenAddresses = uniqueLockingBytecodes.size;
  const issuingCovenantUtxos = outputs.filter(
    output => output.nonfungible_token_capability === "minting" || output.nonfungible_token_capability === "mutable"
  ).length;
  return { numberHolders, numberTokenAddresses, issuingCovenantUtxos }
}

export function calculateTotalSupplyFT(outputs: OutputWithLockingBytecode[]): number {
  return outputs.reduce(
    (total:number, output) =>
      total + parseInt(output.fungible_token_amount ?? "0"),
    0
  );
}

export function calculateReservedSupplyFT(outputs: OutputWithLockingBytecode[], authheadReservedFT: number): number {
  const covenantFT = outputs.reduce(
    (total: number, output) =>
      output.nonfungible_token_capability === "minting" || output.nonfungible_token_capability === "mutable"
        ? total + parseInt(output.fungible_token_amount ?? "0") : total,
    0
  );
  return covenantFT + authheadReservedFT;
}
