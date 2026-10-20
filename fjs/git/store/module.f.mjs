/**
 * The object store: from an id to the object it names, checked. A caller
 * that has an id — from a ref, from a `tree` or `parent` header, from a
 * tree entry — asks here and gets the `Envelope`, or a refusal; nothing
 * above this module spells a path under `objects/`, and nothing above it
 * trusts a file name, since every object read is hashed with
 * [`fjs/git/oid`](../oid/module.f.mjs)'s `of` and refused where the hash
 * is not the id asked for.
 *
 * Both places an object lives are read, in every object directory the
 * repository has: the loose file at {@link objectPath}, and the packs below
 * `objects/pack/` through
 * [`fjs/git/packstore`](../packstore/module.f.mjs), which is where
 * `git clone` and `git gc` put nearly everything. The repository's own
 * `objects/` is the first such directory and its `objects/info/alternates`
 * names the rest, as [`fjs/git/alternates`](../alternates/module.f.mjs)
 * decodes it — see {@link objectsDirs}, which walks them, and
 * {@link readIn}, which reads over the list. The caller gives the common
 * directory, `.git` for a main worktree; finding it from a worktree of any
 * kind is [`fjs/git/repo`](../repo/module.f.mjs)'s `tryCommonDir`.
 * Walking from a commit to the blob a path names is
 * [`fjs/git/walk`](../walk/module.f.mjs), over this reader or any other.
 *
 * **The loose file is read first, and a pack answers for it where it cannot.**
 * Git asks its packs before the loose path, so an object that is both packed
 * and loose comes from the pack — measured on Git 2.43.0: with a file of
 * garbage planted at a packed object's loose path, `git cat-file -p` printed
 * the object and only `git fsck` complained about the file. The same answers
 * come out of the other order, since an object is the same object wherever it
 * is stored and the hash below checks whichever copy answered, and this order
 * is the cheaper one: an index is hashed whole when it is opened, so asking
 * the packs first would pay that on every read of a repository whose objects
 * are loose. So anything but a good loose object — no file, no zlib stream,
 * bytes that are no object, bytes that hash to another id — tries the packs,
 * and what the loose read said stands only where no pack holds the id.
 *
 * **What this asks of its host.** A loose read needs `readWhole`, which opens the
 * file once and answers the chunks it holds; a packed one adds `readdir` for the
 * pack directory, `stat` and `readBytes` for the pack, and the index is read by
 * `readWhole` too, since its size is the pack's object count and no `Vec` holds
 * it — one operation and not a fold, so the chunks it answers are one file's.
 * The pack is read at known offsets instead, which is what `stat` and
 * `readBytes` are for: the length, then the header, the trailer and the windows
 * of an entry. `readFile` is for the configuration and the alternates, and
 * `inflate` is not asked for at all: the objects are inflated by
 * [`fjs/zlib/inflate`](../../zlib/inflate/module.f.mjs), which is pure. The
 * host's `inflate` effect, which answered one `Vec` of 128 KiB at most for one of
 * the same, refused every object over that length — about one in a hundred in
 * this repository's own history; none is refused for its length now, though a delta
 * chain is held to a ceiling (see [`fjs/git/pack`](../pack/module.f.mjs)).
 *
 * Each of these is a `NodeOp`, so a program on the node runner notices nothing.
 * What has to grow is an interpreter written for exactly an older set, which a
 * mock or a partial runner is: a loose object is now one `readWhole` where it was
 * a `readFile` and an `inflate`.
 *
 * @module
 *
 * @import { IoChannel, ReadBytes, ReadFile, ReadWhole, Readdir, Stat } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Entry } from '../config/types.ts'
 * @import { Envelope } from '../object/types.ts'
 * @import { Held } from '../packstore/types.ts'
 * @import { _Outcome } from './private.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { catchStep, ioError, mapStep, pureError, pureOk, resultStep, step, walkStep } from '../../effects/module.f.mjs'
import { namesNothing, readUtf8File } from '../../effects/node/module.f.mjs'
import { join, under } from '../../path/module.f.mjs'
import { compose } from '../../types/function/module.f.js'
import { map } from '../../types/nullable/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { alternatesIn } from '../alternates/module.f.mjs'
import { lastBool, lastInt, lastValue, tryEntries, values } from '../config/module.f.mjs'
import { tryRead as readLoose } from '../loose/module.f.mjs'
import { hexText, of, ofWidth } from '../oid/module.f.mjs'
import { tryRead as readPacked } from '../packstore/module.f.mjs'

/**
 * Where a loose object lives: `objects/`, a directory named by the first
 * two hex digits of the id, a file named by the rest.
 *
 * Joined below `dir` with {@link under} rather than by writing the
 * separator, because `dir` is the caller's and a directory that already
 * ends in one must not get another: `/` and `//` are two roots, so a `dir`
 * of `/` would otherwise name `objects/` under the UNC root instead of the
 * POSIX one.
 *
 * @type {(dir: string) => (id: Oid) => string}
 */
