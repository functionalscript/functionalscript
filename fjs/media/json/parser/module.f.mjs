/**
 * The shared JSON reader: the rewrite set that folds the tree of the grammar
 * in `../../../ebnf/lib/json` into a JSON value as the LL(1) backend builds
 * it, and {@link parse}, the parser over the whole set — both per numeric
 * policy, so that each codec chooses its own runtime numeric domain from the
 * same parse:
 *
 * ```text
 * JSON text -> grammar -> parse(policy) -+-> json.Unknown       (number)
 *                                        +-> extended.Unknown   (number | bigint)
 *                                        +-> another policy's domain
 * ```
 *
 * A number is the one leaf the reader does not know how to build: its exact
 * lexeme is handed to the `NumberPolicy` the caller supplies, so numeric
 * syntax stays lossless all the way to the policy. No codec has to
 * materialize another codec's domain first: standard JSON parsing never
 * needs an intermediate `bigint`, and extended parsing never needs an
 * intermediate rounded `number`.
 *
 * What a mapping returns is a JSON value or an error, never a value that is
 * no JSON. A mapping reports nothing, so a number the policy refuses is its
 * error standing where the number would, a container holding one is that
 * error too, and the first in document order is the document's. A parse
 * that fails builds no tree and reports where; {@link parse} merges the two
 * into one `Result`.
 *
 * The input is the UTF-16 alphabet of `../../../ebnf/utf16`, code units
 * rather than code points, which is what makes a string the sequence of
 * units it spells: a lone surrogate is one unit in and one unit out,
 * escaped or raw, as `JSON.parse` reads it.
 *
 * A string is folded rule by rule: an `escape` to the character it
 * spells, a `character` to its text, and the `string` to the text of its
 * characters, so the three mappings are one unit, {@link stringMappings},
 * that a grammar built over JSON's rules folds the same way. {@link lexeme}
 * is the text under a node, and {@link syntaxError} names where a parse
 * failed. `../../datajs/parser` is the reader built over them.
 *
 * @module
 *
 * @import { RequiredMap } from '../../../types/object/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Ast, Children, Meta } from '../../../ebnf/ast/types.ts'
 * @import { Mapping, Mappings, RewriteSet } from '../../../ebnf/ll1/types.ts'
 * @import { Rule } from '../../../ebnf/types.ts'
 * @import { Utf16 } from '../../../ebnf/utf16/types.ts'
 * @import { Entry, JsonValue } from '../../../ebnf/lib/json/types.ts'
 * @import { Json, NumberPolicy, Out, ParseUnknown, Text } from './types.ts'
 */

import { assert, assertNotNullish } from '../../../asserts/module.f.mjs'
import { listToString } from '../../../text/utf16/module.f.mjs'
import { at } from '../../../types/object/module.f.mjs'
import { error, mapOk, ok, unwrap } from '../../../types/result/module.f.mjs'
import { eof } from '../../../ebnf/module.f.mjs'
import { symbolAt, unmapped } from '../../../ebnf/ast/module.f.mjs'
import { mapping, parser } from '../../../ebnf/ll1/module.f.mjs'
import { units } from '../../../ebnf/utf16/module.f.mjs'
import { character, escape, hex, items, json, number, string, value } from '../../../ebnf/lib/json/module.f.mjs'

const { fromCharCode } = String
const { fromEntries } = Object

/** @type {(value: string) => Meta<Text>} */
const text = value => ({ symbol: 0, meta: { id: 'text', value } })

/** @type {<P>(result: Result<ParseUnknown<P>, string>) => Meta<Json<P>>} */
const jsonSymbol = result => ({ symbol: 0, meta: { id: 'json', result } })

/** @type {(node: Meta<Utf16 | { readonly id: string }> | readonly unknown[]) => number} */
const unitAt = node => {
    const { symbol, meta } = symbolAt(node)
    assert(meta.id === 'utf16')
    return symbol
}

