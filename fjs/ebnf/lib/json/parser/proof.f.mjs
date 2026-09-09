/**
 * @import { Assert } from '../../../../asserts/types.ts'
 * @import { Unknown } from '../../../../media/json/types.ts'
 * @import { Result } from '../../../../types/result/types.ts'
 * @import { Equal } from '../../../../types/ts/types.ts'
 * @import { Ast, Meta } from '../../../ast/types.ts'
 * @import { Parser } from '../../../ll1/types.ts'
 * @import { Error, Json, Out, Utf16 } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../../asserts/module.f.mjs'
import { unwrap } from '../../../../types/result/module.f.mjs'
import { parser } from '../../../ll1/module.f.mjs'
import { json } from '../module.f.mjs'
import { mappings, parse, units } from './module.f.mjs'

const { is } = Object

/** The value a document spells, where it spells one. @type {(text: string) => Unknown} */
const parsed = text => unwrap(parse(text))

/** @type {(value: Unknown) => Meta<Json>} */
const jsonSymbol = value => ({ symbol: 0, meta: { id: 'json', result: ['ok', value] } })

/**
 * The document's rule alone, with the set folded: it stops where the rule
 * does, and its node is the one symbol the `json` mapping returned.
 */
const parseValue = parser(json, mappings)

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
    // A number is read as JavaScript reads its lexeme: every form the
    // grammar admits, `-0` kept as `-0`, and an underflow rounded to `0`,
    // as `JSON.parse` has it.
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
        assertStructurallySame(parsed('{"__proto__": 1}'), { ['__proto__']: 1 })
        const document = ' [1.5e-3, {"a\\u00e9\\n": null, "": [true, false]}, "x"] '
        assertStructurallySame(parsed(document), JSON.parse(document))
    },
    // A number the finite range cannot hold is the one thing in a JSON text
    // that is no JSON value: it is an error naming its lexeme, and so is
    // every container above it — the first such number in document order,
    // where there are several.
    range: () => {
        assertStructurallySame(parse('1e400'), ['error', ['range', '1e400']])
        assertStructurallySame(parse('-1e400'), ['error', ['range', '-1e400']])
        assertStructurallySame(parse('[1, [2, 1e999], 3]'), ['error', ['range', '1e999']])
        assertStructurallySame(parse('{"a": {"b": 1e400}, "c": 1e401}'), ['error', ['range', '1e400']])
        assertStructurallySame(parse('[1e400, 1e401]'), ['error', ['range', '1e400']])
    },
    // A text the grammar does not match is a syntax error at the index the
    // parse failed at — the length where it ran out — and a document is the
    // whole text: what follows a value is refused, not left.
    syntax: () => {
        assertStructurallySame(parse(''), ['error', ['syntax', 0]])
        assertStructurallySame(parse('   '), ['error', ['syntax', 3]])
        assertStructurallySame(parse('[1,'), ['error', ['syntax', 3]])
        assertStructurallySame(parse('[1 2]'), ['error', ['syntax', 3]])
        assertStructurallySame(parse('tru'), ['error', ['syntax', 3]])
        assertStructurallySame(parse('[1]x'), ['error', ['syntax', 3]])
        assertStructurallySame(parse('1 2'), ['error', ['syntax', 2]])
        assertStructurallySame(parse('01'), ['error', ['syntax', 1]])
        assertStructurallySame(parse('"\\x"'), ['error', ['syntax', 2]])
        assertStructurallySame(parse('"\\u12"'), ['error', ['syntax', 5]])
        assertStructurallySame(parse('"a\nb"'), ['error', ['syntax', 2]])
        assertStructurallySame(parse('{"a" 1}'), ['error', ['syntax', 5]])
        assertStructurallySame(parse('{1: 2}'), ['error', ['syntax', 1]])
        assertStructurallySame(parse('\ud800'), ['error', ['syntax', 0]])
    },
    // Nesting depth grows with the input, and the fold adds no depth to the
    // machine's: 5000 levels of brackets and an array of 10000 items both
    // parse, and the values come out whole.
    deep: () => {
        const n = 5000
        const nested = parsed('['.repeat(n) + ']'.repeat(n))
        /** @type {(depth: number, v: Unknown) => number} */
        const depthOf = (depth, v) => v instanceof Array && v.length === 1 ? depthOf(depth + 1, v[0]) : depth
        assertEq(depthOf(0, nested), n - 1)
        const m = 10000
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
        /** @typedef {Assert<Equal<typeof parseValue, Parser<Ast<typeof json, Utf16, Out>, Utf16>>>} _Typed */
        assertStructurallySame(parseValue(units('[1]x')), ['ok', [jsonSymbol([1]), 3]])
        assertStructurallySame(parseValue(units(' "a" ')), ['ok', [jsonSymbol('a'), 5]])
    },
    // The input is one symbol per code unit, each with the shared metadata,
    // so an astral character is two and the text's length is the input's.
    units: () => {
        const symbols = units('a😀')
        assertStructurallySame(symbols.map(({ symbol }) => symbol), [0x61, 0xD83D, 0xDE00])
        assert(symbols[0].meta === symbols[1].meta)
        assertEq(symbols[0].meta.id, 'utf16')
    },
    // `parse` is total over strings: what it returns is a value or one of
    // the two errors, and nothing it is given makes it throw.
    contract: () => {
        /** @typedef {Assert<Equal<typeof parse, (text: string) => Result<Unknown, Error>>>} _Parse */
        assertEq(parse('[')[0], 'error')
    },
}
