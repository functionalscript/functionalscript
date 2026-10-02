/**
 * The programs every compiler stage's demo offers in its examples drop-down.
 *
 * **One list for all the stages**, so a program picked on the tokenizer's page
 * can be found by the same name on the parser's, the EDAG's and the Rust page
 * — one program followed down the pipeline, not six unrelated lists. A stage
 * that finds a program uninteresting passes a shorter list; none re-spells
 * one.
 *
 * **A refused program is an example too.** `!x` and `typeof x` are valid
 * JavaScript the parser refuses today, and an import has no file set in a
 * browser, so the Rust output refuses it. Showing the refusal is the cheapest
 * regression table there is, and a demo's proof walks this list, so one that
 * stops behaving as its name says fails a test. A name says what an example
 * demonstrates, never that it is a bug.
 *
 * @module
 *
 * @import { Examples } from './types.ts'
 */

/** @type {Examples} */
export const examples = [
    ['Primitives', 'export default [1, "hi", true, null, undefined, 1n, -0];'],
    ['Objects', 'export default { x: 1, y: { z: "s" } };'],
    ['Sharing: a const used twice', 'const a = [1];\nexport default [a, a];'],
    ['Arithmetic', 'export default [1 + 2, 7 % 3, 2 ** 10, 5 > 3, ~5, 1 << 3];'],
    ['Laziness', 'const f = x => x > 0 ? x : -x;\nexport default [f(-3), 1 && 2, null ?? 5];'],
    ['Function with a rest parameter', 'export default (a, b, ...r) => [a, b, r];'],
    ['Closure', 'const k = 5;\nexport default x => y => x + y + k;'],
    ['Methods and properties', 'export default ["abc".length, [1, 2, 3].at(0), (1).toString()];'],
    ['Named exports', 'export const a = 1;\nexport const b = [a, a];\nexport default 2;'],
    ['A failure at run time', 'export default [1, 2][5].x;'],
    ['Refused: an import', 'import m from "./m.f.js";\nexport default m;'],
    ['Refused: logical not', 'export default !1;'],
    ['Refused: typeof', 'export default typeof 1;'],
    ['Parse error', 'export default {bad'],
]
