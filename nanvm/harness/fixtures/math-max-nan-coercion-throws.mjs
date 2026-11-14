// A NaN result still converts every later argument.
const value = { valueOf: () => { throw 'max conversion after NaN'; } };
// @ts-expect-error — the third argument is converted even after NaN.
export default Math.max(2, NaN, value);
