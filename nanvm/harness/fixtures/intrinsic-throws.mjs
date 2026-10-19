/**
 * Compiled by `fjs compile` into `../gen.fixtures/intrinsic_throws.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// An intrinsic on a receiver without the member throws as the member call
// throws, calling `undefined`: this module throws at the call.
/** @type {(s: unknown, start: unknown, end: unknown) => unknown} */
const slice = (s, start, end) => /** @type {{ slice: (a: unknown, b: unknown) => unknown }} */ (s).slice(start, end);
export default [
    slice("ab", 0, 1),
    slice(5, 0, 1),
];
