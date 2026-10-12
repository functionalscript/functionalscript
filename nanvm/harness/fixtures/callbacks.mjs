/**
 * Compiled by `fjs compile` into `../gen.fixtures/callbacks.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the callback members with a callback that captures state: an AOT-compiled closure called by the VM's own code, which sees its captured values and the element, index and array it is passed. The captured value is an argument of an enclosing function, so the closure has a non-empty frame; a module `const` would be folded into the callback and capture nothing. A plain non-capturing callback is `entry`'s.
 */
/** @type {(...a: readonly number[]) => readonly unknown[]} */
const run = (...a) => [
    [3, 1, 2].map(x => x * a[0]),
    [3, 1, 2].map((x, i) => x + i * a[0]),
    [3, 1, 2].filter(x => x > a[0] / 10),
    [3, 1, 2].reduce((s, x) => s + x * a[0], 0),
    [3, 1, 2].reduceRight((s, x) => s + x * a[0], ""),
    [3, 1, 2].find(x => x < a[0] && x > 1),
    [3, 1, 2].findIndex(x => x === a[0] - 8),
    [3, 1, 2].findLast(x => x > a[0] - 9),
    [3, 1, 2].findLastIndex(x => x > a[0]),
    [3, 1, 2].some(x => x === a[0] - 8),
    [3, 1, 2].every(x => x < a[0]),
    [3, 1, 2].flatMap(x => [x, x * a[0]]),
    [3, 1, 2].map((x, i, all) => all.length + i + a[0]),
];
export default run(10);
