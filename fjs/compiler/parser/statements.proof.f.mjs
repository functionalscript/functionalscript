/**
 * The proof of a module's statements: call statements, `assert(a);` — a
 * call evaluated for its failure and its value discarded, read as a `const`
 * nothing can read
 * ([spec: call statements](../../../spec/functions/call-statements.md)) —
 * and the order statements stand in, what begins one, and which error a
 * malformed run of them reports first. Split off `./proof.f.mjs`, as
 * `./operators.proof.f.mjs` is, when that file outgrew what the website's
 * build accepts in one file — 128 KiB, which it passed at `b3a6e6c` —
 * along the seam its own sections drew. It reads the parser as that proof does, through the helpers it
 * exports.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 */

import { parseFromTokens } from './module.f.mjs'
import { expectModule, expectRefused, stringifyDjsModule, tokenizeString } from './proof.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'

/** A module's AST, which the source must be accepted to have. @type {(source: string) => import('./types.ts').ResolvedModule} */
const resolvedOf = source => {
    const [tag, value] = parseFromTokens(tokenizeString(source))
    assert(tag === 'ok', value)
    return value
}

/** A module's EDAG, as the lowering makes it. @type {(source: string) => unknown} */
const edagOf = source => unresolved(resolvedOf(source)).edag

/** A module run on the represented interpreter: its result, or its failure. @type {(source: string) => import('../../types/result/types.ts').Result<unknown, unknown>} */
const run = source => memo(assertOk(analysis(unresolved(resolvedOf(source)).edag)))({ args: [] })

const f = 'const f = (...a) => a[0] ? 1 : (() => { throw a[1]; })();'