export const objectPath = dir => id => loosePath(objectsDir(dir), id)

/**
 * The same path from the `objects/` directory itself: a directory named by the
 * first two hex digits of the id, a file named by the rest.
 *
 * **The key is the `objects/` directory and not the repository**, because an
 * `objects/info/alternates` names object directories directly — see
 * {@link objectsDirs}. {@link objectPath} is this one below `objects/`, which is
 * what a caller holding a repository has.
 *
 * @type {(od: string, id: Oid) => string}
 */
const loosePath = (od, id) => {
    const h = hexText(id)
    return under(od, join(h.slice(0, 2), h.slice(2)))
}

/**
 * A repository's own object directory: `objects/` below it.
 *
 * Joined with {@link under} for the reason {@link objectPath} gives.
 *
 * @type {(dir: string) => string}
 */
export const objectsDir = dir => under(dir, 'objects')

/**
 * Where an object directory records the stores it borrows from.
 *
 * @type {(od: string) => string}
 */
const alternatesPath = od => under(od, join('info', 'alternates'))

/**
 * The code an object is refused with when the bytes at its path hash to
 * another id: corruption, or a file put where it does not belong, and
 * either way not the object asked for. The channel's, beside the codes
 * the host gives a file it cannot read, since a caller that asked for an
 * object by id has one question and both are its answer.
 */
export const objectIdCode = /** @type {const} */ ('ERR_OBJECT_ID')

/**
 * The message beside {@link objectIdCode}: the path read, and the id its
 * bytes have.
 *
 * @type {(path: string, actual: string) => string}
 */
export const objectIdMessage = (path, actual) => `${path} holds the object ${actual}`

/**
 * How many borrowings deep the search goes: six, which is where Git stops.
 *
 * Measured on Git 2.43.0 with chains of one to nine links, each repository
 * borrowing from the next and only the last holding the blob: six links answer,
 * and at seven `git cat-file -p` prints `error: <the sixth>: ignoring alternate
 * object stores, nesting too deep` and exits 128. So a directory reached at this
 * depth is searched and its *own* borrowings are not followed.
 *
 * **The stores above the limit still answer**, which is why this is a bound on
 * the walk and not a refusal. Measured with an object written into the store one
 * link away while the chain ran seven deep: Git printed the same error and then
 * the object, at exit 0. The too-deep tail is dropped and everything above it is
 * read.
 *
 * It is also what ends a cycle no string comparison can see. An entry of `sub`
 * where `objects/sub` is a symlink to `objects` names a new path every hop —
 * `objects/sub`, `objects/sub/sub` — so {@link borrowedBy}'s check never fires;
 * measured on Git 2.43.0, Git ends that walk too rather than following it for
 * ever.
 */
export const maxBorrowDepth = /** @type {const} */ (6)

/**
 * One object directory of the search, and the directories it borrows from, to be
 * searched after it.
 *
 * **A directory already seen is skipped**, which ends the cycle a reader can
 * see: measured on Git 2.43.0 with a borrower and a donor naming each other,
 * `git cat-file -p` answers rather than looping, so Git does not follow one
 * twice either. A cycle spelled differently at every hop is ended by
 * {@link maxBorrowDepth} instead.
 *
 * **A borrowing that cannot be consulted contributes nothing.** A missing
 * `alternates` file is the ordinary case, since almost no repository has one;
 * but an entry naming a regular file gives `ENOTDIR` for the same read, and an
 * unreadable directory gives `EACCES`, and Git treats all three alike. Measured
 * on Git 2.43.0 with an entry naming a regular file: `git cat-file -p` prints
 * `error: object directory <file> does not exist; check
 * .git/objects/info/alternates` and then answers the object, at exit 0. An
 * earlier revision failed the whole store on anything but `ENOENT`, which made a
 * repository Git reads unreadable here.
 *
 * **Every failure is a skip**, with no exception. An earlier revision kept one —
 * a file naming a path this layer cannot spell — and that refusal cost more
 * than the case it caught: see {@link alternatesIn}.
 *
 * **This is the one place a reader is quieter than Git**, which prints `error:`
 * and carries on. There is no channel here to print on, so an unusable borrowing
 * is passed over in silence; giving a warning somewhere to go is
 * [`todo/byte-paths.md`](../todo/byte-paths.md)'s neighbour rather than this
 * module's to invent.
 *
 * @type {(at: readonly [string, number]) => (seen: readonly string[]) => Effect<ReadFile, readonly [readonly string[], List<readonly [string, number]>], IoChannel>}
 */
