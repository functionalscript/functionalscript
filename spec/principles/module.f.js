/**
 * The compiler demo examples of the principles pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 */

/** @type {Examples} */
const overview = [
    ['Overview', 'const a = 1 + 2;\nconst checked = a.x;\nexport default [a, a, a * 3, a < 4 && a, (...x) => x, undefined];'],
]

/** @type {Examples} */
const failure = [
    ['A failure at run time', 'export default [1, 2][5].x;'],
    ['Parse error', 'export default {bad'],
]

export default { overview, failure, all: [...overview, ...failure] }
