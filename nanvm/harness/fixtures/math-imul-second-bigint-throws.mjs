// The second operand is independently subject to ToNumber.
// @ts-expect-error — the second BigInt operand is rejected by ToNumber.
export default Math.imul(2, 1n);
