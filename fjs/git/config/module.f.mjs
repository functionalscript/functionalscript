/**
 * The repository's `config` file, read for the one thing the readers
 * need from it: the id width. The file is Git's INI-like text — `[section]`
 * or `[section "subsection"]` headers, `key = value` under them, comments
 * from `#` or `;` — and {@link tryEntries} reads it as Git's own parser
 * reads it, which is a character at a time rather than a line at a time:
 *
 * - A value may be quoted in whole or in part. `\n`, `\t`, `\b`, `\\` and
 *   `\"` are what a `\` escapes and nothing else is an escape; a comment
 *   mark inside quotes is a character of the value; the whitespace around
 *   a value is dropped and the whitespace inside quotes is kept.
 * - A key written without `=` is `true`, and nothing but the line's end
 *   may follow it — `bare ; on` is a line Git refuses, where `bare = true
 *   ; on` is one it reads.
 * - A header ends at its `]` and the line goes on: `[a] x = 1` sets `a.x`
 *   and `[a][b] x = 1` sets `b.x`, both as Git sets them.
 * - A section and a key are case-insensitive and read lowercased, a
 *   subsection is case-sensitive and kept as written, and a `\` in one
 *   stands for the character after it.
 * - No whitespace may sit inside a header but the run between the section
 *   and its subsection's opening quote: `[core ]` and `[core "a" ]` are
 *   lines Git refuses.
 *
 * A line Git calls a `bad config line` refuses the file whole, as Git
 * refuses it. Two things Git reads this does not, and both are refused
 * rather than misread: a `\` at the end of a line, which continues the
 * value on the next, and a NUL inside a quoted subsection, which truncates
 * the whole name Git assembles and leaves it with no key in it. Neither
 * comes out of a `git init`, and the key this module is for is a word in a
 * section with no subsection.
 *
 * @module
 *
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { OidBytes } from '../types.ts'
 * @import { _SubState, _ValueState } from './private.ts'
 * @import { Entry } from './types.ts'
 */

/** The value Git gives a key written without one. */
const bareValue = /** @type {const} */ ('true')

/** The byte-order mark, as one character of decoded text. */
const bom = /** @type {const} */ ('\uFEFF')

/** @type {(c: string) => boolean} */
const isAlpha = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')

/** @type {(c: string) => boolean} */
const isDigit = c => c >= '0' && c <= '9'

/** What Git calls a key character: what a name is made of. */
const isKeyChar = /** @type {(c: string) => boolean} */ (c => isAlpha(c) || isDigit(c) || c === '-')

/**
 * The whitespace Git's parser skips between a key and its `=`, and nothing
 * else: that one loop asks for a space or a tab by name where the rest of
 * the parser asks {@link isSpace}, so `x\r= 1` is a bad config line where
 * `\rx = 1` is not.
 *
 * @type {(c: string) => boolean}
 */
const isKeySpace = c => c === ' ' || c === '\t'

/**
 * Whether a character is whitespace to Git, a line's end apart. Git has its
 * own `isspace` over C's, and it holds a space, a tab, a newline and a
 * `\r` and no more: a `\v` or a `\f` is no whitespace, so it begins no
 * line and stands in a value as the character it is.
 *
 * @type {(c: string) => boolean}
 */
const isSpace = c => isKeySpace(c) || c === '\r'

/**
 * Whether a character is whitespace to the C library, which is a wider
 * class than {@link isSpace} by a `\v` and a `\f`. It is not the parser's
 * class and is asked nowhere the parser reads: a number is converted by
 * `strtoimax`, and that skips whatever the library calls space before the
 * sign, so `repositoryformatversion = "\v1"` is version 1 to Git where a
 * `\v` anywhere else in a value is a character of it.
 *
 * @type {(c: string) => boolean}
 */
const isCSpace = c => isSpace(c) || c === '\n' || c === '\v' || c === '\f'

/**
 * The opposite of a character test, so a search for the first character a
 * class does not hold is a search for one another holds. Built once where
 * the class is bound rather than at every text.
 *
 * @type {(is: (c: string) => boolean) => (c: string) => boolean}
 */
const not = is => c => !is(c)

/**
 * What is left of text once the whitespace it begins with is skipped, by
 * whichever class of it the caller is Git's.
 *
 * @type {(is: (c: string) => boolean) => (text: string) => string}
 */
const afterOf = is => {
    const no = not(is)
    return text => {
        const i = [...text].findIndex(no)
        return i === -1 ? '' : text.slice(i)
    }
}

/** What is left of text once the whitespace it begins with is skipped. */
const afterSpace = afterOf(isSpace)

