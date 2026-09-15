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
 * names the rest — see {@link objectsDirs}, which walks them, and
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
 * **Reading packs widens what this asks of its host, and that is a break.** A
 * loose read needs `readFile` and `inflate`; a packed one adds exactly four —
 * `readdir` for the pack directory, `readWhole` for the index, and `stat` and
 * `readBytes` for the pack. The index is read *whole*, since its size is the
 * pack's object count and no `Vec` holds it, and that is one operation and not
 * a fold: `readWhole` opens the path once and reads it to the end, so the
 * chunks it answers are one file's. The pack beside it is read at known offsets
 * instead, which is what `stat` and `readBytes` are for: the length, then the
 * header, the trailer and one entry's window. `readFile` is not among the four —
 * neither pack file goes through it, and the loose path already needed it.
 *
 * Every one of the four is a `NodeOp`, so a program on the node runner notices
 * nothing — what has to grow is an interpreter written for exactly the old set,
 * which a mock or a partial runner is. Both of this repository's own callers
 * were such interpreters and grew four handlers each, which is the measure of
 * what an importer has to do.
 *
 * @module
 *
 * @import { Inflate, IoChannel, ReadBytes, ReadFile, ReadWhole, Readdir, Stat } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Envelope } from '../object/types.ts'
 * @import { Held } from '../packstore/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { catchStep, ioError, mapStep, pureError, pureOk, resultStep, step, walkStep } from '../../effects/module.f.mjs'
import { readFile, readUtf8File } from '../../effects/node/module.f.mjs'
import { join, root, under } from '../../path/module.f.mjs'
import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { length, uint } from '../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { tryOidBytes } from '../config/module.f.mjs'
import { tryRead as readLoose } from '../loose/module.f.mjs'
import { hexText, of } from '../oid/module.f.mjs'
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
 * What {@link alternateLine} answers for a line naming a byte this layer cannot
 * spell, told from a path by identity rather than by its text — a path may be
 * any string at all, so no string could stand for a refusal.
 */
const refused = /** @type {const} */ (['refused'])

/**
 * One line of an `objects/info/alternates`, unquoted where it is quoted, or
 * `null` where the line names nothing: it is empty, or it is a comment.
 *
 * Every rule here was measured on Git 2.43.0, by writing the line into a
 * borrower's alternates file and asking `git cat-file -p` for a blob only the
 * donor holds:
 *
 * - **A line beginning `#` is a comment**, and is skipped without being tried
 *   as a path — a nonexistent directory prints `error: unable to normalize
 *   alternate object path: …` where the comment prints nothing at all, which is
 *   how the two are told apart from outside.
 * - **An empty line is skipped.**
 * - **A colon is not a separator.** A line of two paths joined by one is tried
 *   as a single path, and the error names the whole colon-joined string. The
 *   separator is the newline and nothing else — it is
 *   `GIT_ALTERNATE_OBJECT_DIRECTORIES`, the environment variable, that splits
 *   on `:`, not this file.
 * - **A line beginning `"` is C-quoted**, and its escapes are decoded: a line of
 *   `"/no\tsuch"` gives `error: object directory /no<TAB>such does not exist`,
 *   a real tab rather than a backslash and a `t`.
 * - **An unterminated quote is not a quoted line at all.** `"/some/path` with no
 *   closing quote is taken verbatim, leading `"` included, and resolved as a
 *   relative path — measured, the error named `…/borrower/.git/objects/"/some/path`.
 *   So the unquoting is attempted and the line used as it stands where it does
 *   not succeed, which is why this answers the raw line rather than a refusal.
 *
 * @type {(line: string) => Nullable<string | typeof refused>}
 */
const alternateLine = line => {
    if (line.length === 0 || line.startsWith('#')) { return null }
    if (!line.startsWith('"')) { return line }
    const u = unquoted(line)
    if (u === null) { return line }
    const [text, high] = u
    return high ? refused : text
}

