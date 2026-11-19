// A failing first conversion prevents conversion of the second operand.
const left = { valueOf: () => { throw 'imul first conversion'; }, toString: () => '3' };
const right = { valueOf: () => { throw 'must not convert right'; } };
// @ts-expect-error — exercise ToNumber and its ordering on both operands.
export default Math.imul(left, right);