const borrowedBy = ([od, depth]) => seen => {
    if (seen.includes(od)) { return pureOk(/** @type {const} */ ([seen, null])) }
    const kept = /** @type {readonly string[]} */ ([...seen, od])
    if (depth === maxBorrowDepth) { return pureOk(/** @type {const} */ ([kept, null])) }
    const text = catchStep(readUtf8File(alternatesPath(od)), () => pureOk(''))
    return mapStep(text, t => /** @type {const} */ ([
        kept,
        alternatesIn(od, t).map(n => /** @type {const} */ ([n, depth + 1])),
    ]))
}

/**
 * The object directories a repository's reads search, in order: its own
 * `objects/` first, then each directory its `objects/info/alternates` names,
 * then each of *those* directories' own, and so on to {@link maxBorrowDepth},
 * with a directory already reached skipped.
 *
 * **An alternate is a whole object store and not a loose-object directory.**
 * Measured on Git 2.43.0: a borrower reads the donor's objects after the donor
 * was `git repack -adq`'d into a single pack, so the packs of a borrowed store
 * answer as its loose files do. That is why this answers directories and the
 * read below asks each of them both questions.
 *
 * The borrowings of one directory are searched before the next directory's, so
 * the order is the file's with each store's own inserted after it. The order
 * cannot change which object comes back, since an id names its content and the
 * read checks the hash; it decides only which file is opened first.
 *
 * @type {(dir: string) => Effect<ReadFile, readonly string[], IoChannel>}
 */
export const objectsDirs = dir => walkStep(
    pureOk([/** @type {readonly [string, number]} */ ([objectsDir(dir), 0])]),
    /** @type {readonly string[]} */ ([]),
    borrowedBy)

/**
 * The extensions Git 2.43 reads whatever the version says, as it
 * lowercases them.
 *
 * @type {readonly string[]}
 */
const v0Extensions = ['noop', 'preciousobjects', 'partialclone', 'worktreeconfig']

/**
 * The extensions Git 2.43 reads only under `repositoryformatversion = 1`.
 * Under version 0 a file holding one is refused — `repo version is 0, but
 * v1-only extension found` — and `objectformat`, the key
 * {@link tryOidBytes} is for, is one of them.
 *
 * @type {readonly string[]}
 */
const v1OnlyExtensions = ['noop-v1', 'objectformat']

/**
 * The extensions Git 2.43 knows. Under `repositoryformatversion = 1` Git
 * refuses a repository whose `[extensions]` holds any other key —
 * `unknown repository extension found` — since an extension changes how
 * the repository is read and a reader that ignored one would read it
 * wrongly; {@link tryOidBytes} refuses it for the same reason.
 * `compatobjectformat` is not among them: Git 2.43 refuses it, a later Git
 * knows it, and a newer Git knowing more of them is what keeps this list a
 * version's. Under version 0 an unknown key is ignored, as Git ignores it.
 *
 * @type {readonly string[]}
 */
const knownExtensions = [...v0Extensions, ...v1OnlyExtensions]

/** The hash `extensions.objectFormat` names where the id is 32 bytes wide. */
const sha256 = /** @type {const} */ ('sha256')

/**
 * Whether a value names a hash Git knows, which is what
 * `extensions.objectFormat` must hold. A comparison and not a lookup in a
 * map of the two: a value is any text the file holds, and `toString` or
 * `__proto__` would find a key of `Object.prototype` in an ordinary object
 * and pass for a hash's name.
 *
 * @type {(value: string) => boolean}
 */
