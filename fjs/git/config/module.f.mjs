/**
 * Git's `config` file: its grammar, and the readers a key's assignments
 * are read through. The file is Git's INI-like text — `[section]`
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
 * comes out of a `git init`.
 *
 * What a key means is its reader's business, not the grammar's: the
 * repository format and the id width it names are
 * [`fjs/git/store`](../store/module.f.mjs)'s `tryOidBytes`. This module
 * answers every assignment in the file, and the readers below take a key's
 * from there the way Git takes them — {@link values} every one,
 * {@link lastValue} the one that wins, and {@link lastInt} and
 * {@link lastBool} the one that wins as Git's `int` and `bool`, each
 * assignment judged as the reader reaches it.
 *
 * @module
 *
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { _SubState, _ValueState } from './private.ts'
 * @import { Entry } from './types.ts'
 */

import { entry as objectEntry } from '../../types/object/entry/module.f.js'
import { charIs, digitsValue, hexDigitsValue, isDigit, isLatinLetter } from '../../text/ascii/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { untilNul } from '../bytes/module.f.js'

/** The value Git gives a key written without one. */
const bareValue = /** @type {const} */ ('true')

/** The byte-order mark, as one character of decoded text. */
const bom = /** @type {const} */ ('\uFEFF')

/** @type {(c: string) => boolean} */
const isAlpha = charIs(isLatinLetter)

/** @type {(c: string) => boolean} */
const isDigitChar = charIs(isDigit)

/**
 * What Git calls a key character: what a name is made of.
 *
 * @type {(c: string) => boolean}
 */
const isKeyChar = c => isAlpha(c) || isDigitChar(c) || c === '-'

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
const isCSpace = c => isSpace(c) || c === '\n' || c === '\u000B' || c === '\f'

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
 * The words Git reads as `true`, lowercased.
 *
 * @type {readonly string[]}
 */
const trueWords = ['true', 'yes', 'on']

/**
 * The words Git reads as `false`, lowercased, the empty value among them:
 * `x =` is false where `x` alone is true.
 *
 * @type {readonly string[]}
 */
const falseWords = ['false', 'no', 'off', '']

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
 *
 * @type {StringMap<bigint>}
 */
const prefixes = { b: 2n, x: 16n }

/**
 * What a `k`, `m` or `g` after a number scales it by, however cased.
 *
 * @type {StringMap<bigint>}
 */
const factors = {
    k: 1_024n,
    m: 1_048_576n,
    g: 1_073_741_824n,
}

/**
 * The magnitude a number may reach: Git reads one into a C `int`, and
 * refuses what does not fit, the scaling by a unit counted in.
 */
const maxInt = /** @type {const} */ (0x7fff_ffffn)

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
 * The number digits spell in a radix, or `null` where they are none or
 * one of them is no digit of it: `0-9` below the radix, and for 16 the
 * letters `a-f` in either case as well, each through
 * [`fjs/text/ascii`](../../text/ascii/module.f.js)'s digit-run readers.
 *
 * @type {(digits: string, radix: bigint) => Nullable<bigint>}
 */
const tryDigits = (digits, radix) => {
    const codes = [...digits].map(c => c.charCodeAt(0))
    return radix === 16n ? hexDigitsValue(codes) : digitsValue(radix)(codes)
}

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
    const unit = objectEntry(factors, signed.slice(-1).toLowerCase())
    const body = unit === undefined ? signed : signed.slice(0, -1)
    const marked = body[0] === '0' ? objectEntry(prefixes, body[1]?.toLowerCase()) : undefined
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
 * The boolean a value spells as Git's parser reads one, or `null` where it
 * spells none: one of {@link trueWords} or {@link falseWords}, however
 * cased, or a number as {@link tryInt} reads one, which is true where it
 * is not zero.
 *
 * @type {(value: string) => Nullable<boolean>}
 */
const tryBool = value => {
    const word = value.toLowerCase()
    if (trueWords.includes(word)) { return true }
    if (falseWords.includes(word)) { return false }
    const n = tryInt(value)
    return n === null ? null : n !== 0n
}