/**
 * The single-character escapes Git's own `unquote_c_style` decodes, as a map
 * from the character after the backslash to the byte it means.
 */
const escapes = /** @type {Readonly<Record<string, string>>} */ ({
    a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v',
    '"': '"', '\\': '\\',
})

/**
 * Whether `c` is one of the eight octal digits an escape may be written in.
 *
 * @type {(c: string) => boolean}
 */
const isOctal = c => c >= '0' && c <= '7'

/**
 * The three octal digits at `i` as the byte they name, or `null` where they are
 * not three octal digits.
 *
 * @type {(line: string, i: number) => Nullable<number>}
 */
const octalAt = (line, i) =>
    i + 2 < line.length && isOctal(line[i]) && isOctal(line[i + 1]) && isOctal(line[i + 2])
        ? parseInt(line.slice(i, i + 3), 8)
        : null

/**
 * A C-quoted line decoded and whether its escapes named a byte above ASCII, or
 * `null` where it is not a quoted line — an unterminated quote, an escape that
 * is not a character Git decodes, or a short octal escape.
 *
 * **The byte is reported from the decoding and not from the text**, because only
 * an escape this actually consumed names one. A `\377` in a comment, in an
 * unquoted line, or after the closing quote is four ordinary characters that Git
 * reads as a path, and a scan over the raw line would refuse all three. A
 * non-ASCII *character* in the line is not one either: it is already UTF-8, the
 * host writes back the bytes it came from, and the whole-file check has passed
 * it — see {@link alternatesCode}.
 *
 * `null` is not a refusal here: {@link alternateLine} takes the line verbatim
 * instead, because that is what Git does with a line whose unquoting fails.
 *
 * **Text after the closing quote is not such a failure.** The quote ends the
 * path and the remainder is ignored: measured on Git 2.43.0 with a borrower
 * holding nothing of its own, a line of `"<donor>"junk` printed the donor's blob
 * at exit 0 — while also reporting a second entry Git made of the remainder, a
 * meaning this does not invent for it.
 *
 * @type {(line: string) => Nullable<readonly [string, boolean]>}
 */
const unquoted = line => {
    let out = ''
    let high = false
    let i = 1
    while (true) {
        if (i === line.length) { return null }
        const c = line[i]
        if (c === '"') { return [out, high] }
        if (c !== '\\') {
            out += c
            i += 1
            continue
        }
        if (i + 1 === line.length) { return null }
        const e = line[i + 1]
        const one = escapes[e]
        if (one !== undefined) {
            out += one
            i += 2
            continue
        }
        const v = octalAt(line, i + 1)
        if (v === null) { return null }
        out += String.fromCharCode(v)
        high = high || v > 0x7F
        i += 4
    }
}

/**
 * The object directories an `objects/info/alternates` names, in the order it
 * names them, or `null` where a line names a path this layer cannot spell.
 *
 * **An absolute entry names a directory on its own** and a relative one is read
 * below the `objects/` directory holding the file — not the repository and not
 * the process. Measured on Git 2.43.0: a borrower whose file reads
 * `../../../donor/.git/objects` reads the donor, and
 * `borrower/.git/objects/../../..` is the directory the two repositories sit in.
 * The same holds one level down — a donor's own alternates file resolves against
 * the donor's `objects/`, measured with a three-deep chain.
 *
 * **The joined path is not folded**, which is the difference between a path and
 * a string about a path. `..` after a symlink means the link *target's* parent
 * and not the directory the link sits in, so folding it away asks about a
 * directory nobody named. Measured on Git 2.43.0 with `link -> <donor>/.git` and
 * an entry of `<dir>/link/../.git/objects`: Git read the donor's blob, where the
 * folded spelling names `<dir>/.git/objects`, which does not exist. Leaving the
 * path as written hands the traversal to the host, which is the only thing that
 * can do it — and it is why a cycle is bounded by {@link maxBorrowDepth} rather
 * than by the spelling of a path.
 *
 * A file with no trailing newline names its last directory all the same,
 * measured.
 *
 * @type {(od: string, text: string) => Nullable<readonly string[]>}
 */
