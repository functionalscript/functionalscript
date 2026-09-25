// A named-only module holding one export of each kind the harness's `run`
// tells apart (`nanvm-harness/src/lib.rs`).
export const answer = [42];
/** @param {...number} a */
export const add = (...a) => a[0] + a[1];
export const nothing = undefined;
/** @param {...{ readonly x: unknown }} a */
export const fails = (...a) => a[0].x;
