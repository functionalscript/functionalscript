/**
 * Compiled by `fjs compile` into `../gen.fixtures/callbacks.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins the callback members with a callback that captures state: an AOT-compiled closure called by the VM's own code, which sees its captured values and the element, index and array it is passed. A plain non-capturing callback is `entry`'s.
 */
const k = 10;
const a = [3, 1, 2];
export default [
    a.map(x => x * k),
    a.map((x, i) => x + i * k),
    a.filter(x => x > k / 10),
    a.reduce((s, x) => s + x * k, 0),
    a.reduceRight((s, x) => s + x * k, ""),
    a.find(x => x < k && x > 1),
    a.findIndex(x => x === 2),
    a.findLast(x => x > k - 9),
    a.findLastIndex(x => x > k),
    a.some(x => x === k - 8),
    a.every(x => x < k),
    a.flatMap(x => [x, x * k]),
    a.map((x, i, all) => all.length + i),
];
