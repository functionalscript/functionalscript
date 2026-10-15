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
    ['Comments', '// a line comment\nconst a = 1; /* a block\n   comment */\nexport default a;'],
]

/** @type {Examples} */
const whitespace = []

/** @type {Examples} */
const identifiers = []

/** @type {Examples} */
const stringEscapes = [
    ['String escapes', 'export default ["a\\nb", "\\u0041", "q\\"q", "back\\\\slash"];'],
    ['Hex escape', 'export default "\\x41";'],
]

export default { comments, whitespace, identifiers, stringEscapes }
