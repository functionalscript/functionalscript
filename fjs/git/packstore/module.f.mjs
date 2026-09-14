/**
 * The objects a pack directory holds: from an id to the `Envelope` a `.pack`
 * spells, through the `.idx` beside it.
 *
 * [`fjs/git/loose`](../loose/module.f.mjs) is the same boundary for the other
 * place an object lives, and the two answer alike on purpose — a caller above
 * [`fjs/git/store`](../store/module.f.mjs) never learns which file held the
 * object it asked for. This module is where a pack stops being a format
 * ([`fjs/git/pack`](../pack/module.f.mjs), [`fjs/git/packidx`](../packidx/module.f.mjs),
 * both pure) and becomes a repository's objects.
 *
 * Every claim below was measured against Git 2.43.0, on packs it wrote.
 *
 * **Two files answer, in order.** The `.idx` says where in the `.pack` an id's
 * entry begins; nothing else does, and a pack on its own can only be read from
 * the front. A directory holds any number of pairs, so the lookup is a walk over
 * them that stops at the first pack holding the id — the packs a repository
 * keeps are disjoint in the objects they hold except where a `gc` has not yet
 * dropped an old one, and two packs holding one id hold the same object under
 * it, so the first answer is the answer.
 *
 * Opening an index is not cheap: it is read whole and its trailing checksum is
 * hashed, and its ids are built as it is read. That is what makes a packed read
 * cost more than a loose one here where it costs less in Git, which keeps its
 * indexes mapped; the two halves of it are
 * [`packidx`'s lazy-index-ids.md](../packidx/todo/lazy-index-ids.md) and
 * [`oid`'s chunk-gathering.md](../oid/todo/chunk-gathering.md), and neither is a
 * question about what a read *answers*.
 *
 * **An entry's window has to be exact.** A pack entry carries no length: its
 * header says what the object inflates to and says nothing about how many bytes
 * of the file the zlib stream after it takes. `inflate` refuses bytes after the
 * end of a stream, so a reader that hands the host a generous window hands it
 * the beginning of the next entry and is refused. The index is what closes the
 * window — see `after` in [`fjs/git/packidx`](../packidx/module.f.mjs) — and the
 * last entry in a pack ends at the file's length less its trailing checksum,
 * which is why a read `stat`s the pack. Measured on a pack of six objects, two
 * of them deltas: every entry's window taken this way inflated with nothing left
 * over.
 *
 * **A delta chain is walked, not recursed.** Each link reads one entry, and a
 * delta's base is the next item of the same walk rather than a nested read, for
 * the reason [`fjs/effects`](../../effects/module.f.mjs)' `_walkLoop` exists and
 * [`fjs/git/walk`](../walk/module.f.mjs) repeats: a `Read` that answers values
 * resumes inside the caller, so a recursion costs a frame per link and a long
 * chain exhausts the stack. `--depth` is 50 by default and takes any number.
 *
 * **A `refDelta`'s base must be in the same pack, and may be anywhere in it.**
 * An `ofsDelta` names its base by a distance back, so its base precedes it; a
 * `refDelta` names an id, and the id may sit *after* it. Measured: a thin pack
 * from `git pack-objects --thin`, stored by `git index-pack --fix-thin`, came
 * out with the delta at offset 470 and the base it names appended at 545. That
 * is also what makes an out-of-pack base a refusal here rather than a missing
 * feature: `--fix-thin` appends the bases a fetched pack lacked, so a pack on
 * disk carries its own, and one that does not is a pack this cannot read — the
 * base could be loose, in another pack, or nowhere, and answering from the wrong
 * one of those is worse than refusing. `tryRead` over the whole store, which
 * would resolve such a base wherever it lives, is
 * [object-store.md](../todo/object-store.md).
 *
 * **`null` is absence and an error is corruption.** No pack in the directory
 * holds the id is `null`, which is what lets
 * [`fjs/git/store`](../store/module.f.mjs) try the loose path and the packs in
 * either order and report a miss once. Everything else — an `.idx` Git would not
 * read, an entry that does not frame, a stream that does not inflate, a delta
 * that does not apply, a chain that cycles or leaves the pack — is the channel's.
 * A pack that holds an id and cannot answer it is not a pack that lacks it, and
 * a caller told `null` for the second would go looking elsewhere for an object
 * that is right here and broken.
 *
 * **The pack is checked against the index that named it**, which is four things
 * Git checks when it opens one and none of them a hash: the signature, the
 * version, the object count against the index's, and the pack's trailing
 * checksum against the one the index recorded. See {@link framingOf} for what Git
 * says to each and what an earlier revision of this module got wrong by skipping
 * them.
 *
 * @module
 *
 * @import { Dirent, Inflate, IoChannel, ReadBytes, Readdir, Stat } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Envelope } from '../object/types.ts'
 * @import { Entry } from '../pack/types.ts'
 * @import { Idx } from '../packidx/types.ts'
 * @import { Bytes, Oid, OidBytes } from '../types.ts'
 * @import { _Chain, _Delta } from './private.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { catchStep, foldStep, history, historyStep, ioError, mapStep, pureError, pureOk, step, walkStep } from '../../effects/module.f.mjs'
import { inflate, isNotFound, leadsNowhere, readBytes, readWholeBytes, readdir, stat } from '../../effects/node/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { join, under } from '../../path/module.f.mjs'
import { length, maxLengthBytes, msb, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { headerBytes, tryApplyDelta, tryEntry, tryHeader } from '../pack/module.f.mjs'
import { after, holdsEntryAt, offsetOf, tryIdx } from '../packidx/module.f.mjs'
import { hexText } from '../oid/module.f.mjs'

const toBytes = u8List(msb)

const toVec = u8ListToVec(msb)

/** What a pack index is called, and so what a listing of the directory looks for. */
const idxSuffix = /** @type {const} */ ('.idx')

