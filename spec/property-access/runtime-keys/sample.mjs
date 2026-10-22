/** @type {(a: readonly string[], i: number) => string | undefined} */
const at = (a, i) => a[i];
export default at(["x", "y"], 1);
