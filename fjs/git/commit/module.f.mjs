/**
 * A commit: the header block with `tree`, then `parent` zero or more
 * times, then `author` and `committer`, read by position as Git reads
 * them; `encoding`, `gpgsig` and `mergetag` by key, wherever they sit;
 * then the message.
 *
 * The header block's grammar is the first pass and this module the second:
 * {@link tryRead} and {@link write} are the block's, since a commit adds
 * no syntax to it, and the well-known fields are functions over the header
 * list, total on a commit {@link validate} has accepted. On one it has
 * not, an accessor panics only where the field it reads is missing or
 * malformed — `tree` on a commit whose first header is no hex id,
 * `committer` on one with none — and reads what is there otherwise. A
 * `mergetag` value is a whole tag object less its last LF, which the
 * header's framing took, and {@link mergetags} gives the LF back and hands
 * the tag to the tag reader — one more pass over the same alphabet, as
 * the design says; a tag that never ended in LF is the one the fold
 * cannot keep. A commit with a bad `tree` id or no
 * `committer` is read and written byte for byte; `validate` is where it is
 * refused, as Git refuses it.
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
import { byteLength } from '../../ebnf/byte/module.f.mjs'
import { concat, includes } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { hasNulHeader, keyIs, tryRead as readPayload, valueAt, valuesOf, write as writePayload } from '../header/module.f.mjs'
import { tryRead as readIdent } from '../ident/module.f.mjs'
import { tryFromHex, tryFromHexOf } from '../oid/module.f.mjs'
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
 * as are `parent` in a row. A scan and a slice, not a recursion: Git puts
 * no bound on the parents, and a merge of thousands is a commit `fsck`
 * accepts.
 *
 * @type {(c: Commit) => readonly Bytes[]}
 */