/** What the pack beside it is called. */
const packSuffix = /** @type {const} */ ('.pack')

/**
 * Where a repository keeps its packs, below the directory `objects/` is in.
 *
 * Joined with {@link under} rather than by writing a separator, for the reason
 * [`fjs/git/store`](../store/module.f.mjs)'s `objectPath` is: `dir` is the
 * caller's and may already end in one.
 *
 * @type {(dir: string) => string}
 */
export const packDir = dir => under(dir, join('objects', 'pack'))

/**
 * The code an `.idx` is refused with when it is not one Git would read at the
 * repository's width. The file names the objects of the pack beside it, so a
 * pack whose index does not read holds nothing this can reach, and that is a
 * failure rather than an absence.
 */
export const packIdxCode = /** @type {const} */ ('ERR_PACK_IDX')

/**
 * The code every refusal inside a pack shares: an entry that does not frame, an
 * inflated stream that is not the length its header declares, a base outside the
 * pack, a chain longer than the pack's object count, or a delta that does not
 * apply. One code, because a caller has one question — can this pack answer for
 * this id — and each message names the pack and the offset it went wrong at.
 */
export const packEntryCode = /** @type {const} */ ('ERR_PACK_ENTRY')

/** @type {(path: string) => string} */
const idxMessage = path => `${path} is no pack index`

/**
 * A refusal about the entry at an offset, as the channel error it becomes.
 *
 * The pack and the offset come first so the message each case names is all the
 * case has to write, and so this closes over nothing.
 *
 * @type {(path: string, at: number) => (what: string) => Effect<never, never, IoChannel>}
 */
const entryRefusal = (path, at) => what =>
    pureError(ioError({ code: packEntryCode, message: `${path}:${at} ${what}` }))

/**
 * One entry of the pack directory that ends in `.idx`, kept where it is a file.
 *
 * **A listing cannot classify a symlink, and a pack pair may be one.** Node's
 * `Dirent` does not follow a link, so a linked `.idx` arrives with both kind
 * flags false and a filter on `isFile` drops it — and with it every object the
 * pack holds. Git follows one: measured on Git 2.43.0 with both files of a pair
 * replaced by links into another directory, `git cat-file -p` answered the blob
 * and `git count-objects -v` reported `in-pack: 4, packs: 1`.
 *
 * So an entry the listing *can* classify costs nothing, and one it cannot costs a
 * `stat`, which follows the link without opening what it finds. A link that
 * leads nowhere is skipped, as Git's listing skips one; any other failure is the
 * channel's, because a pack dropped in silence is every object in it missing.
 *
 * @type {(pd: string) => (e: Dirent) => (names: List<string>) => Effect<Stat, List<string>, IoChannel>}
 */
