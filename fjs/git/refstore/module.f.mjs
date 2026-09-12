/**
 * The refs a repository holds, over the effects: which ids it keeps
 * reachable, and what one ref name resolves to.
 *
 * [`fjs/git/ref`](../ref/module.f.mjs) reads the bytes of one ref file and
 * has no effects. This module finds and opens the files, which is the half
 * that needs a filesystem, and it is where every rule lives that no reader of
 * a single file can decide: which of two files holding the same name wins,
 * when a symbolic ref stops being followed, how a name and a path spell each
 * other, and which names a target may take.
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
 * The filter runs before a path is built and not after a file is read, which
 * matters for a name a caller passes in rather than one a directory listing
 * handed over: `..` is one of the byte pairs the rule refuses, so a name like
 * `../secret` never becomes a path below the repository and is never opened.
 * A file outside a repository is not a ref however its first bytes read.
 *
 * **A ref name is bytes and a path is text, joined by UTF-8 in both
 * directions.** A directory entry called `é` is the name `0xC3 0xA9`, and that
 * name reads back as the path `é`. Reading a byte as a code point instead
 * spells the same name `Ã©`, which is a file no repository has — so the
 * listing and the lookup would disagree about one ref, each right about its
 * own half.
 *
 * The join is lossless only for a name that *is* UTF-8, and Git requires no
 * such thing: `refs/heads/\x80` is a name `git check-ref-format` accepts and
 * `rev-parse` resolves, measured. Such a name can only arrive here in a
 * `packed-refs` line, which never becomes a path, and both halves answer it —
 * but a *loose* file of that name is unreachable, because node hands back
 * U+FFFD for the byte and a read of the decoded string is `ENOENT`. What that
 * costs each half is measured in
 * [`todo/byte-ref-names.md`](./todo/byte-ref-names.md); the fix is a path API
 * that speaks bytes and belongs to the effects, not here.
 *
 * **`HEAD`'s target must sit under `refs/`, and it is the only name with such
 * a rule.** Measured: with `.git/HEAD` holding `ref: a/b` and `.git/a/b`
 * holding a valid id, each of `git rev-parse HEAD`,
 * `git rev-parse --verify HEAD` and `git symbolic-ref HEAD` answers
 * `not a git repository` — the directory stops being one rather than `HEAD`
 * holding an odd value. `a/b` is a name `git check-ref-format` accepts, so the
 * rule is not the name's; and an ordinary ref may point outside `refs/`, which
 * a symbolic ref onto `FETCH_HEAD` is the everyday case of. A rule about
 * *which* name is being resolved cannot live in a reader of one file's bytes,
 * which is why it is here.
 *
 * **A `packed-refs` may name one ref twice, and the last line wins.**
 * Measured: `git show-ref` lists both lines and `git rev-parse` answers the
 * last, in either order of the two. Git neither refuses the file nor takes the
 * first, so the earlier lines are dead and one name still has one value.
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
 * @import { _Entry, _Found, _Walked } from './private.ts'
 */

import { catchStep, mapStep, pureError, pureOk, step, walkStep } from '../../effects/module.f.mjs'
import { isNotFound, readFile, readdir } from '../../effects/node/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { under } from '../../path/module.f.mjs'
import { fromCodePointList, fromVec } from '../../text/utf8/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { msb, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { tryPacked, tryRef } from '../ref/module.f.mjs'
import { isWholeName } from '../refname/module.f.mjs'

const toBytes = u8List(msb)

const toVec = u8ListToVec(msb)

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
export const maxLookups = /** @type {const} */ (5)

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
const special = /** @type {readonly string[]} */ (['FETCH_HEAD', 'MERGE_HEAD'])

