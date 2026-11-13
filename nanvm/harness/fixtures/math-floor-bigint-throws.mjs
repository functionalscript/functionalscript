// ToNumber rejects BigInt; Number(value) would incorrectly accept this input.
// @ts-expect-error — JavaScript ToNumber rejects the BigInt argument.
export default Math.floor(1n);