export const alternatesIn = (od, text) => {
    const named = text.split('\n').map(alternateLine)
    if (named.includes(refused)) { return null }
    return /** @type {readonly string[]} */ (named.filter(l => l !== null && l !== refused))
        .map(l => root(l) === '' ? under(od, l) : l)
}

/**
 * The code an `objects/info/alternates` is refused with when its bytes are not
 * UTF-8.
 *
 * **A path this layer cannot spell is refused rather than approximated.** Every
 * effect here takes a path as a string, and the decoder answers `ÿ` for a lone
 * `0xFF` rather than refusing, so a file naming a directory in some other
 * encoding would decode to a *different*, existing-or-not directory and the
 * store would quietly fail to find the objects that directory holds. Git has no
 * such trouble: the file is bytes to it and it opens what it is given. Carrying
 * byte paths through the effects is the fix and is not this module's to make —
 * [`todo/byte-paths.md`](../todo/byte-paths.md) records it — so until then the
 * store says it cannot look rather than looking somewhere else.
 */
export const alternatesCode = /** @type {const} */ ('ERR_ALTERNATES_ENCODING')

/**
 * The message beside {@link alternatesCode}: the file that is not UTF-8.
 *
 * @type {(path: string) => string}
 */
export const alternatesMessage = path => `${path} is not UTF-8`

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
 * The text of an `objects/info/alternates`, refusing it where its bytes are not
 * UTF-8.
 *
 * The bytes are decoded and encoded again and the two compared, because the
 * decoder does not refuse: a lone `0xFF` comes back as `ÿ`, a character whose
 * UTF-8 is two bytes, so a round trip that does not give the file back is
 * exactly a file this layer cannot spell. See {@link alternatesCode}.
 *
 * @type {(p: string) => Effect<ReadFile, string, IoChannel>}
 */
const alternatesText = p => step(readFile(p), v => {
    const t = utf8ToString(v)
    const again = utf8(t)
    return length(again) === length(v) && uint(again) === uint(v)
        ? pureOk(t)
        : pureError(ioError({ code: alternatesCode, message: alternatesMessage(p) }))
})

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
 * Whether a failure is this module's own refusal of an alternates file, which is
 * the one an unusable borrowing may not be confused with. See {@link
 * borrowedBy}.
 *
 * @type {(c: IoChannel) => boolean}
 */
const isAlternates = c => c[0] === 'ioError' && c[1].code === alternatesCode

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
 * The one failure that is not a skip is {@link alternatesCode}, which this
 * module raises itself: the file was read and names a path this layer would
 * spell wrongly, and looking somewhere else is the answer it must not give.
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
    const p = alternatesPath(od)
    const text = catchStep(
        alternatesText(p),
        c => isAlternates(c) ? pureError(c) : pureOk(''))
    return step(text, t => {
        const named = alternatesIn(od, t)
        // `null` is the refusal and not an empty list: the file was read and
        // names a path this layer would spell wrongly, so passing it over would
        // be the silence the whole check exists to prevent.
        return named === null
            ? pureError(ioError({ code: alternatesCode, message: alternatesMessage(p) }))
            : pureOk(/** @type {const} */ ([
                kept,
                named.map(n => /** @type {const} */ ([n, depth + 1])),
            ]))
    })
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
 * The repository's id width, from its `config`: 20 bytes for SHA-1, 32
 * for SHA-256, or `null` where the file is one Git refuses — a format it
 * does not know, the extension under `repositoryformatversion = 0`, an
 * extension Git does not know, a boolean extension whose value is none, a
 * bad line. A `config` that cannot be read is the channel's, since a
 * directory without one is no repository.
 *
 * @type {(dir: string) => Effect<ReadFile, Nullable<OidBytes>, IoChannel>}
 */
