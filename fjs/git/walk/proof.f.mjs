/**
 * @import { Inflate, ReadFile } from '../../effects/node/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { TreeEntry } from '../tree/types.ts'
 * @import { Bytes, ObjectType, Oid } from '../types.ts'
 * @import { Read } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ioError, pureOk } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { msb, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { write as writeEnvelope } from '../object/module.f.mjs'
import { of, toHex } from '../oid/module.f.mjs'
import { objectPath, tryRead as readStore } from '../store/module.f.mjs'
import { latin1 } from '../testlib.f.mjs'
import { mode, write as writeTree } from '../tree/module.f.mjs'
import { peel, tryEntries, tryEntry } from './module.f.mjs'

const dir = /** @type {const} */ ('repo')

const of20 = of(20)

const at = objectPath(dir)

const toVec = u8ListToVec(msb)

/** @type {(id: Oid) => string} */
const hex = id => codePointListToString(toHex(id))

/** @type {(mode: string, name: string, oid: Oid) => TreeEntry} */
const entry = (m, name, oid) => ({ mode: latin1(m), name: latin1(name), oid })

/** @type {(entries: readonly TreeEntry[]) => readonly number[]} */
const tree = entries => toArray(writeTree(20)(entries))

/** @type {(who: string) => (headers: readonly string[]) => readonly number[]} */
const payload = who => headers => latin1([...headers, `author ${who}`, `committer ${who}`, '', 'm', ''].join('\n'))

const commitOf = payload('A <a@b> 1 +0000')

/** @type {(target: Oid, type: ObjectType, name: string) => readonly number[]} */
const tagOf = (target, type, name) =>
    latin1([`object ${hex(target)}`, `type ${type}`, `tag ${name}`, 'tagger A <a@b> 1 +0000', '', 'm', ''].join('\n'))

// The objects of a repository the proof builds, each stored under the id
// `of` gives it, as Git stores one.

const hello = latin1('hello\n')

const helloId = of20('blob', hello)

const b = latin1('b\n')

const bId = of20('blob', b)

const sub = tree([entry('100644', 'b.txt', bId)])

const subId = of20('tree', sub)

/** A commit in another repository, as a `160000` entry names one. */
const elsewhereId = of20('commit', commitOf([`tree ${hex(subId)}`]))

/**
 * An id whose file holds bytes that are no object at all: no envelope, so
 * the store answers `null` before it hashes anything, and the walk stops
 * wherever it meets one.
 */
const oddId = of20('blob', latin1('odd'))

const root = tree([
    entry('100644', 'a.txt', helloId),
    entry('40000', 'dir', subId),
    entry('120000', 'link', bId),
    entry('160000', 'mod', elsewhereId),
    entry('40000', 'odd', oddId),
])

const rootId = of20('tree', root)

const commit = commitOf([`tree ${hex(rootId)}`])

const commitId = of20('commit', commit)

/** A commit whose `tree` header is no id: the walk stops, not panics. */
const badTree = commitOf(['tree zz'])

const badTreeId = of20('commit', badTree)

/** Bytes stored as a commit that are no commit, and the same for a tag. */
const junk = latin1('junk')

const junkCommitId = of20('commit', junk)

const junkTagId = of20('tag', junk)

/** A tag naming an object the repository does not hold. */
const danglingTag = tagOf(helloId, 'blob', 'dangling')

const danglingTagId = of20('tag', danglingTag)

/** An id nothing is stored under. */
const nowhereId = of20('blob', latin1('nowhere'))

/** A tag naming the id nothing is stored under. */
const lostTag = tagOf(nowhereId, 'blob', 'lost')

const lostTagId = of20('tag', lostTag)

/** A commit whose `tree` names the id nothing is stored under. */
const lostTree = commitOf([`tree ${hex(nowhereId)}`])

const lostTreeId = of20('commit', lostTree)

/** A commit whose `tree` names the file that is no object. */
const oddTree = commitOf([`tree ${hex(oddId)}`])

const oddTreeId = of20('commit', oddTree)

/** A commit whose `tree` names a blob. */
const blobTree = commitOf([`tree ${hex(helloId)}`])