/**
 * The id a `packed-refs` line gives a name, taking the **last** of them where
 * the file names one twice.
 *
 * A file can hold a name twice, and Git neither refuses it nor takes the
 * first: measured on Git 2.43.0, `git show-ref` lists both lines and
 * `git rev-parse` answers the last, in either order of the two. So the last
 * line is the effective value and the ones above it are dead.
 *
 * @type {(packed: readonly PackedRef[], name: Bytes) => Nullable<Oid>}
 */
const packedId = (packed, name) => {
    const hits = packed.filter(e => sameName(e.name, name))
    return hits.length === 0 ? null : hits[hits.length - 1].id
}

/** The one ref name whose target Git constrains. */
const head = /** @type {const} */ ('HEAD')

/** The prefix `HEAD`'s target must carry. */
const refsPrefix = /** @type {const} */ ('refs/')

/** @type {(name: readonly number[]) => boolean} */
const isUnderRefs = name => nameText(name)?.startsWith(refsPrefix) === true

/**
 * The text of a ref name, for the path its loose file sits at, or `null` where
 * the bytes are no UTF-8.
 *
 * Decoded as UTF-8 and not a byte per code point, which is the inverse of
 * {@link nameBytes} and has to be: a name of the two bytes `0xC3 0xA9` is the
 * one character `é` on the filesystem, and reading each byte as a code point
 * would ask the host for `Ã©` instead and miss the file. Bytes that are no
 * UTF-8 name no file node could have handed us, so they answer `null` rather
 * than a path built from replacement characters.
 *
 * `null` means *there is no loose file to ask about*, not that the name is bad.
 * A ref name is bytes and Git takes any byte the name rule allows —
 * `git check-ref-format refs/heads/\x80` is accepted, and `show-ref` and
 * `rev-parse` both handle such a ref, measured — so a `packed-refs` line may
 * carry one and `tryRoots` lists it. What cannot carry one is this host's path:
 * node reads a directory entry as UTF-8 with replacement, so the same byte
 * comes back as U+FFFD and a `readFile` of that string answers `ENOENT`,
 * measured. So for such a name the packed line is the only answer the host can
 * give, and [`todo/byte-ref-names.md`](./todo/byte-ref-names.md) records what
 * that costs.
 *
 * @type {(name: readonly number[]) => Nullable<string>}
 */
