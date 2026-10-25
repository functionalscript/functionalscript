/**
 * The compiler demo examples of the values pages, one list per page.
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
    ['Primitives', 'export default [1, "hi", true, null, undefined, 1n, -0, 0xFF, 0x10n];', 'primitives'],
]

/** @type {Examples} */
const templateLiterals = [
    ['Template literals', 'const name = "world";\nexport default [`Hello, ${name}!`, `${1}${2}`, `literal \\${name}`];', 'template-literals'],
]

/** @type {Examples} */
const objects = [
    ['Objects', 'export default { x: 1, y: { z: "s" } };', 'objects'],
    ['A repeated object key', 'export default { a: 1, b: 2, a: 3 };', 'a-repeated-object-key'],
    ['Shorthand members', 'const x = 1;\nconst y = [x];\nexport default { x, y };', 'shorthand-members'],
]

export default { index, templateLiterals, objects, all: [...index, ...templateLiterals, ...objects] }
