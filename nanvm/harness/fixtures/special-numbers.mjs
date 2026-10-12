/**
 * Compiled by `fjs compile` into `../gen.fixtures/special_numbers.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the numbers JSON cannot spell: `-0`, `NaN` and both
 * infinities. It has no JSON form, so `lib.rs` asserts its leaves by hand.
 */
export default [-0, NaN, Infinity, -Infinity];
