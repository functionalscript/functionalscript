// What a call supplies and what a function takes: extra, omitted and explicit
// `undefined` arguments, a parameter nothing reads, the rest array returned,
// forwarded and spread, and a zero-arity function called with arguments.
/** @type {(...a: readonly unknown[]) => unknown} */
const first = (a, _b) => a;
/** @type {(...a: readonly unknown[]) => unknown} */
const second = (_a, b) => b;
/** @type {(...a: readonly unknown[]) => number} */
const none = () => 7;
/** @type {(...x: readonly unknown[]) => readonly unknown[]} */
const rest = (...x) => x;
/** @type {(...x: readonly unknown[]) => readonly unknown[]} */
const forward = (...x) => rest(...x);
/** @type {(a?: unknown, ...x: readonly unknown[]) => readonly unknown[]} */
const tail = (_a, ...x) => x;
const source = [1, 2, 3];
const spread = rest(...source);
const again = forward(...source);
export default [
    first.length,
    second.length,
    none.length,
    first(1, 2, 3, 4),
    second(1, 2, 3, 4),
    first() === undefined,
    second(1) === undefined,
    none(1, 2, 3),
    tail().length,
    tail(1).length,
    tail(1, undefined).length,
    tail(undefined, undefined, undefined).length,
    spread,
    spread === source,
    spread[0] === source[0],
    again,
    again === spread,
    rest() !== rest(),
    forward().length,
];