const namedIdx = pd => e => names => e.isFile
    ? pureOk(concat(names)([e.name]))
    : catchStep(
        mapStep(stat(under(pd, e.name)), s => s.isFile ? concat(names)([e.name]) : names),
        c => leadsNowhere(c) ? pureOk(names) : pureError(c))

/**
 * The `.idx` names a pack directory holds, and nothing else in it: the `.pack`
 * files themselves, the `.rev` a newer Git writes beside them, a `.keep`, and a
 * partial file a fetch is still writing are all skipped by the suffix.
 *
 * A directory that is not there is no packs rather than a failure. `git init`
 * makes an empty `objects/pack/`, but a repository is not required to keep one
 * and a caller asking for an object should not have to know whether it does.
 *
 * @type {(pd: string) => Effect<Stat | Readdir, List<string>, IoChannel>}
 */
const idxNames = pd => catchStep(
    step(
        readdir(pd, {}),
        es => foldStep(
            pureOk(es.filter(e => e.name.endsWith(idxSuffix) && !e.isDirectory)),
            /** @type {List<string>} */ (null),
            namedIdx(pd))),
    e => isNotFound(e) ? pureOk(/** @type {List<string>} */ (null)) : pureError(e))

/**
 * The index at `path`, or a refusal naming it.
 *
 * **An index does not fit a `Vec`, which is why this is not a `readFile`.** That
 * answers one, 128 KiB at most, and a version 2 SHA-1 index outgrows it at 4,643
 * objects — 28 bytes an object over a 1,072-byte frame. This repository's own
 * `objects/pack` holds indexes of 161,764 bytes and more, so reading one through
 * `readFile` failed for the ordinary case rather than an extreme one.
 * [`readWholeBytes`](../../effects/node/module.f.mjs) reads it in windows into a
 * byte list, which has no such bound and is what `tryIdx` takes.
 *
 * The bound that remains is memory and the host's own: an index is as long as
 * the pack it names has objects, and the whole of it is held while it is decoded.
 * Reading only the fanout and one bucket is what
 * [`todo/lazy-index-ids.md`](../packidx/todo/lazy-index-ids.md) is for.
 *
 * @type {(path: string, oidBytes: OidBytes) => Effect<Stat | ReadBytes, Idx, IoChannel>}
 */
const idxAt = (path, oidBytes) => {
    const read = mapStep(readWholeBytes(path), b => tryIdx(oidBytes)(b))
    return step(read, i => i === null
        ? pureError(ioError({ code: packIdxCode, message: idxMessage(path) }))
        : pureOk(i))
}

/**
 * Where the entry beginning at `at` ends, or `null` where the index leaves it no
 * room: an offset at or past the point the pack's trailing checksum begins, or
 * one the index says another entry begins at.
 *
 * The pack's length is the caller's because it comes from a `stat` the walk does
 * once, and the entry after this one is the index's.
 *
 * @type {(idx: Idx, oidBytes: OidBytes, packLength: number, at: number) => Nullable<number>}
 */
const endOf = (idx, oidBytes, packLength, at) => {
    const next = after(idx)(at)
    const end = next === null ? packLength - oidBytes : next
    return end > at ? end : null
}

/**
 * One entry of a pack, framed, with the stream after its header inflated — the
 * entry and the bytes as a pair, since the kind decides what the bytes are and
 * both are read from the one window.
 *
 * @type {(oidBytes: OidBytes, path: string, at: number, window: readonly number[]) => Effect<Inflate, readonly [Entry, readonly number[]], IoChannel>}
 */
