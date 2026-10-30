/**
 * The compiler demo examples of the operators pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 */

/** @type {Examples} */
const grouping = [
    ['Operator precedence', 'export default [1 + 2 * 3 ** 2, (1 + 2) * 3, 1 + 2 === 3 && 4 > 3];', 'operator-precedence'],
]

/** @type {Examples} */
const index = [
    ['Arithmetic', 'export default [1 + 2, 7 % 3, 2 ** 10, 5 > 3, ~5, 1 << 3];', 'arithmetic'],
    ['Logical not', 'export default [!1, !!"", !null, ![]];', 'logical-not'],
    ['typeof', 'export default [typeof 1, typeof "s", typeof null, typeof 1n, typeof (() => 1)];', 'typeof'],
    ['Laziness: && || ??', 'export default (...a) => [a[0] && a[1], a[0] || a[1], a[0] ?? a[1]];', 'logical-laziness'],
    ['Laziness: ?:', 'export default (...a) => a[0] ? a[1] : a[2];', 'conditional-laziness'],
]

/** @type {Examples} */
const comma = [
    ['Comma: the assertion form', 'const assert = (...a) => a[0] ? undefined : (() => { throw a[1]; })();\nexport default (...a) => (assert(a[0] >= 0, "negative"), a[0] + 2);', 'comma-the-assertion-form'],
    ['Comma: a detached call', 'const o = { f: (...a) => a.length };\nexport default [(0, o.f)(1, 2), (1, 2, 3)];', 'comma-a-detached-call'],
]

/** @type {Examples} */
const instanceOf = [
    ['instanceof', 'export default [[1] instanceof Array, [] instanceof (Array), null instanceof Array, !1 instanceof Array];', 'instanceof'],
]

/** @type {Examples} */
const inOperator = [
    ['in', 'export default ["x" in { x: 1 }, "x" in { x: undefined }, "0" in [7], "x" in {}, "x" in (() => 1)];', 'in'],
]

export default { grouping, index, comma, instanceOf, inOperator, all: [...grouping, ...index, ...comma, ...instanceOf, ...inOperator] }
