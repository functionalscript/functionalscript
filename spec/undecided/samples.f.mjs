/**
 * One module per **open** row of the
 * [refused constructs](../todo/refused-constructs.md) register, by the
 * row's ID: valid JavaScript, which `fjs compile` refuses today and no
 * record yet says it should keep refusing, or start accepting.
 *
 * Each module is as small as the construct allows. Where the construct is
 * a statement, it sits in a function's body, the only place a statement
 * other than a `const` or an export is written, so that the refusal is of
 * the construct and not of where it is.
 *
 * @module
 *
 * @import { StringMap } from '../../fjs/types/object/types.ts'
 */

/** @type {StringMap<string>} */
export const samples = {
    'lex.trivia': 'export default\u000B1;\n',
    'op.comma': 'const f = a => { return a, 1; };\nexport default f(0);\n',
    'op.delete': 'const o = { a: 1 };\nexport default delete o.a;\n',
    'op.void': 'export default void 0;\n',
    'op.arguments': 'export default typeof arguments;\n',
    'op.unary-plus': 'export default +"1";\n',
    'op.import-call': 'export default import("./a.mjs");\n',
    'op.import-meta': 'export default import.meta.url;\n',
    'op.tagged-template': 'const tag = s => s[0];\nexport default tag`x`;\n',
    'acc.property-assignment': 'const f = o => { o.b = 1; return o; };\nexport default f({});\n',
    'name.forward-reference': 'const f = () => b;\nconst b = 1;\nexport default f();\n',
    'st.for-in-of': 'const f = a => { let s = 0; for (const x of a) { s = s + x; } return s; };\nexport default f([1, 2]);\n',
    'st.do-while': 'const f = () => { let i = 0; do { i = i + 1; } while (i < 3); return i; };\nexport default f();\n',
    'st.try': 'const f = () => { try { return 1; } catch { return 2; } };\nexport default f();\n',
    'st.debugger': 'const f = () => { debugger; return 1; };\nexport default f();\n',
    'st.label': 'const f = () => { let i = 0; x: while (i < 3) { i = i + 1; } return i; };\nexport default f();\n',
    'st.directive': '"use strict";\nexport default 1;\n',
    'st.literal-call': 'const f = () => { "a".trim(); return 1; };\nexport default f();\n',
    'decl.function': 'function f() { return 1; }\nexport default f();\n',
    'decl.generator': 'function* g() { yield 1; }\nexport default g;\n',
    'decl.accessor': 'export default { get a() { return 1; } };\n',
    'decl.method': 'export default { f() { return 1; } };\n',
    'decl.pattern-object-rest': 'const { a, ...r } = { a: 1, b: 2 };\nexport default r;\n',
    'decl.pattern-computed-key': 'const k = "a";\nconst { [k]: a } = { a: 1 };\nexport default a;\n',
    'mod.export-list': 'const a = 1;\nexport { a };\n',
    'mod.reexport': 'export * from "./a.f.js";\n',
    'mod.side-effect-import': 'import "./a.f.js";\nexport default 1;\n',
    'mod.string-import-name': 'import { "x" as y } from "./a.f.js";\nexport default y;\n',
    'mod.top-level-await': 'export default await 1;\n',
    'lit.octal': 'export default 0o7;\n',
    'lit.trailing-dot': 'export default 5.;\n',
    'lit.string-escape': 'export default "\\x41";\n',
    'lit.string-continuation': 'export default "a\\\nb";\n',
    'lit.template-escape': 'export default `\\x41`;\n',
}
