/**
 * @import { Assert } from '../../../asserts/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Equal } from '../../../types/ts/types.ts'
 * @import { Ast, Meta } from '../../../ebnf/ast/types.ts'
 * @import { Mapping, Parser, RewriteSet } from '../../../ebnf/ll1/types.ts'
 * @import { Utf16 } from '../../../ebnf/utf16/types.ts'
 * @import { Unknown } from '../types.ts'
 * @import { Json, NumberPolicy, Out, ParseUnknown, Text } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { error, ok, unwrap } from '../../../types/result/module.f.mjs'
import { parser } from '../../../ebnf/ll1/module.f.mjs'
import { units } from '../../../ebnf/utf16/module.f.mjs'
import { json, number, string } from '../../../ebnf/lib/json/module.f.mjs'
import { lexeme, mappings, parse as parseWithPolicy, stringMapping, syntaxError } from './module.f.mjs'

const { is } = Object
const { isFinite } = Number

/**
 * The structural machine is proved through a `number` policy that refuses
 * what the finite range cannot hold, so that a policy's error has a route to
 * take: `1e400` reads as `Infinity`, which is no JSON value.
 *
 * @type {NumberPolicy<number>}
 */
const numberPolicy = lexeme => {
    const n = Number(lexeme)
    return isFinite(n) ? ok(n) : error(`out of range: ${lexeme}`)
}

const parse = parseWithPolicy(numberPolicy)

/** The value a document spells, where it spells one. @type {(text: string) => Unknown} */
const parsed = text => unwrap(parse(text))

/** @type {(value: Unknown) => Meta<Json<number>>} */
const jsonSymbol = value => ({ symbol: 0, meta: { id: 'json', result: ['ok', value] } })

/**
 * The document's rule alone, with the set folded: it stops where the rule
 * does, and its node is the one symbol the `json` mapping returned.
 */
const parseValue = parser(json, mappings(numberPolicy))

