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
 * @import { _Outcome } from './private.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { catchStep, ioError, mapStep, pureError, pureOk, resultStep, step, walkStep } from '../../effects/module.f.mjs'
import { namesNothing, readUtf8File } from '../../effects/node/module.f.mjs'
import { isDriveLetter, isDriveRoot, join, root, under } from '../../path/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { tryOidBytes } from '../config/module.f.mjs'
import { tryRead as readLoose } from '../loose/module.f.mjs'
import { hexText, isOidOf, of } from '../oid/module.f.mjs'
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
 * An entry as the host will be given it: a path ends at its first `NUL`, because
 * a path is a `NUL`-terminated byte string everywhere this runs.
 *
 * **Not doing this is a refusal and not a miss**, which is why it is worth a
 * function. Node will not carry a `NUL` to the system call at all — every `fs`
 * operation throws `TypeError [ERR_INVALID_ARG_VALUE]`, "must be a string …
 * without null bytes" — and `fjs/effects/node` turns a thrown failure into a
 * channel error carrying that code. `ERR_INVALID_ARG_VALUE` is not `ENOENT`, so
 * {@link inOne} reads it as a store that holds the object and cannot give it up,
 * and the whole read is refused. Git meanwhile reads the donor behind the `NUL`.
 * Ending the path here is what keeps a repository Git reads readable.
 *
 * A `\000` escape is the only way into a quoted line; a raw `0x00` byte is the
 * other road, through a file whose own bytes hold one. Both arrive here as the
 * same character.
 *
 * @type {(entry: string) => string}
 */
const untilNul = entry => {
    const i = entry.indexOf('\u0000')
    return i === -1 ? entry : entry.slice(0, i)
}

/**
 * One line of an `objects/info/alternates`, unquoted where it is quoted and cut
 * at its first `NUL`, or `null` where the line names nothing: it is empty, it is
 * a comment, or nothing is left of it before that `NUL`.
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
 * **Text after the closing quote is dropped, and Git searches it.** Its reading
 * of the remainder is an off-by-one — the suffix becomes a second entry missing
 * its first character — so there is no reading of it to copy, and this takes the
 * quoted path alone. A store named only by that mangled second entry is one this
 * does not reach; see
 * [`todo/alternates-line-quirks.md`](../todo/alternates-line-quirks.md).
 *
 * **A path ends at its first `NUL`**, which is why {@link untilNul} runs last and
 * a line left with nothing is skipped like an empty one. That is not this
 * module's rule but the one both hosts obey — measured on Git 2.43.0, a line of
 * `"<donor>/objects\000x"` read the donor's blob at exit 0, where the controls
 * `"<donor>/objectsx"` and `"<donor>/objects\001x"` both exited 128.
 *
 * @type {(line: string) => Nullable<string>}
 */
