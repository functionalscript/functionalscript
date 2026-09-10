/**
 * An object id between its two spellings: the raw bytes a tree entry holds
 * and the hex text a header holds. Neither knows the repository's id width;
 * a hex of any even length reads to the id it spells, and the width is a
 * check `validate` makes on the object, against the width it is given.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, Oid, OidBytes } from '../types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { hexDigitCodePoint, hexDigitValue } from '../../text/ascii/module.f.mjs'
import { length, msb, tryU8ListToVec, u8List } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'

const toVec = tryU8ListToVec(msb)

const toBytes = u8List(msb)

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
    const values = digits.flatMap(b => {
        const v = hexDigitValue(b)
        return v === null ? [] : [v]
    })
    if (values.length !== digits.length || values.length === 0 || values.length % 2 !== 0) { return null }
    return toVec(values.filter((_, i) => i % 2 === 0).map((h, i) => h * 16 + values[2 * i + 1]))
}

/**
 * {@link tryFromHex} at the repository's width: an id of any other width
 * is refused too, which is the check every header that names an object
 * makes, in a commit's `validate` and a tag's alike.
 *
 * @throws If an item of the hex is not a byte.
 *
 * @type {(oidBytes: OidBytes) => (hex: Bytes) => Nullable<Oid>}
 */
export const tryFromHexOf = oidBytes => hex => {
    const id = tryFromHex(hex)
    return id !== null && length(id) === BigInt(oidBytes) * 8n ? id : null
}

/**
 * An id's hex spelling, two small-letter digits a byte: the inverse of
 * {@link tryFromHex}, and what Git writes.
 *
 * @throws On a `Vec` that is not whole bytes: `Oid` is the type's name for
 * one that is, and a caller can build any `Vec`, so the spelling refuses
 * rather than pad the last byte and spell an id that reads back wider.
 *
 * @type {(oid: Oid) => Bytes}
 */
export const toHex = oid => {
    assert(length(oid) % 8n === 0n, ['not whole bytes', oid])
    return toArray(toBytes(oid)).flatMap(b => [hexDigitCodePoint(b >> 4), hexDigitCodePoint(b & 15)])
}