const framedAt = (oidBytes, path, at, window) => {
    const e = tryEntry(oidBytes)(window)
    return e === null
        ? entryRefusal(path, at)('is no pack entry')
        : mapStep(
            inflate(toVec(window.slice(e.dataAt))),
            v => /** @type {const} */ ([e, byteArray(toBytes(v))]))
}

/**
 * {@link applied}'s fold, which stops at the first delta that does not apply.
 *
 * @type {(acc: Nullable<readonly number[]>, d: readonly number[]) => Nullable<readonly number[]>}
 */
const applyStep = (acc, d) => acc === null ? null : tryApplyDelta(acc, d)

/**
 * The object a chain of deltas builds from the base it ends at, or `null` where
 * one of them does not apply: a size that disagrees with what it was given, or
 * an instruction that leaves the base.
 *
 * The deltas are already in the order they apply — see `_Chain` in
 * [`./private.ts`](./private.ts) — so this is a fold and not a walk back.
 *
 * @type {(deltas: List<readonly number[]>, base: readonly number[]) => Nullable<readonly number[]>}
 */
const applied = (deltas, base) =>
    toArray(deltas).reduce(applyStep, /** @type {Nullable<readonly number[]>} */ (base))

/**
 * Where the base of a delta entry begins, or `null` where this pack cannot
 * answer for it: an `ofsDelta` whose distance back overshoots the pack's header,
 * or a `refDelta` naming an id the index does not hold.
 *
 * Only a delta has a base, which is why the type says so rather than the body:
 * an entry read whole ends the chain, and a `null` for it would be a case with
 * no caller.
 *
 * @type {(idx: Idx, at: number, e: _Delta) => Nullable<number>}
 */
const baseAt = (idx, at, e) => {
    if (e.kind === 'refDelta') { return offsetOf(idx)(e.baseId) }
    const back = at - e.baseBack
    // The distance must land where an entry begins, which is the same check the
    // id gets one line above — `offsetOf` answers an entry's offset or nothing,
    // and a distance has to be held to that too. Without it a crafted distance
    // pointing into the middle of another entry is framed to the next indexed
    // offset and inflated, and bytes planted there that happen to hash to the id
    // asked for would be answered as the object. Git refuses the same pack with
    // `bad offset for revindex` — see {@link holdsEntryAt}, which has the
    // measurement.
    return back < headerBytes || !holdsEntryAt(idx)(back) ? null : back
}

/** @type {(e: _Delta, at: number) => string} */
const missingBase = (e, at) =>
    e.kind === 'refDelta'
        ? `names a base ${hexText(e.baseId)} the pack does not hold`
        : `names a base at ${at - e.baseBack} where no entry begins`

/**
 * What one link of the chain does with the entry it read: end the walk at an
 * object, or collect a delta and name the base as the item to read next.
 *
 * The declared size is checked against the bytes that came back, which is the
 * one statement the entry makes about its own stream. A pack whose entry says
 * one length and holds another is corrupt in a way that costs nothing to catch
 * here and would otherwise be caught as a delta that does not apply, or not at
 * all — an object read whole is answered as it is, and the hash check above this
 * is what would refuse it.
 *
 * @type {(idx: Idx, path: string, at: number, chain: _Chain, e: Entry, data: readonly number[]) => Effect<never, readonly [_Chain, List<number>], IoChannel>}
 */
const advance = (idx, path, at, chain, e, data) => {
    const refuse = entryRefusal(path, at)
    if (data.length !== e.size) {
        return refuse(`inflates to ${data.length} bytes, not the ${e.size} its header declares`)
    }
    if (e.kind === 'object') {
        const payload = applied(chain.deltas, data)
        return payload === null
            ? refuse('holds a delta that does not apply to its base')
            : pureOk(/** @type {const} */ ([{ ...chain, found: { type: e.type, payload } }, null]))
    }
    if (chain.links >= idx.ids.length) {
        return refuse(`begins a chain of more deltas than the pack's ${idx.ids.length} objects`)
    }
    const base = baseAt(idx, at, e)
    return base === null
        ? refuse(missingBase(e, at))
        : pureOk(/** @type {const} */ ([
            { deltas: concat([data])(chain.deltas), links: chain.links + 1, found: null },
            [base],
        ]))
}

