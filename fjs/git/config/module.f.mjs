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

/** @type {(c: string) => boolean} */
const isAlpha = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')

/** @type {(c: string) => boolean} */
const isDigit = c => c >= '0' && c <= '9'

/** What Git calls a key character: what a name is made of. */
const isKeyChar = /** @type {(c: string) => boolean} */ (c => isAlpha(c) || isDigit(c) || c === '-')

/** @type {(c: string) => boolean} */
const isSpace = c => c === ' ' || c === '\t'

/**
 * Whether a character is whitespace inside a value, where Git counts a
 * `\r` as well and writes every one of them as a space.
 *
 * @type {(c: string) => boolean}
 */
const isValueSpace = c => isSpace(c) || c === '\r'

/**
 * What is left of text once the whitespace it begins with is skipped.
 *
 * @type {(text: string) => string}
 */
const afterSpace = text => {
    const i = [...text].findIndex(c => !isSpace(c))
    return i === -1 ? '' : text.slice(i)
}

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
 * The extensions Git 2.43 knows, as it lowercases them. Under
 * `repositoryformatversion = 1` Git refuses a repository whose
 * `[extensions]` holds any other key — `unknown repository extension
 * found` — since an extension changes how the repository is read and a
 * reader that ignored one would read it wrongly; {@link tryOidBytes}
 * refuses it for the same reason. `compatobjectformat` is not among them:
 * Git 2.43 refuses it, a later Git knows it, and a newer Git knowing more
 * of them is what keeps this list a version's. Under version 0 an unknown
 * key is ignored, as Git ignores it.
 *
 * @type {readonly string[]}
 */
const knownExtensions = [
    'noop',
    'noop-v1',
    'preciousobjects',
    'partialclone',
    'worktreeconfig',
    'objectformat',
]

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
 * Whether a value is a number as Git's parser reads one, which is C's own
 * grammar: an optional sign, then `0x` before hexadecimal digits, a
 * leading `0` before octal ones, or decimal ones, then an optional `k`,
 * `m` or `g` scaling it. `08` is no number, its `8` being no octal digit,
 * and neither is one too large for the `int` it is read into — both are
 * values Git refuses.
 *
 * @type {(value: string) => boolean}
 */
const isInt = value => {
    const signed = value[0] === '+' || value[0] === '-' ? value.slice(1) : value
    const factor = factors[signed.slice(-1).toLowerCase()]
    const body = factor === undefined ? signed : signed.slice(0, -1)
    const hex = body[0] === '0' && (body[1] === 'x' || body[1] === 'X')
    // A leading `0` is an octal digit as well as the mark of the base, so
    // it stays in the digits and `0` alone is the number it spells.
    const n = hex ? tryDigits(body.slice(2), 16n) : tryDigits(body, body[0] === '0' ? 8n : 10n)
    return n !== null && n * (factor ?? 1n) <= maxInt
}

/**
 * Whether a value is one Git reads as a boolean: one of {@link booleans},
 * however cased, or a number, which is true where it is not zero.
 *
 * @type {(value: string) => boolean}
 */
const isBoolean = value => booleans.includes(value.toLowerCase()) || isInt(value)

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
            if (c === '"') { return { ...acc, quoted: !acc.quoted } }
            if (!acc.quoted && (c === '#' || c === ';')) { return { ...acc, done: true } }
            if (!acc.quoted && isValueSpace(c)) {
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
    const after = afterSpace(line.slice(key.length))
    if (after !== '' && after[0] !== '=') { return null }
    const value = after === '' ? bareValue : tryValue(after.slice(1))
    return value === null ? null : [section, [section, key.toLowerCase(), value]]
}

/**
 * Every `key = value` of the file, with the section each sits in, in
 * order, so a key set twice is read twice and the last one wins as it
 * does for Git; or `null` where a line is one Git refuses. A `\r` before
 * a line's end is the half of a Windows line ending Git also drops.
 *
 * @type {(text: string) => Nullable<readonly Entry[]>}
 */
export const tryEntries = text => {
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
 * The last value of a key in a section, or `null` where the file sets
 * none.
 *
 * @type {(entries: readonly Entry[], section: string, key: string) => Nullable<string>}
 */
const last = (entries, section, key) => {
    const values = entries.flatMap(([s, k, value]) => s === section && k === key ? [value] : [])
    return values.length === 0 ? null : values[values.length - 1]
}

/**
 * The id width the file names, or `null` where the file is one Git
 * refuses: `extensions.objectFormat` absent — as in every repository
 * `git init` writes by default, which has no `[extensions]` section — or
 * `sha1` is 20 bytes; `sha256`, which `git init --object-format=sha256`
 * writes beside `repositoryformatversion = 1`, is 32. The value is
 * case-sensitive, as Git reads it: `SHA256` is refused. The key at all
 * needs `core.repositoryformatversion = 1`, since Git refuses the
 * extension under version 0 — `repo version is 0, but v1-only extension
 * found` — and under version 1 every key in `[extensions]` must be one
 * Git knows, since it refuses `unknown repository extension found`. A
 * version other than 0 or 1 is refused whatever else the file says, as is
 * a file with a bad line.
 *
 * @type {(text: string) => Nullable<OidBytes>}
 */
export const tryOidBytes = text => {
    const entries = tryEntries(text)
    if (entries === null) { return null }
    if (!entries.every(([section, key, value]) =>
        section !== 'extensions' || !booleanExtensions.includes(key) || isBoolean(value))) { return null }
    const version = last(entries, 'core', 'repositoryformatversion') ?? '0'
    if (version !== '0' && version !== '1') { return null }
    if (version === '1' && !entries.every(([section, key]) => section !== 'extensions' || knownExtensions.includes(key))) { return null }
    const format = last(entries, 'extensions', 'objectformat')
    if (format === null) { return 20 }
    if (version !== '1') { return null }
    return format === 'sha1' ? 20 : format === 'sha256' ? 32 : null
}
