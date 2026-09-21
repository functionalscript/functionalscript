/**
 * Compiled by `fjs compile` into the sibling `throws.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the failure contract end to end: a bigint division
 * by zero throws in JavaScript, and the compiled module answers the thrown
 * value as its `Err` rather than panicking.
 */
export default 1n / 0n;
