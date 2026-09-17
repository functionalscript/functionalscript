/**
 * Compiled by `fjs compile` into the sibling `sharing.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the generator's node-sharing path: `shared` is one
 * object referenced twice, printed as one `let` binding cloned at each
 * reference rather than two separate object literals.
 */
const shared = { x: 1 };
export default [shared, shared];
