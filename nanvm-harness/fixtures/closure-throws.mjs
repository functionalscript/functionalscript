/**
 * Compiled by `fjs compile` into `../gen.fixtures/closure_throws.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`.
 */
// A failure computing a frame element fails when the closure is made, not
// when it is called: this module throws at `make(undefined)`.
/** @type {(...a: readonly any[]) => () => unknown} */
const make = (...a) => {
    const v = a[0].x;
    return () => v;
};
export default make(undefined);
