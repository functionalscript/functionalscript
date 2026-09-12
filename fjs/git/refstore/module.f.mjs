/**
 * The refs a repository holds, over the effects: which ids it keeps
 * reachable, and what one ref name resolves to.
 *
 * [`fjs/git/ref`](../ref/module.f.mjs) reads the bytes of one ref file and
 * has no effects. This module finds and opens the files, which is the half
 * that needs a filesystem, and it is where the two rules live that no reader
 * of a single file can decide: which of two files holding the same name
 * wins, and when a symbolic ref stops being followed.
 *
 * Every rule below was measured against Git 2.43.0 rather than read off a
 * manual page.
 *
 * **A loose ref shadows a packed one, by existing rather than by being
 * good.** `git pack-refs` leaves the loose file until it is safe to drop,
 * and a later update writes the loose file and leaves the packed line
 * stale, so the two disagree in normal operation. Measured: with
 * `refs/heads/master` packed at one id and a loose file holding another,
 * `git show-ref` and `git rev-parse` both answer the loose one. And with
 * the loose file holding bytes that are no id, Git does **not** fall back
 * to the packed line — `git show-ref` refuses the whole listing with
 * `bad ref refs/heads/master`. So the loose file decides the name once it
 * is there, and this module reads it the same way: a loose file that is no
 * ref leaves the name with no value rather than with the packed one.
 *
 * **A ref name that is no ref name is not a ref.** Git's own walk of
 * `refs/` skips such a file without a word, and the rule it skips by is the
 * ref-name rule. Measured by writing each of these into `refs/heads/` and
 * asking `git show-ref`, beside `git check-ref-format` on the same name:
 *
 * | file | `show-ref` | `check-ref-format` |
 * | --- | --- | --- |
 * | `plain` | listed | ok |
 * | `.hidden` | skipped | refused |
 * | `x.lock` | skipped | refused |
 * | `bad.` | skipped | refused |
 * | `a..b`, `a@{b` | skipped | refused |
 * | `has space`, `tilde~x`, `caret^x` | skipped | refused |
 *
 * The two agree on every one, so the filter here is
 * [`fjs/git/refname`](../refname/module.f.mjs)'s `isWholeName` and not a
 * list of file-name conventions.
 *
 * @module
 *
 * @import { Dirent, ReadFile, Readdir } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { IoChannel } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, Oid, OidBytes } from '../types.ts'
 * @import { PackedRef } from '../ref/types.ts'
 * @import { Root } from './types.ts'
 */

import { catchStep, mapStep, pureError, pureOk, step, walkStep } from '../../effects/module.f.mjs'
import { isNotFound, readFile, readdir } from '../../effects/node/module.f.mjs'
import { under } from '../../path/module.f.mjs'
import { fromCodePointList } from '../../text/utf8/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { msb, u8List } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { tryPacked, tryRef } from '../ref/module.f.mjs'
import { isWholeName } from '../refname/module.f.mjs'

const toBytes = u8List(msb)

/**
 * A ref name as the bytes Git stores it as, from the text a path is.
 *
 * A loose ref's name is a file name, which the host hands over as a string
 * because node decodes a directory entry as UTF-8. A `packed-refs` name
 * never leaves the byte world. Encoding back to UTF-8 here makes the two one
 * name, which is what lets a loose ref shadow a packed one, and it
 * round-trips for every name node decoded from valid UTF-8 bytes.
 *
 * @type {(s: string) => readonly number[]} */
const nameBytes = s => toArray(fromCodePointList(stringToCodePointList(s)))

/** @type {(a: Bytes, b: Bytes) => boolean} */
const sameName = (a, b) => {
    const x = toArray(a)
    const y = toArray(b)
    return x.length === y.length && x.every((v, i) => y[i] === v)
}

/**
 * The bytes of a file, or `null` where there is none.
 *
 * A missing file is an answer here rather than a failure: a repository with
 * nothing packed has no `packed-refs`, and one whose refs are all packed has
 * an empty `refs/`. Every other error is the channel's.
 *
 * @type {(path: string) => Effect<ReadFile, Nullable<Bytes>, IoChannel>}
 */
const tryBytes = path =>
    catchStep(
        mapStep(readFile(path), toBytes),
        e => isNotFound(e) ? pureOk(null) : pureError(e))

/**
 * The `packed-refs` entries, `[]` where the file is not there, and `null`
 * where it is there and is one Git refuses.
 *
 * The three answers are distinct on purpose: a repository with nothing
 * packed and one whose `packed-refs` is malformed are not the same, and Git
 * treats them differently — the first is ordinary, the second is
 * `fatal: unexpected line`.
 *
 * @type {(dir: string, oidBytes: OidBytes) => Effect<ReadFile, Nullable<readonly PackedRef[]>, IoChannel>}
 */
export const tryPackedRefs = (dir, oidBytes) => {
    const parse = tryPacked(oidBytes)
    return mapStep(tryBytes(under(dir, 'packed-refs')), b => b === null ? [] : parse(b))
}

