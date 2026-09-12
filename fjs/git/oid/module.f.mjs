/**
 * An object id between its two spellings, and from the object it names.
 * The spellings are the raw bytes a tree entry holds and the hex text a
 * header holds; neither knows the repository's id width, since a hex of
 * any even length reads to the id it spells, and the width is a check
 * `validate` makes on the object, against the width it is given. The id
 * itself is {@link of}: the hash of the object's bytes at the width the
 * repository uses, SHA-1 or SHA-256, which is the one place this module
 * knows the width means a hash.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { sha1 } from '../../crypto/sha1/module.f.mjs'
import { computeSync, sha256 } from '../../crypto/sha2/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { hexDigitCodePoint, hexDigitValue } from '../../text/ascii/module.f.mjs'
import { length, msb, tryU8ListToVec, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { next, toArray } from '../../types/list/module.f.mjs'
import { write } from '../object/module.f.mjs'

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

const chunkVec = u8ListToVec(msb)

/**
 * How many bytes of an object go into one `Vec` on the way to the hash:
 * an object is as long as its author made it and a `Vec` holds 128 KiB,
 * so the bytes are fed to the hash a piece at a time, each well under the
 * bound and long enough that the pieces are few.
 */
const chunkBytes = /** @type {const} */ (65536)

/**
 * An object's bytes as the `Vec`s the hash takes, {@link chunkBytes} at a
 * time and the last one shorter, made as the hash asks for them: one chunk
 * is held at a time and never the object as an array, so an object longer
 * than an array would hold is hashed all the same.
 *
 * The tail the gathering reached is what the next chunk starts from, not
 * the list with a count dropped from its front: a dropped list walks the
 * bytes it drops, and a chunk over a list dropped over a list would walk
 * every byte before it, once per chunk, which is quadratic in the object.
 * Every byte is walked once here.
 *
 * @type {(bytes: Bytes) => List<Vec>}
 */
const chunks = bytes => () => {
    let rest = bytes
    let taken = 0
    const gathered = Array.from({ length: chunkBytes }, () => {
        const r = next(rest)
        if (r === null) { return 0 }
        rest = r.tail
        taken += 1
        return r.first
    })
    return taken === 0
        ? null
        : { first: chunkVec(taken === chunkBytes ? gathered : gathered.slice(0, taken)), tail: chunks(rest) }
}

/**
 * The id Git gives an object, at the repository's width: the hash of
 * `<type> SP <size> NUL <payload>`, as [`fjs/git/object`](../object/module.f.mjs)'s
 * `write` lays it out — SHA-1 at 20 bytes, the width of every repository
 * in use today, and SHA-256 at 32. The width is bound once, so a store
 * that hashes every object it reads chooses the hash once.
 *
 * What the id vouches for is the hash's business: in a SHA-1 repository
 * it is only as strong as SHA-1, and what a trust layer does about that
 * is [`todo/git-sha1-collisions.md`](../../../todo/git-sha1-collisions.md).
 *
 * @throws If an item of the payload is not a byte, as `write` throws.
 *
 * @type {(oidBytes: OidBytes) => (type: ObjectType, payload: Bytes) => Oid}
 */
export const of = oidBytes => {
    const hash = digestOf(oidBytes)
    return (type, payload) => hash(write(type, payload))
}

/**
 * The hash a repository of this width uses, over plain bytes and with no object
 * framing: SHA-1 at 20 bytes and SHA-256 at 32.
 *
 * {@link of} is this applied to an object's `<type> SP <size> NUL <payload>`,
 * and it is built on this rather than beside it so that the choice of hash is
 * made in one place.
 *
 * Not every hash Git writes is over an object. A pack and a pack index each end
 * in a checksum over their own preceding bytes, with no framing at all, and a
 * reader that checks one needs the repository's hash without the object rule.
 *
 * @throws If an item of the bytes is not a byte.
 *
 * @type {(oidBytes: OidBytes) => (bytes: Bytes) => Oid}
 */
export const digestOf = oidBytes => {
    const hash = oidBytes === 20 ? computeSync(sha1) : computeSync(sha256)
    return bytes => hash(chunks(bytes))
}

/**
 * An id's hex spelling, two small-letter digits a byte: the inverse of
 * {@link tryFromHex}, and what Git writes.
 *
 * @throws On a `Vec` that is not whole bytes, or is empty: `Oid` is the
 * type's name for one that is neither, and a caller can build any `Vec`,
 * so the spelling refuses rather than pad the last byte and spell an id
 * that reads back wider, or spell nothing, which {@link tryFromHex} does
 * not read.
 *
 * @type {(oid: Oid) => Bytes}
 */
export const toHex = oid => {
    const bits = length(oid)
    assert(bits !== 0n && bits % 8n === 0n, ['not whole bytes', oid])
    return toArray(toBytes(oid)).flatMap(b => [hexDigitCodePoint(b >> 4), hexDigitCodePoint(b & 15)])
}
