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
 * that a grammar built over JSON's rules folds the same way, {@link textAt}
 * reads the text they return, and {@link syntaxError} names where a parse
 * failed. `../../datajs/parser` is the reader built over them, and builds
 * its own output symbol with {@link tagged}, as this reader builds both of
 * its own.
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Ast, Children, Meta } from '../../../ebnf/ast/types.ts'
 * @import { Mapping, Mappings, RewriteSet } from '../../../ebnf/ll1/types.ts'
 * @import { Utf16 } from '../../../ebnf/utf16/types.ts'
 * @import { hex } from '../../../ebnf/lib/json/module.f.mjs'
 * @import { Entry, JsonValue } from '../../../ebnf/lib/json/types.ts'
 * @import { _LiteralId, _Member, _OnlyKey, Json, NumberPolicy, Out, ParseUnknown, Tagged, Text } from './types.ts'
 */

import { assert, assertNotNullish } from '../../../asserts/module.f.js'
import { hexDigitsValue } from '../../../text/ascii/module.f.mjs'
import { codeUnitToString } from '../../../text/utf16/module.f.mjs'
import { escapeToCodePoint } from '../../../js/string_escape/module.f.mjs'
import { error, mapOk, ok, okList } from '../../../types/result/module.f.js'
import { eof } from '../../../ebnf/module.f.mjs'
import { symbolAt, unmapped } from '../../../ebnf/ast/module.f.mjs'
import { mapping, parser } from '../../../ebnf/ll1/module.f.mjs'
import { lexeme, unitAt, units } from '../../../ebnf/utf16/module.f.mjs'
import { character, escape, items, json, number, string, value } from '../../../ebnf/lib/json/module.f.mjs'
const { fromEntries } = Object

/**
 * The wrap/read pair of a single-payload member of an output alphabet `O`:
 * `symbol` wraps a payload as that member under its `id`, and `at` reads
 * the payload back from a node, asserting the `id` — the one runtime check
 * the convention that an `id` names one metadata type leaves to make.
 *
 * `O` appears in no argument, so an instance is a `const` annotated with
 * its {@link Tagged} type, which supplies `O`, `Id` and `K` together.
 *
 * @template {{ readonly id: string }} O
 * @template {_LiteralId<O>} Id
 * @template {_OnlyKey<_Member<O, Id>>} K
 * @param {Id} id
 * @param {K} key
 * @returns {Tagged<O, Id, K>}
 */
export const tagged = (id, key) => ({
    // `_OnlyKey` makes `key` the member's one field besides `id`, so this is
    // the whole member, which TypeScript cannot follow through `Extract`.
    symbol: payload => /** @type {Meta<_Member<O, Id>>} */ ({ symbol: 0, meta: { id, [key]: payload } }),
    at: node => {
        const { meta } = symbolAt(node)
        assert(meta.id === id)
        // `_Admits` leaves no member of the node's alphabet but this one to
        // carry `id`, so the assert has narrowed `meta` to it.
        const member = /** @type {_Member<O, Id>} */ (/** @type {unknown} */ (meta))
        return member[key]
    },
})

/** @type {Tagged<Text, 'text', 'value'>} */
const textTag = tagged('text', 'value')

/**
 * The string a `Text` node carries: what {@link stringMappings} return for a
 * string, so every reader built over them reads it with this.
 *
 * @type {Tagged<Text, 'text', 'value'>['at']}
 */
export const textAt = textTag.at

/**
 * The pair of a value's symbol over the domain `P`: a thunk, since a value
 * cannot be generic, so each use binds it where `P` is bound.
 *
 * @type {<P>() => Tagged<Out<P>, 'json', 'result'>}
 */
const jsonTag = () => tagged('json', 'result')

/**
 * The code unit of a hex digit node: the digit as written, for
 * `hexDigitsValue` to read.
 *
 * @type {(node: Ast<typeof hex, Utf16, Text>) => number}
 */
const hexDigitUnit = node => {
    const [, digit] = unmapped(node)
    return unitAt(digit)
}

