/**
 * The programs every compiler stage's demo offers in its examples drop-down.
 *
 * **One flat list for all six pages**, so a program picked on the
 * tokenizer's page can be found by the same name on the parser's, the EDAG's,
 * the serializer's, the Rust page and the side-by-side page — one program
 * followed down the pipeline, not six unrelated lists. Each demo offers the
 * whole list; none re-spells a program.
 *
 * **The first is the overview, and every page opens on it.** It carries one
 * of everything one program can hold — a `const` referenced six times, once
 * lazily; an unused `const` the compiler anchors; a function with a rest
 * parameter; numbers and `undefined` where a value sits — so each page
 * shows its central property before a reader has picked anything. It has no
 * import, which every output and the serializer would refuse, so no page
 * opens on a refusal.
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
    ['Overview', 'const a = 1 + 2;\nconst checked = a.x;\nexport default [a, a, a * 3, a < 4 && a, (...x) => x, undefined];'],
    ['Primitives', 'export default [1, "hi", true, null, undefined, 1n, -0, 0xFF, 0x10n];'],
    ['String escapes', 'export default ["a\\nb", "\\u0041", "q\\"q", "back\\\\slash"];'],
    ['Comments', '// a line comment\nconst a = 1; /* a block\n   comment */\nexport default a;'],
    ['Objects', 'export default { x: 1, y: { z: "s" } };'],
    ['A repeated object key', 'export default { a: 1, b: 2, a: 3 };'],
    ['Sharing: a const used twice', 'const a = [1];\nexport default [a, a];'],
    ['Sharing: a repeated expression', 'const a = 1 + 2;\nconst b = 1 + 2;\nexport default [a, a, b];'],
    ['Arithmetic', 'export default [1 + 2, 7 % 3, 2 ** 10, 5 > 3, ~5, 1 << 3];'],
    ['Operator precedence', 'export default [1 + 2 * 3 ** 2, (1 + 2) * 3, 1 + 2 === 3 && 4 > 3];'],
    ['Logical not', 'export default [!1, !!"", !null, ![]];'],
    ['typeof', 'export default [typeof 1, typeof "s", typeof null, typeof 1n, typeof (() => 1)];'],
    ['instanceof', 'export default [[1] instanceof Array, [] instanceof (Array), null instanceof Array, !1 instanceof Array];'],
    ['Number conversion', 'const xs = [10, 20, 30];\nexport default [Number("0x10"), Number(" 4 "), Number(1n), Number([7]), Number(null), xs[Number("2")]];'],
    ['Laziness', 'const f = x => x > 0 ? x : -x;\nexport default [f(-3), 1 && 2, null ?? 5];'],
    ['Laziness: && || ??', 'export default (...a) => [a[0] && a[1], a[0] || a[1], a[0] ?? a[1]];'],
    ['Laziness: ?:', 'export default (...a) => a[0] ? a[1] : a[2];'],
    ['Function with a rest parameter', 'export default (a, b, ...r) => [a, b, r];'],
    ['Closure', 'const k = 5;\nexport default x => y => x + y + k;'],
    ['Recursion', 'const fact = n => n < 2 ? 1 : n * fact(n - 1);\nexport default fact(5);'],
    ['Throw', 'export default (...a) => {\n    const reason = ["not implemented", a[0]];\n    throw reason;\n};'],
    ['Early return', 'export default (n) => {\n    if (n < 0) { return -1; }\n    if (n > 0) { return 1; }\n    return 0;\n};'],
    ['Shorthand members', 'const x = 1;\nconst y = [x];\nexport default { x, y };'],
    ['Methods and properties', 'export default ["abc".length, [1, 2, 3].at(0), (1).toString()];'],
    ['Optional chaining', 'const o = { a: { b: 1 }, f: x => [x, x] };\nconst n = null;\nexport default [o?.a.b, n?.a.b, n?.[0], o.f?.(2), n?.(2), (o?.a).b];'],
    ['The entry helper', 'const entry = (a, b) => {\n    const x = Object.getOwnPropertyDescriptor(a, b);\n    return x?.enumerable ? x.value : undefined;\n};\nexport default [entry({ k: 1 }, "k"), entry([7, 8], 1), entry("ab", 1), typeof entry];'],
    ['Named exports', 'export const a = 1;\nexport const b = [a, a];\nexport default 2;'],
    ['A failure at run time', 'export default [1, 2][5].x;'],
    ['An import', 'import m from "./m.f.js";\nexport default m;'],
    ['A named import and a call', 'import m from "./m.f.js";\nimport { x } from "./n.f.js";\nexport default m(x);'],
    ['Hex escape', 'export default "\\x41";'],
    ['Parse error', 'export default {bad'],
]
