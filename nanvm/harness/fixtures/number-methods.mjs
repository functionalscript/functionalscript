/**
 * Compiled by `fjs compile` into `../gen.fixtures/number-methods.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins a number's formatting members with arguments: fixed, precision and exponent forms, and the radix of `toString`.
 */
const n = 1234.5678;
export default [
    n.toFixed(2),
    n.toFixed(),
    n.toPrecision(6),
    n.toExponential(3),
    n.toExponential(),
    (255).toString(16),
    (-255).toString(2),
    (5n).toString(2),
];