const nameText = name => fromVec(toVec(name))

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
        const dense = byteArray(name)
        // A name that is no ref name never reaches the filesystem. `..` is
        // one of the byte pairs `isWholeName` refuses, so this is also what
        // keeps `../secret` from being joined below `dir` and read: a path
        // that leaves the repository is not a ref this can answer for, and
        // the file at the other end of it could begin with something that
        // looks like an id.
        if (!isWholeName(dense)) { return pureOk(null) }
        const text = nameText(dense)
        // No path can name this ref's loose file — not because the name is bad
        // but because this host spells a path as text. A loose file of such a
        // name is unreachable through `readFile` either way, so it is absent as
        // far as this API can see, and the rule for an absent loose file is the
        // packed line. Refusing here instead would call a packed ref that
        // `tryRoots` lists absent. See {@link nameText}.
        if (text === null) { return pureOk(packedId(packed, name)) }
        return step(tryBytes(under(dir, text)), bytes => {
            if (bytes === null) { return pureOk(special.includes(text) ? null : packedId(packed, name)) }
            const r = readRef(bytes)
            if (r === null) { return pureOk(null) }
            if (r.kind === 'direct') { return pureOk(r.id) }
            // `HEAD` is the one ref whose target Git constrains: it must sit
            // under `refs/`, and a `HEAD` that does not is not a repository
            // at all rather than a ref with an odd value. Measured on Git
            // 2.43.0 — with `.git/HEAD` holding `ref: a/b` and `.git/a/b`
            // holding a valid id, every one of `rev-parse HEAD`,
            // `rev-parse --verify HEAD` and `symbolic-ref HEAD` answers
            // `not a git repository`. This function knows which name it was
            // asked about, which is why the check lives here and not in the
            // grammar that reads one file's bytes.
            if (text === head && !isUnderRefs(byteArray(r.target))) { return pureOk(null) }
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
 * `refs/heads/master`, `FETCH_HEAD`. One that is no ref name answers `null`
 * before any file is opened, which is the same answer a name nothing is stored
 * under gets and the only safe one: the name comes from outside — `HEAD` for a
 * checkout, a ref a person typed — and `..` is one of the byte pairs the rule
 * refuses, so `../secret` would otherwise join below the repository into a
 * path that leaves it. A file on the other side of that boundary is not a ref
 * however its first bytes read.
 *
 * `HEAD` is the one name whose target Git constrains, and this is where that
 * is enforced, because this is the half that knows which name it was asked
 * about. The module doc has the measurement.
 *
 * @type {(dir: string, oidBytes: OidBytes) => (name: Bytes) => Effect<ReadFile, Nullable<Oid>, IoChannel>}
 */
export const tryResolve = (dir, oidBytes) => name =>
    step(tryPackedRefs(dir, oidBytes), packed =>
        packed === null
            ? pureOk(null)
            : resolveWith(dir, oidBytes, packed)(name, maxLookups))

/** @type {(state: Nullable<_Found>, items: Nullable<readonly _Entry[]>) => _Walked} */
const walked = (state, items) => [state, items]

/** @type {(parent: _Entry) => (d: Dirent) => _Entry} */
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
 * @type {(dir: string, oidBytes: OidBytes, packed: readonly PackedRef[]) => (item: _Entry) => (state: Nullable<_Found>) => Effect<Readdir | ReadFile, _Walked, IoChannel>}
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
        // the name is recorded whatever the file turns out to hold, because
        // that is what shadows the packed line
        const names = [...found.names, name]
        /** @type {(bytes: Bytes) => Effect<ReadFile, _Walked, IoChannel>} */
        const cont = bytes => {
            const r = readRef(bytes)
            if (r === null) { return pureOk(walked(null, null)) }
            if (r.kind === 'direct') {
                return pureOk(walked({ roots: [...found.roots, { name, id: r.id }], names }, null))
            }
            return mapStep(
                resolve(r.target, maxLookups - 1),
                id => walked({ roots: id === null ? found.roots : [...found.roots, { name, id }], names }, null))
        }
        return step(mapStep(readFile(item.path), toBytes), cont)
    }
}

/**
 * The roots the walk found, then the packed lines nothing hides.
 *
 * A packed line is dropped for either of two reasons. A loose file of the same
 * name hides it, by existing — see {@link _Found}. And a *later* packed line of
 * the same name hides it, because a file may name a ref twice and Git takes
 * the last: measured on Git 2.43.0, `git show-ref` lists both lines and
 * `git rev-parse` answers the last, in either order. Keeping both would break
 * the one-entry-per-name this function promises.
 *
 * @type {(found: _Found, packed: readonly PackedRef[]) => readonly Root[]}
 */
const combine = (found, packed) => [
    ...found.roots,
    ...packed
        .filter((p, i) =>
            !found.names.some(n => sameName(n, p.name))
            && !packed.slice(i + 1).some(q => sameName(q.name, p.name)))
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
 * places appears once, with the loose value. It shadows by existing: a loose
 * symbolic ref whose target is nowhere yields no root and the packed line
 * still does not come back, since the loose file is what the repository now
 * says about that name. A symbolic loose ref that does resolve is answered
 * resolved, which is what `git show-ref` lists for one.
 *
 * One name, one entry, whatever the files do: a `packed-refs` naming a ref
 * twice contributes its last line and not both.
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
        /** @type {_Entry} */
        const start = { path: under(dir, 'refs'), name: 'refs', isDirectory: true }
        /** @type {Nullable<_Found>} */
        const init = { roots: [], names: [] }
        return mapStep(
            walkStep(pureOk([start]), init, looseOf(dir, oidBytes, packed)),
            found => found === null ? null : combine(found, packed))
    })
