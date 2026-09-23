// Named parameters: each is bound to its position of the arguments, a
// missing one `undefined` and an extra one passed, and `length` is the
// declared count, an unused parameter included — `0` for a rest parameter.
/** @type {(...a: readonly number[]) => readonly number[]} */
const pair = (a, b) => [b, a];
/** @type {(a: number) => number} */
const one = a => a;
/** @type {(...a: readonly number[]) => number} */
const first = (a, b) => a;
/** @type {(...a: readonly number[]) => number} */
const rest = (...a) => a.length;
export default [pair(1, 2), pair(1, 2, 3), one(4), first(5), pair.length, one.length, first.length, rest.length];
