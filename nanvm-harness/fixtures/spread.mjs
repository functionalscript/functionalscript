/**
 * Compiled by `fjs compile` into `../gen.fixtures/spread.rs`, committed and
 * drift-checked by `npm run gen` (see `../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins spread (`spec/README.md`, Spread) end to end: an
 * array's elements and a string's code points spliced into an array literal
 * and into a call's arguments, a method call's included, as JavaScript
 * splices them, through `get_iterator`.
 */
const a = [1, 2];
/** @type {(...x: readonly unknown[]) => readonly unknown[]} */
const f = (...x) => x;
export default [[0, ...a, 3], [...'a😀'], f(...a, 4), [...a, ...a].length, a.at(...[1])];
