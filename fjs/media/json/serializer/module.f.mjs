/**
 * JSON serializer for deterministic string output: the atoms every JSON leaf
 * is spelled with, and the one recursive walk over JSON's containers.
 *
 * `treeSerialize` is that walk. It knows objects and arrays and nothing about
 * leaves, so a codec supplies its own leaf spelling — standard JSON and
 * extended JSON differ only there, not in a second object/array walker.
 * `leafSerialize` builds that spelling from the one arm every dialect varies,
 * `number`, plus the leaf kinds a dialect adds; `codec` turns it into the
 * `serialize`/`stringify` pair.
 *
 * `stringSerialize` is FunctionalScript, not the host's `JSON.stringify`: it
 * escapes over this repository's own UTF-16 decoder and reproduces the
 * ECMAScript `QuoteJSONString` result exactly, lone surrogates included.
 *
 * **A leaf says what it is.** A leaf is a `[text, kind]` run, not a bare
 * string: a string is a `string`, a number a `number`, `null`, `true` and
 * `false` are `literal`s; punctuation stays a plain string. The pieces are
 * `Chunk`s, `string | Run`, so that a writer built on them marks what it
 * knows and leaves the rest. The public `serialize` of a codec still answers
 * plain strings, `chunkStrings`; the kinds are what a writer of marked text
 * builds on (`fjs/text/marked/README.md`).
 *
 * @module
 *
 * @import { List } from '../../../types/list/types.ts'
 * @import { Reduce } from '../../../types/function/operator/types.ts'
 * @import { CodePoint } from '../../../text/code_point/types.ts'
 * @import { Tree, TreeObject, TreeArray, TreeEntry, TreeEntries, TreeMapEntries } from '../types.ts'
 * @import { Codec, LeafSerializer, _ExtraLeaves, _Leaves } from './types.ts'
 * @import { Chunk } from '../../../text/marked/types.ts'
 */

