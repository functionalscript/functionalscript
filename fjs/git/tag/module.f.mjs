/**
 * A tag: the header block with `object`, `type`, `tag` and `tagger`, in
 * that order and read by position as Git reads them, then the message.
 * A signature, where there is one, is part of the message, from the line
 * that begins its armor to the end, so nothing here knows about it.
 *
 * The header block's grammar is the first pass and this module the second:
 * {@link tryRead} and {@link write} are the block's, since a tag adds no
 * syntax to it, and the well-known fields are functions over the header
 * list, total on a tag {@link validate} has accepted and a panic on one it
 * has not. A tag with an unknown `type`, or with no `tagger` as very old
 * tags have none, is read and written byte for byte; `validate` is where
 * it is refused, as `git fsck` refuses it.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Ident } from '../ident/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 * @import { Tag } from './types.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { length as bitLength } from '../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { tryRead as readPayload, valueAt, write as writePayload } from '../header/module.f.mjs'
import { tryRead as readIdent } from '../ident/module.f.mjs'
import { objectTypes } from '../object/module.f.mjs'
import { tryFromHex } from '../oid/module.f.mjs'

/**
 * Reads a tag, or refuses it: the header block's reader, since a tag is
 * the block and nothing more. What the headers hold is not looked at; see
 * {@link validate}.
 *
 * @type {(input: Bytes) => Nullable<Tag>}
 */
export const tryRead = readPayload

/**
 * A tag's bytes, every header as read: the header block's writer.
 *
 * @type {(t: Tag) => Bytes}
 */
export const write = writePayload

/**
 * The type the `type` header names, or `null` when it names none of the
 * four.
 *
 * @type {(value: Bytes) => Nullable<ObjectType>}
 */
const typeOf = value => {
    const text = codePointListToString(byteArray(value))
    return objectTypes.find(t => t === text) ?? null
}

/**
 * The id the `object` header names: the first header, a hex id.
 *
 * @throws On a tag {@link validate} refuses: no `object` header first, or
 * one that is not a hex id.
 *
 * @type {(t: Tag) => Oid}
 */
export const object = t => {
    const value = valueAt(t, 0, 'object')
    assertNotNullish(value, 'no object')
    const id = tryFromHex(value)
    assert(id !== null, ['not an id', value])
    return id
}

/**
 * The type the `type` header names: the second header, one of the four.
 *
 * @throws On a tag {@link validate} refuses: no `type` header second, or
 * one naming none of the four types.
 *
 * @type {(t: Tag) => ObjectType}
 */
export const type = t => {
    const value = valueAt(t, 1, 'type')
    assertNotNullish(value, 'no type')
    const type = typeOf(value)
    assert(type !== null, ['unknown type', value])
    return type
}

/**
 * The tag's name, the value of the `tag` header: the third header, bytes
 * as the format leaves them.
 *
 * @throws On a tag {@link validate} refuses: no `tag` header third.
 *
 * @type {(t: Tag) => Bytes}
 */
export const name = t => {
    const value = valueAt(t, 2, 'tag')
    assertNotNullish(value, 'no tag name')
    return value
}

/**
 * Who made the tag and when, or `null` where the tag has no `tagger`
 * header fourth, as very old tags have none.
 *
 * @throws On a tag {@link validate} refuses: a `tagger` header holding
 * what is not an ident.
 *
 * @type {(t: Tag) => Nullable<Ident>}
 */
export const tagger = t => {
    const value = valueAt(t, 3, 'tagger')
    if (value === null) { return null }
    const ident = readIdent(value)
    assert(ident !== null, ['not a tagger', value])
    return ident
}

/**
 * Vouches for a tag as `git fsck` does, or refuses it, saying why: no
 * `object` header first or one that is not a hex id of the repository's
 * width, no `type` header second or one naming none of the four types, no
 * `tag` header third, or a `tagger` header fourth that is not an ident.
 * A missing `tagger` and a header after it are what `fsck` only notes,
 * so both pass.
 *
 * Separate from {@link tryRead} on purpose: a reader reads what it can,
 * and only this says no.
 *
 * @type {(oidBytes: OidBytes) => (t: Tag) => Result<Tag, string>}
 */
export const validate = oidBytes => t => {
    const objectValue = valueAt(t, 0, 'object')
    if (objectValue === null) { return error('no object') }
    const id = tryFromHex(objectValue)
    if (id === null || bitLength(id) !== BigInt(oidBytes) * 8n) { return error('not an id') }
    const typeValue = valueAt(t, 1, 'type')
    if (typeValue === null) { return error('no type') }
    if (typeOf(typeValue) === null) { return error('unknown type') }
    if (valueAt(t, 2, 'tag') === null) { return error('no tag name') }
    const taggerValue = valueAt(t, 3, 'tagger')
    return taggerValue !== null && readIdent(taggerValue) === null ? error('not a tagger') : ok(t)
}
