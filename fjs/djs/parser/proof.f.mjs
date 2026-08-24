/**
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 */

import { parseFromTokens, _bnfParseFromTokens } from './module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { stringifyAsTree } from '../serializer/module.f.mjs'
import { stringify } from '../../media/json/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

/** @type {(s: string) => readonly DjsTokenWithMetadata[]} */
const tokenizeString = s => toArray(tokenize(stringToList(s))(''))

const stringifyDjsModule = stringifyAsTree(sort)

/** @type {(kind: 'ws' | 'nl' | 'null' | 'true' | 'false' | 'undefined' | 'eof', line: number) => DjsTokenWithMetadata} */
const proofKind = (kind, line) => ({ token: { kind }, metadata: { path: 'a.js', line, column: 1 } })

/** @type {(value: string, line: number) => DjsTokenWithMetadata} */
const proofId = (value, line) => ({ token: { kind: 'id', value }, metadata: { path: 'a.js', line, column: 1 } })

export const proof = {
    // The BNF implementation and the hand-written state machine agree on the
    // whole result, not merely on accept/reject: the same `AstModule` for every
    // source that parses, and the same `ParseError` message for every one that
    // does not. That is the parity bar the cutover has to clear.
    bnfParity: [
        () => {
            for (const s of [
                "export default null",
                "export default true",
                "export default false",
                "export default undefined",
                "export default 0.1",
                "export default 1.1e+2",
                "export default \"abc\"",
                "export default 1234567890n",
                "export default []",
                "export default [1]",
                "export default [1,]",
                "export default [[]]",
                "export default [0,[1,[2,[]]],3]",
                "export default [1234567890n]",
                "export default {}",
                "export default {\"a\":1}",
                "export default {a: 1}",
                "export default {\"a\":1,}",
                "export default {[\"a\"]:1}",
                "export default {a:1,\"b\":2,[\"c\"]:3,}",
                "export default {\"a\":{\"b\":{\"c\":[\"d\"]}}}",
                "export default {\"a\":true,\"b\":false,\"c\":null,\"d\":undefined}",
                "export default {a:1,a:2}",
                "export default {[\"__proto__\"]: 1}",
                "const a = 1\nexport default a",
                "const a = 1\nconst b = 2\nexport default [a,b]",
                "const a = a\nexport default a",
                "import x from \"m\"\nexport default x",
                "import x from \"m\"\nconst a = 1\nexport default a",
                "import x from \"m\"\nimport y from \"n\"\nexport default [x,y]",
                "// c\nexport default 1",
                "/* c */ export default 1",
                "\n\n export default 1 \n\n",
                "const export = 1\nexport default export",
                "export default { from: 2, default: 3 }",
            ]) {
                const tokens = tokenizeString(s)
                const [oldTag, oldValue] = parseFromTokens(tokens)
                const [newTag, newValue] = _bnfParseFromTokens(tokens)
                assert(oldTag === 'ok' && newTag === 'ok', [s, oldTag, newTag])
                assertEq(stringifyDjsModule(newValue), stringifyDjsModule(oldValue), s)
            }
        },
        () => {
            // malformed shapes, which the grammar rejects
            for (const s of [
                "",
                "export default",
                "42",
                "[1,2]",
                "{\"a\":1}",
                "export default [",
                "export default {",
                "const a = 1 export default a",
                "export default 1 2",
                "export default {a}",
                "export default {:1}",
                "export default [,]",
                "import x from y\nexport default x",
                "export x from \"m\"\nexport default 1",
                "const = 1\nexport default 1",
                "export default {[1]:2}",
                "const a = 1;\nexport default a",
                "export default 1\nconst b = 2",
                "import x from \"m\"",
                "const a = 1",
            ]) {
                const tokens = tokenizeString(s)
                const [oldTag, oldValue] = parseFromTokens(tokens)
                const [newTag, newValue] = _bnfParseFromTokens(tokens)
                assert(oldTag === 'error' && newTag === 'error', [s, oldTag, newTag])
                assertEq(newValue.message, oldValue.message, s)
                assertStructurallySame(newValue.metadata, oldValue.metadata, s)
            }
        },
        () => {
            // The one wording the BNF path cannot reproduce, and why. Statement
            // ordering is shape here — `import* const* export` — so a late
            // `import` is simply a token the grammar cannot use, not a rule
            // about ordering it could name. The position is identical, which is
            // what the ParseError contract actually promises.
            const s = 'const a = 1\nimport x from "m"\nexport default a'
            const tokens = tokenizeString(s)
            const [oldTag, oldValue] = parseFromTokens(tokens)
            const [newTag, newValue] = _bnfParseFromTokens(tokens)
            assert(oldTag === 'error' && newTag === 'error', [oldTag, newTag])
            assertEq(oldValue.message, 'import must come before const')
            assertEq(newValue.message, 'unexpected token')
            assertStructurallySame(newValue.metadata, oldValue.metadata)
        },
        () => {
            // the checks no grammar could make, which the fold owns: each one
            // reads a token's text rather than its symbol
            for (const s of [
                "const a = 1\nconst a = 2\nexport default a",
                "import x from \"m\"\nimport x from \"n\"\nexport default x",
                "import x from \"m\"\nconst x = 1\nexport default x",
                "export default zzz",
                "const a = zzz\nexport default a",
                "export default [zzz]",
                "export default {a: zzz}",
                "export default {__proto__: 1}",
                "export default {\"__proto__\": 1}",
                // a third statement after the failing one: the fold stops at the
                // first error rather than reporting the last
                "import x from \"m\"\nimport x from \"n\"\nimport y from \"o\"\nexport default y",
                "const a = 1\nconst a = 2\nconst b = 3\nexport default b",
            ]) {
                const tokens = tokenizeString(s)
                const [oldTag, oldValue] = parseFromTokens(tokens)
                const [newTag, newValue] = _bnfParseFromTokens(tokens)
                assert(oldTag === 'error' && newTag === 'error', [s, oldTag, newTag])
                assertEq(newValue.message, oldValue.message, s)
                assertStructurallySame(newValue.metadata, oldValue.metadata, s)
            }
        },
    ],
    // Errors are reported first-to-last, and a key is not special enough to
    // jump the queue.
    //
    // Checking every key before folding any value reported `__proto__` in
    // `{a: missing, __proto__: 1}`, where the earlier unresolved reference is
    // what a reader meets first — so keys are checked as their member is
    // reached instead.
    bnfFirstErrorOrder: [
        () => {
            for (const source of [
                'export default {a: missing, __proto__: 1}',
                'export default {__proto__: 1, a: missing}',
                'export default [missing, {__proto__: 1}]',
                'export default {a: {b: missing}, __proto__: 1}',
                'export default {a: 1, b: missing, __proto__: 2}',
                // nothing fails before it, so the key is reached mid-fold
                // rather than on the way in
                'export default {a: 1, __proto__: 2}',
                'export default {a: 1, b: 2, "__proto__": 3}',
            ]) {
                const tokens = tokenizeString(source)
                const [oldTag, oldValue] = parseFromTokens(tokens)
                const [newTag, newValue] = _bnfParseFromTokens(tokens)
                assert(oldTag === 'error' && newTag === 'error', [source, oldTag, newTag])
                assertEq(newValue.message, oldValue.message, source)
                assertStructurallySame(newValue.metadata, oldValue.metadata, source)
            }
        },
    ],
    // Wide and deep values, which cost the BNF path a stack frame each until
    // both its traversals were made iterative.
    //
    // A repetition is only *flat* in the AST when `toData` recognizes the
    // right-recursive shape, and nested inside `delimited`'s option scaffolding
    // it does not — so 5,000 siblings are 5,000 levels of tree, and a recursive
    // walk over them overflows exactly as deep nesting would. The state machine
    // was fixed for its own version of this; see `containerStackCost`.
    bnfStackSafety: [
        () => {
            const source = `export default [${Array(5000).fill('null').join(',')}]`
            const tokens = tokenizeString(source)
            assertEq(parseFromTokens(tokens)[0], 'ok')
            assertEq(_bnfParseFromTokens(tokens)[0], 'ok')
        },
        () => {
            const source = `export default [${Array(5000).fill('{}').join(',')}]`
            const tokens = tokenizeString(source)
            assertEq(parseFromTokens(tokens)[0], 'ok')
            assertEq(_bnfParseFromTokens(tokens)[0], 'ok')
        },
        () => {
            const source = `export default ${'['.repeat(5000)}${']'.repeat(5000)}`
            const tokens = tokenizeString(source)
            assertEq(parseFromTokens(tokens)[0], 'ok')
            assertEq(_bnfParseFromTokens(tokens)[0], 'ok')
        },
        () => {
            // wide objects walk the member list rather than the element list
            const source = `export default {${Array(5000).fill(0).map((_, i) => `k${i}:${i}`).join(',')}}`
            const tokens = tokenizeString(source)
            assertEq(parseFromTokens(tokens)[0], 'ok')
            assertEq(_bnfParseFromTokens(tokens)[0], 'ok')
        },
    ],
    // The tokenizer's EOF contract, checked through the parser rather than
    // through `splitEof` alone.
    //
    // Two of these are a **deliberate behaviour change at cutover**: the state
    // machine accepts a stream with no `eof`, and one with two, because it only
    // ever asks what the next token is. The BNF path requires exactly one, in
    // final position, because a backend synthesizes its own logical end and a
    // second marker would be a symbol the grammar has no rule for. Neither
    // stream can come from the tokenizer, so this tightens a contract only a
    // hand-built list could break — but it does tighten it, and the cutover
    // should not be where that is discovered.
    bnfEofContract: [
        () => {
            const wellFormed = [
                proofId('export', 1), proofKind('ws', 1), proofId('default', 1),
                proofKind('ws', 1), proofKind('null', 1), proofKind('eof', 1),
            ]
            const [oldTag] = parseFromTokens(wellFormed)
            const [newTag] = _bnfParseFromTokens(wellFormed)
            assert(oldTag === 'ok' && newTag === 'ok', [oldTag, newTag])
        },
        () => {
            // no `eof`: the state machine reads it as a complete module
            const noEof = [
                proofId('export', 1), proofKind('ws', 1), proofId('default', 1),
                proofKind('ws', 1), proofKind('null', 1),
            ]
            assertEq(parseFromTokens(noEof)[0], 'ok')
            const [tag, value] = _bnfParseFromTokens(noEof)
            assert(tag === 'error', tag)
            assertEq(value.message, 'missing end-of-input token')
        },
        () => {
            // a second `eof`: likewise invisible to the state machine
            const twoEof = [
                proofId('export', 1), proofKind('ws', 1), proofId('default', 1),
                proofKind('ws', 1), proofKind('null', 1), proofKind('eof', 1), proofKind('eof', 2),
            ]
            assertEq(parseFromTokens(twoEof)[0], 'ok')
            const [tag, value] = _bnfParseFromTokens(twoEof)
            assert(tag === 'error', tag)
            assertEq(value.message, 'end-of-input token is not final')
        },
        () => {
            // an empty stream is rejected by both, on different words
            assertEq(parseFromTokens([])[0], 'error')
            const [tag, value] = _bnfParseFromTokens([])
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
            const [tag, value] = parseFromTokens(tokenizeString('const a = /* x'))
            assert(tag === 'error', tag)
            assertEq(value.metadata?.column, 15)
        },
    ],
    // None of the framing keywords is reserved: outside the positions that frame
    // a module, the parser accepts them as ordinary identifiers. Pinned here
    // because the BNF replacement gives each its own token symbol, and a grammar
    // whose identifier rule accepted only the `id` symbol would stop parsing
    // every case below without any other test noticing.
    framingKeywordsAsIdentifiers: [
        () => {
            const [tag, value] = parseFromTokens(tokenizeString('const export = 1\nexport default export'))
            assert(tag === 'ok', tag)
            // `export` bound as a const and then referenced: the exported value
            // resolves back to that binding, so the word acted as an identifier
            // in both positions.
            assertStructurallySame(value[1], [1, ['cref', 0]])
        },
        () => {
            const [tag] = parseFromTokens(tokenizeString('const from = 1\nexport default from'))
            assert(tag === 'ok', tag)
        },
        () => {
            const [tag] = parseFromTokens(tokenizeString('const import = 1\nexport default import'))
            assert(tag === 'ok', tag)
        },
        () => {
            const [tag] = parseFromTokens(tokenizeString('export default { from: 2, default: 3 }'))
            assert(tag === 'ok', tag)
        },
        () => {
            const [tag] = parseFromTokens(tokenizeString('export default { export: 1 }'))
            assert(tag === 'ok', tag)
        },
    ],
    valid: [
        () => {
            const tokenList = tokenizeString('export default null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[null]]')
        },
        () => {
            const tokenList = tokenizeString('export default true')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[true]]')
        },
        () => {
            const tokenList = tokenizeString('export default false')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[false]]')
        },
        () => {
            const tokenList = tokenizeString('export default undefined')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[undefined]]')
        },
        () => {
            const tokenList = tokenizeString('export default 0.1')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[0.1]]')
        },
        () => {
            const tokenList = tokenizeString('export default 1.1e+2')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[110]]')
        },
        () => {
            const tokenList = tokenizeString('export default "abc"')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],["abc"]]')
        },
        () => {
            const tokenList = tokenizeString('export default []')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[1]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [[]]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[["array",[]]]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [0,[1,[2,[]]],3]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[0,["array",[1,["array",[2,["array",[]]]]]],3]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default {}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default [{}]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[["array",[{}]]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":true,"b":false,"c":null,"d":undefined}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":true,"b":false,"c":null,"d":undefined}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {"a":{"b":{"c":["d"]}}}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":{"b":{"c":["array",["d"]]}}}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default {a: 1}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":1}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('export default 1234567890n')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1234567890n]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1234567890n]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[1234567890n]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default [1,]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[1]]]]')
        },
        () => {
            const tokenList = tokenizeString('export default {"a":1,}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":1}]]') { throw result }
        }
    ],
    // A computed key `["a"]` is a third spelling of an ordinary key, next to
    // the identifier and the string literal (#2470).
    computedKey: [
        () => {
            const tokenList = tokenizeString('export default {["a"]:1}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[{"a":1}]]')
        },
        () => {
            // all three spellings in one object, plus a trailing comma
            const tokenList = tokenizeString('export default {a:1,"b":2,["c"]:3,}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[{"a":1,"b":2,"c":3}]]')
        },
        () => {
            // trivia is trivia inside the brackets too
            const tokenList = tokenizeString('export default { [ /* c */ \n // c \n "a" /* c */ \n // c \n ] : 1 }')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[{"a":1}]]')
        },
        () => {
            // the key that has no other spelling
            const tokenList = tokenizeString('export default {["__proto__"]:{"a":42}}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[{"__proto__":{"a":42}}]]')
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
            const tokenList = tokenizeString('export default {__proto__:1}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, '__proto__ requires the computed key form')
        },
        () => {
            const tokenList = tokenizeString('export default {"__proto__":1}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, '__proto__ requires the computed key form')
        },
        () => {
            // the same two spellings after a ',', the parser's other key state
            const tokenList = tokenizeString('export default {"a":1,__proto__:2}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, '__proto__ requires the computed key form')
        },
        () => {
            const tokenList = tokenizeString('export default {"a":1,"__proto__":2}')
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
            const tokenList = tokenizeString('export default 10-5')
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
            // `parseFromTokens` itself, called with no tokens at all (the
            // tokenizer never produces this — it always emits at least an
            // `eof` token — but the exported function's own contract must
            // still handle it: the initial state is neither 'result' nor
            // 'error', so it falls through to the same "unexpected end".
            const obj = parseFromTokens(null)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
            assertEq(obj[1].metadata, null)
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
            const tokenList = tokenizeString(' export default [ 0 , 1 , 2 ] ')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[0,1,2]]]]')
        },
        () => {
            const tokenList = tokenizeString(' export default { "a" : 0 , "b" : 1 } ')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":0,"b":1}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('\nexport\ndefault\n[\n0\n,\n1\n,\n2\n]\n')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[["array",[0,1,2]]]]')
        },
        () => {
            const tokenList = tokenizeString('\rexport\rdefault\r{\r"a"\r:\r0\r,\r"b"\r:\r1\r}\r')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[{"a":0,"b":1}]]') { throw result }
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
            const tokenList = tokenizeString('const a = 1\n')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end')
        },
    ],
    // Statements are ordered: imports, then constants, then `export default`.
    statementOrder: [
        () => {
            const tokenList = tokenizeString('import a from "a.f.js" \n const b = 1 \n export default [a,b]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[["a.f.js"],[1,["array",[["aref",0],["cref",0]]]]]')
        },
        () => {
            const tokenList = tokenizeString('const b = 1 \n import a from "a.f.js" \n export default [a,b]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'import must come before const')
        },
        () => {
            // nothing follows `export default` but trivia
            const tokenList = tokenizeString('export default 1 \n const a = 2')
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
            const tokenList = tokenizeString('export default a')
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
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default 3')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1,2,3]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default b')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1,2,["cref",1]]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default [b,a,b]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[1,2,["array",[["cref",1],["cref",0],["cref",1]]]]]')
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const b = 2 \n export default {"1st":b,"2nd":a,"3rd":b}')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            if (result !== '[[],[1,2,{"1st":["cref",1],"2nd":["cref",0],"3rd":["cref",1]}]]') { throw result }
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
            const tokenList = tokenizeString('const = 1 \n const b = 2 \n export default 3')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected token', obj)
        },
        () => {
            const tokenList = tokenizeString('const a = 1 \n const a = 2 \n export default 3')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'duplicate id', obj)
        },
        () => {
            // No newline after the const's value: the parser hits `eof` while
            // still in the newline-required state, instead of the following
            // `nl` token every other `const` test provides.
            const tokenList = tokenizeString('const a = 1')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'unexpected end', obj)
        },
    ],
    validWithArgs:[
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n export default a')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[["test/test.f.mjs"],[["aref",0]]]')
        },
        () => {
            const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import b from "second/test.f.mjs" \n export default [b, a, b]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[["first/test.f.mjs","second/test.f.mjs"],[["array",[["aref",1],["aref",0],["aref",1]]]]]')
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const b = null \n export default [b, a, b]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[["test/test.f.mjs"],[null,["array",[["cref",0],["aref",0],["cref",0]]]]]')
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
            const tokenList = tokenizeString('import a from "first/test.f.mjs" \n import a from "second/test.f.mjs" \n export default [b, a, b]')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'duplicate id', obj)
        },
        () => {
            const tokenList = tokenizeString('import a from "test/test.f.mjs" \n const a = null \n export default null')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'error', obj)
            assertEq(obj[1].message, 'duplicate id', obj)
        },
    ],
    comments: [
        () => {
            const tokenList = tokenizeString('export //comment \n default /* comment */ null //comment')
            const obj = parseFromTokens(tokenList)
            assert(obj[0] === 'ok', obj)
            const result = stringifyDjsModule(obj[1])
            assertEq(result, '[[],[null]]')
        },
    ],
    // Regression: closing a container popped the parser stack with `drop(1)`,
    // which is lazy, so every closed container left one unforced thunk wrapping
    // the stack. The chain was forced only at the end, costing a call-stack
    // frame per container and overflowing at roughly 5000 of them — whether
    // nested or flat siblings — while primitives were unbounded. `fjs/media/json`
    // carried the same defect and was fixed in the same way.
    containerStackCost: [
        () => {
            const [tag, value] = parseFromTokens(tokenizeString(
                `export default [${Array(20000).fill('{}').join(',')}]`))
            assert(tag === 'ok', tag)
            assertEq(value[1].length, 1)
        },
        () => {
            const [tag] = parseFromTokens(tokenizeString(
                `export default [${Array(20000).fill('[]').join(',')}]`))
            assert(tag === 'ok', tag)
        },
        () => {
            const [tag] = parseFromTokens(tokenizeString(
                'export default ' + '['.repeat(20000) + ']'.repeat(20000)))
            assert(tag === 'ok', tag)
        },
        () => {
            // primitives never touched the stack — the baseline that always passed
            const [tag] = parseFromTokens(tokenizeString(
                `export default [${Array.from({ length: 20000 }, (_, i) => i).join(',')}]`))
            assert(tag === 'ok', tag)
        },
    ]
}
