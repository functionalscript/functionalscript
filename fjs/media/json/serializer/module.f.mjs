/**
 * JSON serializer for deterministic string output: the atoms every JSON leaf
 * is spelled with, and the one recursive walk over JSON's containers.
 *
 * `treeSerialize` is that walk. It knows objects and arrays and nothing about
 * leaves, so a codec supplies its own leaf spelling — standard JSON and
 * extended JSON differ only there, not in a second object/array walker.
 *
 * `stringSerialize` is FunctionalScript, not the host's `JSON.stringify`: it
 * escapes over this repository's own UTF-16 decoder and reproduces the
 * ECMAScript `QuoteJSONString` result exactly, lone surrogates included.
 *
 * @module
 *
 * @import { List } from '../../../types/list/types.ts'
 * @import { Reduce } from '../../../types/function/operator/types.ts'
 * @import { CodePoint } from '../../../text/utf16/types.ts'
 * @import { Tree, TreeObject, TreeArray, TreeEntry, TreeEntries, TreeMapEntries } from '../types.ts'
 */

import { flat, map, reduce, empty } from '../../../types/list/module.f.mjs'
import { concat } from '../../../types/string/module.f.mjs'
import { codePointToString, stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { errorMask } from '../../../text/code_point/module.f.mjs'
import { definedEntries, isObject } from '../../../types/object/module.f.mjs'
import { compose, fn } from '../../../types/function/module.f.mjs'
import { hexDigitCodePoint, space } from '../../../text/ascii/module.f.mjs'
import { codePointToEscape } from '../../../js/string_escape/module.f.mjs'
import { map as nullableMap } from '../../../types/nullable/module.f.mjs'

const jsonStringify = JSON.stringify

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
 * @type {(_: string) => List<string>}
 */
export const stringSerialize
    = input => [`"${concat(map(escapeCodePoint)(stringToCodePointList(input)))}"`]

/**
 * Serializes a number as a JSON number literal.
 *
 * @type {(_: number) => List<string>}
 */
export const numberSerialize
    = input => [jsonStringify(input)]

/**
 * Shared serialized representation for `null`.
 */
export const nullSerialize = ['null']

const trueSerialize = ['true']

const falseSerialize = ['false']

/** @type {(_: boolean) => List<string>} */
export const boolSerialize
    = value => value ? trueSerialize : falseSerialize

const comma = [',']

/** @type {Reduce<List<string>>} */
const joinOp
    = b => prior => flat([prior, comma, b])

/** @type {(input: List<List<string>>) => List<string>} */
const join
    = reduce(joinOp)(empty)

/** @type {(open: string) => (close: string) => (input: List<List<string>>) => List<string>} */
const wrap
    = open => close => {
        const seqOpen = [open]
        const seqClose = [close]
        return input => flat([seqOpen, join(input), seqClose])
    }

/** @type {(input: List<List<string>>) => List<string>} */
export const objectWrap
    = wrap('{')('}')

/**
 * Wraps serialized entries into a JSON array.
 *
 * @type {(input: List<List<string>>) => List<string>}
 */
export const arrayWrap
    = wrap('[')(']')

/**
 * The separator between a serialized property key and its value. Shared with
 * the DJS serializer, which builds the same `key : value` fragment.
 *
 * @type {List<string>}
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
 * @param {(value: P) => List<string>} leafSerialize
 * @returns {(sort: TreeMapEntries<P>) => (value: Tree<P>) => List<string>}
 */
export const treeSerialize = leafSerialize => sort => {
    // `definedEntries` is generic; naming it at `P` here is what keeps the leaf
    // type through the `fn(...)` composition below, which would otherwise
    // instantiate it at `unknown`.
    /** @type {(object: TreeObject<P>) => TreeEntries<P>} */
    const objectEntries = definedEntries
    /** @type {(kv: TreeEntry<P>) => List<string>} */
    const propertySerialize = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    const mapPropertySerialize = map(propertySerialize)
    /** @type {(object: TreeObject<P>) => List<string>} */
    const objectSerialize = fn(objectEntries)
        .map(sort)
        .map(mapPropertySerialize)
        .map(objectWrap)
        .result
    /** @type {(value: Tree<P>) => List<string>} */
    const f = value => {
        if (value instanceof Array) { return arraySerialize(value) }
        if (isObject(value)) { return objectSerialize(value) }
        return leafSerialize(value)
    }
    /** @type {(value: TreeArray<P>) => List<string>} */
    const arraySerialize = compose(map(f))(arrayWrap)
    return f
}
