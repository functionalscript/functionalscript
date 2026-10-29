/**
 * Compiled by `fjs compile` into `../gen.fixtures/object_from_entries_not_array_throws.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// `Object.fromEntries` of a value that is not an array throws: JavaScript
// refuses a value it cannot iterate, and the language admits no other
// iterable as entries. This module throws at the call.
// @ts-expect-error — the argument TypeScript refuses.
export default Object.fromEntries(5);