/** The same, for the one loop that takes a space or a tab and no `\r`. */
const afterKeySpace = afterOf(isKeySpace)

/** The same, for the conversion that skips the C library's whitespace. */
const afterCSpace = afterOf(isCSpace)

/**
 * The longest prefix of text whose characters `is` accepts: the name Git
 * reads there, which ends where the first character that is no name's
 * begins.
 *
 * @type {(is: (c: string) => boolean) => (text: string) => string}
 */
const spanOf = is => {
    const no = not(is)
    return text => {
        const i = [...text].findIndex(no)
        return i === -1 ? text : text.slice(0, i)
    }
}

/** The key a line names, up to what is no key character. */
const keyAt = spanOf(isKeyChar)

/** The section a header names, which is a key's characters and `.`. */
const sectionAt = spanOf(c => isKeyChar(c) || c === '.')

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
 * v1-only extension found` — and `objectformat`, the key this module is
 * for, is one of them.
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

/** The words Git reads as a boolean, lowercased. */
const booleans = /** @type {readonly string[]} */ (['true', 'false', 'yes', 'no', 'on', 'off', ''])

/**
 * The radix a letter after a leading `0` names, however cased, and none
 * where the letter is neither: `0x1f` is hexadecimal and `0b11` is binary,
 * where `017` is octal by the `0` alone.
 *
 * The binary one is not C's. `strtoimax` reads a number in base 0 by C's
 * grammar, which has decimal, octal and hexadecimal and no binary, and the
 * `0b` is an extension glibc added in 2.38. So Git reads
 * `repositoryformatversion = 0b1` as version 1 where it is built against a
 * glibc that new — which is what the Git this module is measured against
 * does — and as a bad numeric value where it is built against a library
 * without it. There is no reading that suits both, and this takes the one
 * the measurements are of.
 */
const prefixes = /** @type {StringMap<bigint>} */ ({ b: 2n, x: 16n })

/** What a `k`, `m` or `g` after a number scales it by, however cased. */
const factors = /** @type {StringMap<bigint>} */ ({
    k: 1024n,
    m: 1048576n,
    g: 1073741824n,
})

/**
 * The magnitude a number may reach: Git reads one into a C `int`, and
 * refuses what does not fit, the scaling by a unit counted in.
 */
const maxInt = /** @type {const} */ (2147483647n)

/**
 * What a character is worth as a digit, and 16 — no digit's worth — where
 * it is none.
 *
 * @type {(c: string) => bigint}
 */
const digitValue = c =>
    isDigit(c) ? BigInt(c.charCodeAt(0) - 0x30)
        : c >= 'a' && c <= 'f' ? BigInt(c.charCodeAt(0) - 0x57)
            : c >= 'A' && c <= 'F' ? BigInt(c.charCodeAt(0) - 0x37)
                : 16n

/**
 * One split element with the `\r` a `\n` followed taken off it, where `last`
 * is the index of the element no `\n` followed.
 *
 * @type {(last: number) => (line: string, i: number) => string}
 */
const unCr = last => (line, i) => i !== last && line.endsWith('\r') ? line.slice(0, -1) : line

/**
 * The lines of a file, as Git ends one. Git ends a line at a `\n` and folds
 * the `\r` before it, and folds no other. A `\r` that reaches the end of
 * the file ends nothing, so it stands in the line as the character it is:
 * `x\r` is the bare key `x\r`, which is a bad config line for the reason
 * `x\r= 1` is one, rather than the bare key `x`.
 *
 * @type {(text: string) => readonly string[]}
 */
const lines = text => {
    const split = text.split('\n')
    return split.map(unCr(split.length - 1))
}

/**
 * One digit read into the number before it, in a radix the caller binds
 * first. `null` stays `null`, and a character that is no digit of the radix
 * makes it so.
 *
 * @type {(radix: bigint) => (acc: Nullable<bigint>, c: string) => Nullable<bigint>}
 */
const digitStep = radix => (acc, c) => {
    if (acc === null) { return null }
    const v = digitValue(c)
    return v >= radix ? null : acc * radix + v
}

/**
 * The number digits spell in a radix, or `null` where they are none or
 * one of them is no digit of it.
 *
 * @type {(digits: string, radix: bigint) => Nullable<bigint>}
 */
const tryDigits = (digits, radix) => digits.length === 0
    ? null
    : [...digits].reduce(digitStep(radix), /** @type {Nullable<bigint>} */(0n))

/**
 * The number a value spells as Git's parser reads one, or `null` where it
 * spells none. The grammar is C's own, since `strtoimax` is what reads it:
 * whitespace, then an optional sign, then `0x` before hexadecimal digits,
 * `0b` before binary ones — see {@link prefixes} for whose extension that
 * is — a leading `0` before octal ones, or decimal ones, then an optional
 * `k`, `m` or `g` scaling it. `08` spells no number, its `8` being no octal digit,
 * and neither does one too large for the `int` it is read into — both are
 * values Git refuses.
 *
 * The whitespace is the conversion's and not the parser's, so it is
 * {@link isCSpace} that says what it is, and it comes off the front only:
 * `" 1"` is 1 to Git where `"1 "` is a `bad numeric config value`, its
 * space being read as a unit and found to be none. Only a quoted value
 * carries any, the parser having dropped what surrounded an unquoted one,
 * and nothing but the number reads a value this way — `" true"` stays a
 * `bad boolean config value`, since a word is compared as it is written.
 *
 * @type {(value: string) => Nullable<bigint>}
 */
const tryInt = value => {
    const text = afterCSpace(value)
    const signed = text[0] === '+' || text[0] === '-' ? text.slice(1) : text
    const unit = factors[signed.slice(-1).toLowerCase()]
    const body = unit === undefined ? signed : signed.slice(0, -1)
    const marked = body[0] === '0' ? prefixes[body[1]?.toLowerCase()] : undefined
    // A leading `0` is an octal digit as well as the mark of the base, so
    // where no letter follows it, it stays in the digits and `0` alone is
    // the number it spells.
    const n = marked === undefined
        ? tryDigits(body, body[0] === '0' ? 8n : 10n)
        : tryDigits(body.slice(2), marked)
    if (n === null) { return null }
    const scaled = n * (unit ?? 1n)
    return scaled > maxInt ? null : text[0] === '-' ? -scaled : scaled
}

/**
 * Whether a value is one Git reads as a boolean: one of {@link booleans},
 * however cased, or a number, which is true where it is not zero.
 *
 * @type {(value: string) => boolean}
 */
const isBoolean = value => booleans.includes(value.toLowerCase()) || tryInt(value) !== null

/** What a `\` before it stands for, and nothing else is an escape. */
const escapes = /** @type {StringMap<string>} */ ({
    n: '\n',
    t: '\t',
    b: '\b',
    '\\': '\\',
    '"': '"',
})

/**
 * One character of a value, read into what the reader carries. Hoisted
 * because it closes over nothing: the whole of what it knows is the state
 * handed to it and the character after it.
 *
 * @type {(acc: _ValueState, c: string) => _ValueState}
 */
const valueStep = (acc, c) => {
    if (acc.bad || acc.done) { return acc }
    if (acc.escape) {
        const e = escapes[c]
        return e === undefined
            ? { ...acc, bad: true }
            : { ...acc, value: acc.value + acc.pending + e, pending: '', escape: false }
    }
    if (c === '\\') { return { ...acc, escape: true } }
    // A quote keeps the whitespace before it, as Git keeps it:
    // `x = a ""` is the value `a ` where `x = a ` is `a`.
    if (c === '"') { return { ...acc, value: acc.value + acc.pending, pending: '', quoted: !acc.quoted } }
    if (!acc.quoted && (c === '#' || c === ';')) { return { ...acc, done: true } }
    if (!acc.quoted && isSpace(c)) {
        // Git writes whitespace as a space, one for one, and keeps the run
        // only where something that is none follows it.
        return acc.value === '' ? acc : { ...acc, pending: `${acc.pending} ` }
    }
    return { ...acc, value: acc.value + acc.pending + c, pending: '' }
}

/** What the reader of a value starts from. */
const valueStart = /** @type {_ValueState} */ ({
    value: '', pending: '', quoted: false, escape: false, done: false, bad: false,
})

/**
 * A value as Git reads it, or `null` where the line is one Git refuses:
 * the text after `=`, its quotes taken as quoting rather than characters,
 * its escapes read, a comment outside quotes ending it, and the
 * whitespace around it dropped. Whitespace inside quotes is the value's
 * as written; whitespace outside them that the value keeps — a run
 * between two of its characters — is written as spaces, one for one, as
 * Git writes it.
 *
 * Then it ends at its first NUL, and only then, because Git builds the
 * value and hands it on as a C string. So `x = a\0b` is `a`, and
 * `x = a   \0b` is `a   ` — the NUL is no whitespace, so it commits the
 * run before it, and the cut leaves that run at the end where a line's
 * end would have dropped it. A NUL in a name is not this: it is no key
 * character, so it is a bad config line, which the name reader already
 * says.
 *
 * @type {(rest: string) => Nullable<string>}
 */
const tryValue = rest => {
    const end = [...rest].reduce(valueStep, valueStart)
    if (end.bad || end.quoted || end.escape) { return null }
    const nul = end.value.indexOf('\0')
    return nul === -1 ? end.value : end.value.slice(0, nul)
}

/**
 * One character of a subsection, read into what the reader carries.
 * Hoisted for the reason {@link valueStep} is: it closes over nothing.
 *
 * @type {(acc: _SubState, c: string) => _SubState}
 */
const subStep = (acc, c) => {
    if (acc.after !== null) { return { ...acc, after: acc.after + c } }
    if (acc.escape) { return { sub: acc.sub + c, escape: false, after: null } }
    if (c === '\\') { return { ...acc, escape: true } }
    return c === '"' ? { ...acc, after: '' } : { ...acc, sub: acc.sub + c }
}

/** What the reader of a subsection starts from. */
const subStart = /** @type {_SubState} */ ({ sub: '', escape: false, after: null })

/**
 * The subsection closing a header whose section is already read, and what
 * is left of the line after the `]` that follows it: the text between the
 * quotes as written, a `\\` standing for the character after it, and
 * `null` where the quotes do not close on the line or anything but `]`
 * follows them.
 *
 * @type {(section: string, rest: string) => Nullable<readonly [string, string]>}
 */
const trySub = (section, rest) => {
    const open = afterSpace(rest)
    if (open[0] !== '"') { return null }
    const { sub, after } = [...open.slice(1)].reduce(subStep, subStart)
    if (after === null || after[0] !== ']') { return null }
    // A subsection holding a NUL is refused rather than read. Git takes
    // every character but a `\n` into a subsection and then hands the
    // assembled `section.subsection.key` to its callback as a C string, so
    // `[remote "o\0p"]` with `x = 1` reaches it as the name `remote.o`
    // and nothing more — a name with no key in it, which an entry of a
    // section, a key and a value cannot spell. Refusing says so, where
    // answering `remote.o\\0p.x` would be a name Git never built.
    return sub.includes('\0') ? null : [`${section}.${sub}`, after.slice(1)]
}

/**
 * A section header read off the front of a line that begins with `[`: the
 * name it gives the section, lowercased as Git lowercases it, and what is
 * left of the line after its `]`; or `null` where Git calls the line bad.
 * `[core]` names `core` and `[remote "origin"]` names `remote.origin`.
 *
 * @type {(line: string) => Nullable<readonly [string, string]>}
 */
const tryHeader = line => {
    const section = sectionAt(line.slice(1))
    const rest = line.slice(section.length + 1)
    const lower = section.toLowerCase()
    // A name and its `]` and nothing between them, or the whitespace that
    // may stand before a subsection's opening quote and nothing else.
    if (rest[0] === ']') { return section === '' ? null : [lower, rest.slice(1)] }
    return isSpace(rest[0]) ? trySub(lower, rest) : null
}

/**
 * One line read, from the section it begins in: the section it leaves —
 * a header sets it, and one line may hold more than one — and the entry
 * it holds, or none; `null` where Git calls it a bad config line.
 *
 * @type {(section: string, raw: string) => Nullable<readonly [string, Nullable<Entry>]>}
 */
const tryLine = (section, raw) => {
    const line = afterSpace(raw)
    if (line === '' || line[0] === '#' || line[0] === ';') { return [section, null] }
    if (line[0] === '[') {
        const head = tryHeader(line)
        return head === null ? null : tryLine(head[0], head[1])
    }
    const key = keyAt(line)
    // A name begins with a letter, so a line beginning with anything a
    // section, a comment and a name all may not is a bad line.
    if (key === '' || !isAlpha(key[0])) { return null }
    const after = afterKeySpace(line.slice(key.length))
    if (after !== '' && after[0] !== '=') { return null }
    const value = after === '' ? bareValue : tryValue(after.slice(1))
    return value === null ? null : [section, [section, key.toLowerCase(), value]]
}

/**
 * One line of a file, read into the section it stands in and the entries
 * before it. `null` in place of the entries is a line Git refuses, which
 * refuses every line after it too.
 *
 * @type {(acc: readonly [string, Nullable<readonly Entry[]>], raw: string) => readonly [string, Nullable<readonly Entry[]>]}
 */
const lineStep = ([section, list], raw) => {
    if (list === null) { return [section, null] }
    const read = tryLine(section, raw)
    if (read === null) { return [section, null] }
    const [next, entry] = read
    return [next, entry === null ? list : [...list, entry]]
}

/** The section and the entries a file starts from: none of either. */
const linesStart = /** @type {readonly [string, Nullable<readonly Entry[]>]} */ (['', []])

/**
 * Every `key = value` of the file, with the section each sits in, in
 * order, so a key set twice is read twice and the last one wins as it
 * does for Git; or `null` where a line is one Git refuses. A `\r` before a
 * line's end is the half of a Windows line ending Git also drops, and a
 * byte-order mark at the beginning is skipped as Git skips it.
 *
 * @type {(raw: string) => Nullable<readonly Entry[]>}
 */
export const tryEntries = raw => {
    // A byte-order mark at the file's beginning is Git's to skip, and no
    // editor that writes one means it as text. Here it is the one character
    // a decoder leaves, so the half of one Git refuses cannot arise.
    const text = raw.startsWith(bom) ? raw.slice(bom.length) : raw
    const [, list] = lines(text).reduce(lineStep, linesStart)
    return list
}

/**
 * The value an entry holds under a section and a key, as a list of none or
 * one, so a flatMap over the entries is the values they give that key.
 *
 * @type {(section: string, key: string) => (entry: Entry) => readonly string[]}
 */
const valueAt = (section, key) => ([s, k, value]) => s === section && k === key ? [value] : []

/**
 * Every value a key is given in a section, in order. Git reads each of
 * them as it comes to it, so a reader that judged only the last would let
 * a value Git refuses pass behind a good one.
 *
 * @type {(entries: readonly Entry[], section: string, key: string) => readonly string[]}
 */
const valuesOf = (entries, section, key) => entries.flatMap(valueAt(section, key))

/**
 * The last of a list, or `null` where it has none: the value that wins,
 * as the last one wins for Git.
 *
 * @type {(values: readonly string[]) => Nullable<string>}
 */
const last = values => values.length === 0 ? null : values[values.length - 1]

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

/** Whether Git 2.43 knows an extension by this name. */
const isKnownExtension = /** @type {(ext: string) => boolean} */ (
    ext => knownExtensions.includes(ext))

/** Whether it is one Git reads only under `repositoryformatversion = 1`. */
const isV1OnlyExtension = /** @type {(ext: string) => boolean} */ (
    ext => v1OnlyExtensions.includes(ext))

/**
 * Whether the value under an extension's name is one Git reads there: a
 * boolean where the extension takes one, a hash's name under
 * `objectFormat`, and anything at all under a name that is no extension.
 *
 * @type {(entry: Entry) => boolean}
 */
const extensionValueRead = entry => {
    const ext = extensionAt(entry)
    if (ext === null) { return true }
    const value = entry[2]
    return booleanExtensions.includes(ext)
        ? isBoolean(value)
        : ext !== 'objectformat' || isFormat(value)
}

/**
 * One `repositoryformatversion` read into the version before it. The last
 * assignment wins, and one spelling no number refuses the file whatever
 * stands after it, since Git reads each as its parser reaches it.
 *
 * @type {(acc: Nullable<bigint>, value: string) => Nullable<bigint>}
 */
const versionStep = (acc, value) => acc === null ? null : tryInt(value)

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
const extensionValuesRead = entries => entries.every(extensionValueRead)

/**
 * The id width the file names, or `null` where the file is one Git
 * refuses. 32 bytes needs `extensions.objectFormat = sha256` under
 * `repositoryformatversion = 1`, which is what `git init
 * --object-format=sha256` writes; everything else Git opens is 20, the
 * default `git init` writes with no `[extensions]` section at all.
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
 * @type {(text: string) => Nullable<OidBytes>}
 */
export const tryOidBytes = text => {
    const entries = tryEntries(text)
    if (entries === null) { return null }
    if (!extensionValuesRead(entries)) { return null }
    // Each version spells a number or refuses the file, and the last one
    // spells the version.
    const version = valuesOf(entries, 'core', 'repositoryformatversion')
        .reduce(versionStep, /** @type {Nullable<bigint>} */(noVersion))
    if (version === null || version > 1n) { return null }
    const exts = entries.flatMap(extensionsOf)
    if (version >= 1n && !exts.every(isKnownExtension)) { return null }
    if (version === 0n && exts.some(isV1OnlyExtension)) { return null }
    // The hash is what the last `objectFormat` names whatever the version,
    // since Git reads the key at every one — and nothing, where the format
    // Git read was thrown away.
    // Every `objectFormat` the file holds names a hash, or the file is
    // already refused, so the last one is the repository's and 20 is both
    // the other hash's width and what a file naming no format has.
    return version !== noVersion && last(valuesOf(entries, 'extensions', 'objectformat')) === sha256 ? 32 : 20
}
