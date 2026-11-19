// A BigInt from valueOf is already primitive; ToNumber rejects it without fallback.
const value = /** @type {const} */ ({ valueOf: () => 1n, toString: () => '1.9' });
// @ts-expect-error — exercise JavaScript ToNumber beyond its number signature.
export default Math.trunc(value);
