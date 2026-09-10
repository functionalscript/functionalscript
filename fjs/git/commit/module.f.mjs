/**
 * A commit: the header block with `tree`, then `parent` zero or more
 * times, then `author` and `committer`, read by position as Git reads
 * them; `encoding`, `gpgsig` and `mergetag` by key, wherever they sit;
 * then the message.
 *
 * The header block's grammar is the first pass and this module the second:
 * {@link tryRead} and {@link write} are the block's, since a commit adds
 * no syntax to it, and the well-known fields are functions over the header
 * list, total on a commit {@link validate} has accepted and a panic on one
 * it has not. A `mergetag` value is a whole tag object, and
 * {@link mergetags} hands it to the tag reader — one more pass over the
 * same alphabet, as the design says. A commit with a bad `tree` id or no
 * `committer` is read and written byte for byte; `validate` is where it is
 * refused, as `git fsck` refuses it.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Ident } from '../ident/types.ts'
 * @import { Tag } from '../tag/types.ts'
 * @import { Bytes, Oid, OidBytes } from '../types.ts'
 * @import { Commit } from './types.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.mjs'
import { length as bitLength } from '../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { tryRead as readPayload, valueAt, valuesOf, write as writePayload } from '../header/module.f.mjs'
import { tryRead as readIdent } from '../ident/module.f.mjs'
import { tryFromHex } from '../oid/module.f.mjs'
import { tryRead as readTag, validate as validateTag } from '../tag/module.f.mjs'

/**
 * Reads a commit, or refuses it: the header block's reader, since a
 * commit is the block and nothing more. What the headers hold is not
 * looked at; see {@link validate}.
 *
 * @type {(input: Bytes) => Nullable<Commit>}
 */
export const tryRead = readPayload

/**
 * A commit's bytes, every header as read: the header block's writer.
 *
 * @type {(c: Commit) => Bytes}
 */
export const write = writePayload

/**
 * The values of the `parent` headers: from the second header on, as many
 * as are `parent` in a row.
 *
 * @type {(c: Commit) => readonly Bytes[]}
 */
const parentValues = c => {
    /** @type {(i: number) => readonly Bytes[]} */
    const from = i => {
        const v = valueAt(c, i, 'parent')
        return v === null ? [] : [v, ...from(i + 1)]
    }
    return from(1)
}

/**
 * The id the `tree` header names: the first header, a hex id.
 *
 * @throws On a commit {@link validate} refuses: no `tree` header first,
 * or one that is not a hex id.
 *
 * @type {(c: Commit) => Oid}
 */
export const tree = c => {
    const value = valueAt(c, 0, 'tree')
    assertNotNullish(value, 'no tree')
    const id = tryFromHex(value)
    assert(id !== null, ['not a tree id', value])
    return id
}

/**
 * The ids the `parent` headers name, in order: none for a root commit,
 * two or more for a merge.
 *
 * @throws On a commit {@link validate} refuses: a `parent` header that is
 * not a hex id.
 *
 * @type {(c: Commit) => readonly Oid[]}
 */
export const parents = c => parentValues(c).map(value => {
    const id = tryFromHex(value)
    assert(id !== null, ['not a parent id', value])
    return id
})

/**
 * The ident the header at `i` holds, where its key is `key`.
 *
 * @throws Where the header is not there, or holds what is not an ident.
 *
 * @type {(c: Commit, i: number, key: string) => Ident}
 */
const identAt = (c, i, key) => {
    const value = valueAt(c, i, key)
    assertNotNullish(value, `no ${key}`)
    const ident = readIdent(value)
    assert(ident !== null, [`not an ${key}`, value])
    return ident
}

/**
 * Who wrote the change and when: the `author` header, after the parents.
 *
 * @throws On a commit {@link validate} refuses: no `author` header after
 * the parents, or one that is not an ident.
 *
 * @type {(c: Commit) => Ident}
 */
export const author = c => identAt(c, 1 + parentValues(c).length, 'author')

/**
 * Who made the commit and when: the `committer` header, after `author`.
 *
 * @throws On a commit {@link validate} refuses: no `committer` header
 * after `author`, or one that is not an ident.
 *
 * @type {(c: Commit) => Ident}
 */
export const committer = c => identAt(c, 2 + parentValues(c).length, 'committer')

/**
 * The value of the first header of a key, or `null` where there is none.
 *
 * @type {(c: Commit, key: string) => Nullable<Bytes>}
 */
const first = (c, key) => valuesOf(c, key)[0] ?? null

/**
 * The encoding the `encoding` header names, as bytes, or `null` where
 * there is none — the message is UTF-8 then, by convention.
 *
 * @type {(c: Commit) => Nullable<Bytes>}
 */
export const encoding = c => first(c, 'encoding')

/**
 * The signature the `gpgsig` header holds, its armor as bytes with the
 * continuation lines joined by LF, or `null` where the commit is not
 * signed.
 *
 * @type {(c: Commit) => Nullable<Bytes>}
 */
export const gpgsig = c => first(c, 'gpgsig')

/**
 * The tags the `mergetag` headers carry, one per signed tag the commit
 * merged, each a whole tag object read out of the header's value.
 *
 * @throws On a commit {@link validate} refuses: a `mergetag` value that
 * is not a tag.
 *
 * @type {(c: Commit) => readonly Tag[]}
 */
export const mergetags = c => valuesOf(c, 'mergetag').map(value => {
    const tag = readTag(value)
    assert(tag !== null, ['not a mergetag', value])
    return tag
})

/**
 * Whether a header value is a hex id `oidBytes` wide.
 *
 * @type {(oidBytes: OidBytes) => (value: Bytes) => boolean}
 */
const isId = oidBytes => value => {
    const id = tryFromHex(value)
    return id !== null && bitLength(id) === BigInt(oidBytes) * 8n
}

/**
 * Vouches for a commit as `git fsck` does, or refuses it, saying why: no
 * `tree` header first or one that is not a hex id of the repository's
 * width, a `parent` header that is not one, no `author` header after the
 * parents or no `committer` after it, or either holding what is not an
 * ident. One check `fsck` does not make, since it never looks inside:
 * a `mergetag` value must be a tag this module's sibling vouches for, so
 * that {@link mergetags} is total. What `fsck` only notes passes: any
 * other header, a message holding NUL.
 *
 * Separate from {@link tryRead} on purpose: a reader reads what it can,
 * and only this says no.
 *
 * @type {(oidBytes: OidBytes) => (c: Commit) => Result<Commit, string>}
 */
export const validate = oidBytes => c => {
    const id = isId(oidBytes)
    const treeValue = valueAt(c, 0, 'tree')
    if (treeValue === null) { return error('no tree') }
    if (!id(treeValue)) { return error('not a tree id') }
    const ps = parentValues(c)
    if (!ps.every(id)) { return error('not a parent id') }
    const authorValue = valueAt(c, 1 + ps.length, 'author')
    if (authorValue === null) { return error('no author') }
    if (readIdent(authorValue) === null) { return error('not an author') }
    const committerValue = valueAt(c, 2 + ps.length, 'committer')
    if (committerValue === null) { return error('no committer') }
    if (readIdent(committerValue) === null) { return error('not a committer') }
    const tags = valuesOf(c, 'mergetag').map(readTag)
    return tags.every(t => t !== null && validateTag(oidBytes)(t)[0] === 'ok') ? ok(c) : error('not a mergetag')
}
