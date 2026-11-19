/**
 * Compiled by `fjs compile` into `../gen.fixtures/number_limits.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins finite numbers at the edge of the float format: the
 * smallest subnormal, the largest finite number, the first exponent JSON prints
 * in scientific form at each end, and the integers either side of exact
 * representation. Its JSON text is the independent check on each.
 */
const { MAX_VALUE: maximum, MIN_VALUE: minimum } = Number;
export default [
    5e-324, 1.7976931348623157e308, 1e21, 1e-7,
    0x1f_ffff_ffff_ffff, 0x20_0000_0000_0000, -0x1f_ffff_ffff_ffff,
    Number.MAX_VALUE, maximum,
    Number.MAX_VALUE === 1.7976931348623157e308, Number.MAX_VALUE * 2 === Infinity,
    Number.MIN_VALUE, minimum, Number.MIN_VALUE === 5e-324, Number.MIN_VALUE / 2 === 0,
    Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER === -0x1f_ffff_ffff_ffff,
];
