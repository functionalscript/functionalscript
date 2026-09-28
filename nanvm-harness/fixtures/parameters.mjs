// Fixed values, exact rest tails, closure captures and per-call rest identity.
/** @type {(a?: unknown, b?: unknown, c?: unknown, ...x: readonly unknown[]) => readonly any[]} */
const f = (a, b, c, ...x) => [a, b, c, x];
/** @type {(a?: unknown, ...x: readonly unknown[]) => (b?: unknown, ...y: readonly unknown[]) => readonly unknown[]} */
const capture = (a, ...x) => (b, ...y) => [a, x, b, y, x, y];
const g = capture(1, 2, 3);
const one = g(4, 5);
const two = g(6);
export default [
    f.length,
    f(1, 2, 3, 4, 5),
    f()[0] === undefined,
    f(undefined)[1] === undefined,
    f(1, 2, 3, undefined)[3][0] === undefined,
    f(1, 2, 3, undefined)[3].length,
    g.length,
    one,
    one[1] === one[4],
    one[3] === one[5],
    one[1] === two[1],
    one[3] !== two[3],
];
