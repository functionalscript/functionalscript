// Negative infinity does not prevent conversion or rejection of a later BigInt primitive.
const value = { valueOf: () => 1n, toString: () => '4' };
// @ts-expect-error — ToNumber rejects a BigInt primitive without fallback.
export default Math.min(-Infinity, 2, value);
