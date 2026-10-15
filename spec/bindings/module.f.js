/**
 * The compiler demo examples of the bindings pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 */

/** @type {Examples} */
const constants = [
    ['Sharing: a const used twice', 'const a = [1];\nexport default [a, a];'],
    ['Sharing: a repeated expression', 'const a = 1 + 2;\nconst b = 1 + 2;\nexport default [a, a, b];'],
]

/** @type {Examples} */
const destructuring = [
    ['Destructuring', 'const { a, "b": [c, d] } = { a: 1, b: [2, 3] };\nconst [e] = "hi";\nconst f = ([x, { y }], z) => [x, y, z];\nexport default [a, c, d, e, f([4, { y: 5 }], 6)];'],
]

export default { constants, destructuring }
