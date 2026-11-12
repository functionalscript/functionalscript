// Negative infinity cannot terminate conversion of the remaining arguments.
const value = { valueOf: () => { throw 'min conversion after infinity'; } };
// @ts-expect-error — the third argument is converted even after infinity.
export default Math.min(-Infinity, 2, value);
