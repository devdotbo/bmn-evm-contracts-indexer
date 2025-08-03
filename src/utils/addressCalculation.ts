import { keccak256, encodePacked, getAddress } from "viem";

// Helper function to calculate CREATE2 address for escrow contracts
export function calculateEscrowAddress(
  factoryAddress: string,
  implementation: string,
  salt: `0x${string}`,
  initCode: `0x${string}`
): string {
  // CREATE2 address calculation
  // address = keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))[12:]
  
  const initCodeHash = keccak256(initCode);
  
  const encoded = encodePacked(
    ["bytes1", "address", "bytes32", "bytes32"],
    ["0xff", factoryAddress as `0x${string}`, salt, initCodeHash]
  );
  
  const hash = keccak256(encoded);
  const address = `0x${hash.slice(26)}` as `0x${string}`;
  
  return getAddress(address);
}

// Helper to encode the immutables struct into bytes32 salt
export function encodeImmutablesAsSalt(immutables: {
  orderHash: `0x${string}`;
  hashlock: `0x${string}`;
  maker: bigint;
  taker: bigint;
  token: bigint;
  amount: bigint;
  safetyDeposit: bigint;
  timelocks: bigint;
}): `0x${string}` {
  // The salt is typically derived from the immutables struct
  // This is a simplified version - the actual implementation may differ
  return keccak256(
    encodePacked(
      ["bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [
        immutables.orderHash,
        immutables.hashlock,
        immutables.maker,
        immutables.taker,
        immutables.token,
        immutables.amount,
        immutables.safetyDeposit,
        immutables.timelocks
      ]
    )
  );
}