export const proof = {
    // Each of the seven values, alone in its document.
    values: () => {
        assertEq(parsed('null'), null)
        assertEq(parsed('true'), true)
        assertEq(parsed('false'), false)
        assertEq(parsed('"x"'), 'x')
        assertEq(parsed('42'), 42)
        assertStructurallySame(parsed('[]'), [])
        assertStructurallySame(parsed('{}'), {})
    },
    // A string is the code units it spells, each escape decoded: the eight
    // simple escapes, and a `\u` escape as the one unit its digits name, in
    // either case of hex digit.
    strings: () => {
        assertEq(parsed('""'), '')
        assertEq(parsed('"\\" \\\\ \\/ \\b \\f \\n \\r \\t"'), '" \\ / \b \f \n \r \t')
        assertEq(parsed('"\\u0041\\u00e9\\u00E9\\u4e2d"'), 'Aéé中')
        assertEq(parsed('"\\u0000"'), '\0')
        assertEq(parsed('"\\uFFFF"'), '￿')
    },
    // The alphabet is code units, so a text is read as `JSON.parse` reads
    // it: an astral character is two units in and the same two out, raw or
    // escaped, and a lone surrogate is one, raw or escaped, refused nowhere.
    surrogates: () => {
        assertEq(parsed('"😀"'), '😀')
        assertEq(parsed('"\\ud83d\\ude00"'), '😀')
        assertEq(parsed('"\ud800"'), '\ud800')
        assertEq(parsed('"\\ud800"'), '\ud800')
        assertEq(parsed('"\\udc00x"'), '\udc00x')
    },
    // A number is what the policy makes of its lexeme — here, read as
    // JavaScript reads it: every form the grammar admits, `-0` kept as `-0`,
    // and an underflow rounded to `0`, as `JSON.parse` has it.
    numbers: () => {
        assertEq(parsed('0'), 0)
        assertEq(parsed('-1'), -1)
        assertEq(parsed('123'), 123)
        assertEq(parsed('1.5'), 1.5)
        assertEq(parsed('-0.25'), -0.25)
        assertEq(parsed('1e3'), 1000)
        assertEq(parsed('1E+3'), 1000)
        assertEq(parsed('1.5e-3'), 0.0015)
        assertEq(parsed('9007199254740993'), 9007199254740992)
        assert(is(parsed('-0'), -0))
        assertEq(parsed('1e-400'), 0)
    },
    // Containers hold values, whitespace stands wherever the grammar allows
    // it, and an object keeps every entry with the last of a repeated key
    // winning — `__proto__` an ordinary key among them, as `JSON.parse` has
    // it.
    containers: () => {
        assertStructurallySame(parsed('[1, [2, [3]], {"a": [null]}]'), [1, [2, [3]], { a: [null] }])
        assertStructurallySame(parsed(' \n\r\t[ 1 ,\t2 ] '), [1, 2])
        assertStructurallySame(parsed('{ "a" : 1 , "b" : { } }'), { a: 1, b: {} })
        assertStructurallySame(parsed('{"a": 1, "a": 2}'), { a: 2 })
        assertStructurallySame(parsed('{"": 0}'), { '': 0 })
        assertStructurallySame(parsed('{"a":true,"b":false,"c":null}'), { a: true, b: false, c: null })
        assertStructurallySame(parsed('{"__proto__": 1}'), JSON.parse('{"__proto__": 1}'))
        const document = ' [1.5e-3, {"a\\u00e9\\n": null, "": [true, false]}, "x"] '
        assertStructurallySame(parsed(document), JSON.parse(document))
    },
    // The numeric policy is the reader's only opinion about numbers: it is
    // handed the exact lexeme, and it may reject one.
    policy: {
        // the lexeme reaches the policy unrounded — `1.0`, `1e0` and `1` are
        // one `number` but three lexemes
        exactLexeme: () => {
            /** @type {NumberPolicy<string>} */
            const lexemePolicy = lexeme => ok(lexeme)
            assertStructurallySame(parseWithPolicy(lexemePolicy)('[1.0,1e0,1,-0]'), ['ok', ['1.0', '1e0', '1', '-0']])
        },
        // a policy that cannot represent the number fails the parse as an
        // ordinary `Result`, with its own message
        rejected: () => {
            /** @type {NumberPolicy<never>} */
            const rejectPolicy = () => error('no numbers here')
            assertStructurallySame(parseWithPolicy(rejectPolicy)('{"a":[1]}'), ['error', 'no numbers here'])
            assertStructurallySame(parseWithPolicy(rejectPolicy)('{"a":[]}'), ['ok', { a: [] }])
        },
        // A number the policy refuses is the one thing in a JSON text that
        // is no JSON value: it is the policy's error, and so is every
        // container above it — the first such number in document order,
        // where there are several.
        first: () => {
            assertStructurallySame(parse('1e400'), ['error', 'out of range: 1e400'])
            assertStructurallySame(parse('-1e400'), ['error', 'out of range: -1e400'])
            assertStructurallySame(parse('[1, [2, 1e999], 3]'), ['error', 'out of range: 1e999'])
            assertStructurallySame(parse('{"a": {"b": 1e400}, "c": 1e401}'), ['error', 'out of range: 1e400'])
            assertStructurallySame(parse('[1e400, 1e401]'), ['error', 'out of range: 1e400'])
        },
    },
    // A text the grammar does not match is a syntax error naming the index
    // the parse failed at — the end, where it ran out — and a document is
    // the whole text: what follows a value is refused, not left.
    syntax: () => {
        assertStructurallySame(parse(''), ['error', 'unexpected end'])
        assertStructurallySame(parse('   '), ['error', 'unexpected end'])
        assertStructurallySame(parse('[1,'), ['error', 'unexpected end'])
        assertStructurallySame(parse('{"1":2'), ['error', 'unexpected end'])
        assertStructurallySame(parse('"123'), ['error', 'unexpected end'])
        assertStructurallySame(parse('[1 2]'), ['error', 'unexpected symbol at 3'])
        assertStructurallySame(parse('tru'), ['error', 'unexpected end'])
        assertStructurallySame(parse('[1]x'), ['error', 'unexpected symbol at 3'])
        assertStructurallySame(parse('1 2'), ['error', 'unexpected symbol at 2'])
        assertStructurallySame(parse('01'), ['error', 'unexpected symbol at 1'])
        assertStructurallySame(parse('10-5'), ['error', 'unexpected symbol at 2'])
        assertStructurallySame(parse('"\\x"'), ['error', 'unexpected symbol at 2'])
        assertStructurallySame(parse('"\\u12"'), ['error', 'unexpected symbol at 5'])
        assertStructurallySame(parse('"a\nb"'), ['error', 'unexpected symbol at 2'])
        assertStructurallySame(parse('{"a" 1}'), ['error', 'unexpected symbol at 5'])
        assertStructurallySame(parse('{1: 2}'), ['error', 'unexpected symbol at 1'])
        assertStructurallySame(parse('\ud800'), ['error', 'unexpected symbol at 0'])
        assertStructurallySame(parse('undefined'), ['error', 'unexpected symbol at 0'])
        // Trailing commas are not valid JSON — strict JSON has none.
        assertStructurallySame(parse('[1,]'), ['error', 'unexpected symbol at 3'])
        assertStructurallySame(parse('{"a":1,}'), ['error', 'unexpected symbol at 7'])
        assertStructurallySame(parse('{,"1":2}'), ['error', 'unexpected symbol at 1'])
        assertStructurallySame(parse('}'), ['error', 'unexpected symbol at 0'])
        assertStructurallySame(parse('[{]}'), ['error', 'unexpected symbol at 2'])
        assertStructurallySame(parse('{[}]'), ['error', 'unexpected symbol at 1'])
    },
    // Nesting depth grows with the input, and the fold adds no depth to the
    // machine's: 5000 levels of brackets, 6000 sibling containers and an
    // array of 12000 items all parse, and the values come out whole.
    deep: () => {
        const n = 5000
        const nested = parsed('['.repeat(n) + ']'.repeat(n))
        /** @type {(depth: number, v: Unknown) => number} */
        const depthOf = (depth, v) => v instanceof Array && v.length === 1 ? depthOf(depth + 1, v[0]) : depth
        assertEq(depthOf(0, nested), n - 1)
        const s = 6000
        const objects = parsed(`[${Array(s).fill('{}').join(',')}]`)
        assert(objects instanceof Array)
        assertEq(objects.length, s)
        const entries = parsed(`{${Array.from({ length: s }, (_, i) => `"k${i}":[]`).join(',')}}`)
        assert(typeof entries === 'object' && entries !== null && !(entries instanceof Array))
        assertEq(Object.keys(entries).length, s)
        const m = 12000
        const wide = parsed(`[${Array.from({ length: m }, (_, i) => i).join(',')}]`)
        assert(wide instanceof Array)
        assertEq(wide.length, m)
        assertEq(wide[m - 1], m - 1)
    },
    // The set folded into the grammar's own rule: its node is the one symbol
    // the `json` mapping returned, and the rule stops where it does, so a
    // trailing symbol is left rather than refused. The parser is typed by
    // the two alphabets, read off the set.
    mappings: () => {
        /** @typedef {Assert<Equal<typeof parseValue, Parser<Ast<typeof json, Utf16, Out<number>>, Utf16>>>} _Typed */
        assertStructurallySame(parseValue(units('[1]x')), ['ok', [jsonSymbol([1]), 3]])
        assertStructurallySame(parseValue(units(' "a" ')), ['ok', [jsonSymbol('a'), 5]])
    },
    // What a grammar built over JSON's rules folds the same way: the `string`
    // mapping alone, folded into the rule it is keyed by; the lexeme of a
    // node nothing under maps, a variant's tag passed over; and where a
    // parse failed, by the index the backend reports.
    shared: () => {
        /** @typedef {Assert<Equal<typeof stringMapping, Mapping<Utf16, Text>>>} _String */
        const parseString = parser(string, [stringMapping])
        assertStructurallySame(parseString(units('"a\\u0062"')), ['ok', [{ symbol: 0, meta: { id: 'text', value: 'ab' } }, 9]])
        /** @type {RewriteSet<Utf16, never>} */
        const nothing = []
        const parseNumber = parser(number, nothing)
        assertEq(lexeme(unwrap(parseNumber(units('-1.5e+3x')))[0]), '-1.5e+3')
        assertEq(syntaxError('abc')(3), 'unexpected end')
        assertEq(syntaxError('abc')(1), 'unexpected symbol at 1')
    },
    // `parse` is total over strings: what it returns is a value of the
    // policy's domain or a message, and nothing it is given makes it throw.
    contract: () => {
        /** @typedef {Assert<Equal<typeof parseWithPolicy, <P>(policy: NumberPolicy<P>) => (text: string) => Result<ParseUnknown<P>, string>>>} _Parse */
        assertEq(parse('[')[0], 'error')
    },
}
