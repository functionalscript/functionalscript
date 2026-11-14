// A BigInt from the second valueOf is primitive and rejects without fallback.
const right = { valueOf: () => 1n, toString: () => '4' };
// @ts-expect-error — a converted BigInt is rejected on the right too.
export default Math.imul(3, right);
