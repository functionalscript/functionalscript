// A loop, `let` and `while` over one variable, compiled to a Rust loop
// ([spec: loops](../../../spec/control-flow/loops/README.md)): `count` runs a million
// rounds in `tests/while_loop.rs`, which a call per round could not, and the
// default is the same loop over a few rounds, as the Node host runs it.
/** @type {(n: number) => number} */
export const count = n => {
    let r = 0;
    while (r < n) { r = r + 1; }
    return r;
};
/** @type {(n: number) => readonly number[]} */
export const sums = n => {
    let s = [0, 0];
    while (s[0] < n) {
        const i = s[0] + 1;
        s = [i, s[1] + i];
    }
    return s;
};
// lazy operands in the condition and in the block: thunks over the variable
/** @type {(n: number) => number} */
export const lazy = n => {
    let r = 0;
    while (r < n && r >= 0) { r = r % 2 === 0 ? r + 1 : r + 3; }
    return r;
};
export default [count(100), sums(10), lazy(10)];
