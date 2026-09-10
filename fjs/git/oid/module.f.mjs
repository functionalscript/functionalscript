/**
 * An object id between its two spellings: the raw bytes a tree entry holds
 * and the hex text a header holds. Neither knows the repository's id width;
 * a hex of any even length reads to the id it spells, and the width is a
 * check `validate` makes on the object, against the width it is given.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, Oid } from '../types.ts'
 */

import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { hexDigitCodePoint, hexDigitValue } from '../../text/ascii/module.f.mjs'
import { msb, tryU8ListToVec, u8List } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'

const toVec = tryU8ListToVec(msb)

const toBytes = u8List(msb)

/** @type {(v: Nullable<number>) => v is number} */
const isValue = v => v !== null

/**
 * Reads an id from its hex spelling, or refuses it: a byte that is no hex
 * digit, an odd count of them, none, or more than a `Vec` holds. Either
 * case of letter is read, as Git reads it, though Git writes the small
 * one; {@link toHex} writes it.
 *
 * @throws If an item of the hex is not a byte.
 *
 * @type {(hex: Bytes) => Nullable<Oid>}
 */
export const tryFromHex = hex => {
    const digits = byteArray(hex)
    const values = digits.map(hexDigitValue).filter(isValue)
    if (values.length !== digits.length || values.length === 0 || values.length % 2 !== 0) { return null }
    return toVec(values.filter((_, i) => i % 2 === 0).map((h, i) => h * 16 + values[2 * i + 1]))
}

/**
 * An id's hex spelling, two small-letter digits a byte: the inverse of
 * {@link tryFromHex}, and what Git writes.
 *
 * @type {(oid: Oid) => Bytes}
 */
export const toHex = oid => toArray(toBytes(oid)).flatMap(b => [hexDigitCodePoint(b >> 4), hexDigitCodePoint(b & 15)])
