// A BigInt from the first valueOf is primitive and rejects without fallback.
const left = { valueOf: () => 1n, toString: () => '3' };
const right = { valueOf: () => { throw 'must not convert right'; } };
// @ts-expect-error — a converted BigInt is rejected before the right operand.
export default Math.imul(left, right);
