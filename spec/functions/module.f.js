/**
 * The compiler demo examples of the functions pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 */

/** @type {Examples} */
const index = [
    ['Laziness', 'const f = x => x > 0 ? x : -x;\nexport default [f(-3), 1 && 2, null ?? 5];'],
]

/** @type {Examples} */
const parameters = [
    ['Function with a rest parameter', 'export default (a, b, ...r) => [a, b, r];'],
]

/** @type {Examples} */
const captures = [
    ['Closure', 'const k = 5;\nexport default x => y => x + y + k;'],
    ['Recursion', 'const fact = n => n < 2 ? 1 : n * fact(n - 1);\nexport default fact(5);'],
]

export default { index, parameters, captures, all: [...index, ...parameters, ...captures] }