const isFormat = value => value === 'sha1' || value === sha256

/**
 * The version of a file that names none: what Git starts its
 * `repository_format` at and leaves there when no
 * `core.repositoryformatversion` sets it. It is no version rather than
 * version 0, and the difference shows — a file holding
 * `extensions.objectFormat` and no version at all is a SHA-1 repository
 * Git opens, where the same file saying `repositoryformatversion = 0` is
 * one it refuses.
 *
 * A file that spells this number is read as though it named no version at
 * all, since Git tells the two apart by the number and nothing else: on
 * reading `-1` it throws the format it read away and starts again, so
 * `repositoryformatversion = -1` beside `objectFormat = sha256` is a
 * SHA-1 repository where `-2` beside the same key is a SHA-256 one.
 */
const noVersion = /** @type {const} */ (-1n)

/**
 * The extensions whose value Git reads as a boolean, refusing a
 * repository whose value is none — `bad boolean config value`. The
 * others take a word: `objectformat` a hash's name, `partialclone` a
 * remote's, and `noop` and `noop-v1` anything, since Git reads neither.
 *
 * @type {readonly string[]}
 */
const booleanExtensions = ['preciousobjects', 'worktreeconfig']

/** What every extension's name begins with, the dot included. */
const extensionsPrefix = /** @type {const} */ ('extensions.')

/**
 * The extension an entry names, or `null` where it names none. Git reads
 * the name off the whole variable — `extensions.` and everything after it
 * — so a subsection is part of the name rather than a section of its own:
 * `[extensions "x"]` with `noop` names the extension `x.noop`, which is
 * none Git knows, and under version 1 Git refuses the repository for it.
 *
 * @type {(entry: Entry) => Nullable<string>}
 */
const extensionAt = ([section, key]) =>
    section === 'extensions' ? key
        : section.startsWith(extensionsPrefix) ? `${section.slice(extensionsPrefix.length)}.${key}`
            : null

/**
 * Whether Git 2.43 knows an extension by this name.
 *
 * @type {(ext: string) => boolean}
 */
const isKnownExtension = ext => knownExtensions.includes(ext)

/**
 * Whether it is one Git reads only under `repositoryformatversion = 1`.
 *
 * @type {(ext: string) => boolean}
 */
const isV1OnlyExtension = ext => v1OnlyExtensions.includes(ext)

/**
 * The extension an entry names, as a list of none or one, so a flatMap
 * over the entries is the extensions they name.
 *
 * @type {(entry: Entry) => readonly string[]}
 */
const extensionsOf = entry => {
    const ext = extensionAt(entry)
    return ext === null ? [] : [ext]
}

/**
 * Whether every `[extensions]` value the file holds is one Git reads: a
 * boolean where the extension takes one, and a hash's name where the
 * extension is `objectFormat`, which is case-sensitive as Git reads it. An
 * extension under a subsection is a name Git knows none of, so it has no
 * value Git reads either and none is asked of it.
 *
 * @type {(entries: readonly Entry[]) => boolean}
 */
const extensionValuesRead = entries =>
    booleanExtensions.every(ext => lastBool(entries, 'extensions', ext)[0] === 'ok')
        && values(entries, 'extensions', 'objectformat').every(isFormat)

/**
 * The id width a repository's `config` names, from its entries as
 * [`fjs/git/config`](../config/module.f.mjs)'s `tryEntries` reads them, or
 * `null` where the file is one Git refuses. 32 bytes needs
 * `extensions.objectFormat = sha256` under `repositoryformatversion = 1`,
 * which is what `git init --object-format=sha256` writes; everything else
 * Git opens is 20, the default `git init` writes with no `[extensions]`
 * section at all.
 *
 * Git reads the file a line at a time and judges each value as it comes to
 * it, so these refusals are of any assignment and not only of the last:
 *
 * - A `repositoryformatversion` that spells no number, as `abc` does.
 * - An `objectFormat` naming a hash Git does not know, `SHA256` included,
 *   the value being case-sensitive.
 * - A boolean extension whose value is no boolean.
 *
 * The version that wins is the last, as the last value wins for Git, and
 * it is read as a number rather than as text: `01`, `+1` and `0x1` are
 * version 1, and `1k` is 1024. What the version then decides:
 *
 * - Over 1 refuses the file — `Expected git repo version <= 1`.
 * - 1 or more refuses an extension Git does not know — `unknown repository
 *   extension found`. A subsection is part of an extension's name rather
 *   than a section of its own, so `[extensions "x"]` names no extension
 *   Git knows whatever key it holds.
 * - 0 refuses a key Git reads only under version 1, `objectFormat` among
 *   them — `repo version is 0, but v1-only extension found`.
 * - {@link noVersion}, which a file naming no version has and a file
 *   spelling `-1` has too, refuses neither and gives up the format it
 *   read: SHA-1, whatever `objectFormat` said.
 * - Any other version below 0, which Git allows, refuses neither and keeps
 *   the format `objectFormat` named.
 *
 * @type {(entries: readonly Entry[]) => Nullable<OidBytes>}
 */