/**
 * How many lookups one resolution may make, symbolic hops included.
 *
 * Measured on Git 2.43.0 with a chain of symbolic refs ending at a real one:
 * a chain of four hops resolves and one of five is refused as
 * `ignoring dangling symref`. Four hops is five lookups counting the ref
 * that finally holds an id, so five is the bound, and it is the same bound
 * that catches a symbolic ref pointing at itself — Git answers that one with
 * the same message rather than looping.
 */
export const maxLookups = 5

/**
 * The two refs Git reads straight from the file instead of through a ref
 * store, because each may hold more than one record.
 *
 * `FETCH_HEAD` holds a line per fetched ref and `MERGE_HEAD` a line per
 * merge head, so neither is a ref a backend can hold. Git reads the first
 * record of the file, which is what a loose ref file's own grammar already
 * does — the id, one whitespace byte, then the rest unread. Measured: a
 * `FETCH_HEAD` whose first record is `not-for-merge` and whose second is the
 * merge record answers the *first* line's id to `git rev-parse FETCH_HEAD`,
 * so there is nothing to choose between the records here.
 *
 * This is why [`fjs/git/ref`](../ref/module.f.mjs) takes both as symbolic
 * targets and leaves the question to this module: whether such a target
 * resolves depends on the file being there, which the bytes of the ref
 * naming it cannot say.
 */
const special = ['FETCH_HEAD', 'MERGE_HEAD']

/** @type {(packed: readonly PackedRef[], name: Bytes) => Nullable<Oid>} */
const packedId = (packed, name) => {
    const hit = packed.find(e => sameName(e.name, name))
    return hit === undefined ? null : hit.id
}

/**
 * The id a name resolves to, given the packed refs already read: the loose
 * file where there is one, its `packed-refs` line where there is not, a
 * symbolic ref followed to {@link maxLookups}, and `null` for everything
 * else.
 *
 * The loose file decides the name by existing. Where it is there and holds
 * bytes that are no ref, the answer is `null` and **not** the packed line,
 * which is Git's reading: it refuses such a name outright rather than
 * falling back.
 *
 * Everything it needs is a leading parameter, so this closes over nothing
 * and the recursion below is a plain self-call.
 *
 * @type {(dir: string, oidBytes: OidBytes, packed: readonly PackedRef[]) => (name: Bytes, left: number) => Effect<ReadFile, Nullable<Oid>, IoChannel>}
 */
const resolveWith = (dir, oidBytes, packed) => {
    const readRef = tryRef(oidBytes)
    /** @type {(name: Bytes, left: number) => Effect<ReadFile, Nullable<Oid>, IoChannel>} */
    const go = (name, left) => {
        if (left <= 0) { return pureOk(null) }
        const text = codePointListToString(name)
        return step(tryBytes(under(dir, text)), bytes => {
            if (bytes === null) { return pureOk(special.includes(text) ? null : packedId(packed, name)) }
            const r = readRef(bytes)
            if (r === null) { return pureOk(null) }
            if (r.kind === 'direct') { return pureOk(r.id) }
            return go(r.target, left - 1)
        })
    }
    return go
}

/**
 * The id one ref name holds, or `null` where the repository has no such ref.
 *
 * `null` covers every way a name can fail to name an id, because to a caller
 * asking "what does this ref point at" they are one answer: no loose file
 * and no packed line, a loose file that is no ref, a symbolic ref whose
 * target is none, and a chain longer than {@link maxLookups}. A file that
 * cannot be read for any other reason is the channel's.
 *
 * The name is bytes and not text, and it is a whole ref name: `HEAD`,
 * `refs/heads/master`, `FETCH_HEAD`. It is not checked against
 * `isWholeName` here, because a caller that has a name in hand — `HEAD` for
 * a checkout, a ref a person typed — is asking about that name, and a name
 * no file is stored under simply answers `null`.
 *
 * @type {(dir: string, oidBytes: OidBytes) => (name: Bytes) => Effect<ReadFile, Nullable<Oid>, IoChannel>}
 */
export const tryResolve = (dir, oidBytes) => name =>
    step(tryPackedRefs(dir, oidBytes), packed =>
        packed === null
            ? pureOk(null)
            : resolveWith(dir, oidBytes, packed)(name, maxLookups))

/**
 * One entry of the walk of `refs/`: where the file is, the ref name it would
 * be, and whether to descend into it.
 *
 * The name is carried down beside the path rather than recovered from it
 * afterwards. A path and a ref name are spelled differently — the path is
 * the host's and may hold either separator, the name is always `/` — so
 * deriving one from the other means undoing a join, and carrying both costs
 * a field.
 *
 * @typedef {{
 *   readonly path: string
 *   readonly name: string
 *   readonly isDirectory: boolean
 * }} Entry
 */

/**
 * What one step of the walk answers: the roots so far, and the entries to
 * walk next.
 *
 * Named because the branches below build it from different shapes — a
 * directory adds entries and no roots, a ref adds a root and no entries —
 * and without one name for the pair each branch infers its own literal type
 * and none of them unify.
 *
 * @typedef {readonly[Nullable<readonly Root[]>, Nullable<readonly Entry[]>]} Walked
 */

