// A nested function captures both its parent argument and a module constant.
const x = 10;
/** @type {(...a: readonly number[]) => (...b: readonly number[]) => number} */
const make = (...a) => (...b) => a[0] + b[0] + x;
export default make(20)(12);
