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
    ['Operator precedence', 'export default [1 + 2 * 3 ** 2, (1 + 2) * 3, 1 + 2 === 3 && 4 > 3];'],
]

/** @type {Examples} */
const index = [
    ['Arithmetic', 'export default [1 + 2, 7 % 3, 2 ** 10, 5 > 3, ~5, 1 << 3];'],
    ['Logical not', 'export default [!1, !!"", !null, ![]];'],
    ['typeof', 'export default [typeof 1, typeof "s", typeof null, typeof 1n, typeof (() => 1)];'],
    ['Laziness: && || ??', 'export default (...a) => [a[0] && a[1], a[0] || a[1], a[0] ?? a[1]];'],
    ['Laziness: ?:', 'export default (...a) => a[0] ? a[1] : a[2];'],
]

/** @type {Examples} */
const instanceOf = [
    ['instanceof', 'export default [[1] instanceof Array, [] instanceof (Array), null instanceof Array, !1 instanceof Array];'],
]

export default { grouping, index, instanceOf }
