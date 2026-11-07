/**
 * The compiler demo examples of the modules pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 * @import { Files } from '../../fjs/compiler/demo_files/types.ts'
 */

/** @type {Examples} */
const exports = [
    ['Named exports', 'export const a = 1;\nexport const b = [a, a];\nexport default 2;', 'named-exports'],
]

/** @type {Examples} */
const imports = [
    ['An import', 'import m from "./m.f.js";\nexport default m;', 'an-import'],
    ['A named import and a call', 'import m from "./m.f.js";\nimport { x } from "./n.f.js";\nexport default m(x);', 'a-named-import-and-a-call'],
    ['A module imported twice', 'import a from "./a.f.js";\nimport b from "./b.f.js";\nexport default [a, b];', 'a-module-imported-twice'],
    ['A cyclic import', 'import a from "./a.f.js";\nexport default a;', 'a-cyclic-import'],
]

/**
 * The files an example's main module imports, by the example's ID: what the
 * compiler demo writes into a box of its own for each, so the program links.
 * A stage page reads the main module alone.
 *
 * @type {readonly (readonly [id: string, files: Files])[]}
 */
const files = [
    ['an-import', [['m.f.js', 'export default 42;']]],
    ['a-named-import-and-a-call', [
        ['m.f.js', 'export default x => x * 2;'],
        ['n.f.js', 'export const x = 21;'],
    ]],
    ['a-module-imported-twice', [
        ['a.f.js', 'import shared from "./shared.f.js";\nexport default { from: "a", shared };'],
        ['b.f.js', 'import shared from "./shared.f.js";\nexport default { from: "b", shared };'],
        ['shared.f.js', 'export default { name: "shared object" };'],
    ]],
    ['a-cyclic-import', [['a.f.js', 'import main from "./input.f.js";\nexport default [main];']]],
]

export default { exports, imports, files, all: [...exports, ...imports] }