const blobTreeId = of20('commit', blobTree)

/** A tag whose `object` header is no id. */
const badObject = latin1(['object zz', 'type commit', 'tag bad', '', 'm', ''].join('\n'))

const badObjectId = of20('tag', badObject)

/** A tag whose `type` header names none of the four. */
const badType = latin1([`object ${hex(commitId)}`, 'type thing', 'tag bad', '', 'm', ''].join('\n'))

const badTypeId = of20('tag', badType)

/** A tag declaring `commit` over an object that is a blob. */
const wrongType = tagOf(helloId, 'commit', 'wrong')

const wrongTypeId = of20('tag', wrongType)

/** A tree naming `a.txt` twice, which `git fsck` refuses. */
const twice = tree([entry('100644', 'a.txt', helloId), entry('100644', 'a.txt', bId)])

const twiceId = of20('tree', twice)

/**
 * A tree whose `100644` entry names the subtree: the id holds a tree, and
 * the mode says the path stops there all the same.
 */
const lying = tree([entry('100644', 'dir', subId)])

const lyingId = of20('tree', lying)

/**
 * A chain of tags over the commit, each naming the one before it: the
 * first entry is the commit, so the entry at `n` is `n` tags above it.
 *
 * @type {readonly { readonly id: Oid, readonly type: ObjectType, readonly payload: readonly number[] }[]}
 */
const chain = Array.from({ length: 9 }).reduce(
    /** @type {(acc: readonly { readonly id: Oid, readonly type: ObjectType, readonly payload: readonly number[] }[]) => readonly { readonly id: Oid, readonly type: ObjectType, readonly payload: readonly number[] }[]} */
    acc => {
        const last = acc[acc.length - 1]
        const p = tagOf(last.id, last.type, 'chain')
        return [...acc, { id: of20('tag', p), type: 'tag', payload: p }]
    },
    [{ id: commitId, type: 'commit', payload: commit }],
)

/** @type {(type: ObjectType) => (id: Oid, payload: readonly number[]) => readonly [string, readonly number[]]} */
const file = type => (id, p) => [at(id), toArray(writeEnvelope(type, p))]

const blobFile = file('blob')

const treeFile = file('tree')

const commitFile = file('commit')

const tagFile = file('tag')

/** @type {Readonly<Record<string, readonly number[]>>} */
const files = Object.fromEntries([
    blobFile(helloId, hello),
    blobFile(bId, b),
    treeFile(subId, sub),
    treeFile(rootId, root),
    commitFile(commitId, commit),
    commitFile(badTreeId, badTree),
    commitFile(junkCommitId, junk),
    commitFile(lostTreeId, lostTree),
    commitFile(blobTreeId, blobTree),
    commitFile(oddTreeId, oddTree),
    tagFile(junkTagId, junk),
    tagFile(danglingTagId, danglingTag),
    tagFile(lostTagId, lostTag),
    [at(oddId), latin1('no envelope here')],
    tagFile(badObjectId, badObject),
    tagFile(badTypeId, badType),
    tagFile(wrongTypeId, wrongType),
    treeFile(twiceId, twice),
    treeFile(lyingId, lying),
    ...chain.slice(1).map(t => tagFile(t.id, t.payload)),
])

/**
 * The host the store reads through: the objects above, uncompressed, with
 * `inflate` handing every buffer back as it is, and a log of the ids read
 * so a proof can see which objects the walk asked for.
 *
 * @type {MemOperationMap<ReadFile | Inflate, readonly string[]>}
 */
const host = {
    readFile: path => log => {
        const f = files[path]
        return [
            [...log, path],
            f === undefined ? error(ioError({ code: 'ENOENT', message: `no such file: ${path}` })) : ok(toVec(f)),
        ]
    },
    inflate: data => log => [log, ok(data)],
}

const runHost = run(host)([])

const read = readStore(dir, 20)

const peeled = peel(read, 20)

const entriesOf = tryEntries(read, 20)

const entryOf = tryEntry(read, 20)

/** @type {(name: string) => Bytes} */
const name = latin1

