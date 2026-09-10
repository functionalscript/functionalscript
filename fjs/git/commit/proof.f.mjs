/**
 * @import { Oid } from '../types.ts'
 * @import { Commit } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { toHex } from '../oid/module.f.mjs'
import { name, object, tagger, type, write as writeTag } from '../tag/module.f.mjs'
import { commitPayload, latin1, mergePayload, sha256Commit, tagPayload } from '../testlib.f.mjs'
import { author, committer, encoding, gpgsig, mergetags, parents, tree, tryRead, validate, write } from './module.f.mjs'

/** @type {(input: readonly number[]) => Commit} */
const read = input => {
    const c = tryRead(input)
    assert(c !== null)
    return c
}

/** @type {(lines: readonly string[]) => Commit} */
const commit = lines => read(latin1(lines.join('\n')))

/** @type {(bytes: readonly number[]) => string} */
const text = codePointListToString

/** @type {(id: Oid) => string} */
const hex = id => text(toArray(toHex(id)))

const validate20 = validate(20)

const treeId = /** @type {const} */ ('c5711460da9d5ae7158a951d9d924385419b13ca')

const parentId = /** @type {const} */ ('30317689cb0aaba4f927c1980d80e286c69dce85')

const who = /** @type {const} */ ('A <a@b> 1 +0000')

/**
 * The headers every rule below starts from: a commit `git fsck` accepts.
 *
 * @type {readonly string[]}
 */
const lines = [`tree ${treeId}`, `parent ${parentId}`, `author ${who}`, `committer ${who}`, '', 'm']

/** @type {(i: number, line: string) => Commit} */
const replaced = (i, line) => commit(lines.map((l, j) => j === i ? line : l))

/** @type {(i: number) => Commit} */
const without = i => commit(lines.filter((_, j) => j !== i))

