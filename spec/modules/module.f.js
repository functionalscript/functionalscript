/**
 * The compiler demo examples of the modules pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 */

/** @type {Examples} */
const exports = [
    ['Named exports', 'export const a = 1;\nexport const b = [a, a];\nexport default 2;', 'named-exports'],
]

/** @type {Examples} */
const imports = [
    ['An import', 'import m from "./m.f.js";\nexport default m;', 'an-import'],
    ['A named import and a call', 'import m from "./m.f.js";\nimport { x } from "./n.f.js";\nexport default m(x);', 'a-named-import-and-a-call'],
]

export default { exports, imports, all: [...exports, ...imports] }