export const proof = {
    // `f(x);` is `const _ = f(x);` where nothing can read `_`: the same
    // AST, and the same graph as the comma, `(f(x), rest)`.
    sugar: () => {
        assertEq(stringifyDjsModule(resolvedOf(`${f} f(1); export default 2;`)), stringifyDjsModule(resolvedOf(`${f} const _ = f(1); export default 2;`)))
        assertStructurallySame(edagOf(`${f} f(1); export default 2;`), edagOf(`${f} export default (f(1), 2);`))
        assertStructurallySame(
            edagOf(`${f} export default (...a) => { f(a[0]); return a; };`),
            edagOf(`${f} export default (...a) => (f(a[0]), a);`))
    },
    // It stands wherever a `const` does: before the exports and among the
    // exported `const`s, in a body, in a guard's block, in a loop's block
    // and in a case's — each anchored at that block's root, so the guard's
    // and the case's establish it only where JavaScript would.
    blocks: () => {
        expectModule('const f = (...a) => 1; f(1); export default 2;',
            "[\",\",[[\"()\",[\"=>\",0,[],1],[1]],[\"{}\",[[\":\",\"default\",2]]]]]")
        expectModule('const f = (...a) => 1; export const a = 1; f(a)\nexport const b = 2;',
            "[\",\",[[\"()\",[\"=>\",0,[],1],[1]],[\"{}\",[[\":\",\"a\",1],[\":\",\"b\",2]]]]]")
        assertStructurallySame(edagOf('export default (...a) => { a.f(1); return a; };'),
            ['{}', [[':', 'default', ['=>', 0, [], [',', [['.', ['rest'], 'f', ['|()', [1]]], ['rest']]]]]]])
        assertStructurallySame(edagOf('export default (...a) => { if (a[0]) { a.f(1); return 1; } return 2; };'),
            ['{}', [[':', 'default', ['=>', 0, [], ['?:', ['.', ['rest'], 0], [',', [['.', ['rest'], 'f', ['|()', [1]]], 1]], 2]]]]])
        assertStructurallySame(edagOf('export default (...a) => { switch (a[0]) { case 1: { a.f(1); return 1; } default: { return 2; } } };'),
            ['{}', [[':', 'default', ['=>', 0, [], ['?:', ['===', ['.', ['rest'], 0], 1], [',', [['.', ['rest'], 'f', ['|()', [1]]], 1]], 2]]]]])
        assertStructurallySame(edagOf('export default (...a) => { let r = 0; while (r < 1) { a.f(r); r = 1; } return r; };'),
            ['{}', [[':', 'default', ['=>', 0, [], ['()', ['=>', 1, [['rest']], ['?:', ['<', ['arg', 0], 1], [',', [['.', ['frame', 0], 'f', ['|()', [['arg', 0]]]], ['()', ['self'], [1]]]], ['arg', 0]]], [0]]]]]])
    },
    // Any call: of a name, of a member, guarded, a chain whose last step is
    // a call, a call of a call, and a static function's.
    shapes: () => {
        expectModule('const o = { f: (...a) => 1 }; o.f(1); o?.f(2); o.f?.(3); o?.f(4).g(5); o?.f?.(6)(7); export default 1;',
            "[\",\",[[\".\",[\"{}\",[[\":\",\"f\",[\"=>\",0,[],1]]]],\"f\",[\"|()\",[1]]],[\"?.\",[\"{}\",[[\":\",\"f\",[\"=>\",0,[],1]]]],\"f\",[\"|()\",[2]]],[\".\",[\"{}\",[[\":\",\"f\",[\"=>\",0,[],1]]]],\"f\",[\"|?.()\",[3]]],[\"?.\",[\"{}\",[[\":\",\"f\",[\"=>\",0,[],1]]]],\"f\",[\"|()\",[4],[\"|.\",\"g\",[\"|()\",[5]]]]],[\"?.\",[\"{}\",[[\":\",\"f\",[\"=>\",0,[],1]]]],\"f\",[\"|?.()\",[6],[\"|()\",[7]]]],[\"{}\",[[\":\",\"default\",1]]]]]")
        expectModule('const f = (...a) => f; f(1)(2); f?.(3); Object.is(1, 2); export default 1;',
            "[\",\",[[\"()\",[\"()\",[\"=>\",0,[],[\"self\"]],[1]],[2]],[\"?.()\",[\"=>\",0,[],[\"self\"]],[3]],[\"()\",[\"Object.is\"],[1,2]],[\"{}\",[[\":\",\"default\",1]]]]]")
    },
    // A statement that is no call is refused at its name: an operator's
    // result discarded is almost always a mistake, and a conversion is an
    // operator, not a call. An assignment outside a loop's block is
    // refused at its `=`, and a statement on the line of the one before it
    // without its `;` at its name, as JavaScript refuses both.
    refused: () => {
        for (const statement of [
            'x;',
            'x.y;',
            'x?.y;',
            'x(1).y;',
            'x?.(1).y;',
            'x?.y(1).z;',
            'x(1) + 1;',
            'x(1) ? 1 : 2;',
            'x(1) && x(2);',
            'x => 1;',
            'Number(x);',
            'String(x);',
            'Number();',
        ]) { expectRefused(`const x = 1; ${statement} export default 1;`, 'unexpected token', 14) }
        expectRefused('const x = 1; export default (...a) => { x; return a; };', 'unexpected token', 41)
        expectRefused('const x = 1; export default (...a) => { let r = 0; while (r) { x.y; r = 1; } return r; };', 'unexpected token', 64)
        expectRefused('const x = 1; Number?.(x); export default 1;', 'reserved word', 14)
        expectRefused('const x = 1; x = 2; export default 1;', 'unexpected token', 16)
        expectRefused('const x = (...a) => 1; x(1) x(2); export default 1;', 'unexpected token', 29)
        // a statement opening with `(`, `[` or a backtick is not read, since
        // each would continue the statement before it — a backtick as the
        // tagged template the grammar refuses at its head — so neither line
        // is split into a statement JavaScript would not see
        expectRefused('const x = (...a) => 1; (0, x)(1); export default 1;', 'unexpected token', 24)
        expectRefused('const x = (...a) => 1; (x(1)); export default 1;', 'unexpected token', 24)
        expectRefused('const x = 1; `a`.at(0); export default 1;', 'unexpected token', 14)
        expectRefused('const x = 1\n`a`.at(0)\nexport default 1;', 'unexpected token', 1)
    },
    // The call is evaluated, its value discarded, and its failure the
    // module's or the function's, as JavaScript's is.
    evaluated: () => {
        assertStructurallySame(run(`${f} f(1); export default 2;`), ['ok', ['{}', [[':', 'default', 2]]]])
        assertEq(run(`${f} f(0, 'boom'); export default 2;`)[0], 'error')
        assertEq(run(`${f} const g = (...a) => { f(a[0], 'no'); return 3; }; export default g(0);`)[0], 'error')
        assertStructurallySame(run(`${f} const g = (...a) => { f(a[0], 'no'); return 3; }; export default g(1);`), ['ok', ['{}', [[':', 'default', 3]]]])
    },
    // A syntax error the grammar finds is reported ahead of a semantic one,
    // wherever each sits.
    //
    // The grammar matches the whole module before the fold runs, so a malformed
    // suffix is found before any name is resolved. A statement run onto the
    // line of the one before it without a `;` is no grammar error: the fold
    // refuses it, in statement order, so a semantic error in an earlier
    // statement comes first. The hand-written parser
    // streamed, so it met an unresolved name first and said so. Both are true
    // of the input; they answer different questions about it. Pinned because
    // the reasoning is not recoverable from the positions alone.
    syntaxBeforeSemantic: [
        () => {
            /** @type {readonly(readonly[string, string, readonly[number, number]])[]} */
            const cases = [
                // was: const not found @1:11; a literal, since a name would
                // begin a call statement of its own
                ['const a = missing 1', 'unexpected token', [1, 19]],
                // was: const not found @1:11
                ['const a = missing', 'unexpected end', [1, 18]],
                // was: const not found @1:16
                ['export default missing 1', 'unexpected token', [1, 24]],
                // was: duplicate id @2:7
                ['const a = 1;\nconst a = 2 1', 'unexpected token', [2, 13]],
            ]
            for (const [source, message, position] of cases) {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', [source, tag])
                assertEq(value.message, message, source)
                const { metadata } = value
                assertStructurallySame(
                    metadata === null ? null : [metadata.line, metadata.column],
                    position,
                    source)
            }
        },
        () => {
            // with nothing malformed after it, the semantic error is still the
            // one reported — the change is which error wins, not whether names
            // are checked
            const [tag, value] = parseFromTokens(tokenizeString('export default missing;'))
            assert(tag === 'error', tag)
            assertEq(value.message, 'const not found')
            assertEq(value.metadata?.column, 16)
        },
        () => {
            // a statement run onto the line of the one before is the fold's
            // to refuse, in statement order — a `const` or a call statement
            // alike — so the earlier statement's error is the one reported
            for (const source of ['const a = missing const b = 1; export default 1;', 'const a = missing f(1); export default 1;']) {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'const not found', source)
                assertEq(value.metadata?.column, 11, source)
            }
        },
    ],
    // A JSON document is not a module: a statement begins with `import`,
    // `const`, `export` or a call statement's name, and never with another
    // value. `fjs/media/json` is the reader for these texts.
    jsonDocumentIsNotAModule: [
        () => {
            const tokenList = tokenizeString('null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('1')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('[]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('{"valid":"json"}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            // an identifier begins a call statement, and a module of
            // statements alone has no export, as one of constants has not
            const tokenList = tokenizeString('a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // an empty module has no `export default`
            const tokenList = tokenizeString('')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // …and neither has one that only declares constants
            const tokenList = tokenizeString('const a = 1;\n')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
    ],
    // Statements are ordered: imports, then constants, then `export default`.
    statementOrder: [
        () => {
            const tokenList = tokenizeString('import a from "a.f.js"; \n const b = 1; \n export default [a,b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, "[\"{}\",[[\":\",\"default\",[\"[]\",[[\".\",[\".\",[\"args\"],0],\"default\"],1]]]]]")
        },
        () => {
            const tokenList = tokenizeString('const b = 1; \n import a from "a.f.js"; \n export default [a,b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            // statement ordering is the grammar's shape, so a late `import`
            // is a token the grammar cannot use rather than a rule about
            // ordering it could name
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            // nothing follows `export default` but trivia
            const tokenList = tokenizeString('export default 1; \n const a = 2;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
    ],
    invalidModule:[
        () => {
            // `module` is not one of the statement keywords
            const tokenList = tokenizeString('module=null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            // a reference the module never declared, in a value position
            const tokenList = tokenizeString('export default a;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'const not found', obj)
        },
        () => {
            const tokenList = tokenizeString('export null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('export default = null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
    ],
    validWithConst:[
        () => {
            const tokenList = tokenizeString('const a = 1; \n const b = 2; \n export default 3;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, "[\",\",[1,2,[\"{}\",[[\":\",\"default\",3]]]]]")
        },
        () => {
            const tokenList = tokenizeString('const a = 1; \n const b = 2; \n export default b;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, "[\",\",[1,[\"{}\",[[\":\",\"default\",2]]]]]")
        },
        () => {
            const tokenList = tokenizeString('const a = 1; \n const b = 2; \n export default [b,a,b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, "[\"{}\",[[\":\",\"default\",[\"[]\",[2,1,2]]]]]")
        },
        () => {
            const tokenList = tokenizeString('const a = 1; \n const b = 2; \n export default {"1st":b,"2nd":a,"3rd":b};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== "[\"{}\",[[\":\",\"default\",[\"{}\",[[\":\",\"1st\",2],[\":\",\"2nd\",1],[\":\",\"3rd\",2]]]]]]") { throw result }
        },
    ],
    invalidWithConst:[
        () => {
            const tokenList = tokenizeString('const a = 1 const b = 2 export default 3')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('const = 1; \n const b = 2; \n export default 3;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('const a = 1; \n const a = 2; \n export default 3;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'duplicate id', obj)
        },
        () => {
            // No `;` after the const's value: the end of input comes where
            // the terminator belongs.
            const tokenList = tokenizeString('const a = 1')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end', obj)
        },
    ],
    validWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs"; \n export default a;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, "[\"{}\",[[\":\",\"default\",[\".\",[\".\",[\"args\"],0],\"default\"]]]]")
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs"; \n import b from "second/test.f.mjs"; \n export default [b, a, b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, "[\"{}\",[[\":\",\"default\",[\"[]\",[[\".\",[\".\",[\"args\"],1],\"default\"],[\".\",[\".\",[\"args\"],0],\"default\"],[\".\",[\".\",[\"args\"],1],\"default\"]]]]]]")
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs"; \n const b = null; \n export default [b, a, b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, "[\"{}\",[[\":\",\"default\",[\"[]\",[null,[\".\",[\".\",[\"args\"],0],\"default\"],null]]]]]")
        },
    ],
    invalidWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" export default a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('import a from \n export default a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('import a "test/test.f.mjs" \n export default a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('import from "test/test.f.mjs" \n export default a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs"; \n import a from "second/test.f.mjs"; \n export default [b, a, b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'duplicate id', obj)
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs"; \n const a = null; \n export default null;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'duplicate id', obj)
        },
    ],
}