/** @type {(node: Meta<Utf16 | Out<unknown>> | readonly unknown[]) => string} */
const textAt = node => {
    const { meta } = symbolAt(node)
    assert(meta.id === 'text')
    return meta.value
}

/** @type {<P>(node: Meta<Utf16 | Out<P>> | readonly unknown[]) => Result<ParseUnknown<P>, string>} */
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

/** @type {(node: Ast<typeof hex, Utf16, Text>) => number} */
const hexDigit = node => {
    const [tag, digit] = unmapped(node)
    return unitAt(digit) - hexBase[tag]
}

/** @type {Mappings<Utf16, Text>} */
const textMapping = mapping

/**
 * The mapping of the grammar's `escape` rule: to the character it spells —
 * a simple escape's from the table, and a `\u` escape's the one code unit
 * its four digits name, so an escaped surrogate is one unit, as a raw one
 * is. The node is the backslash and what follows it.
 *
 * @type {Mapping<Utf16, Text>}
 */
const escapeMapping = textMapping(escape, ([, e]) => {
    const branch = unmapped(e)
    if (branch[0] === 'c') { return text(assertNotNullish(at(fromCharCode(unitAt(branch[1])))(simpleEscape))) }
    const [, digits] = unmapped(branch[1])
    return text(fromCharCode(unmapped(digits).reduce((code, digit) => code * 16 + hexDigit(digit), 0)))
})

/**
 * The mapping of the grammar's `character` rule: a symbol as it stands is
 * the text of its unit, and an escape is the text its own mapping returned.
 *
 * @type {Mapping<Utf16, Text>}
 */
const characterMapping = textMapping(character, node =>
    node[0] === 'c' ? text(fromCharCode(unitAt(node[1]))) : symbolAt(node[1]))

/**
 * The mapping of the grammar's `string` rule: to the text of its characters,
 * each one the text its own mapping returned.
 *
 * @type {Mapping<Utf16, Text>}
 */
const stringMapping = textMapping(string, ([, characters]) => text(unmapped(characters).map(textAt).join('')))

/**
 * The mappings of the grammar's `string` rule and the rules under it, an
 * `escape` and a `character`, to the text the string spells with every
 * escape decoded. They know no policy, so they are one unit for every set
 * over JSON's `string` — the sets {@link mappings} builds, and a grammar's
 * that reuses the rule — and a unit rather than three exports because the
 * backend refuses a mapping of a rule the grammar does not hold, and a
 * grammar holding `string` holds all three.
 *
 * @type {readonly Mapping<Utf16, Text>[]}
 */
export const stringMappings = [escapeMapping, characterMapping, stringMapping]

/**
 * The input symbols under a node, in order. A variant's tag is not a symbol
 * and is passed over.
 *
 * @type {(node: Ast<Rule, Utf16, { readonly id: string }> | string) => readonly number[]}
 */
const unitsUnder = node =>
    typeof node === 'string' ? [] :
    node instanceof Array ? node.flatMap(unitsUnder) :
    [unitAt(node)]

/**
 * The text under a node: its input symbols, in order, as the string they
 * spell — the lexeme of a rule nothing under it maps, which is how a
 * number's reaches its policy whole.
 *
 * @type {(node: Ast<Rule, Utf16, { readonly id: string }>) => string}
 */
export const lexeme = node => listToString(unitsUnder(node))

/**
 * A number is what the policy makes of its lexeme: a leaf of the policy's
 * domain, or the policy's error where the domain cannot hold it.
 *
 * @type {<P>(policy: NumberPolicy<P>) => (node: Children<typeof number, Utf16, Out<P>>) => Result<ParseUnknown<P>, string>}
 */
const numberOf = policy => node => policy(lexeme(node))

/**
 * Every value, or the first error among them: an item that is no JSON
 * value makes its container none, and the earliest in document order is
 * the one reported.
 *
 * @type {<T>(results: readonly Result<T, string>[]) => Result<readonly T[], string>}
 */