/**
 * What a `\` before it stands for, and nothing else is an escape.
 *
 * @type {StringMap<string>}
 */
const escapes = {
    n: '\n',
    t: '\t',
    b: '\b',
    '\\': '\\',
    '"': '"',
}

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
        const e = objectEntry(escapes, c)
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

/**
 * What the reader of a value starts from.
 *
 * @type {_ValueState}
 */
const valueStart = {
    value: '', pending: '', quoted: false, escape: false, done: false, bad: false,
}

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
    return untilNul(end.value)
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

/**
 * What the reader of a subsection starts from.
 *
 * @type {_SubState}
 */
const subStart = { sub: '', escape: false, after: null }

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
    return sub.includes('\u0000') ? null : [`${section}.${sub}`, after.slice(1)]
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

/**
 * The section and the entries a file starts from: none of either.
 *
 * @type {readonly [string, Nullable<readonly Entry[]>]}
 */
const linesStart = ['', []]

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
 * Every value a key is given in a section, in file order. The section and
 * the key are spelled as an entry holds them: lowercased, with a
 * subsection after a dot as written — `core` and `repositoryformatversion`,
 * `remote.origin` and `url`.
 *
 * Git reads each assignment as it comes to it, so a reader that judged
 * only the last would let a value Git refuses pass behind a good one.
 *
 * @type {(entries: readonly Entry[], section: string, key: string) => readonly string[]}
 */
export const values = (entries, section, key) => entries.flatMap(valueAt(section, key))

/**
 * The last of a list, or `null` where it has none.
 *
 * @type {(list: readonly string[]) => Nullable<string>}
 */
const last = list => list.length === 0 ? null : list[Number(list.length - 1)]

/**
 * The value a key is last given in a section — the one that wins, as the
 * last one wins for Git — or `null` where it is given none. The section and
 * the key are spelled as for {@link values}.
 *
 * No value is judged on the way: a typed key read through this alone
 * passes a file Git refuses for an earlier assignment, which is what
 * {@link lastInt} and {@link lastBool} are for.
 *
 * @type {(entries: readonly Entry[], section: string, key: string) => Nullable<string>}
 */
export const lastValue = (entries, section, key) => last(values(entries, section, key))

/**
 * A reader of a typed key out of the parser of one value, which reads the
 * key as Git reads one: each assignment parsed as the reader reaches it,
 * the last one winning, and the first that spells nothing the parser reads
 * refusing the file whatever stands after it. It answers `ok(null)` where
 * the key is given no value, and `error` with the first value that spells
 * none.
 *
 * @template T
 * @param {(value: string) => Nullable<T>} parse
 * @returns {(entries: readonly Entry[], section: string, key: string) => Result<Nullable<T>, string>}
 */
const lastOf = parse => {
    /** @type {(acc: Result<Nullable<T>, string>, value: string) => Result<Nullable<T>, string>} */
    const step = (acc, value) => {
        if (acc[0] === 'error') { return acc }
        const v = parse(value)
        return v === null ? error(value) : ok(v)
    }
    /** @type {Result<Nullable<T>, string>} */
    const none = ok(null)
    return (entries, section, key) => values(entries, section, key).reduce(step, none)
}

/**
 * The value a key is last given, as Git's `int` — see {@link tryInt} for
 * the spellings that read as one. `ok(null)` where the key is given no
 * value, and `error` with the first value that spells no number, however
 * good the ones after it: Git reads each as it comes to it and refuses the
 * file at that one.
 *
 * @type {(entries: readonly Entry[], section: string, key: string) => Result<Nullable<bigint>, string>}
 */
export const lastInt = lastOf(tryInt)

/**
 * The value a key is last given, as Git's `bool` — see {@link tryBool} for
 * the spellings that read as one. `ok(null)` where the key is given no
 * value, and `error` with the first value that spells no boolean, as for
 * {@link lastInt}.
 *
 * @type {(entries: readonly Entry[], section: string, key: string) => Result<Nullable<boolean>, string>}
 */
export const lastBool = lastOf(tryBool)
