/**
 * Compiled by `fjs compile` into `../gen.fixtures/bigint_operators.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the operators on bigints through the compile path: arithmetic, bitwise and shift operators across the end of `i64`, the sign rules of division and remainder, relational operators and strict equality with a bigint of another size, and `typeof`. Operands are kept inside the native word limit. Operands come from an operation, as `operators.mjs` does, so that no literal is substituted.
 */
const a = 3n * 4_000_000_000n;
const b = -(5n * 1_000_000_007n);
const big = 9_223_372_036_854_775_807n + a;
export default [
    a + b, a - b, a * b, a / b, a % b, b / a, b % a, -b,
    big + 1n, big - (big - a + a), big * 3n, big / a, big % a, -big, big ** 2n, a ** 3n,
    a & b, a | b, a ^ b, ~a, ~b, a << 70n, big << 1n, big >> 3n, b >> 1n,
    a < b, a <= a, big > a, b >= a, a < big, big < b,
    a === 12_000_000_000n, a !== b, big === big + 0n, 0n === -0n, typeof a,
];
