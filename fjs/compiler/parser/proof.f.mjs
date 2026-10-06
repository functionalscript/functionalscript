/**
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 * @import { AstModule } from '../ast/types.ts'
 * @import { EdagValue, Values } from '../../edag/value/types.ts'
 */

import { parseFromTokens } from './module.f.mjs'
import { parseSyntax } from './syntax/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toUnknown } from '../../edag/value/to_unknown/module.f.mjs'
import { read } from '../../edag/value/property/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { _stringifyTree } from '../module.f.mjs'
import { stringify } from '../../media/json/module.f.mjs'
import { ok, unwrap } from '../../types/result/module.f.mjs'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { _astOf, demo } from './demo.f.mjs'
import { examples } from '../examples/module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'

/**
 * The tokens of a text, the parser's input. Exported, with
 * {@link stringifyDjsModule}, for the proofs split off this one —
 * `./operators.proof.f.mjs` and `./func.proof.f.mjs` — which read the same
 * parser the same way.
 *
 * @type {(s: string) => readonly DjsTokenWithMetadata[]}
 */
export const tokenizeString = s => toArray(tokenize(stringToList(s))(''))

/** A module as the proofs pin it: the compiler's own dump, since the tree holds bigints JSON cannot write. */
export const stringifyDjsModule = _stringifyTree

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

/**
 * A module read to the tree the proofs pin, a refusal thrown.
 *
 * @type {(source: string, expected: string) => void}
 */
const expectModule = (source, expected) => {
    const [tag, value] = parseFromTokens(tokenizeString(source))
    assert(tag === 'ok', value)
    assertEq(stringifyDjsModule(value), expected)
}

/** Parser fixtures execute through the shared represented interpreter. @type {(ast: AstModule, args?: Values) => EdagValue} */
const evaluate = (ast, args = []) => assertOk(memo(assertOk(analysis(unresolved(ast).edag)))({ args }))