const all = results => {
    const errors = results.flatMap(r => r[0] === 'error' ? [r] : [])
    return errors.length === 0 ? ok(results.map(unwrap)) : errors[0]
}

/** @type {<P>(key: string) => (value: ParseUnknown<P>) => readonly [string, ParseUnknown<P>]} */
const pair = key => value => [key, value]

/**
 * One entry of an object: its key, and its value where the value is one.
 *
 * @type {<P>(node: Ast<Entry<typeof string, JsonValue>, Utf16, Out<P>>) => Result<readonly [string, ParseUnknown<P>], string>}
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
 * @template P
 * @param {Children<JsonValue, Utf16, Out<P>>} node
 * @returns {Meta<Json<P>>}
 */
const toJson = node => {
    // Bound to this value's domain once, so that a keyword's constant is a
    // leaf of that domain rather than the domain `jsonSymbol` would infer
    // from the constant alone.
    /** @type {(result: Result<ParseUnknown<P>, string>) => Meta<Json<P>>} */
    const symbol = jsonSymbol
    switch (node[0]) {
        case 'array': { return symbol(all(items(unmapped(node[1])).map(jsonAt))) }
        case 'object': { return symbol(mapOk(fromEntries)(all(items(unmapped(node[1])).map(entry)))) }
        case 'string': { return symbol(ok(textAt(node[1]))) }
        case 'number': { return symbol(jsonAt(node[1])) }
        case 'true': { return symbol(ok(true)) }
        case 'false': { return symbol(ok(false)) }
        case 'null': { return symbol(ok(null)) }
    }
}

/**
 * The rewrite set over `policy`: a string to the text it spells, a number to
 * what the policy makes of its lexeme, a value to what its branch made of
 * it, and the document to its value's symbol, so that `parser(json,
 * mappings(policy))` yields one symbol carrying the value. Keyed by the
 * rules `../../../ebnf/lib/json` holds, so it applies to that grammar.
 *
 * @template P
 * @param {NumberPolicy<P>} policy
 * @returns {RewriteSet<Utf16, Out<P>>}
 */
export const mappings = policy => {
    /** @type {Mappings<Utf16, Out<P>>} */
    const map = mapping
    return [
        ...stringMappings,
        map(number, node => jsonSymbol(numberOf(policy)(node))),
        map(value, toJson),
        map(json, ([, v]) => jsonSymbol(jsonAt(v))),
    ]
}

/**
 * A document is the grammar's `json` followed by the end of input, so that
 * a trailing symbol is refused rather than left: `json` alone stops where
 * its rule does and would read `[1]x` as `[1]`.
 */
const document = /**@type {const}*/([json, eof])

/**
 * A parse that failed, by the index the backend reports: the input's length
 * where it ran out, and the symbol it could not read otherwise.
 *
 * @type {(text: string) => (at: number) => string}
 */
export const syntaxError = text => at =>
    at === text.length ? 'unexpected end' : `unexpected symbol at ${at}`

/**
 * Parses a text as a JSON document into the value domain `policy`
 * materializes numbers into.
 *
 * Returns `ok` with the parsed value on success, or `error` with a message
 * when the text is no JSON document — where the parse failed, or, verbatim,
 * why `policy` refused a number its domain cannot represent.
 *
 * The parser over the set is built where the policy is bound, so a codec
 * binds its policy once and holds the reader, as both codecs here do.
 *
 * @template P
 * @param {NumberPolicy<P>} policy
 * @returns {(text: string) => Result<ParseUnknown<P>, string>}
 */
export const parse = policy => {
    const parseDocument = parser(document, mappings(policy))
    return text => {
        const match = parseDocument(units(text))
        return match[0] === 'error' ? error(syntaxError(text)(match[1])) : jsonAt(unmapped(match[1][0])[0])
    }
}
