// Positive infinity cannot terminate conversion of the remaining arguments.
const value = { valueOf: () => { throw 'max conversion after infinity'; } };
// @ts-expect-error — the third argument is converted even after infinity.
export default Math.max(Infinity, 2, value);
