/**
 * The loose object envelope: `<type> SP <size> NUL`, ahead of the payload.
 *
 * A grammar reads the envelope and stops at the NUL, so no payload ever
 * reaches a parser — a blob's least of all — and the reader slices what
 * follows the NUL as the payload. The size is a claim about that payload,
 * and the reader holds it to the claim: an object whose payload is not as
 * long as its envelope says is refused, as Git refuses it.
 *
 * The object id is the hash of the whole — envelope and payload — which
 * is why {@link write} exists beside {@link tryRead}: what is hashed or
 * stored is the envelope's bytes ahead of the payload's.
 *
 * @module
 *
 * @import { Meta } from '../../ebnf/ast/types.ts'
 * @import { Byte } from '../../ebnf/byte/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, ObjectType } from '../types.ts'
 * @import { Envelope } from './types.ts'
 */

import { byteParser, not, symbols } from '../../ebnf/byte/module.f.mjs'
import { range, repeatFrom1, set } from '../../ebnf/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { concat, drop, length, take, toArray } from '../../types/list/module.f.mjs'

const { isSafeInteger } = Number

/** The four types, as the envelope spells them. */
export const objectTypes = /** @type {const} */ (['blob', 'tree', 'commit', 'tag'])

/**
 * The type as one word up to the space, and not a variant of the four:
 * `tree` and `tag` share a first byte, so the variant is not LL(1).
 * `literals` in `../../ebnf` would read the four as a prefix tree, at the
 * cost of a node nested down the word's branches; the word is read the way
 * the header block reads a key instead, so its node is flat, and the reader
 * chooses among the four after the parse.
 */
const word = repeatFrom1(not(set(' ')))

const size = repeatFrom1(range('09'))

/**
 * The envelope rule, up to and including the NUL and with no `eof`: a
 * match stops at the NUL and reports the index after it, which is where
 * the payload begins.
 */
export const envelope = /** @type {const} */ ([word, ' ', size, '\0'])

const parse = byteParser(envelope)

/**
 * How much of an object the parser is handed. `commit`, SP, sixteen
 * digits — `2 ** 53` has sixteen — and NUL are 24 bytes; an envelope the
 * prefix does not hold is refused, since no object it could describe
 * exists.
 */
const prefixLength = 32

/** @type {(leaves: readonly Meta<Byte>[]) => readonly number[]} */
const symbolsOf = leaves => leaves.map(({ symbol }) => symbol)

/** @type {(s: string) => readonly number[]} */
const ascii = s => toArray(stringToCodePointList(s))

/**
 * The type a word names, or `null`: the four are ASCII, so the word is
 * compared as the text it spells.
 *
 * @type {(w: readonly number[]) => Nullable<ObjectType>}
 */
const typeOf = w => {
    const s = codePointListToString(w)
    return objectTypes.find(t => t === s) ?? null
}

/** @type {(digits: readonly number[]) => number} */
const decimal = digits => digits.reduce((n, d) => n * 10 + d - 0x30, 0)

/**
 * Reads an object past its envelope, or refuses it: an envelope the prefix
 * does not hold, a type that is not one of the four, a size that is not a
 * safe integer, or a payload that is not as long as the size claims. The
 * payload is the input after the NUL, sliced and not read.
 *
 * @type {(input: Bytes) => Nullable<Envelope>}
 */
export const tryRead = input => {
    const r = parse(symbols(take(prefixLength)(input)))
    if (r[0] === 'error') { return null }
    const [[w, , digits], end] = r[1]
    const type = typeOf(symbolsOf(w))
    const size = decimal(symbolsOf(digits))
    const payload = drop(end)(input)
    return type !== null && isSafeInteger(size) && length(payload) === size
        ? { type, payload }
        : null
}

/**
 * An object's bytes: the envelope, then the payload. What Git hashes for
 * the object's id, and what it stores inflated.
 *
 * @type {(type: ObjectType, payload: Bytes) => Bytes}
 */
export const write = (type, payload) =>
    concat(ascii(`${type} ${length(payload)}\0`))(payload)