/** @type {(e: TreeEntry) => readonly [number, string, string]} */
const seen = e => [mode(e), codePointListToString(e.name), hex(e.oid)]

export const proof = {
    // An id naming no tag peels to itself, read; a tag to what it names;
    // a chain of tags to the first object that is not one.
    peel: () => {
        const [, direct] = runHost(peeled(commitId))
        assert(direct[0] === 'ok' && direct[1] !== null)
        assertEq(hex(direct[1].id), hex(commitId))
        assertEq(direct[1].envelope.type, 'commit')
        const [, one] = runHost(peeled(chain[1].id))
        assert(one[0] === 'ok' && one[1] !== null)
        assertEq(hex(one[1].id), hex(commitId))
        // A chain of nine, which `git tag -a` writes and no bound refuses.
        const [, deep] = runHost(peeled(chain[9].id))
        assert(deep[0] === 'ok' && deep[1] !== null)
        assertEq(hex(deep[1].id), hex(commitId))
    },
    // What a tag cannot be peeled through: bytes that are no tag, an
    // `object` header that is no id, and an object the store does not hold,
    // which is the channel's rather than the walk's `null`.
    peelRefused: () => {
        assertStructurallySame(runHost(peeled(junkTagId))[1], ['ok', null])
        assertStructurallySame(runHost(peeled(badObjectId))[1], ['ok', null])
        // A `type` header naming none of the four, and one naming a type
        // the object it reaches is not.
        assertStructurallySame(runHost(peeled(badTypeId))[1], ['ok', null])
        assertStructurallySame(runHost(peeled(wrongTypeId))[1], ['ok', null])
        // A file whose bytes are no object at all: the store's `null`, which
        // the walk hands on.
        assertStructurallySame(runHost(peeled(oddId))[1], ['ok', null])
        const [, missing] = runHost(peeled(danglingTagId))
        assert(missing[0] === 'ok' && missing[1] !== null)
        assertEq(missing[1].envelope.type, 'blob')
        const [, gone] = runHost(peeled(lostTagId))
        assert(gone[0] === 'error')
        const e = gone[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, 'ENOENT')
    },
    // A `Read` that does not check what it answers can hand back a cycle,
    // which a store that checks cannot: a tag naming the id it was asked
    // for. The chain comes back to an id it has been through and stops.
    cycle: () => {
        /** @type {Read<never>} */
        const liar = id => pureOk({
            type: 'tag',
            payload: latin1([`object ${hex(id)}`, 'type tag', 'tag self', '', 'm', ''].join('\n')),
        })
        assertStructurallySame(run({})([])(peel(liar, 20)(commitId))[1], ['ok', null])
    },
    // The tree's entries from a commit's id, from the tree's own id, and
    // from a tag over the commit: the same four entries, as Git wrote them.
    entries: () => {
        const expected = /** @type {readonly (readonly [number, string, string])[]} */ ([
            [0o100644, 'a.txt', hex(helloId)],
            [0o40000, 'dir', hex(subId)],
            [0o120000, 'link', hex(bId)],
            [0o160000, 'mod', hex(elsewhereId)],
            [0o40000, 'odd', hex(oddId)],
        ])
        const [, c] = runHost(entriesOf(commitId))
        assert(c[0] === 'ok' && c[1] !== null)
        assertStructurallySame(c[1].map(seen), expected)
        const [, t] = runHost(entriesOf(rootId))
        assert(t[0] === 'ok' && t[1] !== null)
        assertStructurallySame(t[1].map(seen), expected)
        const [, v] = runHost(entriesOf(chain[2].id))
        assert(v[0] === 'ok' && v[1] !== null)
        assertStructurallySame(v[1].map(seen), expected)
    },
    // What has no entries: a blob's id, bytes stored as a commit that are
    // no commit, a commit whose `tree` is no id, and a tree whose bytes are
    // no tree.
    entriesRefused: () => {
        assertStructurallySame(runHost(entriesOf(helloId))[1], ['ok', null])
        assertStructurallySame(runHost(entriesOf(junkCommitId))[1], ['ok', null])
        assertStructurallySame(runHost(entriesOf(badTreeId))[1], ['ok', null])
        assertStructurallySame(runHost(entriesOf(junkTagId))[1], ['ok', null])
        // A commit whose `tree` names an id the repository does not hold is
        // the channel's; one naming a blob has no entries.
        const [, gone] = runHost(entriesOf(lostTreeId))
        assert(gone[0] === 'error')
        const e = gone[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, 'ENOENT')
        assertStructurallySame(runHost(entriesOf(blobTreeId))[1], ['ok', null])
        assertStructurallySame(runHost(entriesOf(oddTreeId))[1], ['ok', null])
    },
    // A path of one component, and one through a subtree: the entry it
    // names, with its mode and id.
    entry: () => {
        const [, a] = runHost(entryOf(commitId, [name('a.txt')]))
        assert(a[0] === 'ok' && a[1] !== null)
        assertStructurallySame(seen(a[1]), [0o100644, 'a.txt', hex(helloId)])
        const [log, deep] = runHost(entryOf(commitId, [name('dir'), name('b.txt')]))
        assert(deep[0] === 'ok' && deep[1] !== null)
        assertStructurallySame(seen(deep[1]), [0o100644, 'b.txt', hex(bId)])
        // The objects read: the commit, its tree, the subtree, and not the
        // blob the path names.
        assertStructurallySame(log, [at(commitId), at(rootId), at(subId)])
        // A symlink is an entry like any other; its target is its blob's
        // bytes, which the caller reads.
        const [, link] = runHost(entryOf(commitId, [name('link')]))
        assert(link[0] === 'ok' && link[1] !== null)
        assertStructurallySame(seen(link[1]), [0o120000, 'link', hex(bId)])
    },
    // A submodule entry comes back without its commit being read, since
    // that commit is another repository's and this store does not hold it.
    submodule: () => {
        const [log, r] = runHost(entryOf(commitId, [name('mod')]))
        assert(r[0] === 'ok' && r[1] !== null)
        assertStructurallySame(seen(r[1]), [0o160000, 'mod', hex(elsewhereId)])
        assertStructurallySame(log, [at(commitId), at(rootId)])
    },
    // What no path names: a name no entry has, a name under one, a
    // component before the last that is no tree, a path of no components,
    // and a path from an id with no tree at all.
    entryRefused: () => {
        assertStructurallySame(runHost(entryOf(commitId, [name('nope')]))[1], ['ok', null])
        assertStructurallySame(runHost(entryOf(commitId, [name('dir'), name('nope')]))[1], ['ok', null])
        assertStructurallySame(runHost(entryOf(commitId, [name('a.txt'), name('x')]))[1], ['ok', null])
        // A name two entries have is no entry, rather than the first of them.
        assertStructurallySame(runHost(entryOf(twiceId, [name('a.txt')]))[1], ['ok', null])
        // A `100644` entry whose id names a tree is no subtree: the path
        // runs into it, and the tree it names is never read.
        const [log, lie] = runHost(entryOf(lyingId, [name('dir'), name('b.txt')]))
        assertStructurallySame(lie, ['ok', null])
        assertStructurallySame(log, [at(lyingId)])
        assertStructurallySame(runHost(entryOf(commitId, []))[1], ['ok', null])
        assertStructurallySame(runHost(entryOf(helloId, [name('a.txt')]))[1], ['ok', null])
        // A name is bytes as they are: one differing by case is another name.
        assertStructurallySame(runHost(entryOf(commitId, [name('A.txt')]))[1], ['ok', null])
        assertStructurallySame(runHost(entryOf(commitId, [name('a.tx')]))[1], ['ok', null])
        // A component before the last whose file is no object at all.
        assertStructurallySame(runHost(entryOf(commitId, [name('odd'), name('x')]))[1], ['ok', null])
    },
    // A path under a submodule is not this repository's to resolve: a
    // `160000` entry is no subtree, so the path runs into it and the commit
    // it names is never asked for.
    underSubmodule: () => {
        const [log, r] = runHost(entryOf(commitId, [name('mod'), name('x')]))
        assertStructurallySame(r, ['ok', null])
        assertStructurallySame(log, [at(commitId), at(rootId)])
    },
}