import { flat, map, reduce, empty } from '../../../types/list/module.f.mjs'
import { concat } from '../../../types/string/module.f.mjs'
import { chunkStrings, chunksText } from '../../../text/marked/module.f.mjs'
import { codePointToString, stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { errorMask } from '../../../text/code_point/module.f.mjs'
import { definedEntries, isObject } from '../../../types/object/module.f.mjs'
import { compose, fn } from '../../../types/function/module.f.mjs'
import { hexDigitCodePoint, space } from '../../../text/ascii/module.f.mjs'
import { codePointToEscape } from '../../../js/string_escape/module.f.mjs'
import { map as nullableMap } from '../../../types/nullable/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.mjs'

const jsonStringify = JSON.stringify

const { is } = Object

const { fromCharCode } = String

/** @type {(value: number) => string} */
const hexDigit = value => fromCharCode(hexDigitCodePoint(value))

/**
 * `\uXXXX` with lowercase hex digits, matching ECMAScript's `UnicodeEscape`.
 *
 * @type {(unit: number) => string}
 */
const unicodeEscape = unit =>
    `\\u${hexDigit(unit >> 12 & 0xf)}${hexDigit(unit >> 8 & 0xf)}${hexDigit(unit >> 4 & 0xf)}${hexDigit(unit & 0xf)}`

/**
 * The two-character escape a letter spells, projected over the lookup's
 * `null`. Bound here rather than inside `escapeCodePoint`: it depends on
 * nothing that varies per code point, and `escapeCodePoint` runs once per
 * character of every string serialized.
 *
 * @type {(letter: number | null) => string | null}
 */
const simpleEscape = nullableMap(letter => `\\${codePointToString(letter)}`)

/**
 * Escapes one decoded code point. A code point tagged with `errorMask` is an
 * unpaired surrogate, which well-formed JSON stringification (ES2019) emits as
 * its `\uXXXX` escape rather than as a code unit; everything else is either a
 * named escape, a `\u00XX` control escape, or the character itself.
 *
 * @type {(codePoint: CodePoint) => string}
 */
const escapeCodePoint = codePoint =>
    (codePoint & errorMask) !== 0
        ? unicodeEscape(codePoint & 0xffff)
        : simpleEscape(codePointToEscape(codePoint))
            ?? (codePoint < space ? unicodeEscape(codePoint) : codePointToString(codePoint))

/**
 * Serializes a string as a JSON string literal.
 *
 * @type {(_: string) => List<Chunk>}
 */
export const stringSerialize
    = input => [[`"${concat(map(escapeCodePoint)(stringToCodePointList(input)))}"`, 'string']]

/**
 * Serializes a number as a JSON number literal.
 *
 * A finite number is spelled as ECMAScript `ToString` spells it, except that
 * `-0` is written `-0`: it is valid JSON, the parser reads it back as `-0`,
 * and `JSON.stringify` alone would write `0` — a different value read back
 * without a word. This is a deliberate difference from native
 * `JSON.stringify`. `NaN` and the infinities have no JSON spelling and are
 * written `null`, as `JSON.stringify` writes them.
 *
 * Exported as the one owner of the finite-number spelling: DataJS's
 * `_numberSerialize` writes a finite number through it and adds only its own
 * words for the non-finite ones.
 *
 * @type {(_: number) => List<Chunk>}
 */
export const numberSerialize
    = input => isFinite(input) ? [[is(input, -0) ? '-0' : jsonStringify(input), 'number']] : nullSerialize

/**
 * Shared serialized representation for `null`.
 */
/** @type {List<Chunk>} */
export const nullSerialize = [['null', 'literal']]

/** @type {List<Chunk>} */
const trueSerialize = [['true', 'literal']]

/** @type {List<Chunk>} */
const falseSerialize = [['false', 'literal']]

/** @type {(_: boolean) => List<Chunk>} */
export const boolSerialize
    = value => value ? trueSerialize : falseSerialize

/**
 * A leaf spelling from the arms that vary: `number`, which every dialect
 * spells its own way, and the leaf kinds `extra` adds — extended JSON a
 * `bigint`, DataJS a `bigint` and `undefined`. `boolean`, `string` and `null`
 * are spelled here, once, for all of them.
 *
 * The returned function accepts exactly the kinds the configuration carries a
 * serializer for (`_Leaves`), so `leafSerialize(numberSerialize)({})(1n)` is a
 * type error. A `bigint` or `undefined` that reaches a configuration without
 * its arm anyway — only a cast can deliver one — asserts, rather than being
 * answered with a plausible `null`.
 *
 * @param {LeafSerializer<number>} numberSerialize
 * @returns {<X extends _ExtraLeaves>(extra: X) => LeafSerializer<_Leaves<X>>}
 */
export const leafSerialize = numberSerialize => extra => {
    const { bigint, undefined: undefinedSerialize } = extra
    return value => {
        switch (typeof value) {
            case 'boolean': { return boolSerialize(value) }
            case 'number': { return numberSerialize(value) }
            case 'string': { return stringSerialize(value) }
            case 'bigint': { return assertNotNullish(bigint, 'no bigint arm')(value) }
            case 'undefined': { return assertNotNullish(undefinedSerialize, 'no undefined arm')(value) }
            default: { return nullSerialize }
        }
    }
}

const comma = [',']

/** @type {Reduce<List<Chunk>>} */
const joinOp
    = b => prior => flat([prior, comma, b])

/** @type {(input: List<List<Chunk>>) => List<Chunk>} */
const join
    = reduce(joinOp)(empty)

/**
 * Entries joined by commas between an opening and a closing bracket. Shared
 * with the FunctionalScript writer, which spells a call's arguments this way.
 *
 * @type {(open: string) => (close: string) => (input: List<List<Chunk>>) => List<Chunk>}
 */
export const wrap
    = open => close => {
        const seqOpen = [open]
        const seqClose = [close]
        return input => flat([seqOpen, join(input), seqClose])
    }

/** @type {(input: List<List<Chunk>>) => List<Chunk>} */
export const objectWrap
    = wrap('{')('}')

/**
 * Wraps serialized entries into a JSON array.
 *
 * @type {(input: List<List<Chunk>>) => List<Chunk>}
 */
export const arrayWrap
    = wrap('[')(']')

/**
 * The separator between a serialized property key and its value. Shared with
 * `fjs/media/datajs/serializer`, which builds the same `key : value` fragment.
 *
 * @type {List<Chunk>}
 */
export const colon = [':']

/**
 * The recursive walk over a JSON-shaped tree: objects, arrays, and a leaf
 * spelling supplied by the codec.
 *
 * Every leaf of `Tree<P>` reaches `leafSerialize` — containers are the only
 * thing this function recognizes — so a codec that adds a leaf type (extended
 * JSON's `bigint`) or respells one (extended JSON's `3.0` for a whole-valued
 * `number`) changes `leafSerialize` alone.
 *
 * Object entries whose value is `undefined` are dropped: `undefined` is a
 * missing property, not a leaf of any of these trees.
 *
 * @template P
 * @param {(value: P) => List<Chunk>} leafSerialize
 * @returns {(sort: TreeMapEntries<P>) => (value: Tree<P>) => List<Chunk>}
 */
export const treeSerialize = leafSerialize => sort => {
    // `definedEntries` is generic; naming it at `P` here is what keeps the leaf
    // type through the `fn(...)` composition below, which would otherwise
    // instantiate it at `unknown`.
    /** @type {(object: TreeObject<P>) => TreeEntries<P>} */
    const objectEntries = definedEntries
    /** @type {(kv: TreeEntry<P>) => List<Chunk>} */
    const propertySerialize = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    const mapPropertySerialize = map(propertySerialize)
    /** @type {(object: TreeObject<P>) => List<Chunk>} */
    const objectSerialize = fn(objectEntries)
        .map(sort)
        .map(mapPropertySerialize)
        .map(objectWrap)
        .result
    /** @type {(value: Tree<P>) => List<Chunk>} */
    const f = value => {
        if (value instanceof Array) { return arraySerialize(value) }
        if (isObject(value)) { return objectSerialize(value) }
        return leafSerialize(value)
    }
    /** @type {(value: TreeArray<P>) => List<Chunk>} */
    const arraySerialize = compose(map(f))(arrayWrap)
    return f
}

/**
 * A codec from a leaf spelling: `treeSerialize` over it, and the same walk
 * concatenated into text. A dialect is its leaf spelling and nothing else.
 *
 * @template P
 * @param {LeafSerializer<P>} leaf
 * @returns {Codec<P>}
 */
export const codec = leaf => {
    const serialize = treeSerialize(leaf)
    return {
        serialize: sort => compose(serialize(sort))(chunkStrings),
        stringify: sort => compose(serialize(sort))(chunksText),
    }
}