export const proof = {
    // A module may end in `throw` in place of its exports: the body's last
    // entry is the throw of the value, resolved against every name bound,
    // and no export object follows it — a named export before it is the
    // entry it is, and nothing the module exports, since the load never
    // completes. The `;` may be omitted at the end of input, as any
    // statement's may.
    throws: () => {
        expectModule('throw 1;', '[[],[["throw",1]]]')
        expectModule('throw 1', '[[],[["throw",1]]]')
        expectModule('const a = [1]; throw a;', '[[],[["array",[1]],["throw",["cref",0]]]]')
        expectModule('export const a = [1]; throw a;', '[[],[["array",[1]],["throw",["cref",0]]]]')
        expectModule('import m from "./m.f.js";\nthrow m.x', '[[{"json":false,"name":"default","specifier":"./m.f.js"}],[["throw",[".",["aref",0],"x"]]]]')
    },
    namedImports: {
        bindings: () => {
            const source = 'import d, { x, x as y, default as z, as as from, } from "./dep"; export default [d,x,y,z,from];'
            const module = unwrap(parseFromTokens(tokenizeString(source)))
            assertStructurallySame(module[0], ['default', 'x', 'x', 'default', 'as'].map(name => ({ specifier: './dep', json: false, name })))
            const exports = /** @type {const} */ (['{}', [[':', 'default', 1], [':', 'x', 2], [':', 'as', 3]]])
            assertStructurallySame(assertOk(toUnknown(evaluate(module, module[0].map(() => exports)))), { default: [1, 2, 2, 1, 3] })
            const syntax = unwrap(parseSyntax(tokenizeString(source)))
            assertStructurallySame(syntax.imports[0].bindings.map(({ name, local }) => [name, local.token]), [
                ['default', { kind: 'id', value: 'd' }], ['x', { kind: 'id', value: 'x' }],
                ['x', { kind: 'id', value: 'y' }], ['default', { kind: 'id', value: 'z' }],
                ['as', { kind: 'id', value: 'from' }],
            ])
        },
        empty: () => {
            const module = unwrap(parseFromTokens(tokenizeString('import {} from "./dep"; import d, {} from "./dep"; export default d;')))
            assertStructurallySame(module[0].map(({ name }) => name), [null, 'default'])
            const exports = /** @type {const} */ (['{}', [[':', 'default', 7]]])
            assertStructurallySame(assertOk(toUnknown(evaluate(module, [exports, exports]))), { default: 7 })
        },
        json: () => {
            const module = unwrap(parseFromTokens(tokenizeString('import {default as data} from "./data.json" with {type:"json"}; export default data;')))
            assertStructurallySame(module[0], [{ specifier: './data.json', json: true, name: 'default' }])
        },
        errors: () => {
            for (const source of [
                'import {x,x} from "./d";', 'import {x as a,y as a} from "./d";',
                'import a,{x as a} from "./d";', 'import {x} from "./d"; const x=1;',
                'import {x} from "./d"; import x from "./e";',
                'import {x as class} from "./d";', 'import {default} from "./d";',
                'import {x as undefined} from "./d";', 'import {x as NaN} from "./d";',
                'import {x as} from "./d";', 'import {x,,y} from "./d";',
                'import {,} from "./d";', 'import {x y} from "./d";',
                'import {"x" as y} from "./d";', 'import * as ns from "./d";',
                'import d, from "./d";', 'import "./d";',
                'import {x} from "./d" with {wrong:"json"};',
                'import {x} from "./d" with {type:"text"};',
            ]) { assertEq(parseFromTokens(tokenizeString(`${source} export default 1;`))[0], 'error', source) }
            const duplicate = parseFromTokens(tokenizeString('import {x,\nx as x} from "./d"; export default 1;'))
            assert(duplicate[0] === 'error')
            assertEq(duplicate[1].metadata?.line, 2)
            assertEq(duplicate[1].metadata?.column, 6)
        },
    },
    namedExports: {
        results: () => {
            for (const [source, expected] of /** @type {const} */ ([
                ['export const a=5;', { a: 5 }],
                ['const base=5; export const z=base; const local=z; export const a=local; export default a;', { a: 5, default: 5, z: 5 }],
                ['export const a=undefined; export default undefined;', { a: undefined, default: undefined }],
                ['export const __proto__=7;', Object.fromEntries([['__proto__', 7]])],
            ])) {
                const module = unwrap(parseFromTokens(tokenizeString(source)))
                const result = assertOk(toUnknown(evaluate(module)))
                assertStructurallySame(result, expected)
                assertStructurallySame(Object.keys(/** @type {object} */ (result)), Object.keys(expected))
            }
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
                'export const a=1 export const b=2;', 'export const a=1; import b from "./x";',
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
        // A statement's `;` may be omitted where JavaScript inserts one —
        // before `}`, and before a statement on a new line — and the
        // syntax tree records the omission; where the next statement
        // shares the line, the grammar still reads the module and the fold
        // refuses it at that statement's first token, as JavaScript does.
        omittedSemicolons: () => {
            const { exported } = unwrap(parseSyntax(tokenizeString(
                'export default () => {\n    const x = 1\n    return x\n}')))
            assert(exported !== null && exported.value[0] === '=>')
            assertEq(exported.semicolon, false)
            const body = exported.value[2]
            assert(body[0] === 'block')
            assertStructurallySame(body[1].map(([, statement]) => 'semicolon' in statement && statement.semicolon), [false, false])
            assertEq(parseFromTokens(tokenizeString('export default () => {\n    const x = 1\n    return x\n}'))[0], 'ok')
            assertEq(parseFromTokens(tokenizeString('export default () => { return 7 };'))[0], 'ok')
            const sameLine = 'export default () => { const x = 1 return x; };'
            assertEq(parseSyntax(tokenizeString(sameLine))[0], 'ok')
            const refused = parseFromTokens(tokenizeString(sameLine))
            assert(refused[0] === 'error')
            assertEq(refused[1].message, 'unexpected token')
            assertEq(refused[1].metadata?.column, 36)
        },
        syntaxRefusals: () => {
            for (const source of [
                'export default () => {};',
                'export default () => { return; };',
                'export default () => { return 7; const x = 1; };',
                'export default () => { return 7; return 8; };',
            ]) {
                assertEq(parseSyntax(tokenizeString(source))[0], 'error')
                assertEq(parseFromTokens(tokenizeString(source))[0], 'error')
            }
            // a line break where JavaScript forbids one, before `=>` and
            // after `return`: the syntax tree holds it, since trivia is no
            // symbol the grammar reads, and the fold refuses it at the token
            // on the wrong side of the break — the `=>`, or the value
            for (const [source, line, column] of /** @type {const} */ ([
                ['export default ()\n=> 7;', 2, 1],
                ['export default (a)\n=> 7;', 2, 1],
                ['export default (a, b)\n=> 7;', 2, 1],
                ['export default a\n=> 7;', 2, 1],
                ['export default a // c\n=> 7;', 2, 1],
                ['export default (...a) /* x\ny */ => 7;', 2, 6],
                ['export default () => { return\n7; };', 2, 1],
                ['export default () => { return /*\n*/ 7; };', 2, 4],
            ])) {
                assertEq(parseSyntax(tokenizeString(source))[0], 'ok', source)
                const refused = parseFromTokens(tokenizeString(source))
                assert(refused[0] === 'error', source)
                assertEq(refused[1].message, 'unexpected token', source)
                assertEq(refused[1].metadata?.line, line, source)
                assertEq(refused[1].metadata?.column, column, source)
            }
            // a list malformed before its `=>` answers for the list
            const malformed = parseFromTokens(tokenizeString('export default (1)\n=> 7;'))
            assert(malformed[0] === 'error')
            assertEq(malformed[1].message, 'malformed parameter list')
            // A line break inside the returned group is still admitted.
            const source = 'export default () => { return (\n7\n); };'
            assertEq(parseSyntax(tokenizeString(source))[0], 'ok')
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
                ["export default null;", "[[],[[\"object\",[[\":\",\"default\",null]]]]]"],
                ["export default true;", "[[],[[\"object\",[[\":\",\"default\",true]]]]]"],
                ["export default false;", "[[],[[\"object\",[[\":\",\"default\",false]]]]]"],
                ["export default undefined;", "[[],[[\"object\",[[\":\",\"default\",undefined]]]]]"],
                ["export default 0.1;", "[[],[[\"object\",[[\":\",\"default\",0.1]]]]]"],
                ["export default 1.1e+2;", "[[],[[\"object\",[[\":\",\"default\",110]]]]]"],
                // the three numbers JSON cannot spell, as words — and the
                // third of them as the negation it is written as, the `-`
                // being a prefix the grammar reads rather than part of the
                // word. The one line of this corpus the language moved
                // under; every other value still says what it recorded.
                ["export default [NaN, Infinity, -Infinity];", "[[],[[\"object\",[[\":\",\"default\",[\"array\",[NaN,Infinity,[\"-\",Infinity]]]]]]]]"],
                ["export default \"abc\";", "[[],[[\"object\",[[\":\",\"default\",\"abc\"]]]]]"],
                ["export default 1234567890n;", "[[],[[\"object\",[[\":\",\"default\",1234567890n]]]]]"],
                ["export default [];", "[[],[[\"object\",[[\":\",\"default\",[\"array\",[]]]]]]]"],
                ["export default [1];", "[[],[[\"object\",[[\":\",\"default\",[\"array\",[1]]]]]]]"],
                ["export default [1,];", "[[],[[\"object\",[[\":\",\"default\",[\"array\",[1]]]]]]]"],
                ["export default [[]];", "[[],[[\"object\",[[\":\",\"default\",[\"array\",[[\"array\",[]]]]]]]]]"],
                ["export default [0,[1,[2,[]]],3];", "[[],[[\"object\",[[\":\",\"default\",[\"array\",[0,[\"array\",[1,[\"array\",[2,[\"array\",[]]]]]],3]]]]]]]"],
                ["export default [1234567890n];", "[[],[[\"object\",[[\":\",\"default\",[\"array\",[1234567890n]]]]]]]"],
                ["export default {};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[]]]]]]]"],
                ["export default {\"a\":1};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"a\",1]]]]]]]]"],
                ["export default {a: 1};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"a\",1]]]]]]]]"],
                ["export default {\"a\":1,};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"a\",1]]]]]]]]"],
                ["export default {[\"a\"]:1};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"a\",1]]]]]]]]"],
                ["export default {a:1,\"b\":2,[\"c\"]:3,};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"a\",1],[\":\",\"b\",2],[\":\",\"c\",3]]]]]]]]"],
                ["export default {\"a\":{\"b\":{\"c\":[\"d\"]}}};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"a\",[\"object\",[[\":\",\"b\",[\"object\",[[\":\",\"c\",[\"array\",[\"d\"]]]]]]]]]]]]]]]]"],
                ["export default {\"a\":true,\"b\":false,\"c\":null,\"d\":undefined};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"a\",true],[\":\",\"b\",false],[\":\",\"c\",null],[\":\",\"d\",undefined]]]]]]]]"],
                ["export default {a:1,a:2};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"a\",1],[\":\",\"a\",2]]]]]]]]"],
                ["export default {[\"__proto__\"]: 1};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"__proto__\",1]]]]]]]]"],
                ["const a = 1;\nexport default a;", "[[],[1,[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                ["const a = 1;\nconst b = 2;\nexport default [a,b];", "[[],[1,2,[\"object\",[[\":\",\"default\",[\"array\",[[\"cref\",0],[\"cref\",1]]]]]]]]"],
                ["import x from \"m\";\nexport default x;", "[[{\"json\":false,\"name\":\"default\",\"specifier\":\"m\"}],[[\"object\",[[\":\",\"default\",[\"aref\",0]]]]]]"],
                ["import x from \"m\";\nconst a = 1;\nexport default a;", "[[{\"json\":false,\"name\":\"default\",\"specifier\":\"m\"}],[1,[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                ["import x from \"m\";\nimport y from \"n\";\nexport default [x,y];", "[[{\"json\":false,\"name\":\"default\",\"specifier\":\"m\"},{\"json\":false,\"name\":\"default\",\"specifier\":\"n\"}],[[\"object\",[[\":\",\"default\",[\"array\",[[\"aref\",0],[\"aref\",1]]]]]]]]"],
                ["// c\nexport default 1;", "[[],[[\"object\",[[\":\",\"default\",1]]]]]"],
                ["/* c */ export default 1;", "[[],[[\"object\",[[\":\",\"default\",1]]]]]"],
                ["\n\n export default 1; \n\n", "[[],[[\"object\",[[\":\",\"default\",1]]]]]"],
                ["const from = 1;\nexport default from;", "[[],[1,[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                ["export default { from: 2, default: 3, with: 4 };", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"from\",2],[\":\",\"default\",3],[\":\",\"with\",4]]]]]]]]"],
                // a `;` ends a statement wherever it stands, and a `;` on
                // its own line, or several statements on one, are the same
                // module. The last case is a normalized DataJS document
                // verbatim: one line, `$`-names, every statement
                // `;`-terminated, as DataJS requires (spec/datajs).
                ["const a = 1;\nexport default a;", "[[],[1,[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                ["export default 1;", "[[],[[\"object\",[[\":\",\"default\",1]]]]]"],
                ["const a = 1;export default a;", "[[],[1,[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                ["import x from \"m\";const a = [x];export default [x,a];", "[[{\"json\":false,\"name\":\"default\",\"specifier\":\"m\"}],[[\"array\",[[\"aref\",0]]],[\"object\",[[\":\",\"default\",[\"array\",[[\"aref\",0],[\"cref\",0]]]]]]]]"],
                ["const a = 1 ; // c\nexport default a ;", "[[],[1,[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                // whitespace may precede the `;`, newlines included — a
                // newline is trivia, so the value and its terminator may sit
                // on different lines
                ["export default 1\n;", "[[],[[\"object\",[[\":\",\"default\",1]]]]]"],
                ["const a = 1\n;\nexport default a;", "[[],[1,[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                // and a `;` may be omitted where JavaScript inserts one:
                // at the end of input, whatever trivia stands there, and
                // before a statement on a new line — a line comment ends
                // the line, and a block comment holding a newline breaks
                // it (spec/README.md, module structure)
                ["export default 1", "[[],[[\"object\",[[\":\",\"default\",1]]]]]"],
                ["export default 1\n", "[[],[[\"object\",[[\":\",\"default\",1]]]]]"],
                ["export default 1 // c", "[[],[[\"object\",[[\":\",\"default\",1]]]]]"],
                ["const a = 1\nexport default a", "[[],[1,[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                ["import x from \"m\"\nexport default x", "[[{\"json\":false,\"name\":\"default\",\"specifier\":\"m\"}],[[\"object\",[[\":\",\"default\",[\"aref\",0]]]]]]"],
                ["import x from \"m\"\nconst a = x\nexport default a", "[[{\"json\":false,\"name\":\"default\",\"specifier\":\"m\"}],[[\"aref\",0],[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                ["const a = 1 // c\nexport default a", "[[],[1,[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                ["const a = 1 /* c\n */ export default a", "[[],[1,[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                ["export const a = 1\nexport const b = 2", "[[],[1,2,[\"object\",[[\":\",\"a\",[\"cref\",0]],[\":\",\"b\",[\"cref\",1]]]]]]"],
                ["const f = () => 1\nexport default f", "[[],[[\"=>\",0,[1]],[\"object\",[[\":\",\"default\",[\"cref\",0]]]]]]"],
                ["const $0=[1];export default [$0,$0];", "[[],[[\"array\",[1]],[\"object\",[[\":\",\"default\",[\"array\",[[\"cref\",0],[\"cref\",0]]]]]]]]"],
                // a word that denotes a value still names a property: it is
                // an `IdentifierName` in JavaScript, which reads it as the
                // string, and `{ "NaN": 1 }` has always denoted that object
                ["export default {NaN: 1, undefined: 2, true: 3};", "[[],[[\"object\",[[\":\",\"default\",[\"object\",[[\":\",\"NaN\",1],[\":\",\"undefined\",2],[\":\",\"true\",3]]]]]]]]"],
                ["const a = {NaN: 1};export default a.NaN;", "[[],[[\"object\",[[\":\",\"NaN\",1]]],[\"object\",[[\":\",\"default\",[\".\",[\"cref\",0],\"NaN\"]]]]]]"],
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
                // a statement written without its `;` ends at the newline
                // before the next statement, as JavaScript's automatic
                // semicolon insertion has it — and where the next statement
                // shares its line, JavaScript inserts nothing, so its first
                // token is unexpected, as it was when the `;` was required;
                // a comment on the line is on the line, a comment holding a
                // newline breaks it (spec/README.md, module structure)
                ["const a = 1 export default a;", "unexpected token", [1, 13]],
                ["import x from \"m\" export default x;", "unexpected token", [1, 19]],
                ["import x from \"m\" import y from \"n\";\nexport default x;", "unexpected token", [1, 19]],
                ["const a = 1 /* c */ const b = 2;\nexport default b;", "unexpected token", [1, 21]],
                ["const a = 1; const b = 2 export const c = 3;", "unexpected token", [1, 26]],
                ["export const a = 1 export default a;", "unexpected token", [1, 20]],
                ["export default () => { const x = 1 return x; };", "unexpected token", [1, 36]],
                // a module may end in `throw` where `export default` would,
                // and nothing follows it; `throw` and its value share a line,
                // as `return` and its value do; and the value is resolved
                ["throw 1; export default 2;", "unexpected token", [1, 10]],
                ["export default 2; throw 1;", "unexpected token", [1, 19]],
                ["throw\n1;", "unexpected token", [2, 1]],
                ["throw;", "unexpected token", [1, 6]],
                ["const a = 1 throw a;", "unexpected token", [1, 13]],
                ["export const a = 1 throw a;", "unexpected token", [1, 20]],
                ["throw zzz;", "const not found", [1, 7]],
                // a module with no export is one still, however it ends
                ["import x from \"m\"", "unexpected end", [1, 18]],
                ["const a = 1", "unexpected end", [1, 12]],
                ["const a = 1;\nconst a = 2;\nexport default a;", "duplicate id", [2, 7]],
                ["import x from \"m\";\nimport x from \"n\";\nexport default x;", "duplicate id", [2, 8]],
                ["import x from \"m\";\nconst x = 1;\nexport default x;", "duplicate id", [2, 7]],
                // a function's `length` is at most 16: the 17th fixed name is refused
                ["export default (a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15,a16)=>1;", "more than 16 fixed parameters", [1, 71]],
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
        () => {
            // a body of many guards: each nests as the alternate of the one
            // before it, the arms resolved as bodies of their own on the same
            // explicit stack the shapes above pin at twenty thousand, the
            // statements after a guard shared with the body they continue
            // rather than copied per guard, and each guard's read of the
            // parameter answered by the arm before it, which remembers the
            // word, rather than by a walk out through every arm. A quarter
            // of the count above: a guard is nine tokens where a ternary's
            // level is four, and the suite's slowest runner times a test out
            // at five seconds
            const [tag, value] = parseFromTokens(tokenizeString(`export default (a) => {\n${'if (a) { return 1; }\n'.repeat(5000)}return 0;\n};`))
            assert(tag === 'ok', tag)
            /** @type {any} */
            let arm = /** @type {any} */ (value[1][0])[1][0][2][2][0]
            for (let depth = 1; depth < 5000; depth += 1) { arm = arm[3][1][2][0] }
            assertEq(stringify(sort)(arm[3]), '["()",["=>",0,[0]],[]]')
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
        assertEq(stringifyDjsModule(value), '[[],[["object",[[":","default",["object",[[":","b",1],[":","1",2],[":","b",3]]]]]]]]')
        const object = assertOk(toUnknown(assertOk(read(ok(evaluate(value)), 'default'))))
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
            expect('const a = {}; export default a.b;', '[[],[["object",[]],["object",[[":","default",[".",["cref",0],"b"]]]]]]')
            expect('const a = {}; export default a["b c"];', '[[],[["object",[]],["object",[[":","default",[".",["cref",0],"b c"]]]]]]')
            expect('const a = []; export default a[0];', '[[],[["array",[]],["object",[[":","default",[".",["cref",0],0]]]]]]')
            // an index is a constant key, a string or a number token, and
            // the sign was only ever one because the fold made `-1.5` a
            // number. It is two tokens now, so a negative key is written as
            // the string it names — which is the key either spelling gives
            expect('const a = []; export default a["-1.5"];', '[[],[["array",[]],["object",[[":","default",[".",["cref",0],"-1.5"]]]]]]')
            expect('const a = {}; export default a.b[1].default;', '[[],[["object",[]],["object",[[":","default",[".",[".",[".",["cref",0],"b"],1],"default"]]]]]]')
            // any value takes accesses, a literal as a reference does
            expect('export default [1].length;', '[[],[["object",[[":","default",[".",["array",[1]],"length"]]]]]]')
            expect('export default "ab"[0];', '[[],[["object",[[":","default",[".","ab",0]]]]]]')
            expect('export default { a: [1] }.a[0];', '[[],[["object",[[":","default",[".",[".",["object",[[":","a",["array",[1]]]]],"a"],0]]]]]]')
            expect('export default null.x;', '[[],[["object",[[":","default",[".",null,"x"]]]]]]')
            expect('export default true.x;', '[[],[["object",[[":","default",[".",true,"x"]]]]]]')
            expect('const n = -1; export default n.x;', '[[],[["-",1],["object",[[":","default",[".",["cref",0],"x"]]]]]]')
            expect('const a = []; export default [a.length, a["length"]];', '[[],[["array",[]],["object",[[":","default",["array",[[".",["cref",0],"length"],[".",["cref",0],"length"]]]]]]]]')
            // a prototype name is a key like any other: only reading it is refused
            expect('export default { push: 1, toString: 2 };', '[[],[["object",[[":","default",["object",[[":","push",1],[":","toString",2]]]]]]]]')
            expect('import m from "./m.f.js"; export default [m.x, { y: m["x"] }];', '[[{"json":false,"name":"default","specifier":"./m.f.js"}],[["object",[[":","default",["array",[[".",["aref",0],"x"],["object",[[":","y",[".",["aref",0],"x"]]]]]]]]]]]')
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
            expect('export default -1 .x;', '[[],[["object",[[":","default",["-",[".",1,"x"]]]]]]]')
            expect('export default -0 .x;', '[[],[["object",[[":","default",["-",[".",0,"x"]]]]]]]')
            expect('export default -1n .x;', '[[],[["object",[[":","default",["-",[".",1n,"x"]]]]]]]')
            expect('export default -0n .x;', '[[],[["object",[[":","default",["-",[".",0n,"x"]]]]]]]')
            expect('export default -Infinity.x;', '[[],[["object",[[":","default",["-",[".",Infinity,"x"]]]]]]]')
            expect('export default -1["x"];', '[[],[["object",[[":","default",["-",[".",1,"x"]]]]]]]')
            // and without a sign the access is all there is
            expect('export default 1 .x;', '[[],[["object",[[":","default",[".",1,"x"]]]]]]')
            expect('export default 0n.x;', '[[],[["object",[[":","default",[".",0n,"x"]]]]]]')
            expect('export default NaN.x;', '[[],[["object",[[":","default",[".",NaN,"x"]]]]]]')
            expect('export default Infinity["x"];', '[[],[["object",[[":","default",[".",Infinity,"x"]]]]]]')
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
    memberOrder: () => {
        const [tag, value] = parseFromTokens(tokenizeString('export default {"b": 1, "a": 2, "b": 3, "c": {"y": 0, "x": 0}};'))
        assert(tag === 'ok', tag)
        const object = assertOk(toUnknown(assertOk(read(ok(evaluate(value)), 'default'))))
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
            assertEq(stringifyDjsModule(value), '[[{"json":true,"name":"default","specifier":"m"}],[["object",[[":","default",["aref",0]]]]]]')
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
    valid: [
        () => {
            const tokenList = tokenizeString('export default null;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",null]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default true;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",true]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default false;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",false]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default undefined;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",undefined]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default 0.1;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",0.1]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default 1.1e+2;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",110]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default "abc";')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default","abc"]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",["array",[]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",["array",[1]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [[]];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",["array",[["array",[]]]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [0,[1,[2,[]]],3];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",["array",[0,["array",[1,["array",[2,["array",[]]]]]],3]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default {};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[[":","default",["object",[]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [{}];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[[":","default",["array",[["object",[]]]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":true,"b":false,"c":null,"d":undefined};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[[":","default",["object",[[":","a",true],[":","b",false],[":","c",null],[":","d",undefined]]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":{"b":{"c":["d"]}}};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[[":","default",["object",[[":","a",["object",[[":","b",["object",[[":","c",["array",["d"]]]]]]]]]]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {a: 1};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[[":","default",["object",[[":","a",1]]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1234567890n;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",1234567890n]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1234567890n];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",["array",[1234567890n]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1,];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",["array",[1]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default {"a":1,};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[[":","default",["object",[[":","a",1]]]]]]]]') { throw result }
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
            assertEq(result, '[[],[["object",[[":","default",["object",[[":","a",1]]]]]]]]')
        },
        () => {
            // all three spellings in one object, plus a trailing comma
            const tokenList = tokenizeString('export default {a:1,"b":2,["c"]:3,};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",["object",[[":","a",1],[":","b",2],[":","c",3]]]]]]]]')
        },
        () => {
            // trivia is trivia inside the brackets too
            const tokenList = tokenizeString('export default { [ /* c */ \n // c \n "a" /* c */ \n // c \n ] : 1 };')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",["object",[[":","a",1]]]]]]]]')
        },
        () => {
            // the key that has no other spelling
            const tokenList = tokenizeString('export default {["__proto__"]:{"a":42}};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",["object",[[":","__proto__",["object",[[":","a",42]]]]]]]]]]]')
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
        // syntax (RFC 8259 §7), and double-quoted string literals are JSON strings.
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
            assertEq(result, '[[],[["object",[[":","default",["array",[0,1,2]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString(' export default { "a" : 0 , "b" : 1 } ; ')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[[":","default",["object",[[":","a",0],[":","b",1]]]]]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('\nexport\ndefault\n[\n0\n,\n1\n,\n2\n]\n;\n')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["object",[[":","default",["array",[0,1,2]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('\rexport\rdefault\r{\r"a"\r:\r0\r,\r"b"\r:\r1\r}\r;\r')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["object",[[":","default",["object",[[":","a",0],[":","b",1]]]]]]]]') { throw result }
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
            assertEq(result, '[[{"json":false,"name":"default","specifier":"a.f.js"}],[1,["object",[[":","default",["array",[["aref",0],["cref",0]]]]]]]]')
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
            assertEq(result, '[[],[1,2,["object",[[":","default",3]]]]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1; \n const b = 2; \n export default b;')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1,2,["object",[[":","default",["cref",1]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1; \n const b = 2; \n export default [b,a,b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1,2,["object",[[":","default",["array",[["cref",1],["cref",0],["cref",1]]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1; \n const b = 2; \n export default {"1st":b,"2nd":a,"3rd":b};')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[1,2,["object",[[":","default",["object",[[":","1st",["cref",1]],[":","2nd",["cref",0]],[":","3rd",["cref",1]]]]]]]]]') { throw result }
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
            assertEq(result, '[[{"json":false,"name":"default","specifier":"test/test.f.mjs"}],[["object",[[":","default",["aref",0]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs"; \n import b from "second/test.f.mjs"; \n export default [b, a, b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[{"json":false,"name":"default","specifier":"first/test.f.mjs"},{"json":false,"name":"default","specifier":"second/test.f.mjs"}],[["object",[[":","default",["array",[["aref",1],["aref",0],["aref",1]]]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs"; \n const b = null; \n export default [b, a, b];')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[{"json":false,"name":"default","specifier":"test/test.f.mjs"}],[null,["object",[[":","default",["array",[["cref",0],["aref",0],["cref",0]]]]]]]]')
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
            assertEq(result, '[[],[["object",[[":","default",null]]]]]')
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
            let fn = /** @type {any} */ (value[1][1])[1][0][2]
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
    ],
    /**
     * **Every shared example is proved to behave as its name says.** The two
     * operators the parser does not take yet, and the unfinished module, are
     * the refusals; everything else, an import included, parses.
     */
    demo: {
        examples: () => {
            for (const [name, source] of examples) {
                assertEq(_astOf(source)[0], ['Logical not', 'Hex escape', 'typeof', 'Parse error'].includes(name) ? 'error' : 'ok')
            }
            assertEq(_astOf('export default 1;')[1], 'export default [[],[["object",[[":","default",1]]]]];')
            assertEq(_astOf('export default !1;')[1], 'unexpected token')
        },
        view: () => {
            const shown = htmlToString(demo.view(demo.init))
            assert(shown.includes('<pre>'), shown)
            const refused = htmlToString(demo.view('export default {bad'))
            assert(refused.includes('Refused: '), refused)
        },
    },
}
