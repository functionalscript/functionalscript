// A NaN result still converts every later argument.
const value = { valueOf: () => { throw 'min conversion after NaN'; } };
// @ts-expect-error — the third argument is converted even after NaN.
export default Math.min(2, NaN, value);