export const tryOidBytes = entries => {
    if (!extensionValuesRead(entries)) { return null }
    // Each version spells a number or refuses the file, and the last one
    // spells the version; a file that spells none has none.
    const [t, last] = lastInt(entries, 'core', 'repositoryformatversion')
    if (t === 'error') { return null }
    const version = last ?? noVersion
    if (version > 1n) { return null }
    const exts = entries.flatMap(extensionsOf)
    if (version >= 1n && !exts.every(isKnownExtension)) { return null }
    if (version === 0n && exts.some(isV1OnlyExtension)) { return null }
    // The hash is what the last `objectFormat` names whatever the version,
    // since Git reads the key at every one — and nothing, where the format
    // Git read was thrown away.
    // Every `objectFormat` the file holds names a hash, or the file is
    // already refused, so the last one is the repository's and 20 is both
    // the other hash's width and what a file naming no format has.
    return version !== noVersion && lastValue(entries, 'extensions', 'objectformat') === sha256 ? 32 : 20
}

/**
 * The id width a `config` file's text names, or `null` where Git refuses
 * the file: a line it cannot read, or a repository format it does not
 * open.
 *
 * @type {(text: string) => Nullable<OidBytes>}
 */
const widthOf = compose(tryEntries)(map(tryOidBytes))

/**
 * The repository's id width, from its `config`: 20 bytes for SHA-1, 32
 * for SHA-256, or `null` where the file is one Git refuses — a format it
 * does not know, the extension under `repositoryformatversion = 0`, an
 * extension Git does not know, a boolean extension whose value is none, a
 * bad line. A `config` that cannot be read is the channel's, since a
 * directory without one is no repository.
 *
 * @type {(dir: string) => Effect<ReadFile, Nullable<OidBytes>, IoChannel>}
 */
export const oidBytes = dir => mapStep(readUtf8File(under(dir, 'config')), widthOf)

/**
 * What a loose read answers, checked against the id it was asked for: the
 * object where its bytes hash to that id, `null` where they are no object,
 * and {@link objectIdCode} where they hash to another id, with the path
 * read and the id they have. An error from the read is passed on as it is.
 *
 * The id, the path and the hash come first so that the step itself closes
 * over nothing.
 *
 * @type {(idOf: (type: ObjectType, payload: Bytes) => Oid, p: string, id: Oid) => (r: Result<Nullable<Envelope>, IoChannel>) => Result<Nullable<Envelope>, IoChannel>}
 */
const checkedAt = (idOf, p, id) => r => {
    const [tag, e] = r
    if (tag === 'error') { return r }
    if (e === null) { return ok(null) }
    const { type, payload } = e
    const actual = idOf(type, payload)
    return actual === id ? ok(e) : error(ioError({ code: objectIdCode, message: objectIdMessage(p, hexText(actual)) }))
}

/**
 * What a packed read answers, checked the same way: the pack that held the
 * object names the path, so a refusal names the file the bytes came from and not
 * the directory it was found under.
 *
 * Where no pack of this directory holds the id, the loose read's own outcome
 * stands — this directory has nothing, and the next one is asked next.
 *
 * `loose` is a `Result` and not an error, because the three things a loose read
 * can say short of the object are three different answers and each is still the
 * answer once this directory's packs have nothing: no file is its error, bytes
 * that are no object is `null`, and bytes of another object is
 * {@link objectIdCode}.
 *
 * @type {(idOf: (type: ObjectType, payload: Bytes) => Oid, id: Oid, loose: Result<Nullable<Envelope>, IoChannel>) => (r: Result<Nullable<Held>, IoChannel>) => Result<Nullable<Envelope>, IoChannel>}
 */
