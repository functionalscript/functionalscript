/**
 * The JSON reader: the rewrite set that folds the tree of the grammar in
 * `../module.f.mjs` into a JSON value as the LL(1) backend builds it, and
 * {@link parse}, the parser over the whole set.
 *
 * What a mapping returns is a JSON value or an error, never a value that is
 * no JSON. A mapping reports nothing, so the one thing in a JSON text that
 * is no JSON value — a number the finite `number` range cannot hold, `1e400`
 * — is an `error` standing where the number would, a container holding one
 * is that error too, and the first in document order is the document's.
 * A parse that fails builds no tree and reports where; {@link parse} merges
 * the two into one `Result`.
 *
 * The input is UTF-16 code units rather than code points, which is what
 * makes a string the sequence of units it spells: a lone surrogate is one
 * unit in and one unit out, escaped or raw, as `JSON.parse` reads it, where
 * a decoder to code points would refuse it before the grammar saw it.
 *
 * @module
 *
 * @import { Unknown } from '../../../../media/json/types.ts'
 * @import { RequiredMap } from '../../../../types/object/types.ts'
 * @import { Result } from '../../../../types/result/types.ts'
 * @import { Ast, Children, Meta } from '../../../ast/types.ts'
 * @import { Mappings, RewriteSet } from '../../../ll1/types.ts'
 * @import { Rule } from '../../../types.ts'
 * @import { Container, Entry, JsonValue } from '../types.ts'
 * @import { _Character, _Escape, _HexDigit } from './private.ts'
 * @import { Error, Json, Out, OutOfRange, Text, Utf16 } from './types.ts'
 */

import { assert, assertNotNullish } from '../../../../asserts/module.f.mjs'
import { listToString, stringToList } from '../../../../text/utf16/module.f.mjs'
import { toArray } from '../../../../types/list/module.f.mjs'
import { at } from '../../../../types/object/module.f.mjs'
import { error, mapOk, ok, unwrap } from '../../../../types/result/module.f.mjs'
import { eof } from '../../../module.f.mjs'
import { mapping, parser } from '../../../ll1/module.f.mjs'
import { json, number, string, value, ws } from '../module.f.mjs'

const { fromCharCode } = String
const { isFinite } = Number
const { fromEntries } = Object

/**
 * The metadata of a code unit with nothing to say about it: one frozen
 * record shared by every leaf, so the parse allocates nothing per symbol.
 */
const utf16 = /**@type {const}*/({ id: 'utf16' })

/** @type {(symbol: number) => Meta<Utf16>} */
const unit = symbol => ({ symbol, meta: utf16 })

/**
 * The input the parser is given: the UTF-16 code units of a text, each with
 * the trivial metadata.
 *
 * @type {(text: string) => readonly Meta<Utf16>[]}
 */
export const units = text => toArray(stringToList(text)).map(unit)

/** @type {(value: string) => Meta<Text>} */
const text = value => ({ symbol: 0, meta: { id: 'text', value } })

/** @type {(result: Result<Unknown, OutOfRange>) => Meta<Json>} */
const jsonSymbol = result => ({ symbol: 0, meta: { id: 'json', result } })

/**
 * The node at a position no mapping filled: an array the machine built, so
 * its shape is the rule's. The one test a mapping makes where it knows a
 * position is unmapped — the scaffolding `cj` builds and hands to nobody.
 *
 * @type {<T extends readonly unknown[]>(node: T | Meta<unknown>) => T}
 */
const unmapped = node => {
    assert(node instanceof Array)
    return node
}

/**
 * The symbol at a position a mapping filled, or an input leaf: not an array,
 * and its `meta.id` says which alphabet it is.
 *
 * @type {(node: Meta<Utf16 | Out> | readonly unknown[]) => Meta<Utf16 | Out>}
 */
const symbolAt = node => {
    assert(!(node instanceof Array))
    return node
}

/** @type {(node: Meta<Utf16 | Out> | readonly unknown[]) => number} */
const unitAt = node => {
    const { symbol, meta } = symbolAt(node)
    assert(meta.id === 'utf16')
    return symbol
}

/** @type {(node: Meta<Utf16 | Out> | readonly unknown[]) => string} */
const textAt = node => {
    const { meta } = symbolAt(node)
    assert(meta.id === 'text')
    return meta.value
}

/** @type {(node: Meta<Utf16 | Out> | readonly unknown[]) => Result<Unknown, OutOfRange>} */
const jsonAt = node => {
    const { meta } = symbolAt(node)
    assert(meta.id === 'json')
    return meta.result
}

/**
 * The character a simple escape stands for, by the character after the
 * backslash — the eight the grammar's `set('"\\/bfnrt')` admits.
 *
 * @type {RequiredMap<'"' | '\\' | '/' | 'b' | 'f' | 'n' | 'r' | 't', string>}
 */
const simpleEscape = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }

/**
 * What a hex digit's range starts from, by the range's tag in the grammar,
 * so that the digit's value is its symbol less that: `A` is `10`.
 */
const hexBase = /**@type {const}*/({ digit: 0x30, AF: 0x41 - 10, af: 0x61 - 10 })

/** @type {(node: Ast<_HexDigit, Utf16, Out>) => number} */
const hexDigit = node => {
    const [tag, digit] = unmapped(node)
    return unitAt(digit) - hexBase[tag]
}

/**
 * The character an escape spells: a simple escape's from the table, and a
 * `\u` escape's the one code unit its four digits name — so an escaped
 * surrogate is one unit, as a raw one is.
 *
 * @type {(node: Ast<_Escape, Utf16, Out>) => string}
 */