/**
 * One link of the chain: the entry at `at`, read through its exact window,
 * framed, inflated, and either the answer or the base to read next.
 *
 * Everything the link needs is a leading parameter, so it closes over nothing
 * the walk carries.
 *
 * @type {(path: string, oidBytes: OidBytes, idx: Idx, packLength: number) => (at: number) => (chain: _Chain) => Effect<ReadBytes | Inflate, readonly [_Chain, List<number>], IoChannel>}
 */
const linkOf = (path, oidBytes, idx, packLength) => at => chain => {
    const end = endOf(idx, oidBytes, packLength, at)
    if (end === null) { return entryRefusal(path, at)('is not where an entry begins') }
    const window = history(mapStep(readBytes(path, at, end - at), v => byteArray(toBytes(v))))
    const got = historyStep(window, w => framedAt(oidBytes, path, at, w))
    return step(got, ([[e, data]]) => advance(idx, path, at, chain, e, data))
}

/** A chain with nothing read yet. */
const chainStart = /** @type {_Chain} */ ({ deltas: null, links: 0, found: null })

/**
 * The code a `.pack` is refused with when it is not the pack its index belongs
 * to: a signature that is not `PACK`, a version this does not read, an object
 * count that is not the index's, a trailing checksum that is not the one the
 * index recorded, or a file too short to hold a header and a checksum at all.
 */
export const packFileCode = /** @type {const} */ ('ERR_PACK_FILE')

/**
 * Whether the pack's framing agrees with the index that named it, and its
 * length once it does.
 *
 * @type {(path: string, oidBytes: OidBytes, idx: Idx, size: number, front: readonly number[], tail: readonly number[]) => Effect<never, number, IoChannel>}
 */
const agrees = (path, oidBytes, idx, size, front, tail) => {
    /** @type {(what: string) => Effect<never, never, IoChannel>} */
    const refuse = what => pureError(ioError({ code: packFileCode, message: `${path} ${what}` }))
    const h = tryHeader(front)
    if (h === null) { return refuse('is no pack file') }
    if (h.count !== idx.ids.length) {
        return refuse(`holds ${h.count} objects where its index names ${idx.ids.length}`)
    }
    return toVec(tail) === idx.packChecksum
        ? pureOk(size)
        : refuse(`does not match the index, whose pack checksum is ${hexText(idx.packChecksum)}`)
}

/**
 * The pack's length, once the file has been checked against the index that named
 * it: its header read, its object count compared, and its trailing checksum
 * compared with the one the index recorded.
 *
 * **Git checks all four when it opens a pack to read an object**, and each costs
 * a few bytes rather than a hash. Measured on 2.43.0 by damaging one thing at a
 * time in a pack and asking `git cat-file -p` for an object in it:
 *
 * | damage | Git |
 * | --- | --- |
 * | the signature | `is not a GIT packfile` |
 * | the version word | `is version 9 and not supported` |
 * | the object count | `claims to have 10 objects while index indicates 3 objects` |
 * | the trailing checksum | `does not match index` |
 *
 * An earlier revision of this module skipped all four, arguing that verifying a
 * pack means hashing it and that `fjs/git/store`'s hash check catches a
 * mismatched pair anyway. The first half confused two different checks: nothing
 * here hashes the pack, and the index already carries the checksum the pack ends
 * with, so comparing them is a read of an id's width at a known offset. The
 * second half was true and not the point — an object that hashes to the id asked
 * for is that object, so what was lost was not a wrong answer but the report
 * that the repository is damaged, which is the one thing a reader of a corrupt
 * pack must not swallow.
 *
 * Three reads a pack rather than three a link: the header and the trailer are the
 * file's, not an entry's, so a delta chain pays for them once. Git pays once per
 * *open* and keeps the pack mapped; nothing here caches, so a reader that walks
 * many objects pays per object — which the index read above already dominates.
 *
 * @type {(path: string, oidBytes: OidBytes, idx: Idx) => Effect<Stat | ReadBytes, number, IoChannel>}
 */
