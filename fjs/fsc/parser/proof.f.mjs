/**
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 */

import { _parseSyntaxFromTokens, parseFromTokens } from './module.f.mjs'
import { _own, run } from '../ast/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { _stringifyTree } from '../module.f.mjs'
import { stringify } from '../../media/json/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

/** @type {(s: string) => readonly DjsTokenWithMetadata[]} */
const tokenizeString = s => toArray(tokenize(stringToList(s))(''))

const stringifyDjsModule = _stringifyTree

/**
 * `count` copies of `element`, comma-joined.
 *
 * Built by repeating the *string*, which allocates the result directly, rather
 * than allocating an array and then writing over it: `Array(n).fill(x)` mutates
 * what it just made, and proof code is held to the same immutability rule as
 * everything else here.
 *
 * @type {(element: string) => (count: number) => string}
 */
const repeated = element => count => `${`${element},`.repeat(count - 1)}${element}`

/**
 * `count` distinct `k<i>:<i>` properties, comma-joined — the object form of
 * {@link repeated}, where each entry has to differ.
 *
 * @type {(count: number) => string}
 */
const numberedMembers = count =>
    Array.from({ length: count }, (_, i) => `k${i}:${i}`).join(',')

/** @type {(kind: 'ws' | 'nl' | 'null' | 'true' | 'false' | 'undefined' | 'eof' | ';', line: number) => DjsTokenWithMetadata} */
const proofKind = (kind, line) => ({ token: { kind }, metadata: { path: 'a.js', line, column: 1 } })

/** @type {(value: string, line: number) => DjsTokenWithMetadata} */
const proofId = (value, line) => ({ token: { kind: 'id', value }, metadata: { path: 'a.js', line, column: 1 } })