const escaped = node => {
    const escape = unmapped(node)
    if (escape[0] === 'c') { return assertNotNullish(at(fromCharCode(unitAt(escape[1])))(simpleEscape)) }
    const [, digits] = unmapped(escape[1])
    return fromCharCode(unmapped(digits).reduce((code, digit) => code * 16 + hexDigit(digit), 0))
}

/**
 * One character of a string: a symbol as it stands, or what its escape
 * spells — the escape's node is the backslash and what follows it.
 *
 * @type {(node: Ast<_Character, Utf16, Out>) => string}
 */
const character = node => {
    const c = unmapped(node)
    return c[0] === 'c' ? fromCharCode(unitAt(c[1])) : escaped(unmapped(c[1])[1])
}

/**
 * The input symbols under a node, in order — the lexeme of a rule nothing
 * under it maps. A variant's tag is not a symbol and is passed over.
 *
 * @type {(node: Ast<Rule, Utf16, Out> | string) => readonly number[]}
 */
const unitsUnder = node =>
    typeof node === 'string' ? [] :
    node instanceof Array ? node.flatMap(unitsUnder) :
    [unitAt(node)]

/**
 * A number is its lexeme read as JavaScript reads it, where the finite
 * range holds the result; `1e400` reads as `Infinity`, which is no JSON
 * value, so it is the error naming the lexeme instead.
 *
 * @type {(node: Children<typeof number, Utf16, Out>) => Result<Unknown, OutOfRange>}
 */
const numberOf = node => {
    const lexeme = listToString(unitsUnder(node))
    const n = Number(lexeme)
    return isFinite(n) ? ok(n) : error(['range', lexeme])
}

/**
 * Every value, or the first error among them: an item that is no JSON
 * value makes its container none, and the earliest in document order is
 * the one reported.
 *
 * @type {<T>(results: readonly Result<T, OutOfRange>[]) => Result<readonly T[], OutOfRange>}
 */
const all = results => {
    const errors = results.flatMap(r => r[0] === 'error' ? [r] : [])
    return errors.length === 0 ? ok(results.map(unwrap)) : errors[0]
}

/**
 * The item of the pair `cj` hands to `join`: the item, then its whitespace.
 *
 * @type {<R extends Rule>(node: Ast<readonly [R, typeof ws], Utf16, Out>) => Ast<R, Utf16, Out>}
 */
const item = node => unmapped(node)[0]

/**
 * The items of a container, as `cj` lays them out: the option `join` builds
 * is empty, or holds the first item beside the separator-item pairs, each
 * item followed by its whitespace. Everything around an item is scaffolding
 * no mapping did.
 *
 * @type {<R extends Rule>(node: Children<Container<R>, Utf16, Out>) => readonly Ast<R, Utf16, Out>[]}
 */
const items = ([, , option]) => {
    const o = unmapped(option)
    if (o.length === 0) { return [] }
    const [first, rest] = unmapped(o[0])
    return [item(first), ...unmapped(rest).map(pair => item(unmapped(pair)[1]))]
}

/** @type {(key: string) => (value: Unknown) => readonly [string, Unknown]} */
const pair = key => value => [key, value]

/**
 * One entry of an object: its key, and its value where the value is one.
 *
 * @type {(node: Ast<Entry<typeof string, JsonValue>, Utf16, Out>) => Result<readonly [string, Unknown], OutOfRange>}
 */
const entry = node => {
    const [key, , , , v] = unmapped(node)
    return mapOk(pair(textAt(key)))(jsonAt(v))
}

/**
 * A value is what its branch made of it: a container folds its items, an
 * error among them standing for the whole; a string and a number are what
 * their own mappings returned; a keyword is its constant. Every entry of an
 * object is kept, the last of a repeated key winning, as `JSON.parse` has
 * it.
 *
 * @type {(node: Children<JsonValue, Utf16, Out>) => Meta<Json>}
 */
const toJson = node => {
    switch (node[0]) {
        case 'array': { return jsonSymbol(all(items(unmapped(node[1])).map(jsonAt))) }
        case 'object': { return jsonSymbol(mapOk(fromEntries)(all(items(unmapped(node[1])).map(entry)))) }
        case 'string': { return jsonSymbol(ok(textAt(node[1]))) }
        case 'number': { return jsonSymbol(jsonAt(node[1])) }
        case 'true': { return jsonSymbol(ok(true)) }
        case 'false': { return jsonSymbol(ok(false)) }
        case 'null': { return jsonSymbol(ok(null)) }
    }
}

/** @type {Mappings<Utf16, Out>} */
const map = mapping

/**
 * The rewrite set: a string to the text it spells, a number to its value or
 * the error it is, a value to what its branch made of it, and the document
 * to its value's symbol, so that `parser(json, mappings)` yields one symbol
 * carrying the value. Keyed by the rules `../module.f.mjs` holds, so it
 * applies to that grammar and to a grammar built over those rules.
 *
 * @type {RewriteSet<Utf16, Out>}
 */
export const mappings = [
    map(string, ([, characters]) => text(unmapped(characters).map(character).join(''))),
    map(number, node => jsonSymbol(numberOf(node))),
    map(value, toJson),
    map(json, ([, v]) => jsonSymbol(jsonAt(v))),
]

/**
 * A document is the grammar's `json` followed by the end of input, so that
 * a trailing symbol is refused rather than left: `json` alone stops where
 * its rule does and would read `[1]x` as `[1]`.
 */
const document = /**@type {const}*/([json, eof])

const parseDocument = parser(document, mappings)

/**
 * Parses a text as a JSON document: the value it spells, or why it spells
 * none — where the parse failed, or the number the finite range cannot hold.
 *
 * @type {(text: string) => Result<Unknown, Error>}
 */
export const parse = text => {
    const match = parseDocument(units(text))
    return match[0] === 'error' ? error(['syntax', match[1]]) : jsonAt(unmapped(match[1][0])[0])
}