const framingOf = (path, oidBytes, idx) => {
    const sized = history(mapStep(stat(path), s => s.size))
    const front = historyStep(sized, size => size < headerBytes + oidBytes
        ? pureError(ioError({
            code: packFileCode,
            message: `${path} is ${size} bytes, too short to be a pack file`,
        }))
        : mapStep(readBytes(path, 0, headerBytes), v => byteArray(toBytes(v))))
    const back = historyStep(front, (_, size) => mapStep(
        readBytes(path, size - oidBytes, oidBytes),
        v => byteArray(toBytes(v))))
    return step(back, ([tail, head, size]) => agrees(path, oidBytes, idx, size, head, tail))
}

/**
 * The object whose entry begins at `at` in the pack at `path`: the entry and
 * every base behind it, walked, and the deltas applied.
 *
 * The `stat` is one per object read rather than one per link, and it is what the
 * last entry's window needs: a pack ends in its own checksum, so the file's
 * length less an id's width is where the entries stop.
 *
 * @type {(path: string, oidBytes: OidBytes, idx: Idx, at: number) => Effect<Stat | ReadBytes | Inflate, Nullable<Envelope>, IoChannel>}
 */
const objectAt = (path, oidBytes, idx, at) => {
    const checked = framingOf(path, oidBytes, idx)
    const walked = step(checked, n => walkStep(
        pureOk(/** @type {List<number>} */ ([at])),
        chainStart,
        linkOf(path, oidBytes, idx, n)))
    return mapStep(walked, c => c.found)
}

/**
 * One pack of the directory: its index read, and the object where the index
 * holds the id.
 *
 * A pack after the one that answered is not opened — the walk's state is the
 * answer, so a link that already has one performs no command. The `.pack` is the
 * `.idx` under another suffix, which is how Git names the pair and the only way
 * to find one from the other.
 *
 * @type {(pd: string, oidBytes: OidBytes, id: Oid) => (name: string) => (found: Nullable<Envelope>) => Effect<Stat | ReadBytes | Inflate, readonly [Nullable<Envelope>, List<string>], IoChannel>}
 */
const packOf = (pd, oidBytes, id) => name => {
    // Both paths are the pack pair's and neither depends on what the index says,
    // so they are built once per pack rather than once per link of the walk
    // (§3.3).
    const idxPath = under(pd, name)
    const packPath = under(pd, `${name.slice(0, -idxSuffix.length)}${packSuffix}`)
    return found => {
        if (found !== null) { return pureOk(/** @type {const} */ ([found, null])) }
        const idx = idxAt(idxPath, oidBytes)
        const got = step(idx, i => {
            const at = offsetOf(i)(id)
            return at === null
                ? pureOk(/** @type {Nullable<Envelope>} */ (null))
                : objectAt(packPath, oidBytes, i, at)
        })
        return mapStep(got, e => /** @type {const} */ ([e, null]))
    }
}

/**
 * Reads the object an id names from the packs below `dir`, at the repository's
 * width: `null` where no pack there holds it, the `Envelope` where one does, and
 * the channel's where one holds it and cannot answer for it. See the module doc
 * for which failures are which and why.
 *
 * The bytes are not hashed here. `fjs/git/store` does that for whichever file
 * answered, and doing it twice would hash every object read twice.
 *
 * @throws On an id that is not `oidBytes` wide: a caller that mixes the widths
 * has a bug, not a missing object.
 *
 * @type {(dir: string, oidBytes: OidBytes) => (id: Oid) => Effect<Readdir | Stat | ReadBytes | Inflate, Nullable<Envelope>, IoChannel>}
 */
export const tryRead = (dir, oidBytes) => {
    const pd = packDir(dir)
    const bits = BigInt(oidBytes) * 8n
    return id => {
        assert(length(id) === bits, ['not an id of the width', id])
        return walkStep(idxNames(pd), /** @type {Nullable<Envelope>} */ (null), packOf(pd, oidBytes, id))
    }
}