const packedOr = (idOf, id, loose) => r => {
    const [tag, h] = r
    if (tag === 'error') { return r }
    if (h === null) { return loose }
    return checkedAt(idOf, h.path, id)(ok(h.envelope))
}

/**
 * One directory of the search: its answer where it has the object, and otherwise
 * the first directory's answer kept for the end.
 *
 * **The answer that stands when nothing holds the object is the repository's
 * own.** The three things a read can say short of the object are three different
 * answers — no file is its error, bytes that are no object is `null`, bytes of
 * another object is {@link objectIdCode} — and the one worth reporting is about
 * the store that was asked, not about the last store it borrows from. With no
 * alternates there is one directory and this is what the reader did before.
 *
 * @type {(idOf: (type: ObjectType, payload: Bytes) => Oid, oidBytes: OidBytes, id: Oid) => (od: string) => (found: Nullable<_Outcome>) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes, readonly [Nullable<_Outcome>, List<string>], IoChannel>}
 */
const storeOf = (idOf, oidBytes, id) => {
    /**
     * What one object directory answers for the id: its loose file, or its
     * packs where that is anything but the object.
     *
     * A `Result` and not an error, because none of the three things short of
     * the object ends the search — the next directory may hold it — and each is
     * still an answer once every directory has been asked.
     *
     * @type {(od: string) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes, _Outcome, IoChannel>}
     */
    const inOne = od => {
        const p = loosePath(od, id)
        // `resultStep` and not `resultMapStep`: the answer is wanted as a
        // *value* and not lifted back into the channel, because none of the
        // three things short of the object ends the search here.
        const loose = resultStep(readLoose(p), r => pureOk(checkedAt(idOf, p, id)(r)))
        return step(loose, r => {
            if (r[0] === 'ok' && r[1] !== null) { return pureOk(/** @type {_Outcome} */ ([r, false])) }
            // On the loose side, a failure meaning *nothing is at this path* is
            // not a refusal: it is what a store without the object looks like.
            // That is `ENOENT`, and also the `ENOTDIR` of a path whose
            // component is a regular file and the `ELOOP` of one whose links
            // cycle — an alternates entry naming either is a borrowing Git
            // warns about and reads past. Everything else that read can say is
            // a refusal — a hash mismatch, because the file is there and holds
            // something else; a stream that is no zlib stream, because the file
            // is there and is broken; an `EACCES`, because the file may be there
            // and the host will not say. An earlier revision named only the
            // hash mismatch, so a borrowed store's corrupt loose object hid
            // behind the repository's own `ENOENT`; a later one named only
            // `ENOENT`, so an unusable *directory* refused the store.
            const looseRefused = r[0] === 'error' && !namesNothing(r[1])
            return resultStep(readPacked(od, oidBytes)(id), h => {
                const answered = packedOr(idOf, id, r)(h)
                return pureOk(/** @type {_Outcome} */ ([
                    answered,
                    // On the packed side there is no such failure to spare: an
                    // index that names the id has said the store holds it, so
                    // *every* way the read can fail afterwards is a refusal — an
                    // `ENOENT` for the `.pack` beside a readable `.idx` among
                    // them. Which side answered is the question, not which errno
                    // came back; asking the code alone turns that missing pack
                    // into a miss.
                    answered === r ? looseRefused : answered[0] === 'error',
                ]))
            })
        })
    }
    return od => found => {
        if (found !== null && found[0][0] === 'ok' && found[0][1] !== null) {
            return pureOk(/** @type {const} */ ([found, null]))
        }
        return mapStep(
            inOne(od),
            o => /** @type {const} */ ([kept(found, o), null]))
    }
}

/**
 * Which of two outcomes stands: the object, then a refusal, then the first
 * directory's answer.
 *
 * **A refusal outlives a miss, whichever directory it came from.** A borrowed
 * store whose pack cannot answer for an id it holds is corruption, and reporting
 * the repository's own `ENOENT` instead would answer "no such object" for a
 * question that was never answered — the plausible wrong value `fjs/AGENTS.md`
 * forbids. Git says both, in its own way: it prints the borrowed store's failure
 * and then reports the miss. With one channel, the failure is the one worth
 * carrying.
 *
 * **Among misses the first directory's answer stands**, because the three things
 * a read can say short of the object — no file, bytes that are no object, bytes
 * of another object — are about the store that was asked and not about the last
 * store it borrows from. Among refusals the first stands for the same reason.
 *
 * @type {(found: Nullable<_Outcome>, o: _Outcome) => _Outcome}
 */
