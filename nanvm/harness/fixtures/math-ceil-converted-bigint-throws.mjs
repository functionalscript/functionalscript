// A primitive BigInt returned by valueOf is rejected without fallback.
const value = { valueOf: () => 1n, toString: () => '4' };
// @ts-expect-error — exercise JavaScript ToNumber beyond its number signature.
export default Math.ceil(value);
