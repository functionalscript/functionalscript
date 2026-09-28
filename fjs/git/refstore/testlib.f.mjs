/**
 * Fixtures the two halves' proofs share: the directories of a main worktree,
 * the ids a case writes, a ref file's bytes, a repository as Git leaves one
 * after `pack-refs`, and the two ways a case runs an effect over the virtual
 * filesystem.
 *
 * Beside the modules rather than in either proof, because
 * [`./proof.f.mjs`](./proof.f.mjs) proves the readers and
 * [`./write/proof.f.mjs`](./write/proof.f.mjs) the writers, and a fixture copied
 * into both is two fixtures that drift. Its functions are proved in
 * [`./testlib.proof.f.mjs`](./testlib.proof.f.mjs).
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { FileStat, NodeOp } from '../../effects/node/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Oid } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Dirs } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { error } from '../../types/result/module.f.mjs'
import { toHex } from '../oid/module.f.mjs'
import { latin1 } from '../testlib.f.mjs'
import { tryResolve } from './module.f.mjs'

/**
 * A main worktree's two directories, which are one directory: what a caller
 * passes for a repository with no linked worktree, and what every case in
 * both proofs uses except the ones about a worktree.
 *
 * @type {(d: string) => Dirs}
 */
export const one = d => ({ gitdir: d, common: d })

/** A commit id, and a second one so a shadowed name is told from its shadow. */
export const a = /** @type {const} */ ('8dd3225810cee59495e415a45957c2fdc0030e22')

export const b = /** @type {const} */ ('b1c209491856b9e26208165c5cafbf07ae2e7937')

/** A tag object's id, which is what a tag ref names. */
export const t = /** @type {const} */ ('a48bd2c1bb20c1a3457dfa663047827f1e48ad4e')

/** @type {(s: string) => readonly Vec[]} */
export const file = s => [u8ListToVecMsb(latin1(s))]

/** A ref file as Git writes one: the id and an LF. */
export const ref = /** @type {(hex: string) => readonly Vec[]} */ (hex => file(`${hex}\n`))

/**
 * Runs an effect over a virtual filesystem and answers the filesystem it left
 * beside its result, which is what a *write* has to be asked about: its value is
 * `void` and everything the call did is in the directory.
 *
 * @type {<T>(root: Dir, e: Effect<NodeOp, T, IoChannel>) => readonly [Dir, Result<T, IoChannel>]}
 */
export const ran = (root, e) => {
    const [state, r] = virtual({ ...emptyState, root })(e)
    return [state.root, r]
}

/**
 * The same, unwrapped and without the filesystem: what a case about a *read*
 * asks, since it wants the answer rather than the channel or the directory.
 *
 * @type {<T>(root: Dir, e: Effect<NodeOp, T, IoChannel>) => T}
 */
export const run = (root, e) => {
    const [, r] = ran(root, e)
    assert(r[0] === 'ok')
    return r[1]
}

/**
 * A repository as Git leaves one after `git pack-refs --all` and a later
 * update: everything packed, and `refs/heads/master` written loose again at
 * another id, so the two files disagree the way they do in ordinary use.
 *
 * @type {Dir}
 */
export const shadowed = {
    'packed-refs': file(`# pack-refs with: peeled fully-peeled sorted \n${b} refs/heads/master\n${a} refs/heads/other\n${t} refs/tags/v1\n^${a}\n`),
    refs: { heads: { master: ref(a) } },
}

/** @type {(root: Dir, name: string) => Nullable<Oid>} */
export const resolved = (root, name) => run(root, tryResolve(one(''), 20)(latin1(name)))

/** @type {(root: Dir, name: string) => string} */
export const hexOf = (root, name) => {
    const i = resolved(root, name)
    assert(i !== null, name)
    return codePointListToString(toHex(i))
}

/**
 * A handler that says the file is not there.
 *
 * @type {<S, T>(path: string) => (state: S) => readonly [S, Result<T, IoChannel>]}
 */
export const missing = path => state => [state, error(ioError({ code: 'ENOENT', message: path }))]

/**
 * What `stat` answers about an entry, as the two questions it is.
 *
 * @type {(isFile: boolean, isDirectory: boolean) => FileStat}
 */
export const kind = (isFile, isDirectory) => ({ size: 41, isFile, isDirectory })
