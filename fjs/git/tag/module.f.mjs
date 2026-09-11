/**
 * A tag: the header block with `object`, `type`, `tag` and `tagger`, in
 * that order and read by position as Git reads them, then the message.
 * A signature, where there is one, is part of the message, from the line
 * that begins its armor to the end, so nothing here knows about it.
 *
 * The header block's grammar is the first pass and this module the second:
 * {@link tryRead} and {@link write} are the block's, since a tag adds no
 * syntax to it, and the well-known fields are functions over the header
 * list, total on a tag {@link validate} has accepted. On one it has not,
 * an accessor panics only where the field it reads is missing or malformed
 * — `object` on a tag whose first header is no hex id, `tagger` on one
 * whose fourth is no ident — and reads what is there otherwise. A tag with an unknown
 * `type`, or with no `tagger` as very old tags have none, is read and
 * written byte for byte; `validate` is where it is refused, as Git refuses
 * it.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Ident } from '../ident/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 * @import { TagTarget } from './types.ts'
 * @import { Tag } from './types.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.mjs'
import { ascii, byteArray, byteLength } from '../../ebnf/byte/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { hasNulHeader, tryRead as readPayload, valueAt, write as writePayload } from '../header/module.f.mjs'
import { tryRead as readIdent } from '../ident/module.f.mjs'
import { objectTypes } from '../object/module.f.mjs'
import { tryFromHex, tryFromHexOf } from '../oid/module.f.mjs'

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

const dot = /** @type {const} */ (0x2E)

const slash = /** @type {const} */ (0x2F)

const at = /** @type {const} */ (0x40)

const brace = /** @type {const} */ (0x7B)

const del = /** @type {const} */ (0x7F)

/** The bytes a ref name may not hold, besides the control characters. */
const forbidden = ascii(' ~^:?*[\\')

const lock = ascii('.lock')

/**
 * Whether two bytes sit next to each other in a name, in that order.
 *
 * @type {(name: readonly number[], a: number, b: number) => boolean}
 */
const holdsPair = (name, a, b) => name.some((x, i) => i !== 0 && name[i - 1] === a && x === b)

/**
 * Whether a component of a ref name, between slashes, is one: not empty,
 * not beginning with `.`, not ending in `.lock`.
 *
 * @type {(component: readonly number[]) => boolean}
 */
const isComponent = component =>
    component.length !== 0
    && component[0] !== dot
    && !(component.length >= lock.length && lock.every((b, i) => component[component.length - lock.length + i] === b))

/**
 * The components of a name, between its slashes: the bytes before the
 * first, between each two, and after the last, so a name with none is one
 * component and `a//b` has an empty one. Sliced once each, not grown byte
 * by byte, since a name is as long as its author made it.
 *
 * @type {(name: readonly number[]) => readonly (readonly number[])[]}
 */
const components = name => {
    const slashes = name.flatMap((b, i) => b === slash ? [i] : [])
    /** @type {readonly number[]} */
    const starts = [0, ...slashes.map(i => i + 1)]
    /** @type {readonly number[]} */
    const ends = [...slashes, name.length]
    return starts.map((start, i) => name.slice(start, ends[i]))
}

/**
 * Whether a name is one `refs/tags/` takes, by the rules of
 * `git check-ref-format` over `refs/tags/<name>`: no control character,
 * no space and none of
 * `~ ^ : ? * [ \`, no `..` and no `@{`, not ending in `.`,
 * and every component between slashes one {@link isComponent} takes. A
 * name that is `@` alone passes, since the ref it names is `refs/tags/@`
 * and not `@`. `git fsck` only warns of a tag named otherwise, as
 * `badTagName`, and exits clean; `git mktag`, strict by default, refuses to
 * write it. This module refuses it too, since a name no ref takes names
 * nothing.
 *
 * @type {(name: readonly number[]) => boolean}
 */
const isTagName = name =>
    name.every(b => b >= 0x20 && b !== del && !forbidden.includes(b))
    && !holdsPair(name, dot, dot)
    && !holdsPair(name, at, brace)
    && name[name.length - 1] !== dot
    && components(name).every(isComponent)

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
 * The id the `object` header names, at the repository's width, or `null`
 * where there is no `object` header first or it is not a hex id of that
 * width: {@link object} without the panic, and with the width checked.
 * For a caller holding a tag it has not vouched for — peeling a tag to
 * what it names reads this id and nothing else.
 *
 * @type {(oidBytes: OidBytes) => (t: Tag) => Nullable<Oid>}
 */