const kept = (found, o) => {
    if (found === null) { return o }
    const [answer, refusal] = o
    if (answer[0] === 'ok' && answer[1] !== null) { return o }
    return refusal && !found[1] ? o : found
}

/**
 * Reads the object an id names from the object directories `ods`, at the
 * repository's width, and checks it: the loose file or the packs of each,
 * whichever answers, hashed and given back only where the hash is the id, and
 * the same two questions again in each directory the repository borrows from.
 * `null` where nothing holds it as an object — the loose file's bytes are no
 * object and no pack has the id; a file that cannot be read, a stream that is
 * no zlib stream, a pack that cannot answer for an id it holds, and bytes that
 * hash to another id are the channel's, the last as {@link objectIdCode}
 * naming the file the bytes came from.
 *
 * Which file is read first, and what makes the other one answer, is the module
 * doc's; which directories are searched and in what order is
 * {@link objectsDirs}'s; that a pack's own failures are not a miss is
 * [`fjs/git/packstore`](../packstore/module.f.mjs)'s.
 *
 * **A store this reader falls through, Git stops at.** Measured on Git 2.43.0
 * with a file of garbage planted at the borrower's own loose path and a good
 * copy in the alternate: `git cat-file -p` answers `fatal: Not a valid object
 * name` and exits 128, where this reader goes on to the alternate and answers
 * the object. The same rule the loose-then-packs order already had, applied to
 * directories as well — and it is safe here for the reason it is safe there: the
 * bytes that come back are hashed, so what falls through is never a wrong
 * object, only a different copy of the right one. Git is stricter on purpose, so
 * that corruption is noticed rather than worked around; a reader is the wrong
 * place to notice it, and `git fsck` is where that belongs.
 *
 * The width is bound first, so the hash is chosen once for a store and
 * not once per object.
 *
 * @throws As [`fjs/git/oid`](../oid/module.f.mjs)'s `ofWidth` does, on an
 * id that is not `oidBytes` wide.
 *
 * @type {(ods: readonly string[], oidBytes: OidBytes) => (id: Oid) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes, Nullable<Envelope>, IoChannel>}
 */
export const readIn = (ods, oidBytes) => {
    const idOf = of(oidBytes)
    return ofWidth(oidBytes)(id => {
        const walked = walkStep(
            pureOk(ods),
            /** @type {Nullable<_Outcome>} */ (null),
            storeOf(idOf, oidBytes, id))
        return step(walked, found => {
            const r = found === null
                ? /** @type {Result<Nullable<Envelope>, IoChannel>} */ (ok(null))
                : found[0]
            return r[0] === 'error' ? pureError(r[1]) : pureOk(r[1])
        })
    })
}

/**
 * The same, for a repository: its object directories resolved and then read.
 *
 * **This asks for the borrowings once per object.** {@link objectsDirs} is an
 * effect, so a reader built here reads `objects/info/alternates` again for every
 * id it is given — one extra read per object, and a walk from a commit to a blob
 * is many objects. A caller reading more than one object should resolve the
 * directories once and hold {@link readIn} instead, which is why that is the
 * exported pair rather than an implementation detail. Holding the answer *here*
 * would mean a reader that never notices a repository gaining an alternate,
 * which is a cache with no way to spell its own invalidation, so the choice is
 * the caller's to make.
 *
 * @throws As [`fjs/git/oid`](../oid/module.f.mjs)'s `ofWidth` does, on an
 * id that is not `oidBytes` wide.
 *
 * @type {(dir: string, oidBytes: OidBytes) => (id: Oid) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes, Nullable<Envelope>, IoChannel>}
 */
export const tryRead = (dir, oidBytes) => {
    const dirs = objectsDirs(dir)
    // Asked here as well as in `readIn`, because the effect below is not run
    // until it is stepped: a caller that hands over an id of the wrong width
    // has a bug now, not one command later.
    return ofWidth(oidBytes)(id => step(dirs, ods => readIn(ods, oidBytes)(id)))
}
