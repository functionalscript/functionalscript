/**
 * Compiled by `fjs compile` into `../gen.fixtures/object_entries_throws.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// `Object.entries` of a nullish value throws, as `ToObject` does, where an
// object spread of one copies nothing: this module throws at the call.
export default [
    // @ts-expect-error — the value TypeScript refuses to spread.
    { ...null },
    // @ts-expect-error — and to enumerate.
    Object.entries(null),
];