export const tryObject = oidBytes => {
    const id = tryFromHexOf(oidBytes)
    return t => {
        const value = valueAt(t, 0, 'object')
        return value === null ? null : id(value)
    }
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
 * The type the `type` header names, or `null` where there is no `type`
 * header second or it names none of the four: {@link type} without the
 * panic. For a caller holding a tag it has not vouched for — peeling a
 * tag checks the object it reaches against this, since a tag that names
 * its target's type wrongly is one Git refuses to peel.
 *
 * @type {(t: Tag) => Nullable<ObjectType>}
 */
export const tryType = t => {
    const value = valueAt(t, 1, 'type')
    return value === null ? null : typeOf(value)
}

/**
 * What a tag names and what it says that object is, or `null` where Git
 * would not parse the bytes as a tag: the `object` header first naming an
 * id of the width, the `type` header second naming one of the four, and
 * the `tag` header third, whatever name it holds.
 *
 * It is one step because Git's own parse is one, and those three headers
 * are the whole of what it reads — a tag with no `tagger` parses, where one
 * missing its `tag` header, or holding `type` after it, does not, and
 * `git cat-file -t <tag>^{}` refuses to resolve such a tag at all.
 *
 * @type {(oidBytes: OidBytes) => (t: Tag) => Nullable<TagTarget>}
 */
export const tryTarget = oidBytes => {
    const objectOf = tryObject(oidBytes)
    return t => {
        const id = objectOf(t)
        const type = tryType(t)
        return id === null || type === null || valueAt(t, 2, 'tag') === null ? null : { id, type }
    }
}

/**
 * The same of a tag's bytes rather than a tag: what the payload names and
 * what it says that object is, or `null` where Git would not parse the
 * bytes as a tag at all.
 *
 * A payload shorter than the hexadecimal id plus 24 is refused before a
 * header is read, as Git's parse refuses one: that is what `object <id>`,
 * `type <t>` and `tag ` cost at their shortest, so nothing under it could
 * have held the three headers.
 *
 * One thing refuses here that Git reads: bytes after the third header that
 * are no header at all. Git's parse stops after `tag` and never looks at
 * them, where this reads the whole payload before taking anything by
 * position, so a line with no `SP` in it makes the payload unreadable.
 * That is an over-refusal and it is recorded rather than fixed here —
 * [`todo/positional-headers.md`](../todo/positional-headers.md) has the
 * shapes and what a stopping rule would cost.
 *
 * @type {(oidBytes: OidBytes) => (payload: Bytes) => Nullable<TagTarget>}
 */
export const tryTargetAt = oidBytes => {
    const targetOf = tryTarget(oidBytes)
    const least = oidBytes * 2 + 24
    return payload => {
        const size = byteLength(payload)
        if (size === null || size < least) { return null }
        const t = tryRead(payload)
        return t === null ? null : targetOf(t)
    }
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
 * Vouches for a tag, or refuses it, saying why: a NUL in any header, no
 * `object` header first or one that is not a hex id of the repository's
 * width, no `type` header second or one naming none of the four types, no
 * `tag` header third or one that is not a name `refs/tags/` takes, or a
 * `tagger` header fourth that is not an ident. All but the name are what
 * `git fsck` reports as an error; the name is one it only warns of, as
 * `badTagName`, and `git mktag` refuses to write, and this refuses it as
 * `mktag` does. What `fsck` only notes and Git writes passes: a missing
 * `tagger`, a header after it.
 *
 * Separate from {@link tryRead} on purpose: a reader reads what it can,
 * and only this says no.
 *
 * @type {(oidBytes: OidBytes) => (t: Tag) => Result<Tag, string>}
 */
export const validate = oidBytes => {
    const id = tryFromHexOf(oidBytes)
    return t => {
        if (hasNulHeader(t)) { return error('NUL in header') }
        const objectValue = valueAt(t, 0, 'object')
        if (objectValue === null) { return error('no object') }
        if (id(objectValue) === null) { return error('not an id') }
        const typeValue = valueAt(t, 1, 'type')
        if (typeValue === null) { return error('no type') }
        if (typeOf(typeValue) === null) { return error('unknown type') }
        const nameValue = valueAt(t, 2, 'tag')
        if (nameValue === null) { return error('no tag name') }
        if (!isTagName(byteArray(nameValue))) { return error('bad tag name') }
        const taggerValue = valueAt(t, 3, 'tagger')
        return taggerValue !== null && readIdent(taggerValue) === null ? error('not a tagger') : ok(t)
    }
}
