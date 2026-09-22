/**
 * Compiled by `fjs compile` into the sibling `method.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the method call, `['.', o, 'f', ['|()', args]]`
 * (`fjs/edag/README.md`, Chains), as a chain: the read and the call are one
 * node and print as one expression, `Any::dot(…).end_call(…)`, the
 * arguments a thunk the read's own throw would leave untouched, and the
 * call reaches the function with its arguments. It does not observe the
 * receiver: no FunctionalScript function reads `this`, so what a receiver
 * means for a call — a built-in member function that reads it — is the
 * remaining task, and no fixture can observe it until one exists.
 */
/** @type {(...a: readonly unknown[]) => unknown} */
const f = (...a) => a[0];
const o = { f: f };
export default o.f(42);