/** @type {Mappings<Utf16, Text>} */
const textMapping = mapping

/**
 * The mapping of the grammar's `escape` rule: to the character it spells —
 * a simple escape's from `../../../js/string_escape`'s table, whose letters
 * the grammar's proof pins its escape set to, so the lookup always answers;
 * and a `\u` escape's the one code unit its four digits name, so an escaped
 * surrogate is one unit, as a raw one is. The node is the backslash and what
 * follows it.
 *
 * @type {Mapping<Utf16, Text>}
 */
const escapeMapping = textMapping(escape, ([, e]) => {
    const branch = unmapped(e)
    if (branch[0] === 'c') { return textTag.symbol(codeUnitToString(assertNotNullish(escapeToCodePoint(unitAt(branch[1]))))) }
    const [, digits] = unmapped(branch[1])
    // The grammar admits exactly four hex digits here, so `hexDigitsValue`
    // never answers `null` and the value fits one code unit.
    const unit = assertNotNullish(hexDigitsValue(unmapped(digits).map(hexDigitUnit)))
    return textTag.symbol(codeUnitToString(Number(unit)))
})

/**
 * The mapping of the grammar's `character` rule: a symbol as it stands is
 * the text of its unit, and an escape is the text its own mapping returned.
 *
 * @type {Mapping<Utf16, Text>}
 */
const characterMapping = textMapping(character, node =>
    node[0] === 'c' ? textTag.symbol(codeUnitToString(unitAt(node[1]))) : symbolAt(node[1]))

/**
 * The mapping of the grammar's `string` rule: to the text of its characters,
 * each one the text its own mapping returned.
 *
 * @type {Mapping<Utf16, Text>}
 */
const stringMapping = textMapping(string, ([, characters]) => textTag.symbol(unmapped(characters).map(textAt).join('')))

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
 * A number is what the policy makes of its lexeme — the text under its
 * node, which nothing under it maps, so it reaches the policy whole: a leaf
 * of the policy's domain, or the policy's error where the domain cannot
 * hold it.
 *
 * @type {<P>(policy: NumberPolicy<P>) => (node: Children<typeof number, Utf16, Out<P>>) => Result<ParseUnknown<P>, string>}
 */
const numberOf = policy => node => policy(lexeme(node))

/** @type {<P>(key: string) => (value: ParseUnknown<P>) => readonly [string, ParseUnknown<P>]} */
const pair = key => value => [key, value]

/**
 * One entry of an object: its key, and its value where the value is one.
 *
 * @template P
 * @param {Ast<Entry<typeof string, JsonValue>, Utf16, Out<P>>} node
 * @returns {Result<readonly [string, ParseUnknown<P>], string>}
 */
const entry = node => {
    /** @type {Tagged<Out<P>, 'json', 'result'>} */
    const { at } = jsonTag()
    const [key, , , , v] = unmapped(node)
    return mapOk(pair(textAt(key)))(at(v))
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
    // leaf of that domain rather than the domain a generic constructor would
    // infer from the constant alone.
    /** @type {Tagged<Out<P>, 'json', 'result'>} */
    const { symbol, at } = jsonTag()
    switch (node[0]) {
        case 'array': { return symbol(okList(items(unmapped(node[1])).map(at))) }
        case 'object': { return symbol(mapOk(fromEntries)(okList(items(unmapped(node[1])).map(entry)))) }
        case 'string': { return symbol(ok(textAt(node[1]))) }
        case 'number': { return symbol(at(node[1])) }
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
    /** @type {Tagged<Out<P>, 'json', 'result'>} */
    const { symbol, at } = jsonTag()
    return [
        ...stringMappings,
        map(number, node => symbol(numberOf(policy)(node))),
        map(value, toJson),
        map(json, ([, v]) => symbol(at(v))),
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
    /** @type {Tagged<Out<P>, 'json', 'result'>} */
    const { at } = jsonTag()
    return text => {
        const match = parseDocument(units(text))
        return match[0] === 'error' ? error(syntaxError(text)(match[1])) : at(unmapped(match[1][0])[0])
    }
}
