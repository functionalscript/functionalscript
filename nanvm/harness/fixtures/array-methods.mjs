/**
 * Compiled by `fjs compile` into `../gen.fixtures/array_methods.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins one family's members that take arguments and no callback: an array's, answered by the VM and by Node alike, each producing a new array.
 */
const a = [3, 1, 2];
export default [
    a.slice(1),
    a.slice(-2, -1),
    a.concat([4], 5),
    [[1], [2, [3]]].flat(),
    a.includes(2),
    a.indexOf(2),
    a.lastIndexOf(9),
    a.with(1, 7),
    a.toReversed(),
    a.toSorted(),
    a.toSpliced(1, 1, 8, 9),
    a.join("-"),
];