const alternateLine = line => {
    if (line.length === 0 || line.startsWith('#')) { return null }
    const path = untilNul(line.startsWith('"') ? unquoted(line) ?? line : line)
    return path === '' ? null : path
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
 * not three octal digits, or name no byte at all.
 *
 * @type {(line: string, i: number) => Nullable<number>}
 */
const octalAt = (line, i) => {
    if (i + 2 >= line.length
        || !isOctal(line[i]) || !isOctal(line[i + 1]) || !isOctal(line[i + 2])) { return null }
    const v = parseInt(line.slice(i, i + 3), 8)
    // `\400` and above name no byte, and Git calls the unquoting failed rather
    // than truncating: measured on Git 2.43.0, a line of `"x\400"` read objects
    // from a directory named `"x\400"` — the whole line, quotes included. So
    // this is `null`, which {@link alternateLine} turns into the raw line.
    return v > 0xFF ? null : v
}

/**
 * A C-quoted line with its escapes decoded, or `null` where it is not a quoted
 * line at all — an unterminated quote, an escape that is not a character Git
 * decodes, or a short octal escape.
 *
 * `null` is not a refusal here: {@link alternateLine} takes the line verbatim
 * instead, because that is what Git does with a line whose unquoting fails.
 *
 * **What comes back is a string of characters, not the bytes Git decoded.** An
 * escape naming a byte above ASCII becomes one character of that value, which
 * the host writes back as the two UTF-8 bytes of it — a different directory than
 * Git looks in. That one is not answerable in this layer, where every path is a
 * string, and is [`todo/byte-paths.md`](../todo/byte-paths.md)'s to fix and
 * [`todo/alternates-line-quirks.md`](../todo/alternates-line-quirks.md)'s to
 * record. A `\000` is different: it decodes to a `\u0000` here and the path
 * ends there, which {@link untilNul} does and which agrees with Git.
 *
 * **Text after the closing quote is not an unquoting failure.** The quote ends
 * the path and the remainder is ignored: measured on Git 2.43.0 with a borrower
 * holding nothing of its own, a line of `"<donor>"junk` printed the donor's blob
 * at exit 0 — while also reporting a second entry Git made of the remainder, a
 * meaning this does not invent for it.
 *
 * @type {(line: string) => Nullable<string>}
 */
const unquoted = line => {
    let out = ''
    let i = 1
    while (true) {
        if (i === line.length) { return null }
        const c = line[i]
        if (c === '"') { return out }
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
        i += 4
    }
}

/**
 * The object directories an `objects/info/alternates` names, in the order it
 * names them.
 *
 * **Every line answers a path, and none is refused.** Two shapes name a place
 * this reader cannot reach — a path spelled in bytes it cannot hold, and the
 * mangled second entry Git makes of text after a closing quote — and an earlier
 * revision refused the whole file for each. That was the wrong trade three times
 * over: the refusal took a repository Git reads and made *all* of it unreadable,
 * the objects the store holds itself included, to avoid a miss on a borrowing
 * nobody writes by hand. Both are ordinary paths now that simply are not found,
 * which is a miss and never a wrong object, since the id is checked against
 * whatever answers. What is left of them is
 * [`todo/alternates-line-quirks.md`](../todo/alternates-line-quirks.md).
 *
 * A third shape *was* on that list and is not any more: a `NUL` inside a path,
 * where the entry would have reached the host whole and been turned down before
 * any lookup. {@link untilNul} ends the path there, as Git and the system call
 * both do, so the reader now looks where Git looks rather than refusing.
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
 * @type {(od: string, text: string) => readonly string[]}
 */
export const alternatesIn = (od, text) => text
    .split('\n')
    .map(alternateLine)
    .filter(l => l !== null)
    .map(l => isAbsolute(od, l) ? l : under(od, l))

/**
 * Whether an entry names a directory on its own rather than one below `od`.
 *
 * **Only a leading `/` is a root everywhere.** A drive and a leading backslash
 * are Windows spellings, and nothing in the line says which system wrote it —
 * but the object directory holding the file does: a repository at
 * `C:/repo/.git/objects` is on a system where drives are roots, and one at
 * `/home/…` or a relative path is not. Both were measured on Git 2.43.0 on
 * POSIX, where each is an ordinary directory name: an entry of `C:` read
 * objects from `objects/C:`, and an entry of `\\x` read them from `objects/\\x`.
 *
 * The entry's own text is what is asked, not {@link root}, which reads a
 * backslash as a separator and would call `\\x` rooted before the question is
 * put.
 *
 * Without that test a POSIX entry of `C:/…` would be handed to the host as an
 * absolute path, and the host would resolve it against the *process* directory —
 * a third place, named by nobody.
 *
 * @type {(od: string, entry: string) => boolean}
 */
const isAbsolute = (od, entry) => entry.startsWith('/')
    || ((entry.startsWith('\\') || isDrive(entry)) && isWindows(od))

/**
 * Whether a path begins with a drive's letter and colon — `C:` and not `/`,
 * and not `1:` or `::` either, which [`fjs/path`](../../path/module.f.mjs)
 * reads as no drive: this asks its {@link isDriveLetter}, so the two readers
 * of one entry cannot disagree about whether it is rooted.
 *
 * No `/` is required after the colon, as Git's `has_dos_drive_prefix` requires
 * none: `C:x` is drive C's current directory to Windows, which is somewhere of
 * its own rather than a name below `od`.
 *
 * @type {(x: string) => boolean}
 */
const isDrive = x => x.length > 1 && x[1] === ':' && isDriveLetter(x[0])

/**
 * Whether an object directory is on a system where a drive and a backslash are
 * roots, read off the directory's own spelling.
 *
 * **A drive root is the only spelling that says so.** No POSIX absolute path has
 * one — a directory named `C:` at the root spells `/C:/…`, whose root is `/` —
 * so `C:/` can only have come from a Windows path.
 *
 * **`//` is not evidence, although a UNC share begins with one.** It is a legal
 * POSIX root too: Linux resolves `//tmp/r` as `/tmp/r`, and measured on Git
 * 2.43.0 a borrower opened through `//<tmp>/b` read a `C:/donor/objects` entry
 * as a name below its own `objects/` and answered the blob at exit 0. A revision
 * that counted `//` as Windows sent that entry to the host unprefixed, where it
 * resolves against the *process* directory — a third place named by nobody,
 * which is the failure the drive-root test exists to prevent. So the ambiguous
 * root is read as the platform that can be measured.
 *
 * What this costs is the mirror case: a Windows store on a UNC share reads a
 * drive-rooted or backslash-led entry as relative and does not find the donor.
 * Both that and the relative-`od` gap below are misses and never wrong objects.
 *
 * **A relative directory says nothing either, and is read as POSIX.** A
 * repository opened through a relative path — `fjs/git/repo`'s `tryCommonDir`
 * answers one for a `.git` beside the caller — has no root to read at all.
 *
 * Every one of these is an inference from a path where an answer from the host
 * is what is wanted; [`todo/byte-paths.md`](../todo/byte-paths.md) records them
 * under the task for asking the host which roots it has.
 *
 * @type {(od: string) => boolean}
 */
const isWindows = od => isDriveRoot(root(od))

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
 * @type {(idOf: (type: ObjectType, payload: Bytes) => Oid, oidBytes: OidBytes, id: Oid) => (od: string) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes | Inflate, _Outcome, IoChannel>}
 */
const inOne = (idOf, oidBytes, id) => od => {
    const p = loosePath(od, id)
    // `resultStep` and not `resultMapStep`: the answer is wanted as a *value* and
    // not lifted back into the channel, because none of the three things short of
    // the object ends the search here.
    const loose = resultStep(readLoose(p), r => pureOk(checkedAt(idOf, p, id)(r)))
    return step(loose, r => {
        if (r[0] === 'ok' && r[1] !== null) { return pureOk(/** @type {_Outcome} */ ([r, false])) }
        // On the loose side, a failure meaning *nothing is at this path* is not
        // a refusal: it is what a store without the object looks like. That is
        // `ENOENT`, and also the `ENOTDIR` of a path whose component is a
        // regular file and the `ELOOP` of one whose links cycle — an alternates
        // entry naming either is a borrowing Git warns about and reads past.
        // Everything else that read can say is a refusal — a hash mismatch,
        // because the file is there and holds something else; a stream that is
        // no zlib stream, because the file is there and is broken; an `EACCES`,
        // because the file may be there and the host will not say. An earlier
        // revision named only the hash mismatch, so a borrowed store's corrupt
        // loose object hid behind the repository's own `ENOENT`; a later one
        // named only `ENOENT`, so an unusable *directory* refused the store.
        const looseRefused = r[0] === 'error' && !namesNothing(r[1])
        return resultStep(readPacked(od, oidBytes)(id), h => {
            const answered = packedOr(idOf, id, r)(h)
            return pureOk(/** @type {_Outcome} */ ([
                answered,
                // On the packed side there is no such failure to spare: an index
                // that names the id has said the store holds it, so *every* way
                // the read can fail afterwards is a refusal — an `ENOENT` for the
                // `.pack` beside a readable `.idx` among them. Which side
                // answered is the question, not which errno came back; asking the
                // code alone turns that missing pack into a miss.
                answered === r ? looseRefused : answered[0] === 'error',
            ]))
        })
    })
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
 * @type {(idOf: (type: ObjectType, payload: Bytes) => Oid, oidBytes: OidBytes, id: Oid) => (od: string) => (found: Nullable<_Outcome>) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes | Inflate, readonly [Nullable<_Outcome>, List<string>], IoChannel>}
 */
const storeOf = (idOf, oidBytes, id) => od => found => {
    if (found !== null && found[0][0] === 'ok' && found[0][1] !== null) {
        return pureOk(/** @type {const} */ ([found, null]))
    }
    return mapStep(
        inOne(idOf, oidBytes, id)(od),
        o => /** @type {const} */ ([kept(found, o), null]))
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
 * @throws On an id that is not `oidBytes` wide: a caller that mixes the
 * widths has a bug, not a missing object.
 *
 * @type {(ods: readonly string[], oidBytes: OidBytes) => (id: Oid) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes | Inflate, Nullable<Envelope>, IoChannel>}
 */
export const readIn = (ods, oidBytes) => {
    const idOf = of(oidBytes)
    const isOid = isOidOf(oidBytes)
    return id => {
        assert(isOid(id), ['not an id of the width', id])
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
    const isOid = isOidOf(oidBytes)
    return id => {
        // Asked here as well as in `readIn`, because the effect below is not run
        // until it is stepped: a caller that hands over an id of the wrong width
        // has a bug now, not one command later.
        assert(isOid(id), ['not an id of the width', id])
        return step(dirs, ods => readIn(ods, oidBytes)(id))
    }
}