/** @type {(state: Nullable<readonly Root[]>, items: Nullable<readonly Entry[]>) => Walked} */
const walked = (state, items) => [state, items]

/** @type {(parent: Entry) => (d: Dirent) => Entry} */
const childOf = parent => d => ({
    path: under(parent.path, d.name),
    name: `${parent.name}/${d.name}`,
    isDirectory: d.isDirectory,
})

/**
 * The body of the walk of `refs/`: a directory gives its entries to walk
 * next, and a file gives a root or nothing.
 *
 * `null` for the state is malformed and sticky, which is Git's reading of a
 * loose file that is no ref: `git show-ref` refuses the whole listing rather
 * than dropping the one name.
 *
 * A file whose name is no ref name is skipped without a word, which is also
 * Git's — see this module's header for the table the two agree on.
 *
 * The read here is the plain one and not {@link tryBytes}: the walk has just
 * been told the file is there, so a read that cannot find it is a race or a
 * broken host rather than an absence, and the channel is where that belongs.
 *
 * @type {(dir: string, oidBytes: OidBytes, packed: readonly PackedRef[]) => (item: Entry) => (state: Nullable<readonly Root[]>) => Effect<Readdir | ReadFile, readonly[Nullable<readonly Root[]>, Nullable<readonly Entry[]>], IoChannel>}
 */
const looseOf = (dir, oidBytes, packed) => {
    const readRef = tryRef(oidBytes)
    const resolve = resolveWith(dir, oidBytes, packed)
    return item => state => {
        if (state === null) { return pureOk(walked(null, null)) }
        const found = state
        if (item.isDirectory) {
            return step(
                readdir(item.path, {}),
                entries => pureOk(walked(found, entries.map(childOf(item)))))
        }
        const name = nameBytes(item.name)
        if (!isWholeName(name)) { return pureOk(walked(found, null)) }
        /** @type {(bytes: Bytes) => Effect<ReadFile, Walked, IoChannel>} */
        const cont = bytes => {
            const r = readRef(bytes)
            if (r === null) { return pureOk(walked(null, null)) }
            if (r.kind === 'direct') { return pureOk(walked([...found, { name, id: r.id }], null)) }
            return mapStep(
                resolve(r.target, maxLookups - 1),
                id => walked(id === null ? found : [...found, { name, id }], null))
        }
        return step(mapStep(readFile(item.path), toBytes), cont)
    }
}

/** @type {(loose: readonly Root[], packed: readonly PackedRef[]) => readonly Root[]} */
const combine = (loose, packed) => [
    ...loose,
    ...packed
        .filter(p => !loose.some(l => sameName(l.name, p.name)))
        .map(p => ({ name: p.name, id: p.id })),
]

/**
 * Every ref the repository holds, as a name and the id it effectively
 * names: the retention roots, and the ids a search for candidate commits
 * may start from.
 *
 * `null` where the ref files are ones Git refuses — a `packed-refs` it
 * would call `unexpected line`, or a loose file under `refs/` that is no
 * ref, which it calls `bad ref` and refuses the whole listing for.
 *
 * A `refs/` that cannot be listed is the channel's rather than an empty
 * answer, because a directory without one is no repository: `git init`
 * makes it, `git pack-refs --all` leaves it behind empty rather than
 * removing it, and a bare repository has it too — all three measured. A
 * `packed-refs` that is not there *is* an answer, on the other hand, since
 * a repository that has never been packed has no such file.
 *
 * A loose ref shadows the packed line of the same name, so a name in both
 * places appears once, with the loose value. A symbolic loose ref is
 * answered resolved, which is what `git show-ref` lists for one.
 *
 * The order is the walk's and then the file's, and it means nothing: Git
 * sorts its own listing and this does not, because a caller that wants an
 * order has one to apply and no rule here depends on it. The one ordering
 * question that *is* a rule — which of two files holding a name wins — is
 * settled before the list is built, not by where an entry sits in it.
 *
 * The id a ref names need not be a commit's: a tag ref names an annotated
 * tag object, so a caller after commits peels through
 * [`fjs/git/tag`](../tag/module.f.mjs) rather than assuming.
 *
 * `HEAD` is not here, and neither is any other name outside `refs/`. They
 * are not retention roots on their own — `HEAD` names a branch, which is —
 * and {@link tryResolve} answers one by name for a caller that wants it.
 *
 * @type {(dir: string, oidBytes: OidBytes) => Effect<Readdir | ReadFile, Nullable<readonly Root[]>, IoChannel>}
 */
export const tryRoots = (dir, oidBytes) =>
    step(tryPackedRefs(dir, oidBytes), packed => {
        if (packed === null) { return pureOk(null) }
        /** @type {Entry} */
        const start = { path: under(dir, 'refs'), name: 'refs', isDirectory: true }
        /** @type {Nullable<readonly Root[]>} */
        const init = []
        return mapStep(
            walkStep(pureOk([start]), init, looseOf(dir, oidBytes, packed)),
            loose => loose === null ? null : combine(loose, packed))
    })
