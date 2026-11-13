// ToNumber rejects BigInt, even after earlier arguments converted successfully.
// @ts-expect-error — exercise JavaScript ToNumber beyond the TypeScript number signature.
export default String.fromCharCode(65, 1n);
