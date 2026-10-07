/**
 * The programs every compiler stage's demo offers in its examples drop-down.
 *
 * **One flat list for the stages that use it**, so a program picked on the
 * tokenizer's page can be found by the same name on the parser's, the
 * serializer's, the Rust page and the side-by-side page — one program followed
 * down the pipeline, not five unrelated lists. Each of those demos offers the
 * whole list; none re-spells a program. The EDAG demo, [`edag/demo.f.mjs`](../edag/demo.f.mjs),
 * still has a list of its own, tuned to what its drawing has to say, and
 * does not use this one.
 *
 * **A refused program is an example too.** `"\x41"` is valid JavaScript the
 * front end refuses today, and an import has no file set in a browser, so
 * the Rust output refuses it. Showing the refusal is the cheapest
 * regression table there is, and a demo's proof walks this list, so one that
 * stops behaving as its name says fails a test. Which stage refuses which
 * program differs — the parser takes an import the Rust output cannot link —
 * so a name says what the program is, and each demo's proof says what its
 * stage refuses.
 *
 * @module
 *
 * @import { Examples } from './types.ts'
 */

/** @type {Examples} */
export const examples = [
    ['Primitives', 'export default [1, "hi", true, null, undefined, 1n, -0];'],
    ['String escapes', 'export default ["a\\nb", "\\u0041", "q\\"q", "back\\\\slash"];'],
    ['Comments', '// a line comment\nconst a = 1; /* a block\n   comment */\nexport default a;'],
    ['Objects', 'export default { x: 1, y: { z: "s" } };'],
    ['A repeated object key', 'export default { a: 1, b: 2, a: 3 };'],
    ['Sharing: a const used twice', 'const a = [1];\nexport default [a, a];'],
    ['Arithmetic', 'export default [1 + 2, 7 % 3, 2 ** 10, 5 > 3, ~5, 1 << 3];'],
    ['Operator precedence', 'export default [1 + 2 * 3 ** 2, (1 + 2) * 3, 1 + 2 === 3 && 4 > 3];'],
    ['Logical not', 'export default [!1, !!"", !null, ![]];'],
    ['typeof', 'export default [typeof 1, typeof "s", typeof null, typeof 1n, typeof (() => 1)];'],
    ['Laziness', 'const f = x => x > 0 ? x : -x;\nexport default [f(-3), 1 && 2, null ?? 5];'],
    ['Function with a rest parameter', 'export default (a, b, ...r) => [a, b, r];'],
    ['Closure', 'const k = 5;\nexport default x => y => x + y + k;'],
    ['Recursion', 'const fact = n => n < 2 ? 1 : n * fact(n - 1);\nexport default fact(5);'],
    ['Methods and properties', 'export default ["abc".length, [1, 2, 3].at(0), (1).toString()];'],
    ['Named exports', 'export const a = 1;\nexport const b = [a, a];\nexport default 2;'],
    ['A failure at run time', 'export default [1, 2][5].x;'],
    ['An import', 'import m from "./m.f.js";\nexport default m;'],
    ['Hex escape', 'export default "\\x41";'],
    ['Parse error', 'export default {bad'],
]
