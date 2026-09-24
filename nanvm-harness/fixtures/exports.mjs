// Named-only: one export of each kind the harness must tell apart when it
// selects an export and reads or calls it (`nanvm-harness/src/lib.rs`).
export const answer = [42];
/** @type {(...a: readonly number[]) => number} */
export const add = (...a) => a[0] + a[1];
export const nothing = undefined;
// Called with no arguments, `a[0]` is `undefined`, so the read throws.
/** @type {(...a: readonly { readonly x: unknown }[]) => unknown} */
export const fails = (...a) => a[0].x;
