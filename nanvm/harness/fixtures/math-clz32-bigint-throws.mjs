// ToNumber rejects BigInt instead of converting it like Number().
// @ts-expect-error — JavaScript ToNumber rejects BigInt.
export default Math.clz32(1n);
