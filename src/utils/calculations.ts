interface OutputWithLockingBytecode {
  locking_bytecode: string
  fungible_token_amount?: string | null
  nonfungible_token_capability?: string | null
}

export function countUniqueHolders(outputs: OutputWithLockingBytecode[]): { numberHolders: number, numberTokenAddresses: number, userSupplyFT: number, contractSupplyFT: number } {
  const uniqueLockingBytecodes = new Set(outputs.map(output => output.locking_bytecode.slice(2)));
  const numberHolders = Array.from(uniqueLockingBytecodes).filter(locking_bytecode =>
    locking_bytecode.startsWith('76a914')
  ).length;
  const numberTokenAddresses = uniqueLockingBytecodes.size;

  let userSupplyFT = 0;
  let contractSupplyFT = 0;
  for (const output of outputs) {
    const ft = parseInt(output.fungible_token_amount ?? "0");
    if (output.locking_bytecode.slice(2).startsWith('76a914')) {
      userSupplyFT += ft;
    } else if (output.nonfungible_token_capability !== 'minting' && output.nonfungible_token_capability !== 'mutable') {
      contractSupplyFT += ft;
    }
  }

  return { numberHolders, numberTokenAddresses, userSupplyFT, contractSupplyFT }
}

export function calculateTotalSupplyFT(outputs: OutputWithLockingBytecode[]): number {
  return outputs.reduce(
    (total:number, output) =>
      total + parseInt(output.fungible_token_amount ?? "0"),
    0
  );
}
