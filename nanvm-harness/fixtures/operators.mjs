/**
 * Compiled by `fjs compile` into the sibling `operators.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins every eager operator the grammar admits, each
 * printed as `(…)?` against `nanvm-lib`. `n` is itself an operation, not a
 * literal — a literal would be substituted at every use — so its result is
 * established once, in a `let` binding with the same `?`, and cloned at
 * each of the uses below.
 */
const n = 2 * 3;
export default [
    n + 1, n - 1, n * 2, n / 4, n % 4, n ** 2, -n, ~n,
    n === 6, n !== 6, n < 7, n <= 6, n > 7, n >= 6,
    n & 3, n | 1, n ^ 1, n << 1, n >> 1, n >>> 1,
    "a" + "b", 1 + 2 * 3,
];