export const proof = {
    // The real signed merge commit of this repository: tree, two parents,
    // author, committer, its signature, no encoding and no mergetag;
    // vouched for, and written back to the same bytes.
    merge: () => {
        const c = read(commitPayload)
        assertEq(hex(tree(c)), treeId)
        assertStructurallySame(parents(c).map(hex), [parentId, '261b9142dfe024d8e8e009b0e97f6e52ea981c8d'])
        assertEq(text(toArray(author(c).name)), 'Sergey Shandar')
        assertEq(author(c).time, 1789011254n)
        assertEq(text(toArray(committer(c).email)), 'noreply@github.com')
        assertEq(committer(c).tz, '+0000')
        assertEq(encoding(c), null)
        const sig = gpgsig(c)
        assert(sig !== null)
        assertEq(text(toArray(sig)).split('\n').length, 17)
        assertStructurallySame(mergetags(c), [])
        assertStructurallySame(validate20(c), ['ok', c])
        assertStructurallySame(toArray(write(c)), commitPayload)
    },
    // A merge of a signed tag, as Git wrote it: the tag comes back whole
    // out of the `mergetag` header, its own signature in its message, and
    // names the second parent.
    mergetag: () => {
        const c = read(mergePayload)
        assertEq(hex(tree(c)), '3a3e4ab4cfbdacbc05f5721ad4aa7877a8004de4')
        const [t] = mergetags(c)
        assert(t !== undefined)
        assertEq(mergetags(c).length, 1)
        assertEq(hex(object(t)), hex(parents(c)[1]))
        assertEq(type(t), 'commit')
        assertEq(text(toArray(name(t))), 'vt')
        const by = tagger(t)
        assert(by !== null)
        assertEq(by.time, 1700000100n)
        assertEq(committer(c).time, 1700000200n)
        const message = text(toArray(t.message)).split('\n')
        assertStructurallySame([message[0], message[1], message[6]], ['Topic tag', '-----BEGIN SSH SIGNATURE-----', '-----END SSH SIGNATURE-----'])
        assert(gpgsig(c) !== null)
        assertStructurallySame(validate20(c), ['ok', c])
        assertStructurallySame(toArray(write(c)), mergePayload)
    },
    // A tag folded into a `mergetag` header as Git folds it — SP before
    // each line, so the tag's last LF ends the header — comes back byte
    // for byte, all 432 of them, and not one short.
    folded: () => {
        const folded = `mergetag ${text(tagPayload).slice(0, -1).replaceAll('\n', '\n ')}`
        const c = commit([...lines.slice(0, 4), folded, ...lines.slice(4)])
        assertStructurallySame(validate20(c), ['ok', c])
        const [t] = mergetags(c)
        assert(t !== undefined)
        assertStructurallySame(toArray(writeTag(t)), tagPayload)
        assertEq(tagPayload.length, 432)
    },
    // A root commit Git wrote under SHA-256: its tree a 32-byte id, vouched
    // for at that width and refused at the other, written back byte for byte.
    sha256Git: () => {
        const c = read(sha256Commit)
        assertEq(hex(tree(c)), '2f1e8b790adef60b1b58a9fe37ff415972da0e5abd333e171a4f999484eb42b0')
        assertStructurallySame(parents(c), [])
        const by = author(c)
        assertStructurallySame([text(toArray(by.name)), text(toArray(by.email)), by.time, by.tz], ['Proof', 'proof@example.com', 1700000300n, '+0100'])
        assertStructurallySame(committer(c), by)
        assertEq(text(toArray(c.message)), 'sha256\n')
        assertStructurallySame(validate(32)(c), ['ok', c])
        assertStructurallySame(validate20(c), ['error', 'not a tree id'])
        assertStructurallySame(toArray(write(c)), sha256Commit)
    },
    // A root commit has no parent; `author` and `committer` sit right after
    // the tree. An `encoding` is read by key.
    root: () => {
        const c = commit([`tree ${treeId}`, `author ${who}`, `committer ${who}`, 'encoding latin1', '', ''])
        assertStructurallySame(parents(c), [])
        assertEq(text(toArray(author(c).name)), 'A')
        assertEq(text(toArray(committer(c).name)), 'A')
        assertStructurallySame(toArray(encoding(c) ?? []), latin1('latin1'))
        assertEq(gpgsig(c), null)
        assertStructurallySame(validate20(c), ['ok', c])
    },
    // The other id width, and each width refuses the other's id.
    sha256: () => {
        const c = commit([`tree ${'ab'.repeat(32)}`, `parent ${'cd'.repeat(32)}`, `author ${who}`, `committer ${who}`, '', ''])
        assertStructurallySame(validate(32)(c), ['ok', c])
        assertStructurallySame(validate20(c), ['error', 'not a tree id'])
        assertStructurallySame(validate(32)(commit(lines)), ['error', 'not a tree id'])
    },
    // What `fsck` only notes passes: a header between committer and the
    // end, a `parent` after author, which is another header, not a parent.
    noted: () => {
        const extra = commit([...lines.slice(0, 4), 'note x', ...lines.slice(4)])
        assertStructurallySame(validate20(extra), ['ok', extra])
        const late = commit([...lines.slice(0, 4), `parent ${parentId}`, ...lines.slice(4)])
        assertStructurallySame(validate20(late), ['ok', late])
        assertEq(parents(late).length, 1)
        // A header list that ends in its parents: the run reaches the end.
        const last = commit([...lines.slice(0, 2), '', ''])
        assertEq(parents(last).length, 1)
        assertEq(hex(parents(last)[0]), parentId)
    },
    // Each refusal, one per rule, on a commit the reader reads.
    validate: () => {
        assertStructurallySame(validate20(without(0)), ['error', 'no tree'])
        assertStructurallySame(validate20(commit(['', ''])), ['error', 'no tree'])
        assertStructurallySame(validate20(replaced(0, `tree ${treeId.slice(1)}`)), ['error', 'not a tree id'])
        assertStructurallySame(validate20(replaced(1, `parent ${parentId}0`)), ['error', 'not a parent id'])
        assertStructurallySame(validate20(replaced(1, 'parent zz')), ['error', 'not a parent id'])
        assertStructurallySame(validate20(without(2)), ['error', 'no author'])
        assertStructurallySame(validate20(commit(lines.slice(0, 2).concat(['', '']))), ['error', 'no author'])
        assertStructurallySame(validate20(replaced(2, 'author A <a@b> 1')), ['error', 'not an author'])
        assertStructurallySame(validate20(without(3)), ['error', 'no committer'])
        assertStructurallySame(validate20(replaced(3, `author ${who}`)), ['error', 'no committer'])
        assertStructurallySame(validate20(replaced(3, 'committer A <a@b> x +0000')), ['error', 'not a committer'])
        const bad = commit([...lines.slice(0, 4), 'mergetag object zz', ' type commit', ' tag t', ' ', ' m', ...lines.slice(4)])
        assertStructurallySame(validate20(bad), ['error', 'not a mergetag'])
        const notATag = commit([...lines.slice(0, 4), 'mergetag object', ...lines.slice(4)])
        assertStructurallySame(validate20(notATag), ['error', 'not a mergetag'])
        // A NUL in any header is refused before anything else is looked at;
        // one in the message, after everything else.
        assertStructurallySame(validate20(replaced(3, `committer ${who}\0`)), ['error', 'NUL in header'])
        assertStructurallySame(validate20(commit([...lines.slice(0, 4), 'no\0te x', ...lines.slice(4)])), ['error', 'NUL in header'])
        assertStructurallySame(validate20(commit(['\0 x', '', ''])), ['error', 'NUL in header'])
        assertStructurallySame(validate20(replaced(5, 'm\0')), ['error', 'NUL in message'])
        assertStructurallySame(validate20(commit([...lines.slice(0, 4), 'mergetag x', '', 'm\0'])), ['error', 'not a mergetag'])
    },
    // Git puts no bound on the parents: a merge of eight thousand is read,
    // vouched for, and walked without a stack to run out of.
    octopus: () => {
        const ps = Array.from({ length: 8000 }, (_, i) => `parent ${i.toString(16).padStart(40, '0')}`)
        const c = commit([`tree ${treeId}`, ...ps, `author ${who}`, `committer ${who}`, '', 'm'])
        assertEq(parents(c).length, 8000)
        assertEq(hex(parents(c)[7999]), '1f3f'.padStart(40, '0'))
        assertEq(text(toArray(committer(c).name)), 'A')
        assertStructurallySame(validate20(c), ['ok', c])
    },
    // The well-known fields panic on a commit `validate` refuses.
    throw: {
        noTree: () => tree(without(0)),
        notATreeId: () => tree(replaced(0, 'tree zz')),
        notAParentId: () => parents(replaced(1, 'parent zz')),
        noAuthor: () => author(without(2)),
        notAnAuthor: () => author(replaced(2, 'author A')),
        noCommitter: () => committer(without(3)),
        notACommitter: () => committer(replaced(3, 'committer A')),
        notAMergetag: () => mergetags(commit([...lines.slice(0, 4), 'mergetag x', ...lines.slice(4)])),
    },
}
