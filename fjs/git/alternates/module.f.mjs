/**
 * An `objects/info/alternates` file, decoded: the object directories it names,
 * in the order it names them, as {@link alternatesIn} answers them. A pure
 * decoder over the file's text — reading the file, and searching the
 * directories it names, is [`fjs/git/store`](../store/module.f.mjs)'s.
 *
 * Every line shape here was measured against Git 2.43.0, and every line
 * answers a path: a shape this reader does not follow Git on is a miss and not
 * a refusal, since the store hashes whatever a directory answers against the id
 * it asked for. The two such shapes left are
 * [`todo/alternates-line-quirks.md`](./todo/alternates-line-quirks.md).
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { isDriveLetter, isDriveRoot, root, under } from '../../path/module.f.mjs'

/**
 * An entry as the host will be given it: a path ends at its first `NUL`, because
 * a path is a `NUL`-terminated byte string everywhere this runs.
 *
 * **Not doing this is a refusal and not a miss**, which is why it is worth a
 * function. Node will not carry a `NUL` to the system call at all — every `fs`
 * operation throws `TypeError [ERR_INVALID_ARG_VALUE]`, "must be a string …
 * without null bytes" — and `fjs/effects/node` turns a thrown failure into a
 * channel error carrying that code. `ERR_INVALID_ARG_VALUE` is not `ENOENT`, so
 * `fjs/git/store` reads it as a store that holds the object and cannot give it
 * up, and the whole read is refused. Git meanwhile reads the donor behind the `NUL`.
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
 * [`todo/alternates-line-quirks.md`](./todo/alternates-line-quirks.md).
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
 * [`todo/alternates-line-quirks.md`](./todo/alternates-line-quirks.md)'s to
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
 * [`todo/alternates-line-quirks.md`](./todo/alternates-line-quirks.md).
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
 * can do it — and it is why a cycle is bounded by `fjs/git/store`'s
 * `maxBorrowDepth` rather than by the spelling of a path.
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
