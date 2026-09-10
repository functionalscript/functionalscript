/**
 * The byte alphabet: the terminals a grammar over bytes is written with,
 * and the input such a grammar reads — one symbol per byte, `0..255`, each
 * carrying the alphabet's metadata.
 *
 * The front end spells a terminal as a code point: a string lowers to one
 * symbol per code point, and `set` and `range` read their argument as text.
 * Below `0x80` a code point and its byte coincide, so `'tree '` and
 * `set(' \n')` spell bytes as they are. Above it the two part ways — `'é'`
 * is one code point and two UTF-8 bytes — and a rule spelled that way
 * matches the byte `0xE9` where its author may have meant `0xC3 0xA9`. So a
 * byte grammar takes its terminals above ASCII from {@link bytes}, and
 * {@link byteParser} refuses, before any input, a string rule that is not
 * ASCII, a symbol that is not a byte, and a set that reaches past the byte
 * universe. What it cannot refuse is a text argument to `set` or `range`
 * above `0x7F`: both lower it eagerly, so `set('é')` is `bytes(0xE9)` by
 * the time any check sees it. See `./README.md`.
 *
 * @module
 *
 * @import { List } from '../../types/list/types.ts'
 * @import { Ast, Meta } from '../ast/types.ts'
 * @import { Parser, RewriteSet } from '../ll1/types.ts'
 * @import { Rule, Set } from '../types.ts'
 * @import { Byte } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { rangeEncode, remove, union } from '../module.f.mjs'
import { toData } from '../data/module.f.mjs'
import { parser } from '../ll1/module.f.mjs'

const { isInteger } = Number
const { is: sameValue } = Object

/** One past the last byte: the boundary a byte set never reaches past. */
const byteEnd = /** @type {const} */ (0x100)

/**
 * Whether `b` is a byte: an integer in `0..255`, and not `-0`, which the
 * data layer refuses as a second spelling of `0`. The alphabet's
 * membership, for a consumer that holds a `number` it means as a byte —
 * a `List<number>` it is about to write, say — and has to refuse one that
 * is not.
 *
 * @type {(b: number) => boolean}
 */
export const isByte = b => isInteger(b) && b >= 0 && b < byteEnd && !sameValue(b, -0)

/**
 * The metadata of every byte: one frozen record, shared by every leaf, so
 * that a parse allocates nothing per symbol beyond the leaf itself.
 *
 * @type {Byte}
 */
export const meta = { id: 'byte' }

/**
 * @throws If `b` is not a byte.
 *
 * @type {(b: number) => Meta<Byte>}
 */
const symbol = b => {
    assert(isByte(b), ['not a byte', b])
    return { symbol: b, meta }
}

/**
 * The input a parser over this alphabet is given: the bytes of a list, in
 * order, each with the shared metadata. A `Vec` is read through
 * `u8List(msb)` from `fjs/types/bit_vec`, and a `Uint8Array` through
 * `fromArrayLike` from `fjs/types/list`.
 *
 * @throws If an item is not a byte: the input is refused at the boundary,
 * where a value that is no byte would otherwise fail to match a set and
 * read as a parse error somewhere inside the object.
 *
 * @type {(input: List<number>) => readonly Meta<Byte>[]}
 */
export const symbols = input => toArray(input).map(symbol)

/** Any one byte: the byte universe as a terminal. */
export const byte = rangeEncode(0, 0xFF)

/**
 * The bytes not in `s`: the front end's `remove` with the byte universe
 * named, where its `unicodeMax` would be the wrong one.
 *
 * @type {<const S extends Set>(s: S) => Set<readonly ['remove', typeof byte, S]>}
 */
export const not = s => remove(byte, s)

/**
 * One of the given bytes: the terminal for a byte above `0x7F`, which no
 * string spells and `set` and `range` mis-spell.
 *
 * @throws If no byte is given — a terminal that can never match is a
 * mistake at the call site — or if an argument is not a byte.
 *
 * @type {<const B extends readonly number[]>(...b: B) => Set<readonly ['bytes', ...B]>}
 */
export const bytes = (...b) => {
    assert(b.length !== 0 && b.every(isByte), ['not bytes', b])
    const info = union(...b.map(v => rangeEncode(v, v)))()
    return () => info
}

/**
 * Whether every code point of `s` is ASCII, and so spells the byte it is.
 *
 * @type {(s: string) => boolean}
 */
const isAscii = s => toArray(stringToCodePointList(s)).every(c => c < 0x80)

/**
 * Refuses a rule the lowering met that reaches past the alphabet: a string
 * that is not ASCII, a symbol that is not a byte, a set with a boundary
 * past the byte universe or with an open tail — an odd number of
 * boundaries runs to infinity from the last one, so `['set', 256]` holds no
 * byte and every symbol above. A tuple, a variant and a repeat carry no symbol
 * of their own, and the rules under them are met on their own. A `const`
 * thunk's payload is not: the lowering names the payload under the thunk
 * and never registers it, so the thunk *is* the payload here, and a bare
 * string or number behind one is checked as if it were the key. EOF's set,
 * `[-1, 0]`, is within every boundary a byte set has.
 *
 * @type {(rule: Rule) => void}
 */
const check = rule => {
    if (typeof rule === 'string') {
        assert(isAscii(rule), ['a string in a byte grammar is ASCII', rule])
    } else if (typeof rule === 'number') {
        assert(isByte(rule), ['a symbol in a byte grammar is a byte', rule])
    } else if (typeof rule === 'function') {
        const info = rule()
        if (info[0] === 'set') {
            const [, ...s] = info
            assert(s.length % 2 === 0 && s.every(b => b <= byteEnd), ['a set in a byte grammar holds bytes only', s])
        } else if (info[0] === 'const') {
            check(info[1])
        }
    }
}

/**
 * `parser` from `../ll1` for a grammar over bytes: the rule is refused
 * before any input where it spells a symbol no byte is, and parsed as
 * `parser` parses it otherwise.
 *
 * The check runs over the identity map `toData` returns, which is keyed by
 * every rule the lowering met — a string literal included, so the literal
 * is checked as the text it is, before its code points become sets. The one
 * rule the map does not key is a `const` thunk's payload, which the
 * lowering names under the thunk; the check follows the thunk to it. A text
 * argument to `set` or `range` is lowered eagerly by its constructor and
 * cannot be seen here: `set('é')` reaches the map as the set `[233, 234]`,
 * which is `bytes(0xE9)` spelled another way, and is accepted as that.
 *
 * The input's metadata `I` is this alphabet's, `Byte`, or a record carrying
 * its `id` beside more — an offset, say — and never another alphabet's: a
 * rewrite set written against another layer's input is refused at the
 * type, so a mapping keeps to the layer it was written for.
 *
 * @template {Rule} const R
 * @template {Byte} [I=Byte]
 * @template [O=never]
 * @param {R} rule
 * @param {RewriteSet<I, O>} [set]
 * @returns {Parser<Ast<R, I, O>, I>}
 */
export const byteParser = (rule, set = []) => {
    const [, , names] = toData(rule)
    for (const key of names.keys()) {
        check(key)
    }
    return parser(rule, set)
}