export const proof = {
    namedExports: {
        results: () => {
            for (const [source, expected] of /** @type {const} */ ([
                ['export const a=5;', { a: 5 }],
                ['const base=5; export const z=base; const local=z; export const a=local; export default a;', { a: 5, default: 5, z: 5 }],
                ['export const a=undefined; export default undefined;', { a: undefined, default: undefined }],
                ['export const __proto__=7;', Object.fromEntries([['__proto__', 7]])],
            ])) {
                const module = unwrap(parseFromTokens(tokenizeString(source)))
                const result = unwrap(run(module[1])([]))
                assertStructurallySame(result, expected)
                assertStructurallySame(Object.keys(/** @type {object} */ (result)), Object.keys(expected))
            }
        },
        syntax: () => {
            const source = unwrap(_parseSyntaxFromTokens(tokenizeString('const x=1; export const a=x; const y=a; export const b=y;')))
            assertEq(source.exported, null)
            assertStructurallySame(source.consts.map(c => c.exported), [false, true, false, true])
            assertStructurallySame(source.consts.map(c => c.declaration.name.token), [
                { kind: 'id', value: 'x' }, { kind: 'id', value: 'a' }, { kind: 'id', value: 'y' }, { kind: 'id', value: 'b' },
            ])
        },
        errors: () => {
            for (const source of [
                'export const a=1; export const a=2;',
                'const a=1; export const a=2;',
                'export const a=1; const a=2;',
                'import a from "./x"; export const a=1;',
                'export const a=a;', 'export const a=b; export const b=1;',
                'export const then=1;', 'export const then=()=>1;',
                'export const default=1;', 'export const await=1;', 'export const undefined=1;',
                'export const a=1', 'export const a=1; import b from "./x";',
                'export default 1; export const a=2;', 'export default 1; export default 2;',
                'export { a };', 'export let a=1;', 'const a=1;', '',
                'export const f=()=>{return;};', 'export const f=()=>{};',
                'export const f=()=>{return\n1;};',
            ]) { assertEq(parseFromTokens(tokenizeString(source))[0], 'error', source) }
            const duplicate = parseFromTokens(tokenizeString('export const a=1;\nexport const a=2;'))
            assert(duplicate[0] === 'error')
            assertEq(duplicate[1].metadata?.line, 2)
            assertEq(duplicate[1].metadata?.column, 14)
            const reserved = parseFromTokens(tokenizeString('export const then=1;'))
            assert(reserved[0] === 'error')
            assertEq(reserved[1].metadata?.column, 14)
        },
    },
    sourceBlocks: {
        // Literal expectations pin syntax before lowering can erase it.
        explicitReturn: () => {
            const expression = unwrap(_parseSyntaxFromTokens(tokenizeString('export default () => 7;')))
            const block = unwrap(_parseSyntaxFromTokens(tokenizeString('export default () => { return 7; };')))
            assertStructurallySame(expression.exported, ['=>', ['names', []], ['primitive', 7]])
            assertStructurallySame(block.exported, ['=>', ['names', []], ['block', [['return', ['primitive', 7]]]]])
        },
        orderedDeclarations: () => {
            const { exported } = unwrap(_parseSyntaxFromTokens(tokenizeString(
                'export default () => { const x = 1; const y = 2; return [x, y]; };')))
            assert(exported !== null && exported[0] === '=>')
            const body = exported[2]
            assert(body[0] === 'block')
            const [first, second, last] = body[1]
            assert(first[0] === 'const' && second[0] === 'const' && last[0] === 'return')
            assertStructurallySame(first[1].name.token, { kind: 'id', value: 'x' })
            assertStructurallySame(second[1].name.token, { kind: 'id', value: 'y' })
            assertStructurallySame(first[1].value, ['primitive', 1])
            assertStructurallySame(second[1].value, ['primitive', 2])
            assertEq(first[1].name.metadata.column, 30)
            assertEq(second[1].name.metadata.column, 43)
            const returned = last[1]
            assert(returned[0] === 'array')
            const [x, y] = returned[1]
            assert(x[0] === 'ref' && y[0] === 'ref')
            assertStructurallySame(x[1].token, first[1].name.token)
            assertStructurallySame(y[1].token, second[1].name.token)
        },
        nestedBlocks: () => {
            const { exported } = unwrap(_parseSyntaxFromTokens(tokenizeString(
                'export default () => { return () => { return 7; }; };')))
            assertStructurallySame(exported, ['=>', ['names', []], ['block', [
                ['return', ['=>', ['names', []], ['block', [['return', ['primitive', 7]]]]]],
            ]]])
        },
        syntaxRefusals: () => {
            for (const source of [
                'export default () => {};',
                'export default () => { return; };',
                'export default () => { return 7 };',
                'export default () => { return 7; const x = 1; };',
                'export default () => { return 7; return 8; };',
                'export default ()\n=> 7;',
                'export default () => { return\n7; };',
                'export default () => { return /*\n*/ 7; };',
            ]) {
                assertEq(_parseSyntaxFromTokens(tokenizeString(source))[0], 'error')
                assertEq(parseFromTokens(tokenizeString(source))[0], 'error')
            }
            // A line break inside the returned group is still admitted.
            const source = 'export default () => { return (\n7\n); };'
            assertEq(_parseSyntaxFromTokens(tokenizeString(source))[0], 'ok')
            assertEq(parseFromTokens(tokenizeString(source))[0], 'ok')
        },
    },
    // The corpus that proved parity against the hand-written state machine,
    // kept as fixed expectations now that the state machine is gone.
    //
    // Every value below was **recorded from that parser** before it was deleted,
    // not written by hand and not read off the replacement — so these still say
    // "the parser behaves as it always did", which a test written against the
    // new implementation could not.
    parseCorpus: [
        () => {
            for (const [source, expected] of [
                ["export default null;", "[[],[[\"object\",[[\"default\",null]]]]]"],
                ["export default true;", "[[],[[\"object\",[[\"default\",true]]]]]"],
                ["export default false;", "[[],[[\"object\",[[\"default\",false]]]]]"],
                ["export default undefined;", "[[],[[\"object\",[[\"default\",undefined]]]]]"],
                ["export default 0.1;", "[[],[[\"object\",[[\"default\",0.1]]]]]"],
                ["export default 1.1e+2;", "[[],[[\"object\",[[\"default\",110]]]]]"],
                // the three numbers JSON cannot spell, as words — and the
                // third of them as the negation it is written as, the `-`
                // being a prefix the grammar reads rather than part of the
                // word. The one line of this corpus the language moved
                // under; every other value still says what it recorded.
                ["export default [NaN, Infinity, -Infinity];", "[[],[[\"object\",[[\"default\",[\"array\",[NaN,Infinity,[\"-\",Infinity]]]]]]]]"],
                ["export default \"abc\";", "[[],[[\"object\",[[\"default\",\"abc\"]]]]]"],
                ["export default 1234567890n;", "[[],[[\"object\",[[\"default\",1234567890n]]]]]"],
                ["export default [];", "[[],[[\"object\",[[\"default\",[\"array\",[]]]]]]]"],
                ["export default [1];", "[[],[[\"object\",[[\"default\",[\"array\",[1]]]]]]]"],
                ["export default [1,];", "[[],[[\"object\",[[\"default\",[\"array\",[1]]]]]]]"],
                ["export default [[]];", "[[],[[\"object\",[[\"default\",[\"array\",[[\"array\",[]]]]]]]]]"],
                ["export default [0,[1,[2,[]]],3];", "[[],[[\"object\",[[\"default\",[\"array\",[0,[\"array\",[1,[\"array\",[2,[\"array\",[]]]]]],3]]]]]]]"],
                ["export default [1234567890n];", "[[],[[\"object\",[[\"default\",[\"array\",[1234567890n]]]]]]]"],
                ["export default {};", "[[],[[\"object\",[[\"default\",[\"object\",[]]]]]]]"],
                ["export default {\"a\":1};", "[[],[[\"object\",[[\"default\",[\"object\",[[\"a\",1]]]]]]]]"],
                ["export default {a: 1};", "[[],[[\"object\",[[\"default\",[\"object\",[[\"a\",1]]]]]]]]"],
                ["export default {\"a\":1,};", "[[],[[\"object\",[[\"default\",[\"object\",[[\"a\",1]]]]]]]]"],
                ["export default {[\"a\"]:1};", "[[],[[\"object\",[[\"default\",[\"object\",[[\"a\",1]]]]]]]]"],
                ["export default {a:1,\"b\":2,[\"c\"]:3,};", "[[],[[\"object\",[[\"default\",[\"object\",[[\"a\",1],[\"b\",2],[\"c\",3]]]]]]]]"],
                ["export default {\"a\":{\"b\":{\"c\":[\"d\"]}}};", "[[],[[\"object\",[[\"default\",[\"object\",[[\"a\",[\"object\",[[\"b\",[\"object\",[[\"c\",[\"array\",[\"d\"]]]]]]]]]]]]]]]]"],
                ["export default {\"a\":true,\"b\":false,\"c\":null,\"d\":undefined};", "[[],[[\"object\",[[\"default\",[\"object\",[[\"a\",true],[\"b\",false],[\"c\",null],[\"d\",undefined]]]]]]]]"],
                ["export default {a:1,a:2};", "[[],[[\"object\",[[\"default\",[\"object\",[[\"a\",1],[\"a\",2]]]]]]]]"],
                ["export default {[\"__proto__\"]: 1};", "[[],[[\"object\",[[\"default\",[\"object\",[[\"__proto__\",1]]]]]]]]"],
                ["const a = 1;\nexport default a;", "[[],[1,[\"object\",[[\"default\",[\"cref\",0]]]]]]"],
                ["const a = 1;\nconst b = 2;\nexport default [a,b];", "[[],[1,2,[\"object\",[[\"default\",[\"array\",[[\"cref\",0],[\"cref\",1]]]]]]]]"],
                ["import x from \"m\";\nexport default x;", "[[{\"json\":false,\"specifier\":\"m\"}],[[\"object\",[[\"default\",[\"aref\",0]]]]]]"],
                ["import x from \"m\";\nconst a = 1;\nexport default a;", "[[{\"json\":false,\"specifier\":\"m\"}],[1,[\"object\",[[\"default\",[\"cref\",0]]]]]]"],
                ["import x from \"m\";\nimport y from \"n\";\nexport default [x,y];", "[[{\"json\":false,\"specifier\":\"m\"},{\"json\":false,\"specifier\":\"n\"}],[[\"object\",[[\"default\",[\"array\",[[\"aref\",0],[\"aref\",1]]]]]]]]"],
                ["// c\nexport default 1;", "[[],[[\"object\",[[\"default\",1]]]]]"],
                ["/* c */ export default 1;", "[[],[[\"object\",[[\"default\",1]]]]]"],
                ["\n\n export default 1; \n\n", "[[],[[\"object\",[[\"default\",1]]]]]"],
                ["const from = 1;\nexport default from;", "[[],[1,[\"object\",[[\"default\",[\"cref\",0]]]]]]"],
                ["export default { from: 2, default: 3, with: 4 };", "[[],[[\"object\",[[\"default\",[\"object\",[[\"from\",2],[\"default\",3],[\"with\",4]]]]]]]]"],
                // `;` ends every statement and a newline does not, as DataJS
                // has it (spec/README.md, module structure); a `;` on its own
                // line, or several statements on one, are the same module.
                // The last case is a normalized DataJS document verbatim:
                // one line, `$`-names, every statement `;`-terminated.
                ["const a = 1;\nexport default a;", "[[],[1,[\"object\",[[\"default\",[\"cref\",0]]]]]]"],
                ["export default 1;", "[[],[[\"object\",[[\"default\",1]]]]]"],
                ["const a = 1;export default a;", "[[],[1,[\"object\",[[\"default\",[\"cref\",0]]]]]]"],
                ["import x from \"m\";const a = [x];export default [x,a];", "[[{\"json\":false,\"specifier\":\"m\"}],[[\"array\",[[\"aref\",0]]],[\"object\",[[\"default\",[\"array\",[[\"aref\",0],[\"cref\",0]]]]]]]]"],
                ["const a = 1 ; // c\nexport default a ;", "[[],[1,[\"object\",[[\"default\",[\"cref\",0]]]]]]"],
                // whitespace may precede the `;`, newlines included — a
                // newline is trivia, so the value and its terminator may sit
                // on different lines
                ["export default 1\n;", "[[],[[\"object\",[[\"default\",1]]]]]"],
                ["const a = 1\n;\nexport default a;", "[[],[1,[\"object\",[[\"default\",[\"cref\",0]]]]]]"],
                ["const $0=[1];export default [$0,$0];", "[[],[[\"array\",[1]],[\"object\",[[\"default\",[\"array\",[[\"cref\",0],[\"cref\",0]]]]]]]]"],
                // a word that denotes a value still names a property: it is
                // an `IdentifierName` in JavaScript, which reads it as the
                // string, and `{ "NaN": 1 }` has always denoted that object
                ["export default {NaN: 1, undefined: 2, true: 3};", "[[],[[\"object\",[[\"default\",[\"object\",[[\"NaN\",1],[\"undefined\",2],[\"true\",3]]]]]]]]"],
                ["const a = {NaN: 1};export default a.NaN;", "[[],[[\"object\",[[\"NaN\",1]]],[\"object\",[[\"default\",[\".\",[\"cref\",0],\"NaN\"]]]]]]"],
            ]) {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', [source, tag])
                assertEq(stringifyDjsModule(value), expected, source)
            }
        },
        () => {
            /** @type {readonly(readonly[string, string, readonly[number, number] | null])[]} */
            const cases = [
                ["42", "unexpected token", [1, 1]],
                ["", "unexpected end", [1, 1]],
                ["export default", "unexpected end", [1, 15]],
                ["[1,2]", "unexpected token", [1, 1]],
                ["{\"a\":1}", "unexpected token", [1, 1]],
                ["export default [", "unexpected end", [1, 17]],
                ["export default {", "unexpected end", [1, 17]],
                ["const a = 1 export default a", "unexpected token", [1, 13]],
                ["export default 1 2", "unexpected token", [1, 18]],
                ["export default {a}", "unexpected token", [1, 18]],
                ["export default {:1}", "unexpected token", [1, 17]],
                ["export default [,]", "unexpected token", [1, 17]],
                ["import x from y\nexport default x", "unexpected token", [1, 15]],
                ["export x from \"m\"\nexport default 1", "unexpected token", [1, 8]],
                ["const = 1\nexport default 1", "unexpected token", [1, 7]],
                ["export default {[1]:2}", "unexpected token", [1, 18]],
                // one terminator per statement: a second `;` is not an empty
                // statement, it is a stray token the next rule rejects,
                // however much trivia separates it from the first
                ["export default 1;;", "unexpected token", [1, 18]],
                ["const a = 1;;\nexport default a", "unexpected token", [1, 13]],
                ["const a = 1;\n;export default a", "unexpected token", [2, 1]],
                [";export default 1", "unexpected token", [1, 1]],
                ["export default ;", "unexpected token", [1, 16]],
                ["export default 1\nconst b = 2", "unexpected token", [2, 1]],
                // `;` ends every statement, and neither a newline nor the end
                // of input does: a newline is trivia, read past, so a missing
                // `;` is found at what came instead — the next statement's
                // keyword, or the end of input, where the `eof` token is
                ["import x from \"m\"", "unexpected end", [1, 18]],
                ["const a = 1", "unexpected end", [1, 12]],
                ["export default 1", "unexpected end", [1, 17]],
                ["export default 1\n", "unexpected end", [2, 1]],
                ["export default 1 // c", "unexpected end", [1, 22]],
                ["const a = 1\nexport default a;", "unexpected token", [2, 1]],
                ["import x from \"m\"\nexport default x;", "unexpected token", [2, 1]],
                ["import x from \"m\"\nconst a = x;\nexport default a;", "unexpected token", [2, 1]],
                ["const a = 1;\nconst b = 2\nexport default b;", "unexpected token", [3, 1]],
                ["const a = 1;\nconst a = 2;\nexport default a;", "duplicate id", [2, 7]],
                ["import x from \"m\";\nimport x from \"n\";\nexport default x;", "duplicate id", [2, 8]],
                ["import x from \"m\";\nconst x = 1;\nexport default x;", "duplicate id", [2, 7]],
                ["export default zzz;", "const not found", [1, 16]],
                // `NaN` and `Infinity` are reserved, as `undefined` is, and
                // reserved is about *binding*: each may name a property,
                // where JavaScript has an `IdentifierName` and reads the
                // word as a string, and none may take a name of its own, so
                // the refusal is the fold's `reserved word` and not the
                // grammar's `unexpected token` — the same answer `const if`
                // gets. `{NaN: 1}` and `a.NaN` are accepted above.
                ["const NaN = 1;\nexport default NaN;", "reserved word", [1, 7]],
                ["import Infinity from \"m\";\nexport default Infinity;", "reserved word", [1, 8]],
                ["export default (...undefined) => undefined;", "reserved word", [1, 20]],
                // a statement wrong in both halves answers for the half a
                // reader meets first: the name, not the initializer, which
                // is why the binding name is checked before the value is
                // read — `const if = missing;` answered `const not found`
                // at `missing` until it was
                ["const NaN = missing;\nexport default 1;", "reserved word", [1, 7]],
                ["const if = missing;\nexport default 1;", "reserved word", [1, 7]],
                ["const a = 1;\nconst a = missing;\nexport default 1;", "duplicate id", [2, 7]],
                // `-Infinity` is no name in either language, and it is two
                // tokens here, so the `-` is what a key position answers at
                ["export default {-Infinity: 1};", "unexpected token", [1, 17]],
                ["const undefined = 1;\nexport default undefined;", "reserved word", [1, 7]],
                ["const a = zzz;\nexport default a;", "const not found", [1, 11]],
                // a `const` naming itself is a reference before its declaration,
                // which JavaScript refuses too; it used to name the entry
                // being defined, and denote the entry before it
                ["const a = a;\nexport default a;", "const not found", [1, 11]],
                ["const a = [1];\nconst b = { x: b };\nexport default [a, b];", "const not found", [2, 16]],
                ["export default [zzz];", "const not found", [1, 17]],
                ["export default {a: zzz};", "const not found", [1, 20]],
                ["export default {__proto__: 1};", "__proto__ requires the computed key form", [1, 17]],
                ["export default {\"__proto__\": 1};", "__proto__ requires the computed key form", [1, 17]],
                ["import x from \"m\";\nimport x from \"n\";\nimport y from \"o\";\nexport default y;", "duplicate id", [2, 8]],
                ["const a = 1;\nconst a = 2;\nconst b = 3;\nexport default b;", "duplicate id", [2, 7]],
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
    ],
    // Wide and deep values. A list is right-recursive, so 5,000 siblings
    // are 5,000 levels of tree: the machine builds it on a heap stack, each
    // list node's mapping prepends one item to what its tail returned, and
    // the resolution walks the value over a stack of its own — no walk
    // recurses. See `containerStackCost` for the wider case.
    stackSafety: [
        () => {
            const source = `export default [${repeated('null')(5000)}];`
            const tokens = tokenizeString(source)
            assertEq(parseFromTokens(tokens)[0], 'ok')
        },
        () => {
            const source = `export default [${repeated('{}')(5000)}];`
            const tokens = tokenizeString(source)
            assertEq(parseFromTokens(tokens)[0], 'ok')
        },
        () => {
            const source = `export default ${'['.repeat(5000)}${']'.repeat(5000)};`
            const tokens = tokenizeString(source)
            assertEq(parseFromTokens(tokens)[0], 'ok')
        },
        () => {
            // wide objects walk the member list rather than the element list
            const source = `export default {${numberedMembers(5000)}};`
            const tokens = tokenizeString(source)
            assertEq(parseFromTokens(tokens)[0], 'ok')
        },
    ],
    // A chain of lazy operators, or of conditionals, as deep as the source
    // that built it, at the bar `containerStackCost` sets: a lazy chain
    // folds left through the same reader as an eager one, and a conditional
    // nests to the right through its arms — each arm a value already mapped
    // by the time the conditional's own mapping runs, so the reader never
    // recurses, and the resolution walks the three operands over its own
    // explicit stack. Neither shape is bounded by what a human writes: the
    // eager ladder's own overflow was found at this depth, not reasoned away.
    lazyStackCost: [
        () => {
            const [tag] = parseFromTokens(tokenizeString(`export default 1${' && 1'.repeat(20000)};`))
            assert(tag === 'ok', tag)
        },
        () => {
            const [tag] = parseFromTokens(tokenizeString(`export default 1${' || 1 && 1'.repeat(20000)};`))
            assert(tag === 'ok', tag)
        },
        () => {
            const [tag] = parseFromTokens(tokenizeString(`export default 1${' ?? 1'.repeat(20000)};`))
            assert(tag === 'ok', tag)
        },
        () => {
            // nested to the right through the else arm
            const [tag] = parseFromTokens(tokenizeString(`export default ${'1 ? 2 : '.repeat(20000)}3;`))
            assert(tag === 'ok', tag)
        },
        () => {
            // and through the then arm, whose `:` closes each in turn
            const [tag] = parseFromTokens(tokenizeString(`export default ${'1 ? '.repeat(20000)}2${' : 3'.repeat(20000)};`))
            assert(tag === 'ok', tag)
        },
    ],
    // A syntax error is reported ahead of a semantic one, wherever each sits.
    //
    // The grammar matches the whole module before the fold runs, so a malformed
    // suffix is found before any name is resolved. The hand-written parser
    // streamed, so it met an unresolved name first and said so. Both are true
    // of the input; they answer different questions about it. Pinned because
    // the reasoning is not recoverable from the positions alone.
    syntaxBeforeSemantic: [
        () => {
            /** @type {readonly(readonly[string, string, readonly[number, number]])[]} */
            const cases = [
                // was: const not found @1:11
                ['const a = missing x', 'unexpected token', [1, 19]],
                // was: const not found @1:11
                ['const a = missing', 'unexpected end', [1, 18]],
                // was: const not found @1:16
                ['export default missing 1', 'unexpected token', [1, 24]],
                // was: duplicate id @2:7
                ['const a = 1;\nconst a = 2 x', 'unexpected token', [2, 13]],
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
    ],
    // The tokenizer's EOF contract, checked through the parser rather than
    // through `splitEof` alone.
    //
    // The parser requires exactly one `eof`, in final position, because the
    // backend synthesizes its own logical end and a second marker would be a
    // symbol the grammar has no rule for. Neither stream can come from the
    // tokenizer, so only a hand-built list reaches these.
    eofContract: [
        () => {
            const wellFormed = [
                proofId('export', 1), proofKind('ws', 1), proofId('default', 1),
                proofKind('ws', 1), proofKind('null', 1), proofKind(';', 1), proofKind('eof', 1),
            ]
            assertEq(parseFromTokens(wellFormed)[0], 'ok')
        },
        () => {
            // no `eof`: the state machine read this as a complete module
            const noEof = [
                proofId('export', 1), proofKind('ws', 1), proofId('default', 1),
                proofKind('ws', 1), proofKind('null', 1), proofKind(';', 1),
            ]
            const [tag, value] = parseFromTokens(noEof)
            assert(tag === 'error', tag)
            assertEq(value.message, 'missing end-of-input token')
        },
        () => {
            // a second `eof`: likewise invisible to the state machine
            const twoEof = [
                proofId('export', 1), proofKind('ws', 1), proofId('default', 1),
                proofKind('ws', 1), proofKind('null', 1), proofKind(';', 1), proofKind('eof', 1), proofKind('eof', 2),
            ]
            const [tag, value] = parseFromTokens(twoEof)
            assert(tag === 'error', tag)
            assertEq(value.message, 'end-of-input token is not final')
        },
        () => {
            const [tag, value] = parseFromTokens([])
            assert(tag === 'error', tag)
            assertEq(value.message, 'missing end-of-input token')
        },
    ],
    // A lexical failure ends the token stream at an `error` token and emits no
    // `eof`. `splitEof` reads a missing `eof` that way rather than as a broken
    // tokenizer contract, and reports the error where it happened — so that
    // reading is pinned here against the real tokenizer, alongside the position
    // the current parser reports for the same input.
    lexicalErrorStreamShape: [
        () => {
            const tokens = tokenizeString('const a = "abc')
            assertEq(tokens.length, 1)
            assertEq(tokens[0].token.kind, 'error')
            assertEq(tokens[0].metadata.column, 11)
        },
        () => {
            const [tag, value] = parseFromTokens(tokenizeString('const a = "abc'))
            assert(tag === 'error', tag)
            assertEq(value.metadata?.line, 1)
            assertEq(value.metadata?.column, 11)
        },
        () => {
            // anchored at the `/*` that was never closed, not at the end of
            // input — the same convention the unterminated string above uses
            const [tag, value] = parseFromTokens(tokenizeString('const a = /* x'))
            assert(tag === 'error', tag)
            assertEq(value.metadata?.column, 11)
        },
    ],
    // An object's members stand in the order they are written, as JavaScript
    // reads the same literal, and a repeated key keeps its first position
    // and takes its last value. The parser used to sort them, which the
    // subset law over the DataJS corpus found: the graph a module denotes
    // has an order, and a reader that changes it reads another graph. The
    // syntax keeps more than the value: the members as written, an
    // integer-like key where it stands and a repeated key twice, which
    // EDAG's object constructor takes and a plain object cannot hold.
    membersAsWritten: () => {
        const [tag, value] = parseFromTokens(tokenizeString('export default {"b": 1, "1": 2, "b": 3};'))
        assert(tag === 'ok', tag)
        assertEq(stringifyDjsModule(value), '[[],[["object",[["default",["object",[["b",1],["1",2],["b",3]]]]]]]]')
        const object = _own(unwrap(run(value[1])([])), 'default')
        assert(typeof object === 'object' && object !== null && !(object instanceof Array), object)
        assertEq(Object.keys(object).join(), '1,b')
        assertEq(object.b, 3)
    },
    // A property access is `['.', base, key]`, the base any value and the
    // accesses before it, the key the constant written; a key naming the
    // prototype chain is refused at the key, in either spelling, and the
    // errors come in document order as everywhere else.
    access: {
        forms: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('const a = {}; export default a.b;', '[[],[["object",[]],["object",[["default",[".",["cref",0],"b"]]]]]]')
            expect('const a = {}; export default a["b c"];', '[[],[["object",[]],["object",[["default",[".",["cref",0],"b c"]]]]]]')
            expect('const a = []; export default a[0];', '[[],[["array",[]],["object",[["default",[".",["cref",0],0]]]]]]')
            // an index is a constant key, a string or a number token, and
            // the sign was only ever one because the fold made `-1.5` a
            // number. It is two tokens now, so a negative key is written as
            // the string it names — which is the key either spelling gives
            expect('const a = []; export default a["-1.5"];', '[[],[["array",[]],["object",[["default",[".",["cref",0],"-1.5"]]]]]]')
            expect('const a = {}; export default a.b[1].default;', '[[],[["object",[]],["object",[["default",[".",[".",[".",["cref",0],"b"],1],"default"]]]]]]')
            // any value takes accesses, a literal as a reference does
            expect('export default [1].length;', '[[],[["object",[["default",[".",["array",[1]],"length"]]]]]]')
            expect('export default "ab"[0];', '[[],[["object",[["default",[".","ab",0]]]]]]')
            expect('export default { a: [1] }.a[0];', '[[],[["object",[["default",[".",[".",["object",[["a",["array",[1]]]]],"a"],0]]]]]]')
            expect('export default null.x;', '[[],[["object",[["default",[".",null,"x"]]]]]]')
            expect('export default true.x;', '[[],[["object",[["default",[".",true,"x"]]]]]]')
            expect('const n = -1; export default n.x;', '[[],[["-",1],["object",[["default",[".",["cref",0],"x"]]]]]]')
            expect('const a = []; export default [a.length, a["length"]];', '[[],[["array",[]],["object",[["default",["array",[[".",["cref",0],"length"],[".",["cref",0],"length"]]]]]]]]')
            // a prototype name is a key like any other: only reading it is refused
            expect('export default { push: 1, toString: 2 };', '[[],[["object",[["default",["object",[["push",1],["toString",2]]]]]]]]')
            expect('import m from "./m.f.js"; export default [m.x, { y: m["x"] }];', '[[{"json":false,"specifier":"./m.f.js"}],[["object",[["default",["array",[[".",["aref",0],"x"],["object",[["y",[".",["aref",0],"x"]]]]]]]]]]]')
        },
        // `-1 .x` is `-(1 .x)` in JavaScript, and it is that here: the `-`
        // is a prefix the grammar reads, so the negation stands outside the
        // access rather than inside the literal. An access on a numeric
        // literal is an access like any other, and `-0n` needs no sign to
        // tell it by, there being no fold left to lose one.
        numeric: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default -1 .x;', '[[],[["object",[["default",["-",[".",1,"x"]]]]]]]')
            expect('export default -0 .x;', '[[],[["object",[["default",["-",[".",0,"x"]]]]]]]')
            expect('export default -1n .x;', '[[],[["object",[["default",["-",[".",1n,"x"]]]]]]]')
            expect('export default -0n .x;', '[[],[["object",[["default",["-",[".",0n,"x"]]]]]]]')
            expect('export default -Infinity.x;', '[[],[["object",[["default",["-",[".",Infinity,"x"]]]]]]]')
            expect('export default -1["x"];', '[[],[["object",[["default",["-",[".",1,"x"]]]]]]]')
            // and without a sign the access is all there is
            expect('export default 1 .x;', '[[],[["object",[["default",[".",1,"x"]]]]]]')
            expect('export default 0n.x;', '[[],[["object",[["default",[".",0n,"x"]]]]]]')
            expect('export default NaN.x;', '[[],[["object",[["default",[".",NaN,"x"]]]]]]')
            expect('export default Infinity["x"];', '[[],[["object",[["default",[".",Infinity,"x"]]]]]]')
        },
        prohibited: () => {
            /** @type {(source: string, column: number) => void} */
            const expect = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'prohibited property name')
                assertEq(value.metadata?.column, column)
            }
            expect('const a = {}; export default a.__proto__;', 32)
            expect('const a = {}; export default a["__proto__"];', 32)
            expect('const a = {}; export default a.constructor;', 32)
            expect('const a = {}; export default a["constructor"];', 32)
            expect('const a = {}; export default a.b.constructor.c;', 34)
            // every name a built-in prototype gives a value, in either
            // spelling, `length` excepted
            expect('const a = []; export default a.push;', 32)
            expect('const a = []; export default a["toString"];', 32)
            expect('const a = {}; export default a.hasOwnProperty;', 32)
            expect('const a = ""; export default a.at;', 32)
            expect('const a = 1; export default a.toFixed;', 31)
            expect('const a = {}; export default a.valueOf;', 32)
        },
        // the base is resolved first, so an unbound base is reported before
        // a prohibited key, and a prohibited key before an unbound name after it
        order: () => {
            const [tag, value] = parseFromTokens(tokenizeString('export default [b.__proto__, a];'))
            assert(tag === 'error', tag)
            assertEq(`${value.message} at ${value.metadata?.column}`, 'const not found at 17')
            const [tag2, value2] = parseFromTokens(tokenizeString('const b = {}; export default [b.__proto__, a];'))
            assert(tag2 === 'error', tag2)
            assertEq(`${value2.message} at ${value2.metadata?.column}`, 'prohibited property name at 33')
        },
    },
    // The one prefix operator. `-` is a token the grammar reads, so what it
    // takes is a whole value with its steps — JavaScript's reading — and
    // what it may take is JavaScript's `UnaryExpression`: not an arrow
    // function, which is why `-(...a) => 1` is a syntax error in both.
    neg: {
        forms: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default -1;', '[[],[["object",[["default",["-",1]]]]]]')
            expect('export default -1n;', '[[],[["object",[["default",["-",1n]]]]]]')
            expect('export default -0;', '[[],[["object",[["default",["-",0]]]]]]')
            expect('export default -Infinity;', '[[],[["object",[["default",["-",Infinity]]]]]]')
            // `-NaN` is a value in JavaScript and is one here, where the
            // fold made it an error token
            expect('export default -NaN;', '[[],[["object",[["default",["-",NaN]]]]]]')
            expect('export default -"2";', '[[],[["object",[["default",["-","2"]]]]]]')
            expect('export default -[1];', '[[],[["object",[["default",["-",["array",[1]]]]]]]]')
            expect('export default -{a:1};', '[[],[["object",[["default",["-",["object",[["a",1]]]]]]]]]')
            // right-recursive, so a negation takes a negation
            expect('export default - -1;', '[[],[["object",[["default",["-",["-",1]]]]]]]')
            expect('export default - - -1;', '[[],[["object",[["default",["-",["-",["-",1]]]]]]]]')
            // and inside a body, where the prefix is the body's own value
            expect('export default (...a) => -a[0];', '[[],[["object",[["default",["=>",0,[["-",[".",["args"],0]]]]]]]]]')
        },
        refused: () => {
            /** @type {(source: string, column: number) => void} */
            const expect = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'unexpected token')
                assertEq(value.metadata?.column, column)
            }
            // `--` is the one decrement token, which the language has no
            // rule for, so it is refused where it is written and never read
            // as a negation of a negation — `- -1` is how that is spelled
            expect('export default --1;', 16)
            // an arrow function is no `UnaryExpression`: `-(...a) => 1` is a
            // syntax error in JavaScript, so the operand rule takes every
            // value but a function. The `(` is not what fails — a group
            // is an operand, `-((...a) => 1)` — so the refusal is at what
            // the `(` opens: the `...`, exactly where JavaScript's is, or
            // the `)` of an empty list, which is no value to group either
            expect('export default -(...a) => 1;', 18)
            expect('export default -() => 1;', 18)
            // and it is the *operand rule* that refuses it, not the one
            // branch: the rule names itself, so a `-` one deeper reaches it
            // again, and a body's `-` takes the same rule rather than the
            // body's own. Each of the three references is load-bearing —
            // point any of them at `value` and the function is admitted
            expect('export default - -(...a) => 1;', 20)
            expect('export default (...b) => -(...a) => 1;', 28)
            expect('export default (...b) => - -(...a) => 1;', 30)
        },
    },
    // Stage A of `spec/todo/2340-operators.md`: arithmetic, strict
    // comparison, and bitwise, each read as `[tag, left, right]` — the
    // binary `-` told from `neg`'s own unary one by length, `**`
    // right-associative, and every operator above `unary` — never a value
    // or a body themselves, the same reason `neg`'s operand rule refuses a
    // function above.
    operators: {
        forms: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            // arithmetic, left-associative, and its own precedence within
            expect('export default 1 + 2 * 3;', '[[],[["object",[["default",["+",1,["*",2,3]]]]]]]')
            expect('export default 1 * 2 + 3;', '[[],[["object",[["default",["+",["*",1,2],3]]]]]]')
            expect('export default 5 - 2 - 1;', '[[],[["object",[["default",["-",["-",5,2],1]]]]]]')
            expect('export default 6 / 4 / 2;', '[[],[["object",[["default",["/",["/",6,4],2]]]]]]')
            expect('export default 6 % 4 % 3;', '[[],[["object",[["default",["%",["%",6,4],3]]]]]]')
            // `**` right-associative, and above it in precedence
            expect('export default 2 ** 3 ** 2;', '[[],[["object",[["default",["**",2,["**",3,2]]]]]]]')
            // `**`'s own right operand reaches back into a full `unary`, so
            // a `-`/`~` stands there without parentheses, as it does in
            // JavaScript
            expect('export default 2 ** -2;', '[[],[["object",[["default",["**",2,["-",2]]]]]]]')
            expect('export default 2 ** ~2;', '[[],[["object",[["default",["**",2,["~",2]]]]]]]')
            expect('export default 2 ** - -2;', '[[],[["object",[["default",["**",2,["-",["-",2]]]]]]]]')
            // parentheses are the only way to raise a negation to a power,
            // or to negate one, matching JavaScript exactly
            expect('export default (-2) ** 2;', '[[],[["object",[["default",["**",["-",2],2]]]]]]')
            expect('export default -(2 ** 2);', '[[],[["object",[["default",["-",["**",2,2]]]]]]]')
            expect('export default ~1 & 2;', '[[],[["object",[["default",["&",["~",1],2]]]]]]')
            // strict comparison and bitwise, in JavaScript's own precedence
            expect('export default 1 + 2 < 3 * 4;', '[[],[["object",[["default",["<",["+",1,2],["*",3,4]]]]]]]')
            expect('export default 1 <= 2 >= 1;', '[[],[["object",[["default",[">=",["<=",1,2],1]]]]]]')
            expect('export default 2 > 1;', '[[],[["object",[["default",[">",2,1]]]]]]')
            expect('export default 1 < 2 === 3 < 4;', '[[],[["object",[["default",["===",["<",1,2],["<",3,4]]]]]]]')
            expect('export default 1 !== 2 === (3 !== 4);', '[[],[["object",[["default",["===",["!==",1,2],["!==",3,4]]]]]]]')
            expect('export default 1 << 2 + 3;', '[[],[["object",[["default",["<<",1,["+",2,3]]]]]]]')
            expect('export default 256 >> 4 >> 1;', '[[],[["object",[["default",[">>",[">>",256,4],1]]]]]]')
            expect('export default -1 >>> 16 >>> 8;', '[[],[["object",[["default",[">>>",[">>>",["-",1],16],8]]]]]]')
            expect('export default 1 & 2 | 3 ^ 4;', '[[],[["object",[["default",["|",["&",1,2],["^",3,4]]]]]]]')
            // a group as an operand, and steps/power bound tighter than a layer
            expect('export default (1 + 2) * 3;', '[[],[["object",[["default",["*",["+",1,2],3]]]]]]')
            expect('const a = [1]; export default a[0] * 2;', '[[],[["array",[1]],["object",[["default",["*",[".",["cref",0],0],2]]]]]]')
            expect('export default 2 ** 2 * 3;', '[[],[["object",[["default",["*",["**",2,2],3]]]]]]')
            // a function's body is its own operand, the whole expression
            // its greedy operand rather than the outer layer's own
            expect('export default (...a) => 1 + 2 * 3;', '[[],[["object",[["default",["=>",0,[["+",1,["*",2,3]]]]]]]]]')
            // a group around a function is an ordinary operand once more
            expect('export default 1 * ((...a) => 2);', '[[],[["object",[["default",["*",1,["=>",0,[2]]]]]]]]')
        },
        refused: () => {
            /** @type {(source: string, column: number) => void} */
            const expect = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'unexpected token')
                assertEq(value.metadata?.column, column)
            }
            // a function is no operand of a binary operator, unparenthesized:
            // an operand's own `(` is `unary`'s restricted one, a group
            // alone, so `...` is refused right there, one token earlier
            // than `neg`'s own — its operand rule takes `paren`, the
            // choice a function shares, and refuses at what its own body
            // cannot spell instead
            expect('export default 1 * (...a) => 2;', 21)
            // an empty group is no value either, refused at the `)`
            expect('export default 1 + () => 2;', 21)
            // JavaScript refuses `**` immediately after a unary-prefixed
            // operand, full stop — no reading admitted without parentheses
            // — so `unaryOperand` carries no `powTail` of its own, at any
            // depth of `-`/`~` nesting, whether the operand is bare or
            // itself parenthesized
            expect('export default -2 ** 2;', 19)
            expect('export default ~2 ** 2;', 19)
            expect('export default - -2 ** 2;', 21)
            expect('export default ~ ~2 ** 2;', 21)
            expect('export default - (2) ** 2;', 22)
            // the same restriction recurses through `**`'s own right
            // operand: `2 ** -2 ** 2` reads its own right side as an
            // exponentiation in turn, and `-2 ** 2` refuses there exactly
            // as it does standing alone
            expect('export default 2 ** -2 ** 2;', 24)
        },
        scope: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            // both operands are resolved, in order
            expect('export default 1 + zzz;', 'const not found', 20)
            expect('export default zzz + 1;', 'const not found', 16)
        },
        // Stage B: the lazy operators, `[tag, left, right]` exactly as the
        // eager ones are — laziness is no shape difference here — above
        // `bitwiseOr`, `&&` below `||`, and `??` a chain of its own that
        // mixes with neither, refused at the operator that would mix them.
        lazy: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default 1 && 2;', '[[],[["object",[["default",["&&",1,2]]]]]]')
            expect('export default 1 || 2;', '[[],[["object",[["default",["||",1,2]]]]]]')
            expect('export default 1 ?? 2;', '[[],[["object",[["default",["??",1,2]]]]]]')
            // left-associative, each of them
            expect('export default 1 && 2 && 3;', '[[],[["object",[["default",["&&",["&&",1,2],3]]]]]]')
            expect('export default 1 || 2 || 3;', '[[],[["object",[["default",["||",["||",1,2],3]]]]]]')
            expect('export default 1 ?? 2 ?? 3;', '[[],[["object",[["default",["??",["??",1,2],3]]]]]]')
            // `&&` binds tighter than `||`, whichever opens the chain
            expect('export default 1 || 2 && 3;', '[[],[["object",[["default",["||",1,["&&",2,3]]]]]]]')
            expect('export default 1 && 2 || 3;', '[[],[["object",[["default",["||",["&&",1,2],3]]]]]]')
            expect('export default 1 && 2 || 3 && 4 || 5;', '[[],[["object",[["default",["||",["||",["&&",1,2],["&&",3,4]],5]]]]]]')
            expect('export default 1 || 2 && 3 && 4 || 5 && 6;', '[[],[["object",[["default",["||",["||",1,["&&",["&&",2,3],4]],["&&",5,6]]]]]]]')
            // and every eager operator binds tighter than any of them
            expect('export default 1 | 2 && 3 + 4;', '[[],[["object",[["default",["&&",["|",1,2],["+",3,4]]]]]]]')
            expect('export default 1 === 2 ?? 3 ** 4;', '[[],[["object",[["default",["??",["===",1,2],["**",3,4]]]]]]]')
            expect('export default -1 || ~2;', '[[],[["object",[["default",["||",["-",1],["~",2]]]]]]]')
            // a group is an operand, and mixes what the bare chain may not
            expect('export default (1 ?? 2) || 3;', '[[],[["object",[["default",["||",["??",1,2],3]]]]]]')
            expect('export default 1 ?? (2 || 3);', '[[],[["object",[["default",["??",1,["||",2,3]]]]]]]')
            expect('export default (1 && 2).x;', '[[],[["object",[["default",[".",["&&",1,2],"x"]]]]]]')
            // a function's body is its own operand, the whole chain
            expect('export default (...a) => a && 1 || 2;', '[[],[["object",[["default",["=>",0,[["||",["&&",["args"],1],2]]]]]]]]')
            expect('export default 1 && ((...a) => 2);', '[[],[["object",[["default",["&&",1,["=>",0,[2]]]]]]]]')
        },
        lazyRefused: () => {
            /** @type {(source: string, column: number) => void} */
            const expect = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'unexpected token')
                assertEq(value.metadata?.column, column)
            }
            // `??` beside `&&`/`||` at one nesting is a syntax error in
            // JavaScript, not a precedence question, and the grammar's
            // shape refuses it at the second operator: a chain committed to
            // one has no round for the other
            expect('export default 1 ?? 2 || 3;', 23)
            expect('export default 1 ?? 2 && 3;', 23)
            expect('export default 1 && 2 ?? 3;', 23)
            expect('export default 1 || 2 ?? 3;', 23)
            expect('export default 1 || 2 && 3 ?? 4;', 28)
            // a function is no operand of a lazy operator unparenthesized,
            // as of no eager one
            expect('export default 1 && (...a) => 2;', 22)
            // `?.` is optional chaining, a token the language has no rule
            // for: refused at the token, which the tokenizer marks
            expect('export default 1?.x;', 17)
        },
        // The conditional, `['?:', condition, then, else]` — the one node
        // of three operands, above the short-circuit level, its arms whole
        // values, so a nested conditional associates to the right.
        conditional: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default 1 ? 2 : 3;', '[[],[["object",[["default",["?:",1,2,3]]]]]]')
            expect('export default 1?2:3;', '[[],[["object",[["default",["?:",1,2,3]]]]]]')
            expect('export default 1 ? 2 : 3 ? 4 : 5;', '[[],[["object",[["default",["?:",1,2,["?:",3,4,5]]]]]]]')
            expect('export default 1 ? 2 ? 3 : 4 : 5;', '[[],[["object",[["default",["?:",1,["?:",2,3,4],5]]]]]]')
            // the condition is the whole short-circuit chain, and each arm
            // takes one of its own
            expect('export default 1 && 2 ? 3 || 4 : 5 ?? 6;', '[[],[["object",[["default",["?:",["&&",1,2],["||",3,4],["??",5,6]]]]]]]')
            expect('export default 1 + 2 ? 3 : 4;', '[[],[["object",[["default",["?:",["+",1,2],3,4]]]]]]')
            // an arm may be a function, its body ending where `:` cannot
            // continue it — `1 ? () => 2 : 3` is the function and the else
            // arm, as JavaScript reads it — or an object, an array, a group
            expect('export default 1 ? () => 2 : 3;', '[[],[["object",[["default",["?:",1,["=>",0,[2]],3]]]]]]')
            expect('export default 1 ? 2 : () => 3 ? 4 : 5;', '[[],[["object",[["default",["?:",1,2,["=>",0,[["?:",3,4,5]]]]]]]]]')
            expect('export default 1 ? { x: 2 } : [3];', '[[],[["object",[["default",["?:",1,["object",[["x",2]]],["array",[3]]]]]]]]')
            expect('export default (1 ? 2 : 3).x;', '[[],[["object",[["default",[".",["?:",1,2,3],"x"]]]]]]')
            expect('export default [1 ? 2 : 3, { a: 4 ? 5 : 6 }];', '[[],[["object",[["default",["array",[["?:",1,2,3],["object",[["a",["?:",4,5,6]]]]]]]]]]]')
            expect('export default (...a) => a ? 1 : 2;', '[[],[["object",[["default",["=>",0,[["?:",["args"],1,2]]]]]]]]')
            expect('export default -1 ? -2 : ~3;', '[[],[["object",[["default",["?:",["-",1],["-",2],["~",3]]]]]]]')
            // three operands, resolved in order: the condition first, then
            // each arm, whether or not the program establishes it
            expect('const a = 1; export default a ? a : a;', '[[],[1,["object",[["default",["?:",["cref",0],["cref",0],["cref",0]]]]]]]')
        },
        conditionalRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default 1 ? 2;', 'unexpected token', 21)
            expect('export default 1 ? : 3;', 'unexpected token', 20)
            expect('export default 1 ? 2 : 3 : 4;', 'unexpected token', 26)
            // every operand is resolved, an unselected arm included: a name
            // is checked where it is written, as JavaScript's early errors are
            expect('export default zzz ? 1 : 2;', 'const not found', 16)
            expect('export default 1 ? zzz : 2;', 'const not found', 20)
            expect('export default 1 ? 2 : zzz;', 'const not found', 24)
            expect('export default 1 && zzz;', 'const not found', 21)
            expect('export default zzz ?? 1;', 'const not found', 16)
        },
    },
    memberOrder: () => {
        const [tag, value] = parseFromTokens(tokenizeString('export default {"b": 1, "a": 2, "b": 3, "c": {"y": 0, "x": 0}};'))
        assert(tag === 'ok', tag)
        const object = _own(unwrap(run(value[1])([])), 'default')
        assert(typeof object === 'object' && object !== null && !(object instanceof Array), object)
        assertEq(Object.keys(object).join(), 'b,a,c')
        assertEq(object.b, 3)
        assertEq(Object.keys(/** @type {object} */ (object.c)).join(), 'y,x')
    },
    // A JavaScript keyword is refused where JavaScript wants an identifier —
    // a name bound or referenced — and accepted where JavaScript accepts any
    // word, a key or the name after `.`: a broken JavaScript program is a
    // broken FunctionalScript program. The tokenizer hands every keyword
    // over as an `id` token, so the fold reads the word, framing keywords
    // included; `from` alone is not reserved.
    reservedWords: {
        refused: () => {
            /** @type {(source: string, column: number) => void} */
            const expect = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'reserved word')
                assertEq(value.metadata?.column, column)
            }
            expect('const if = 1;\nexport default 1;', 7)
            expect('const export = 1;\nexport default export;', 7)
            expect('const with = 1;\nexport default 1;', 7)
            expect('const let = 1;\nexport default 1;', 7)
            expect('const eval = 1;\nexport default 1;', 7)
            expect('import class from "m";\nexport default 1;', 8)
            expect('export default class;', 16)
            expect('export default [1, { a: import.x }];', 25)
            // a keyword is refused before its name is looked up
            expect('export default this;', 16)
        },
        accepted: () => {
            /** @type {(source: string) => void} */
            const expect = source => {
                const [tag] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', tag)
            }
            expect('const from = 1;\nexport default from;')
            expect('export default { if: 1, export: 2, with: 3, from: 4, default: 5, this: 6 };')
            expect('const a = {}; export default [a.if, a.export, a.default, a.class];')
        },
    },
    // `with { type: "json" }` is the one import attribute JavaScript
    // defines; the grammar takes any key and any string, and the fold reads
    // both words and names the one it does not know.
    attribute: {
        json: () => {
            const [tag, value] = parseFromTokens(tokenizeString('import x from "m" with { type: "json" };\nexport default x;'))
            assert(tag === 'ok', tag)
            assertEq(stringifyDjsModule(value), '[[{"json":true,"specifier":"m"}],[["object",[["default",["aref",0]]]]]]')
        },
        refused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('import x from "m" with { kind: "json" };\nexport default x;', 'unknown import attribute', 26)
            // a key with a symbol of its own is a word like any other here,
            // as JavaScript's `IdentifierName` key is: the fold names it
            expect('import x from "m" with { return: "json" };\nexport default x;', 'unknown import attribute', 26)
            expect('import x from "m" with { export: "json" };\nexport default x;', 'unknown import attribute', 26)
            expect('import x from "m" with { type: "css" };\nexport default x;', 'unknown import type', 32)
        },
    },
    // A function: its parameter count, then its body. The rest parameter
    // is `['args']` in its body, an access on it is an access, and a name
    // bound outside — a `const`, an import, or an enclosing function's
    // parameter — is a capture, a slot of its frame (`captures` below). A
    // parameter may shadow a module name, as in JavaScript, and is an
    // identifier, so a keyword is refused as one. The list may also be
    // empty, `() => body`, which binds no name at all, or named, `named`
    // below.
    func: {
        parsed: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default (...a) => a;', '[[],[["object",[["default",["=>",0,[["args"]]]]]]]]')
            expect('export default (...a) => [a, a[0], a["x"], (...b) => b];', '[[],[["object",[["default",["=>",0,[["array",[["args"],[".",["args"],0],[".",["args"],"x"],["=>",0,[["args"]]]]]]]]]]]]')
            expect('const f = (...a) => 1; export default [f, f];', '[[],[["=>",0,[1]],["object",[["default",["array",[["cref",0],["cref",0]]]]]]]]')
            expect('const a = 1; export default (...a) => a;', '[[],[1,["object",[["default",["=>",0,[["args"]]]]]]]]')
            expect('export default ( ... a ) => /* c */ a . b [ 0 ] ;', '[[],[["object",[["default",["=>",0,[[".",[".",["args"],"b"],0]]]]]]]]')
            // a body takes accesses as a value does, and a function none of its own
            expect('export default (...a) => [a][0];', '[[],[["object",[["default",["=>",0,[[".",["array",[["args"]]],0]]]]]]]]')
            expect('export default (...a) => "s"[0];', '[[],[["object",[["default",["=>",0,[[".","s",0]]]]]]]]')
        },
        // An empty parameter list binds nothing, and the AST carries no
        // name either way: `() => 1` and `(...a) => 1` are the one node, a
        // count of `0` and the body, as they are the one function in
        // JavaScript for every program that can be written here — the
        // arguments a name does not spell are unreachable, and a rest
        // parameter counts nothing towards `length`, as none does.
        noParameter: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default () => 1;', '[[],[["object",[["default",["=>",0,[1]]]]]]]')
            expect('export default ( /* c */ ) => 1;', '[[],[["object",[["default",["=>",0,[1]]]]]]]')
            expect('export default () => { return 1; };', '[[],[["object",[["default",["=>",0,[1]]]]]]]')
            // a body of its own, with its own entries, as a parameter's is
            expect('export default () => { const x = 1; return x; };', '[[],[["object",[["default",["=>",0,[1,["cref",0]]]]]]]]')
            // the name a parameter would have taken is the body's to bind
            expect('export default () => { const a = 1; return a; };', '[[],[["object",[["default",["=>",0,[1,["cref",0]]]]]]]]')
            // either list nests in the other, and a call needs no parameter
            expect('export default () => (...a) => a;', '[[],[["object",[["default",["=>",0,[["=>",0,[["args"]]]]]]]]]]')
            expect('export default (...a) => [a, () => 1];', '[[],[["object",[["default",["=>",0,[["array",[["args"],["=>",0,[1]]]]]]]]]]]')
            expect('const f = () => 1; export default f();', '[[],[["=>",0,[1]],["object",[["default",["()",["cref",0],[]]]]]]]')
        },
        // What a body with no parameter may not name: the arguments it has
        // no word for are not a name, so they answer as any other unbound
        // word does, and a name bound outside is a capture as ever.
        noParameterRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default () => a;', 'const not found', 22)
            expect('export default () => { const x = a; return x; };', 'const not found', 34)
        },
        refused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default (...a) => zzz;', 'const not found', 26)
            expect('export default (...if) => 1;', 'reserved word', 20)
            expect('export default (...return) => 1;', 'reserved word', 20)
            expect('export default (...a) => a.__proto__;', 'prohibited property name', 28)
        },
        // Named parameters: the count is the list's length, unused names
        // included, and each name is bound to its position of the
        // arguments array, `['.', ['args'], i]` — a read, so a missing
        // argument is `undefined` and an extra one is passed, as in
        // JavaScript. A bare name, `(a)` and `(a, b)` are the three
        // spellings; `(a,)` is `(a)`.
        named: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default a => a;', '[[],[["object",[["default",["=>",1,[[".",["args"],0]]]]]]]]')
            expect('export default (a) => a;', '[[],[["object",[["default",["=>",1,[[".",["args"],0]]]]]]]]')
            expect('export default (a,) => a;', '[[],[["object",[["default",["=>",1,[[".",["args"],0]]]]]]]]')
            expect('export default (a, b) => [b, a];', '[[],[["object",[["default",["=>",2,[["array",[[".",["args"],1],[".",["args"],0]]]]]]]]]]')
            expect('export default (a, b, c) => b;', '[[],[["object",[["default",["=>",3,[[".",["args"],1]]]]]]]]')
            // a name is read as any reference: as a base, an operand, an
            // argument, in a block
            expect('export default a => a.x[0];', '[[],[["object",[["default",["=>",1,[[".",[".",[".",["args"],0],"x"],0]]]]]]]]')
            expect('export default (a, b) => a + b;', '[[],[["object",[["default",["=>",2,[["+",[".",["args"],0],[".",["args"],1]]]]]]]]]')
            expect('export default (f, a) => f(a);', '[[],[["object",[["default",["=>",2,[["()",[".",["args"],0],[[".",["args"],1]]]]]]]]]]')
            expect('export default (a) => { const x = a; return [x, a]; };', '[[],[["object",[["default",["=>",1,[[".",["args"],0],["array",[["cref",0],[".",["args"],0]]]]]]]]]]')
            // a parameter may shadow a module name, and take a keyword's
            // place nowhere
            expect('const a = 1; export default a => a;', '[[],[1,["object",[["default",["=>",1,[[".",["args"],0]]]]]]]]')
            expect('const a = 1; export default (b) => a;', '[[],[1,["object",[["default",["=>",1,[["fref",0]],[["cref",0]]]]]]]]')
            // an enclosing function's parameter is a capture, one slot per
            // parameter, through a middle function as any capture is
            expect('export default (a) => (b) => [a, b];', '[[],[["object",[["default",["=>",1,[["=>",1,[["array",[["fref",0],[".",["args"],0]]]],[[".",["args"],0]]]]]]]]]]')
            expect('export default (a, b) => () => [b, a, b];', '[[],[["object",[["default",["=>",2,[["=>",0,[["array",[["fref",0],["fref",1],["fref",0]]]],[[".",["args"],1],[".",["args"],0]]]]]]]]]]')
            expect('export default (a) => (...b) => (c) => [a, b, c];', '[[],[["object",[["default",["=>",1,[["=>",0,[["=>",1,[["array",[["fref",0],["fref",1],[".",["args"],0]]]],[["fref",0],["args"]]]],[[".",["args"],0]]]]]]]]]]')
            // the three spellings of a list nest in one another
            expect('export default a => (b, c) => (...d) => () => 1;', '[[],[["object",[["default",["=>",1,[["=>",2,[["=>",0,[["=>",0,[1]]]]]]]]]]]]]')
        },
        // What a named list may not be: a keyword or a repeated name, each
        // at the name; a group the grammar read an arrow after, at the
        // arrow — `(a.b) => 1` is read as JavaScript's cover grammar reads
        // it and refused as a parameter list, since a name followed by
        // anything is none; and a body `const` may not take a parameter's
        // name, as it may not take the rest parameter's.
        namedRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default (if) => 1;', 'reserved word', 17)
            expect('export default (a, NaN) => 1;', 'reserved word', 20)
            expect('export default (a, return) => 1;', 'reserved word', 20)
            expect('export default (a, a) => 1;', 'duplicate id', 20)
            expect('export default (a, b, a) => 1;', 'duplicate id', 23)
            expect('export default (a.b) => 1;', 'invalid parameter list', 22)
            expect('export default (a[0]) => 1;', 'invalid parameter list', 23)
            expect('export default (a + 1) => 1;', 'invalid parameter list', 24)
            expect('export default (a ** 2) => 1;', 'invalid parameter list', 25)
            expect('export default (f()) => 1;', 'invalid parameter list', 22)
            expect('export default (a ? 1 : 2) => 1;', 'invalid parameter list', 28)
            // the names are answered for before the body is read, in order
            expect('export default (a, a) => zzz;', 'duplicate id', 20)
            expect('export default (a, if) => zzz;', 'reserved word', 20)
            expect('export default (a.b) => zzz;', 'invalid parameter list', 22)
            expect('export default (a) => { const a = 1; return a; };', 'duplicate id', 31)
            expect('export default (a, b) => { const b = 1; return a; };', 'duplicate id', 34)
            // a name the list does not spell is unbound
            expect('export default (a) => b;', 'const not found', 23)
        },
        // A name a body reads from a scope around it is a capture: the
        // function's third element lists each binding once, in the order
        // the body first names it — the enclosing scope's own reference,
        // a module's `cref` or `aref`, an enclosing body's `cref` or its
        // `args` — and the body reads capture `i` as `['fref', i]`. A
        // function nested in another captures through it, so its capture
        // is a slot of the middle one's frame. A body that captures
        // nothing has no third element.
        captures: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('const c = 1; export default (...a) => c;', '[[],[1,["object",[["default",["=>",0,[["fref",0]],[["cref",0]]]]]]]]')
            expect('import m from "./m.f.js"; export default (...a) => m;', '[[{"json":false,"specifier":"./m.f.js"}],[["object",[["default",["=>",0,[["fref",0]],[["aref",0]]]]]]]]')
            // through an operator, a conditional's arm and a call, as bare
            expect('const c = 1; export default (...a) => c + a[0];', '[[],[1,["object",[["default",["=>",0,[["+",["fref",0],[".",["args"],0]]],[["cref",0]]]]]]]]')
            expect('const c = 1; export default (...a) => a ? c : 1;', '[[],[1,["object",[["default",["=>",0,[["?:",["args"],["fref",0],1]],[["cref",0]]]]]]]]')
            expect('const f = (...a) => 1; export default (...b) => f(b);', '[[],[["=>",0,[1]],["object",[["default",["=>",0,[["()",["fref",0],[["args"]]]],[["cref",0]]]]]]]]')
            // an empty parameter list captures as any other
            expect('const c = 1; export default () => c;', '[[],[1,["object",[["default",["=>",0,[["fref",0]],[["cref",0]]]]]]]]')
            // an enclosing function's arguments, through the middle one
            expect('export default (...a) => () => a;', '[[],[["object",[["default",["=>",0,[["=>",0,[["fref",0]],[["args"]]]]]]]]]]')
            expect('const c = 1; export default (...a) => (...b) => a;', '[[],[1,["object",[["default",["=>",0,[["=>",0,[["fref",0]],[["args"]]]]]]]]]]')
            expect(
                'export default (...a) => (...b) => (...c) => [a, b, a];',
                '[[],[["object",[["default",["=>",0,[["=>",0,[["=>",0,[["array",[["fref",0],["fref",1],["fref",0]]]],[["fref",0],["args"]]]],[["args"]]]]]]]]]]')
            // one slot per binding, in first-use order, a body `const`'s
            // value included: an alias is a binding of its own, which the
            // lowering folds into its target's node
            expect(
                'const c = [1]; const d = c; export default (...a) => { const x = c; return [d, x, c]; };',
                '[[],[["array",[1]],["cref",0],["object",[["default",["=>",0,[["fref",0],["array",[["fref",1],["cref",0],["fref",0]]]],[["cref",0],["cref",1]]]]]]]]')
            // a body `const` shadowing a module name the body never read
            // from outside
            expect('const x = [1]; export default (...a) => { const x = 2; return x; };', '[[],[["array",[1]],["object",[["default",["=>",0,[2,["cref",0]]]]]]]]')
            // a body `const` captured by a function in the body
            expect(
                'export default (...a) => { const x = [a]; return (...b) => x; };',
                '[[],[["object",[["default",["=>",0,[["array",[["args"]]],["=>",0,[["fref",0]],[["cref",0]]]]]]]]]]')
        },
        // The fold lowers a return-only block to the same executable body
        // as an expression, after the source tree has preserved its syntax.
        block: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default (...a) => { return a; };', '[[],[["object",[["default",["=>",0,[["args"]]]]]]]]')
            expect('export default (...a) => { return a[0]; };', '[[],[["object",[["default",["=>",0,[[".",["args"],0]]]]]]]]')
            // the object literal an expression body cannot spell bare,
            // `=> {` opening a block — the group spells it, and `group`
            // pins that the two are one tree
            expect('export default (...a) => { return { x: 1 }; };', '[[],[["object",[["default",["=>",0,[["object",[["x",1]]]]]]]]]]')
            expect('export default (...a) => { return (...b) => { return b; }; };', '[[],[["object",[["default",["=>",0,[["=>",0,[["args"]]]]]]]]]]')
            // the parameter is still the arguments array, and a name bound
            // outside is still a capture
            expect('const c = 1; export default (...a) => { return c; };', '[[],[1,["object",[["default",["=>",0,[["fref",0]],[["cref",0]]]]]]]]')
        },
        // A body `const` is an entry of the function's own body, as a
        // module's is of the module's: `['cref', i]` names entry `i` of the
        // body it is written in, the value it returns is the last entry,
        // and a `const` is one node however many references reach it.
        bodyConst: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default (...a) => { const x = 1; return x; };', '[[],[["object",[["default",["=>",0,[1,["cref",0]]]]]]]]')
            expect('export default (...a) => { const x = 1; const y = 2; return [x, y]; };', '[[],[["object",[["default",["=>",0,[1,2,["array",[["cref",0],["cref",1]]]]]]]]]]')
            // a later statement names an earlier one, and the body's own
            // numbering is not the module's — both are entry 0 of their own
            expect('const m = 9; export default (...a) => { const x = 1; const y = x; return y; };', '[[],[9,["object",[["default",["=>",0,[1,["cref",0],["cref",1]]]]]]]]')
            // the parameter is in scope for the statements too
            expect('export default (...a) => { const x = a[0]; return x; };', '[[],[["object",[["default",["=>",0,[[".",["args"],0],["cref",0]]]]]]]]')
            // a nested body numbers its own entries from zero
            expect('export default (...a) => { const x = (...b) => { const y = 1; return y; }; return x; };', '[[],[["object",[["default",["=>",0,[["=>",0,[1,["cref",0]]],["cref",0]]]]]]]]')
            // an entry the return value never names is an entry all the
            // same: the body keeps it, and the lowering anchors it
            expect('export default (...a) => { const x = []; return 1; };', '[[],[["object",[["default",["=>",0,[["array",[]],1]]]]]]]')
        },
        // What a body `const` may not be named, each at the name.
        bodyConstRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default (...a) => { const x = 1; const x = 2; return x; };', 'duplicate id', 47)
            // the parameter is a name of the body, so a `const` may not
            // take it — the same answer a module's duplicate gets
            expect('export default (...a) => { const a = 1; return a; };', 'duplicate id', 34)
            expect('export default (...a) => { const if = 1; return 1; };', 'reserved word', 34)
            // the name is answered for before its value is read, as a
            // module's `const` is
            expect('export default (...a) => { const NaN = zzz; return 1; };', 'reserved word', 34)
            // a statement's value is resolved in the body's scope: a name
            // nothing binds is not found, and a body `const` may take a name the
            // module binds — shadowing it — unless the body has already
            // read that name from outside, before the `const` or in its own
            // initializer: JavaScript reads the body's `const` there, and
            // the capture taken would be another value
            expect('const x = [1]; export default (...a) => { const y = x; const x = 2; return y; };', 'capture shadowed', 62)
            expect('const x = [1]; export default (...a) => { const y = (...b) => x; const x = 2; return y; };', 'capture shadowed', 72)
            expect('const x = [1]; export default (...a) => { const x = x; return x; };', 'capture shadowed', 49)
            // errors are first-to-last: a later statement's own failure is
            // not reported ahead of an earlier one
            expect('const x = [1]; export default (...a) => { const y = x; const z = zzz; const x = 2; return y; };', 'const not found', 66)
            expect('export default (...a) => { const x = zzz; return x; };', 'const not found', 38)
            // a `const` is not in its own initializer's scope
            expect('export default (...a) => { const x = x; return x; };', 'const not found', 38)
            // and a later statement is not in an earlier one's
            expect('export default (...a) => { const x = y; const y = 1; return x; };', 'const not found', 38)
        },
        // A call, `['()', callee, args]`: the callee and then the arguments
        // in the order written, which is the order they are resolved in and
        // the order an error among them is reported in. A method call keeps
        // its access as the callee here — which of the EDAG's two call
        // forms that becomes is the lowering's.
        call: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('const f = (...a) => 1; export default f();', '[[],[["=>",0,[1]],["object",[["default",["()",["cref",0],[]]]]]]]')
            expect('const f = (...a) => 1; export default f(1, 2);', '[[],[["=>",0,[1]],["object",[["default",["()",["cref",0],[1,2]]]]]]]')
            expect('const o = {}; export default o.b(3);', '[[],[["object",[]],["object",[["default",["()",[".",["cref",0],"b"],[3]]]]]]]')
            expect('const f = (...a) => 1; export default f(1)(2);', '[[],[["=>",0,[1]],["object",[["default",["()",["()",["cref",0],[1]],[2]]]]]]]')
            expect('export default (...a) => a[0](1);', '[[],[["object",[["default",["=>",0,[["()",[".",["args"],0],[1]]]]]]]]]')
            // a trailing comma is the list's, as an array's is
            expect('const f = (...a) => 1; export default f(1,);', '[[],[["=>",0,[1]],["object",[["default",["()",["cref",0],[1]]]]]]]')
        },
        // A group is no node: `(x)` is whatever `x` is, so the AST is the
        // one the parentheses are not in — the sharing a module spells
        // survives them, and a step after the `)` reads the value inside.
        group: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default (1);', '[[],[["object",[["default",1]]]]]')
            expect('export default ((1));', '[[],[["object",[["default",1]]]]]')
            expect('export default ( /* c */ [1] /* c */ );', '[[],[["object",[["default",["array",[1]]]]]]]')
            // the object body, which `=> {` cannot spell
            expect('export default (...a) => ({ x: 1 });', '[[],[["object",[["default",["=>",0,[["object",[["x",1]]]]]]]]]]')
            // a group takes steps, and they apply to the value it holds
            expect('export default ([1, 2]).length;', '[[],[["object",[["default",[".",["array",[1,2]],"length"]]]]]]')
            expect('const a = { b: 1 }; export default (a).b;', '[[],[["object",[["b",1]]],["object",[["default",[".",["cref",0],"b"]]]]]]')
            // a group of a reference is that reference, so two routes into
            // one `const` are the one node they were
            expect('const a = [1]; export default [(a), a];', '[[],[["array",[1]],["object",[["default",["array",[["cref",0],["cref",0]]]]]]]]')
            // and parentheses keep a property reference, as JavaScript's do
            // — `(a.at)(0) === 42` there, pinned by `chainsJs.receiver` in
            // `fjs/edag/proof.f.mjs` — so a call on a grouped access is the
            // method call, the very node `o.b(1)` is and not a detached one
            const grouped = '[[],[["object",[["b",1]]],["object",[["default",["()",[".",["cref",0],"b"],[1]]]]]]]'
            expect('const o = { b: 1 }; export default (o.b)(1);', grouped)
            expect('const o = { b: 1 }; export default ((o.b))(1);', grouped)
            expect('const o = { b: 1 }; export default o.b(1);', grouped)
            // a step reads the value in the group and nothing else, so
            // parentheses around one add no tree: a numeric literal takes
            // its access and its call as it does without them
            expect('export default (1).x;', '[[],[["object",[["default",[".",1,"x"]]]]]]')
            expect('export default 1 .x;', '[[],[["object",[["default",[".",1,"x"]]]]]]')
            expect('export default (1)(2);', '[[],[["object",[["default",["()",1,[2]]]]]]]')
            expect('export default 1(2);', '[[],[["object",[["default",["()",1,[2]]]]]]]')
            // what a group does change is how far a prefix reaches, since
            // `-` binds looser than a step: `(-1).x` is the access on the
            // negation, which nothing else spells, and `-1 .x` the negation
            // of the access, as JavaScript reads each
            expect('export default (-1).x;', '[[],[["object",[["default",[".",["-",1],"x"]]]]]]')
            expect('export default -1 .x;', '[[],[["object",[["default",["-",[".",1,"x"]]]]]]]')
            // and the group is the `-`'s operand, the one way a function or
            // an access on a value written in place reaches a prefix
            expect('export default -(1);', '[[],[["object",[["default",["-",1]]]]]]')
            expect('export default -(1).x;', '[[],[["object",[["default",["-",[".",1,"x"]]]]]]]')
            expect('export default -((...a) => 1);', '[[],[["object",[["default",["-",["=>",0,[1]]]]]]]]')
        },
        // A group denotes its value, so it launders nothing: every rule the
        // value earns it earns inside the parentheses, at the same token.
        groupRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            // a member function a module may not call is refused whether
            // the access is called in place or grouped and called after —
            // the group is no boundary, so the callee is the access either way
            expect('const o = {}; export default (o.push)(1);', 'prohibited member function', 33)
            expect('const o = {}; export default o.push(1);', 'prohibited member function', 32)
            // and a name nothing binds is not found where it stands
            expect('export default (zzz);', 'const not found', 17)
        },
        // What a call's operands earn, each where it is written: the callee
        // is resolved before the arguments, and an argument before the ones
        // after it, so the first failure in source order is the one reported.
        callRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default zzz(1);', 'const not found', 16)
            expect('const f = (...a) => 1; export default f(zzz);', 'const not found', 41)
            expect('const f = (...a) => 1; export default f(1, zzz);', 'const not found', 44)
            expect('const f = (...a) => 1; export default f(yyy, zzz);', 'const not found', 41)
            // a method call's key is checked against the member functions a
            // module may not call: a mutator, and a data property, which is
            // no function
            expect('const o = {}; export default o.push(1);', 'prohibited member function', 32)
            expect('const o = {}; export default o.__proto__(1);', 'prohibited member function', 32)
        },
        // A method call's key is checked against `fjs/js/prototype`'s
        // `prohibitedCalls`, not the read rule: a member function the VM
        // answers by the receiver's type is a call like any other, in
        // either spelling and through a group, while the same name is still
        // refused as a read — as an argument, as a base, or alone — since a
        // detached built-in is a function that only fails.
        method: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('const o = {}; export default o.toString(1);', '[[],[["object",[]],["object",[["default",["()",[".",["cref",0],"toString"],[1]]]]]]]')
            expect('const a = []; export default a["at"](0);', '[[],[["array",[]],["object",[["default",["()",[".",["cref",0],"at"],[0]]]]]]]')
            expect('const a = []; export default (a.at)(0);', '[[],[["array",[]],["object",[["default",["()",[".",["cref",0],"at"],[0]]]]]]]')
            expect('export default [1, 2].map(1).length;', '[[],[["object",[["default",[".",["()",[".",["array",[1,2]],"map"],[1]],"length"]]]]]]')
            /** @type {(source: string, message: string, column: number) => void} */
            const refused = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            refused('const f = (...a) => 1; const o = {}; export default f(o.toString);', 'prohibited property name', 57)
            refused('const o = {}; export default o.toString.x(1);', 'prohibited property name', 32)
            refused('const o = {}; export default o.toString(1).valueOf();', 'prohibited member function', 44)
            // `length` is on neither list: a value owns it, so a call of it
            // is a call of what it holds — a function on an object, and a
            // number, thrown for at run time, on an array
            expect('const f = (...a) => 1; const o = { length: f }; export default o.length();', '[[],[["=>",0,[1]],["object",[["length",["cref",0]]]],["object",[["default",["()",[".",["cref",1],"length"],[]]]]]]]')
            expect('const a = []; export default a.length(1);', '[[],[["array",[]],["object",[["default",["()",[".",["cref",0],"length"],[1]]]]]]]')
        },
        // A call on a numeric literal is a call like any other, and the sign
        // is outside it: JavaScript reads `-1()` as `-(1())` and calls `1`,
        // which is what the prefix gives. There is nothing left to refuse —
        // the fold that made the callee `-1` is gone.
        numericCallee: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default 1();', '[[],[["object",[["default",["()",1,[]]]]]]]')
            expect('export default -1();', '[[],[["object",[["default",["-",["()",1,[]]]]]]]]')
            expect('export default -1n();', '[[],[["object",[["default",["-",["()",1n,[]]]]]]]]')
            expect('export default -Infinity();', '[[],[["object",[["default",["-",["()",Infinity,[]]]]]]]]')
            // an argument is read as any other is, so its own error is the
            // one reported — there is no earlier one to come first
            const [tag, value] = parseFromTokens(tokenizeString('export default 1(zzz);'))
            assert(tag === 'error', tag)
            assertEq(value.message, 'const not found')
            assertEq(value.metadata?.column, 18)
            // and a reference to a number still reads alike in both
            expect('const n = 1; export default n();', '[[],[1,["object",[["default",["()",["cref",0],[]]]]]]]')
        },
        // A body `const` may take a name the module binds. The body cannot
        // reach the module's scope at all — a reference out is a capture —
        // so the module's name is unreachable here rather than hidden, and
        // no-shadowing (`spec/todo/3150-shadowing.md`) has nothing to
        // decide about this case.
        bodyConstShadowsModule: () => {
            const [tag, value] = parseFromTokens(tokenizeString('const c = 1; export default (...a) => { const c = 2; return c; };'))
            assert(tag === 'ok', value)
            assertEq(stringifyDjsModule(value), '[[],[1,["object",[["default",["=>",0,[2,["cref",0]]]]]]]]')
        },
    },
    valid: [
        () => {
            const tokenList = tokenizeString('export default null;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",null]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default true;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",true]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default false;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",false]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default undefined;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",undefined]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default 0.1;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",0.1]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default 1.1e+2;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",110]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default "abc";')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default","abc"]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["array",[]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["array",[1]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [[]];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["array",[["array",[]]]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [0,[1,[2,[]]],3];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["array",[0,["array",[1,["array",[2,["array",[]]]]]],3]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default {};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[["default",["object",[]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [{}];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[["default",["array",[["object",[]]]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":true,"b":false,"c":null,"d":undefined};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[["default",["object",[["a",true],["b",false],["c",null],["d",undefined]]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":{"b":{"c":["d"]}}};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[["default",["object",[["a",["object",[["b",["object",[["c",["array",["d"]]]]]]]]]]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {a: 1};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[["default",["object",[["a",1]]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1234567890n;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",1234567890n]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1234567890n];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["array",[1234567890n]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1,];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["array",[1]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default {"a":1,};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[["default",["object",[["a",1]]]]]]]]') { throw result }
        }
    ],
    // A computed key `["a"]` is a third spelling of an ordinary key, next to
    // the identifier and the string literal (#2470).
    computedKey: [
        () => {
            const tokenList = tokenizeString('export default {["a"]:1};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["object",[["a",1]]]]]]]]')
        },
        () => {
            // all three spellings in one object, plus a trailing comma
            const tokenList = tokenizeString('export default {a:1,"b":2,["c"]:3,};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["object",[["a",1],["b",2],["c",3]]]]]]]]')
        },
        () => {
            // trivia is trivia inside the brackets too
            const tokenList = tokenizeString('export default { [ /* c */ \n // c \n "a" /* c */ \n // c \n ] : 1 };')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["object",[["a",1]]]]]]]]')
        },
        () => {
            // the key that has no other spelling
            const tokenList = tokenizeString('export default {["__proto__"]:{"a":42}};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["object",[["__proto__",["object",[["a",42]]]]]]]]]]]')
        },
    ],
    invalidComputedKey: [
        () => {
            // the brackets hold a string literal, not a number
            const tokenList = tokenizeString('export default {[1]:2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            // eof inside the brackets, before the key
            const tokenList = tokenizeString('export default {[')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // the brackets are not closed
            const tokenList = tokenizeString('export default {["a"}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            // eof after the key, before ']'
            const tokenList = tokenizeString('export default {["a"')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // a computed key still needs its ':'
            const tokenList = tokenizeString('export default {["a"]}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
    ],
    // `{__proto__: v}` and `{"__proto__": v}` assign a prototype in JavaScript
    // instead of adding a property, so FunctionalScript rejects both spellings
    // and accepts only the computed one (#2480).
    protoKey: [
        () => {
            const tokenList = tokenizeString('export default {__proto__:1};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, '__proto__ requires the computed key form')
        },
        () => {
            const tokenList = tokenizeString('export default {"__proto__":1};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, '__proto__ requires the computed key form')
        },
        () => {
            // the same two spellings after a ',', the parser's other key state
            const tokenList = tokenizeString('export default {"a":1,__proto__:2};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, '__proto__ requires the computed key form')
        },
        () => {
            const tokenList = tokenizeString('export default {"a":1,"__proto__":2};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, '__proto__ requires the computed key form')
        },
    ],
    invalid: [
        () => {
            const tokenList = tokenizeString('export default')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            const tokenList = tokenizeString('export default "123')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        // A literal control character inside a string is not valid JSON
        // syntax (RFC 8259 §7), and DJS string literals are JSON strings.
        () => {
            const tokenList = tokenizeString('export default "\t"')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default [,]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default [1 2]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default [1,,2]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default []]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default ["a"')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            const tokenList = tokenizeString('export default [,1]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default [:]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default ]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {,}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {1:2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {"1"2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {"1"::2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2,,"3":4')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {}}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {"1":2')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            const tokenList = tokenizeString('export default {,"1":2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default }')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default [{]}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            const tokenList = tokenizeString('export default {[}]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            // 'export' with no 'default' before eof.
            const tokenList = tokenizeString('export')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // 'const' with no name before eof.
            const tokenList = tokenizeString('const')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // 'const <name>' with no '=' before eof.
            const tokenList = tokenizeString('const x')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // 'const <name>' followed by a token that isn't '='.
            const tokenList = tokenizeString('const x 5')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            // 'import' with no name before eof.
            const tokenList = tokenizeString('import')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // 'import' followed by a token that isn't an id.
            const tokenList = tokenizeString('import 5')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            // 'import <name>' with no 'from' before eof.
            const tokenList = tokenizeString('import a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // 'import <name> from' with no module string before eof.
            const tokenList = tokenizeString('import a from')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // Array opened but eof arrives before any value/']'.
            const tokenList = tokenizeString('export default [')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // Object opened but eof arrives before any key/'}'.
            const tokenList = tokenizeString('export default {')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // Object key given but eof arrives before ':'.
            const tokenList = tokenizeString('export default {"a"')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // Object ':' given but eof arrives before the value.
            const tokenList = tokenizeString('export default {"a":')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // Object value given, followed by a token that's neither ',' nor '}'.
            const tokenList = tokenizeString('export default {"a":1 2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
        },
        () => {
            // Object ',' given but eof arrives before the next key/'}'.
            const tokenList = tokenizeString('export default {"a":1,')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
        () => {
            // `parseFromTokens` itself, called with no tokens at all. The
            // tokenizer never produces this — it always emits at least an
            // `eof` — but the exported function's contract must still answer,
            // and it names what is missing rather than running out of input.
            const obj = parseFromTokens([])
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'missing end-of-input token')
        },
    ],
    errorMetadata: [
        () => {
            // column 17 is the ',' itself — the tokenizer's metadata is start-anchored
            // (each token's own position), unlike the previous tokenizer's metadata, which
            // lagged by one token (an artifact of when its state machine flushed a token).
            const tokenList = tokenizeString('export default [,]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            const errorString = stringify(sort)(obj[1])
            if (errorString !== '{"message":"unexpected token","metadata":{"column":17,"line":1,"path":""}}') { throw errorString }
        },
    ],
    validWhiteSpaces:[
        () => {
            const tokenList = tokenizeString(' export default [ 0 , 1 , 2 ] ; ')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["array",[0,1,2]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString(' export default { "a" : 0 , "b" : 1 } ; ')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[["default",["object",[["a",0],["b",1]]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('\nexport\ndefault\n[\n0\n,\n1\n,\n2\n]\n;\n')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",["array",[0,1,2]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('\rexport\rdefault\r{\r"a"\r:\r0\r,\r"b"\r:\r1\r}\r;\r')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[["default",["object",[["a",0],["b",1]]]]]]]]') { throw result }
        },
    ],
    // A JSON document is not a module: a statement begins with `import`,
    // `const`, or `export` and never with a value. `fjs/media/json` is the
    // reader for these texts.
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
            // an identifier that is not a statement keyword is no better
            const tokenList = tokenizeString('a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token')
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
            assertEq(result, '[[{"json":false,"specifier":"a.f.js"}],[1,["object",[["default",["array",[["aref",0],["cref",0]]]]]]]]')
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
            assertEq(result, '[[],[1,2,["object",[["default",3]]]]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1; \n const b = 2; \n export default b;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1,2,["object",[["default",["cref",1]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1; \n const b = 2; \n export default [b,a,b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1,2,["object",[["default",["array",[["cref",1],["cref",0],["cref",1]]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1; \n const b = 2; \n export default {"1st":b,"2nd":a,"3rd":b};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[1,2,["object",[["default",["object",[["1st",["cref",1]],["2nd",["cref",0]],["3rd",["cref",1]]]]]]]]]') { throw result }
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
            assertEq(result, '[[{"json":false,"specifier":"test/test.f.mjs"}],[["object",[["default",["aref",0]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs"; \n import b from "second/test.f.mjs"; \n export default [b, a, b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[{"json":false,"specifier":"first/test.f.mjs"},{"json":false,"specifier":"second/test.f.mjs"}],[["object",[["default",["array",[["aref",1],["aref",0],["aref",1]]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs"; \n const b = null; \n export default [b, a, b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[{"json":false,"specifier":"test/test.f.mjs"}],[null,["object",[["default",["array",[["cref",0],["aref",0],["cref",0]]]]]]]]')
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
    comments: [
        () => {
            const tokenList = tokenizeString('export //comment \n default /* comment */ null; //comment')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[["default",null]]]]]')
        },
    ],
    // Regression, from the hand-written parser: closing a container popped its
    // stack with `drop(1)`, which is lazy, so every closed container left one
    // unforced thunk wrapping the stack, forced only at the end at a
    // call-stack frame per container — overflowing at roughly 5000 of them,
    // nested or flat, while primitives were unbounded. `fjs/media/json`
    // carried the same defect. Kept as the bar every parser here has met.
    containerStackCost: [
        () => {
            const [tag, value] = parseFromTokens(tokenizeString(
                `export default [${repeated('{}')(20000)}];`))
            assert(tag === 'ok', tag)
            assertEq(value[1].length, 1)
        },
        () => {
            const [tag] = parseFromTokens(tokenizeString(
                `export default [${repeated('[]')(20000)}];`))
            assert(tag === 'ok', tag)
        },
        () => {
            const [tag] = parseFromTokens(tokenizeString(
                'export default ' + '['.repeat(20000) + ']'.repeat(20000) + ';'))
            assert(tag === 'ok', tag)
        },
        () => {
            // a capture through as many functions: resolved by a loop out to
            // the binding scope and back, where a recursion per function
            // overflowed, each body capturing the one outside it
            const [tag, value] = parseFromTokens(tokenizeString(
                `const x = 1; export default ${'() => '.repeat(20000)}x;`))
            assert(tag === 'ok', tag)
            // walked by a loop too: the outermost function captures the
            // module's `x`, every one inside it its parent's slot
            /** @type {any} */
            let fn = /** @type {any} */ (value[1][1])[1][0][1]
            assertEq(stringify(sort)(fn[3]), '[["cref",0]]')
            for (let depth = 1; depth < 20000; depth += 1) { fn = fn[2][0] }
            assertEq(stringify(sort)(fn), '["=>",0,[["fref",0]],[["fref",0]]]')
        },
        () => {
            // primitives never touched the stack — the baseline that always passed
            const [tag] = parseFromTokens(tokenizeString(
                `export default [${Array.from({ length: 20000 }, (_, i) => i).join(',')}];`))
            assert(tag === 'ok', tag)
        },
    ]
}
