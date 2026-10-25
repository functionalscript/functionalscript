/**
 * The compiler demo examples of the lexical-grammar pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * lexical area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 */

/** @type {Examples} */
const comments = [
    ['Comments', '// a line comment\nconst a = 1; /* a block\n   comment */\nexport default a;', 'comments'],
]

/** @type {Examples} */
const whitespace = [
    ['Whitespace', 'export default [\n\t1,\n\t2 +\n\t\t3,\n];', 'whitespace'],
    ['Non-breaking space', 'export default\u00a01;', 'non-breaking-space'],
]

/** @type {Examples} */
const identifiers = [
    ['Identifiers', 'const $_a1 = 1;\nconst a_$1 = [$_a1];\nexport default { $_a1, a_$1 };', 'identifiers'],
    ['Non-ASCII identifier', 'const é = 1;\nexport default é;', 'non-ascii-identifier'],
]

/** @type {Examples} */
const stringEscapes = [
    ['String escapes', 'export default ["a\\nb", "\\u0041", "q\\"q", "back\\\\slash"];', 'string-escapes'],
    ['Hex escape', 'export default "\\x41";', 'hex-escape'],
]

export default { comments, whitespace, identifiers, stringEscapes, all: [...comments, ...whitespace, ...identifiers, ...stringEscapes] }
