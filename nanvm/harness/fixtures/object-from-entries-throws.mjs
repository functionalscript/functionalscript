/**
 * Compiled by `fjs compile` into `../gen.fixtures/object_from_entries_throws.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// `Object.fromEntries` of an array whose element is not an object throws, as
// JavaScript's `TypeError` does: this module throws at the call.
// @ts-expect-error — the entry TypeScript refuses.
export default Object.fromEntries([["a", 1], 2]);