export const oidBytes = dir => mapStep(readUtf8File(under(dir, 'config')), tryOidBytes)

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
 * What one object directory answers for an id: its loose file, or its packs
 * where that is anything but the object.
 *
 * A `Result` and not an error, because none of the three things short of the
 * object ends the search — the next directory may hold it — and each is still an
 * answer once every directory has been asked.
 *
 * Everything it needs is a leading parameter, so the step closes over nothing
 * the walk carries (§3.3).
 *
 * @type {(idOf: (type: ObjectType, payload: Bytes) => Oid, oidBytes: OidBytes, id: Oid) => (od: string) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes | Inflate, Result<Nullable<Envelope>, IoChannel>, IoChannel>}
 */
const inOne = (idOf, oidBytes, id) => od => {
    const p = loosePath(od, id)
    // `resultStep` and not `resultMapStep`: the answer is wanted as a *value* and
    // not lifted back into the channel, because none of the three things short of
    // the object ends the search here.
    const loose = resultStep(readLoose(p), r => pureOk(checkedAt(idOf, p, id)(r)))
    return step(loose, r => r[0] === 'ok' && r[1] !== null
        ? pureOk(r)
        : resultStep(readPacked(od, oidBytes)(id), h => pureOk(packedOr(idOf, id, r)(h))))
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
 * @type {(idOf: (type: ObjectType, payload: Bytes) => Oid, oidBytes: OidBytes, id: Oid) => (od: string) => (found: Nullable<Result<Nullable<Envelope>, IoChannel>>) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes | Inflate, readonly [Nullable<Result<Nullable<Envelope>, IoChannel>>, List<string>], IoChannel>}
 */
const storeOf = (idOf, oidBytes, id) => od => found => {
    if (found !== null && found[0] === 'ok' && found[1] !== null) {
        return pureOk(/** @type {const} */ ([found, null]))
    }
    return mapStep(
        inOne(idOf, oidBytes, id)(od),
        r => /** @type {const} */ ([
            r[0] === 'ok' && r[1] !== null ? r : found ?? r,
            null,
        ]))
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
 * @throws On an id that is not `oidBytes` wide: a caller that mixes the
 * widths has a bug, not a missing object.
 *
 * @type {(ods: readonly string[], oidBytes: OidBytes) => (id: Oid) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes | Inflate, Nullable<Envelope>, IoChannel>}
 */
export const readIn = (ods, oidBytes) => {
    const idOf = of(oidBytes)
    const bits = BigInt(oidBytes) * 8n
    return id => {
        assert(length(id) === bits, ['not an id of the width', id])
        const walked = walkStep(
            pureOk(ods),
            /** @type {Nullable<Result<Nullable<Envelope>, IoChannel>>} */ (null),
            storeOf(idOf, oidBytes, id))
        return step(walked, found => {
            const r = found ?? /** @type {Result<Nullable<Envelope>, IoChannel>} */ (ok(null))
            return r[0] === 'error' ? pureError(r[1]) : pureOk(r[1])
        })
    }
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
 * @throws On an id that is not `oidBytes` wide: a caller that mixes the
 * widths has a bug, not a missing object.
 *
 * @type {(dir: string, oidBytes: OidBytes) => (id: Oid) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes | Inflate, Nullable<Envelope>, IoChannel>}
 */
export const tryRead = (dir, oidBytes) => {
    const dirs = objectsDirs(dir)
    const bits = BigInt(oidBytes) * 8n
    return id => {
        // Asked here as well as in `readIn`, because the effect below is not run
        // until it is stepped: a caller that hands over an id of the wrong width
        // has a bug now, not one command later.
        assert(length(id) === bits, ['not an id of the width', id])
        return step(dirs, ods => readIn(ods, oidBytes)(id))
    }
}
