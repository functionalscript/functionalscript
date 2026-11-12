// ToNumber rejects BigInt; using Number(value) would accept this input.
// @ts-expect-error — JavaScript ToNumber rejects the BigInt argument.
export default Math.log2(1n);
