// The first operand is converted before the second.
const right = { valueOf: () => { throw 'must not convert right'; } };
// @ts-expect-error — the first BigInt operand is rejected by ToNumber.
export default Math.imul(1n, right);