const parentValues = c => {
    const rest = c.headers.slice(1)
    const end = rest.findIndex(h => !keyIs(h, 'parent'))
    return (end === -1 ? rest : rest.slice(0, end)).map(([, v]) => v)
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
 * The id the `tree` header names, at the repository's width, or `null`
 * where there is no `tree` header first or it is not a hex id of that
 * width: {@link tree} without the panic, and with the width checked. For
 * a caller holding a commit it has not vouched for — a walk over a
 * repository reads the tree id and nothing else, and the rest of
 * {@link validate}'s checks are not its business.
 *
 * @type {(oidBytes: OidBytes) => (c: Commit) => Nullable<Oid>}
 */
export const tryTree = oidBytes => {
    const id = tryFromHexOf(oidBytes)
    return c => {
        const value = valueAt(c, 0, 'tree')
        return value === null ? null : id(value)
    }
}

/**
 * The tree of bytes stored as a commit, at the repository's width, or
 * `null` where Git would not parse them as a commit: the bytes are no
 * header block, the `tree` header is missing or names no id of the width,
 * or a `parent` header names none.
 *
 * It is one step because Git's own parse is one, and this is the whole of
 * what that parse reads. `git cat-file -t <tag>^{}` over a tag naming such
 * a commit answers `error: bogus commit object` for a bad tree and `error:
 * bad parents in commit` for a bad parent, rather than the type. It reads
 * no further: a commit with no `author` or no `committer` parses, and
 * {@link validate} is where `fsck`'s rules are.
 *
 * A payload of `hexsz + 6` bytes or fewer is refused before a header is
 * read, as Git's parse refuses one: that is the `tree` line and the empty
 * line after the block at their shortest, so nothing under it could have
 * been a commit.
 *
 * A `parent` naming the same id as the `tree` is refused. Git's parse
 * looks each id up in one table and puts the tree in it first, so by the
 * time the same id arrives as a parent the table already answers `tree`
 * and the lookup fails. That is the one way a parent's *kind* decides
 * anything: a parent naming a blob, or naming nothing at all, is a commit
 * Git peels, since it never reads those.
 *
 * A payload that ends at its last `parent` line's LF is refused too, and
 * for the same reason one byte further along: Git's parent walk wants a
 * byte after the line it is reading, so it calls such a payload `bad
 * parents in commit` however good the id on that line is. One byte more —
 * the empty line — and the same payload is a commit it reads. The rule
 * reaches only the parents Git walked: a header after them ends the walk,
 * and then the payload may end where it likes.
 *
 * Two things refuse here that Git reads, both of them a line Git's walk
 * stops at and never looks at: a line that is no header, and a
 * continuation line, which folds into the value above it and spoils an id
 * that Git never checked. Both are over-refusals and are recorded rather
 * than fixed here —
 * [`todo/positional-headers.md`](../todo/positional-headers.md) has the
 * shapes and what a stopping rule would cost.
 *
 * @type {(oidBytes: OidBytes) => (payload: Bytes) => Nullable<Oid>}
 */
export const tryTreeAt = oidBytes => {
    const treeOf = tryTree(oidBytes)
    const id = tryFromHexOf(oidBytes)
    const least = oidBytes * 2 + 7
    return payload => {
        const size = byteLength(payload)
        if (size === null || size < least) { return null }
        const c = tryRead(payload)
        if (c === null) { return null }
        const parents = parentValues(c)
        // The payload ends at the last `parent` line's LF where the walk
        // reached the last header and nothing followed it.
        if (c.message === null && parents.length === c.headers.length - 1) { return null }
        if (!parents.every(value => id(value) !== null)) { return null }
        const tree = treeOf(c)
        // A parent naming the tree this commit names is refused, since the
        // same parse has just registered that id as a tree.
        return tree === null || parents.some(value => id(value) === tree) ? null : tree
    }
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

const lf = /** @type {const} */ (0x0A)

/**
 * A `mergetag` value as the tag's bytes: the value with the LF the
 * header's framing took, which is the tag object whole for every tag a
 * tool of Git's writes. A tag whose own bytes never ended in LF comes
 * back with one, and so with an id not its own; the README says why that
 * is the fold's loss and not this reader's.
 *
 * @type {(value: Bytes) => Bytes}
 */
const tagOf = value => concat(value)([lf])

/**
 * The tags the `mergetag` headers carry, one per signed tag the commit
 * merged, each a whole tag object read out of the header's value: the
 * tag's bytes, byte for byte, with the LF the framing took given back.
 *
 * @throws On a commit {@link validate} refuses: a `mergetag` value that
 * is not a tag.
 *
 * @type {(c: Commit) => readonly Tag[]}
 */
export const mergetags = c => valuesOf(c, 'mergetag').map(value => {
    const tag = readTag(tagOf(value))
    assert(tag !== null, ['not a mergetag', value])
    return tag
})

/**
 * Vouches for a commit as `git fsck` does, or refuses it, saying why: a
 * NUL in any header, no `tree` header first or one that is not a hex id
 * of the repository's width, a `parent` header that is not one, no
 * `author` header after the parents or no `committer` after it, or either
 * holding what is not an ident, or a NUL in the message. All but the last
 * are what `git fsck` reports as an error; a NUL in the message is one it
 * only warns of, as `nulInCommit`, and this refuses it, since no tool of
 * Git's writes one and a message is read as text. One check `fsck` does
 * not make, since it never looks inside: a `mergetag` value must be a tag
 * this module's sibling vouches for, so that {@link mergetags} is total.
 * What `fsck` only notes and Git writes passes: any other header.
 *
 * Separate from {@link tryRead} on purpose: a reader reads what it can,
 * and only this says no.
 *
 * @type {(oidBytes: OidBytes) => (c: Commit) => Result<Commit, string>}
 */
export const validate = oidBytes => {
    const id = tryFromHexOf(oidBytes)
    const tagOk = validateTag(oidBytes)
    return c => {
        if (hasNulHeader(c)) { return error('NUL in header') }
        const treeValue = valueAt(c, 0, 'tree')
        if (treeValue === null) { return error('no tree') }
        if (id(treeValue) === null) { return error('not a tree id') }
        const ps = parentValues(c)
        if (!ps.every(v => id(v) !== null)) { return error('not a parent id') }
        const authorValue = valueAt(c, 1 + ps.length, 'author')
        if (authorValue === null) { return error('no author') }
        if (readIdent(authorValue) === null) { return error('not an author') }
        const committerValue = valueAt(c, 2 + ps.length, 'committer')
        if (committerValue === null) { return error('no committer') }
        if (readIdent(committerValue) === null) { return error('not a committer') }
        const tags = valuesOf(c, 'mergetag').map(value => readTag(tagOf(value)))
        if (!tags.every(t => t !== null && tagOk(t)[0] === 'ok')) { return error('not a mergetag') }
        return includes(0)(c.message) ? error('NUL in message') : ok(c)
    }
}
