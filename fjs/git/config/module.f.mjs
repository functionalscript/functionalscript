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
 * refuses it. The one thing Git reads that this does not is a `\` at the
 * end of a line, which continues the value on the next; a file using one
 * is refused rather than misread, since no `git init` writes one and the
 * key this module is for is a word.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { OidBytes } from '../types.ts'
 * @import { Entry, SubState, ValueState } from './types.ts'
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
 * What is left of text once the whitespace it begins with is skipped, by
 * whichever class of it the caller is Git's.
 *
 * @type {(is: (c: string) => boolean) => (text: string) => string}
 */
const afterOf = is => text => {
    const i = [...text].findIndex(c => !is(c))
    return i === -1 ? '' : text.slice(i)
}

/** What is left of text once the whitespace it begins with is skipped. */
const afterSpace = afterOf(isSpace)

/** The same, for the one loop that takes a space or a tab and no `\r`. */
const afterKeySpace = afterOf(isKeySpace)

/**
 * The longest prefix of text whose characters `is` accepts: the name Git
 * reads there, which ends where the first character that is no name's
 * begins.
 *
 * @type {(is: (c: string) => boolean) => (text: string) => string}
 */
const spanOf = is => text => {
    const i = [...text].findIndex(c => !is(c))
    return i === -1 ? text : text.slice(0, i)
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

/** What a `k`, `m` or `g` after a number scales it by, however cased. */
const factors = /** @type {Readonly<Record<string, bigint>>} */ ({
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
 * The number digits spell in a radix, or `null` where they are none or
 * one of them is no digit of it.
 *
 * @type {(digits: string, radix: bigint) => Nullable<bigint>}
 */
const tryDigits = (digits, radix) => digits.length === 0 ? null : [...digits].reduce(
    /** @type {(acc: Nullable<bigint>, c: string) => Nullable<bigint>} */
    (acc, c) => {
        if (acc === null) { return null }
        const v = digitValue(c)
        return v >= radix ? null : acc * radix + v
    },
    /** @type {Nullable<bigint>} */(0n))

/**
 * The number a value spells as Git's parser reads one, or `null` where it
 * spells none. The grammar is C's own: an optional sign, then `0x` before
 * hexadecimal digits, a leading `0` before octal ones, or decimal ones,
 * then an optional `k`, `m` or `g` scaling it. `08` spells no number, its
 * `8` being no octal digit, and neither does one too large for the `int`
 * it is read into — both are values Git refuses.
 *
 * @type {(value: string) => Nullable<bigint>}
 */
const tryInt = value => {
    const signed = value[0] === '+' || value[0] === '-' ? value.slice(1) : value
    const unit = factors[signed.slice(-1).toLowerCase()]
    const body = unit === undefined ? signed : signed.slice(0, -1)
    const hex = body[0] === '0' && (body[1] === 'x' || body[1] === 'X')
    // A leading `0` is an octal digit as well as the mark of the base, so
    // it stays in the digits and `0` alone is the number it spells.
    const n = hex ? tryDigits(body.slice(2), 16n) : tryDigits(body, body[0] === '0' ? 8n : 10n)
    if (n === null) { return null }
    const scaled = n * (unit ?? 1n)
    return scaled > maxInt ? null : value[0] === '-' ? -scaled : scaled
}

/**
 * Whether a value is one Git reads as a boolean: one of {@link booleans},
 * however cased, or a number, which is true where it is not zero.
 *
 * @type {(value: string) => boolean}
 */
const isBoolean = value => booleans.includes(value.toLowerCase()) || tryInt(value) !== null

/** What a `\` before it stands for, and nothing else is an escape. */
const escapes = /** @type {Readonly<Record<string, string>>} */ ({
    n: '\n',
    t: '\t',
    b: '\b',
    '\\': '\\',
    '"': '"',
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
 * @type {(rest: string) => Nullable<string>}
 */
const tryValue = rest => {
    const end = [...rest].reduce(
        /** @type {(acc: ValueState, c: string) => ValueState} */
        (acc, c) => {
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
                // Git writes whitespace as a space, one for one, and keeps
                // the run only where something that is none follows it.
                return acc.value === '' ? acc : { ...acc, pending: `${acc.pending} ` }
            }
            return { ...acc, value: acc.value + acc.pending + c, pending: '' }
        },
        { value: '', pending: '', quoted: false, escape: false, done: false, bad: false },
    )
    return end.bad || end.quoted || end.escape ? null : end.value
}

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
    const { sub, after } = [...open.slice(1)].reduce(
        /** @type {(acc: SubState, c: string) => SubState} */
        (acc, c) => {
            if (acc.after !== null) { return { ...acc, after: acc.after + c } }
            if (acc.escape) { return { sub: acc.sub + c, escape: false, after: null } }
            if (c === '\\') { return { ...acc, escape: true } }
            return c === '"' ? { ...acc, after: '' } : { ...acc, sub: acc.sub + c }
        },
        /** @type {SubState} */({ sub: '', escape: false, after: null }),
    )
    return after === null || after[0] !== ']' ? null : [`${section}.${sub}`, after.slice(1)]
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
    const [, list] = text.split('\n').map(line => line.endsWith('\r') ? line.slice(0, -1) : line).reduce(
        /** @type {(acc: readonly [string, Nullable<readonly Entry[]>], raw: string) => readonly [string, Nullable<readonly Entry[]>]} */
        ([section, list], raw) => {
            if (list === null) { return [section, null] }
            const read = tryLine(section, raw)
            if (read === null) { return [section, null] }
            const [next, entry] = read
            return [next, entry === null ? list : [...list, entry]]
        },
        /** @type {readonly [string, Nullable<readonly Entry[]>]} */ (['', []]),
    )
    return list
}

/**
 * Every value a key is given in a section, in order. Git reads each of
 * them as it comes to it, so a reader that judged only the last would let
 * a value Git refuses pass behind a good one.
 *
 * @type {(entries: readonly Entry[], section: string, key: string) => readonly string[]}
 */
const valuesOf = (entries, section, key) =>
    entries.flatMap(([s, k, value]) => s === section && k === key ? [value] : [])

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

/**
 * Whether every `[extensions]` value the file holds is one Git reads: a
 * boolean where the extension takes one, and a hash's name where the
 * extension is `objectFormat`, which is case-sensitive as Git reads it. An
 * extension under a subsection is a name Git knows none of, so it has no
 * value Git reads either and none is asked of it.
 *
 * @type {(entries: readonly Entry[]) => boolean}
 */
const extensionValuesRead = entries => entries.every(entry => {
    const ext = extensionAt(entry)
    if (ext === null) { return true }
    const value = entry[2]
    return booleanExtensions.includes(ext)
        ? isBoolean(value)
        : ext !== 'objectformat' || isFormat(value)
})

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
    const version = valuesOf(entries, 'core', 'repositoryformatversion').reduce(
        /** @type {(acc: Nullable<bigint>, value: string) => Nullable<bigint>} */
        (acc, value) => acc === null ? null : tryInt(value),
        /** @type {Nullable<bigint>} */(noVersion),
    )
    if (version === null || version > 1n) { return null }
    const exts = entries.flatMap(entry => {
        const ext = extensionAt(entry)
        return ext === null ? [] : [ext]
    })
    if (version >= 1n && !exts.every(ext => knownExtensions.includes(ext))) { return null }
    if (version === 0n && exts.some(ext => v1OnlyExtensions.includes(ext))) { return null }
    // The hash is what the last `objectFormat` names whatever the version,
    // since Git reads the key at every one — and nothing, where the format
    // Git read was thrown away.
    // Every `objectFormat` the file holds names a hash, or the file is
    // already refused, so the last one is the repository's and 20 is both
    // the other hash's width and what a file naming no format has.
    return version !== noVersion && last(valuesOf(entries, 'extensions', 'objectformat')) === sha256 ? 32 : 20
}
