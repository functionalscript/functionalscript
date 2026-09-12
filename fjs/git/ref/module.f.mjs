/**
 * The three files a repository keeps its refs in, read as the grammars they
 * are: a loose ref, `HEAD` and any other symbolic ref, and `packed-refs`.
 *
 * All three are text and delimiter-framed, so they are grammars over the
 * byte alphabet like the objects, and all three are read here with no
 * effects — finding and opening the files is
 * [`todo/refs.md`](../todo/refs.md)'s remaining step.
 *
 * The three do not agree with each other, and every disagreement below was
 * measured against Git 2.43.0 rather than read off a manual page. The
 * differences are not tidy and a reader that assumed one rule for all three
 * would be wrong about each:
 *
 * - A loose ref file need not end in LF, and `packed-refs` refuses a last
 *   line that does not: `fatal: unterminated line in .git/packed-refs`.
 * - A loose ref file ignores everything after *one whitespace byte*
 *   following the id, LF or not, so `<id> comment` resolves; `packed-refs`
 *   refuses a blank line or a comment after the first, as
 *   `fatal: unexpected line`; and a symbolic ref refuses a second line
 *   outright, as `No such ref`. Three files, three answers to the same
 *   question.
 * - A symbolic ref treats LF as whitespace around its target, so
 *   `ref:\nrefs/heads/master\n` resolves; `packed-refs` treats LF as the
 *   line ending and nothing else, and separates the id from the name with
 *   exactly *one* byte of SP, TAB or CR, so a second space becomes the
 *   name's first character and Git then calls it
 *   `packed refname is dangerous`.
 *
 * A hex id is read case-insensitively, which is Git's reading and this
 * repository's: a loose ref holding an id in upper case resolves, and
 * `fjs/git/oid`'s `tryFromHex` takes either case already.
 *
 * @module
 *
 * @import { Ast } from '../../ebnf/ast/types.ts'
 * @import { Byte } from '../../ebnf/byte/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, Oid, OidBytes } from '../types.ts'
 * @import { PackedRef, Ref } from './types.ts'
 */

import { byte, byteArray, byteParser, not, symbols, symbolsOf } from '../../ebnf/byte/module.f.mjs'
import { eof, option, repeatFrom0, repeatFrom1, set } from '../../ebnf/module.f.mjs'
import { tryFromHexOf } from '../oid/module.f.mjs'
import { isWholeName } from '../refname/module.f.mjs'

/**
 * The bytes Git counts as whitespace in these files: SP, TAB, CR and LF.
 *
 * LF is one of them, which is the part that is easy to get wrong, because a
 * ref file is line-shaped and LF looks like a terminator rather than a
 * space. Measured on Git 2.43.0: `ref:` and its target may be separated by
 * an LF, so `ref:\nrefs/heads/master\n` resolves, and a symbolic ref may end
 * in any number of them.
 *
 * VT and FF are *not* whitespace here, though C's `isspace` counts them: a
 * `packed-refs` line separated by either is `unexpected line`.
 */
const space = set(' \t\r\n')

/**
 * A hex digit, in either case. An entry of `packed-refs` and a `^` line
 * both begin with one, which is what keeps the file LL(1): a `#` can then
 * only be the header, and the header is the first line or nothing.
 */
const hexDigit = set('0123456789abcdefABCDEF')

/**
 * A loose ref file: the id, then one whitespace byte, then anything at all.
 *
 * That last part is wider than it looks and I had it too narrow. Git's
 * `parse_loose_ref_contents` refuses trailing data only when the byte
 * straight after the id is not whitespace, so *one* whitespace byte opens
 * the rest of the file and nothing in it is read. Measured on Git 2.43.0 by
 * writing each into `refs/heads/master` and asking `git rev-parse master`:
 *
 * | file | |
 * | --- | --- |
 * | `<id>` | resolves — no terminator needed |
 * | `<id>` LF, CRLF, SP, TAB | resolves |
 * | `<id>` LF `junk` LF | resolves |
 * | `<id>` SP `comment` LF | resolves, and TAB or CR the same |
 * | `<id>xcomment` LF | `ignoring broken ref` — no whitespace after the id |
 * | SP `<id>` LF | `ignoring broken ref` |
 * | a short id, an empty file | `ignoring broken ref` |
 *
 * So the grammar is not "the first line is the contract". It is "the id,
 * then whitespace, then don't care", and the last row is what makes the
 * whitespace load-bearing rather than decorative.
 */
const looseRule = /** @type {const} */ ([
    repeatFrom1(not(space)),
    option([space, repeatFrom0(byte)]),
    eof,
])

const parseLoose = byteParser(looseRule)

/**
 * The id a loose ref file names, or `null` where Git would call the ref
 * broken: no id on the first line, an id of another width, or a first byte
 * that is whitespace.
 *
 * The width is the repository's, so a SHA-1 id in a SHA-256 repository is
 * refused rather than resolved — the same check every header naming an
 * object makes.
 *
 * @throws If the input is not a list of bytes.
 *
 * @type {(oidBytes: OidBytes) => (input: Bytes) => Nullable<Oid>}
 */
export const tryLoose = oidBytes => {
    const id = tryFromHexOf(oidBytes)
    return input => {
        const r = parseLoose(symbols(input))
        if (r[0] === 'error') { return null }
        const [[hex]] = r[1]
        return id(symbolsOf(hex))
    }
}

/**
 * A symbolic ref: the keyword, whatever whitespace follows it, the target
 * name, and whatever whitespace ends the line.
 *
 * The keyword is case-sensitive and the whitespace around the target is
 * free on both sides, {@link space} included — so an LF between `ref:` and
 * the target is whitespace and not a terminator. Measured by writing each
 * into `.git/HEAD` and asking `git symbolic-ref HEAD`: `ref: <n>` with LF,
 * without LF, with no space after the colon, with two spaces, with a
 * trailing space, with CRLF, with a trailing TAB, with the target on the
 * *next* line, and with two or three trailing LFs all give the same target.
 * `REF: <n>` gives none — Git stops recognising the file as `HEAD` at all.
 *
 * What ends it is whitespace or the file, and nothing else: `ref: <n>` LF
 * `junk` LF is `No such ref`. That is the one place a symbolic ref is
 * stricter than a loose ref, which ignores exactly such a second line.
 */
const symbolicRule = /** @type {const} */ ([
    'ref:',
    repeatFrom0(space),
    repeatFrom1(not(space)),
    repeatFrom0(space),
    eof,
])

const parseSymbolic = byteParser(symbolicRule)

/**
 * What a ref file holds: the ref another one names, or the id this one
 * does. `null` where the file is neither — a `ref:` line whose target is no
 * ref name, or bytes that are no id of the repository's width.
 *
 * The symbolic form is tried first because the two are disjoint: `ref:` is
 * no hex id, so a file that begins with it cannot be read as one.
 *
 * The target is a whole ref name, `refname`'s {@link isWholeName}, and one
 * level is enough: measured on Git 2.43.0, a symbolic ref at
 * `refs/heads/sym` pointing at `master`, `a/b` or `refs` resolves, and only
 * `@` alone and the names that rule already refuses do not.
 *
 * This reader is deliberately not a `HEAD` reader, and `HEAD` is the one ref
 * with a rule of its own: its target must sit under `refs/`. That rule is
 * about repository validity rather than ref names — writing `ref: a/b` into
 * `.git/HEAD` stops Git reading the directory as a repository at all, where
 * the same target in `refs/heads/sym` resolves — so it belongs to a caller
 * that knows which file it opened, and finding and opening the files is the
 * step after this one.
 *
 * @throws If the input is not a list of bytes.
 *
 * @type {(oidBytes: OidBytes) => (input: Bytes) => Nullable<Ref>}
 */
export const tryRef = oidBytes => {
    const loose = tryLoose(oidBytes)
    return input => {
        const bs = byteArray(input)
        const r = parseSymbolic(symbols(bs))
        if (r[0] !== 'error') {
            const [[, , target]] = r[1]
            const name = byteArray(symbolsOf(target))
            return isWholeName(name) ? { kind: 'symbolic', target: name } : null
        }
        const id = loose(bs)
        return id === null ? null : { kind: 'direct', id }
    }
}

/**
 * `packed-refs`: an optional header line, then one line per ref, each
 * possibly followed by the `^` line that gives what a tag points at.
 *
 * Every line ends in LF, including the last, which is the rule a loose ref
 * does not have. The header is the literal `# pack-refs with:` on the first
 * line and nothing else: any other `#` line is `fatal: unexpected line`
 * wherever it sits, a second header included, and so is a blank line. Git
 * has no comment syntax in this file — see {@link header}.
 * The id and the name are separated by exactly one whitespace byte — a
 * second space joins the name, and Git then refuses the name rather than
 * the line.
 *
 * Sorting is not required to read one. Git writes
 * `# pack-refs with: peeled fully-peeled sorted` and reads an unsorted file
 * without complaint, so the header is a note about what the writer did and
 * not a promise this reader may lean on.
 */
/**
 * The only comment `packed-refs` has: the header Git writes, matched on this
 * exact prefix and nothing else after the `#`.
 *
 * A `#` line is not a comment here, which is the rule a reader would most
 * likely get wrong, and the boundary is exact. Measured with `git show-ref`
 * on Git 2.43.0, each as the first line above one ref line:
 *
 * | first line | |
 * | --- | --- |
 * | `# pack-refs with:` | accepted, and anything may follow the colon |
 * | `# pack-refs with` | `unexpected line` — the colon is required |
 * | `#pack-refs with:` | `unexpected line` — the space is required |
 * | `#  pack-refs with:` | `unexpected line` — exactly one space |
 * | `# Pack-refs with:` | `unexpected line` — case-sensitive |
 * | `# hello`, `#` | `unexpected line` |
 *
 * So Git has no comment syntax in this file, only this one header, and a
 * file carrying any other `#` line is one Git refuses rather than reads.
 * Accepting it would answer plausible refs for a file Git rejects, which is
 * the silence [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * forbids.
 */
const header = /** @type {const} */ ('# pack-refs with:')

const peeledRule = /** @type {const} */ (['^', repeatFrom1(hexDigit), '\n'])

/**
 * The one byte between a packed id and its name, and there is exactly one of
 * them: a second space becomes the name's first character and Git then
 * refuses the *name*, as `packed refname is dangerous`.
 *
 * CR counts, which is the row I had missing — `<id>` CR `<name>` LF is read
 * by `git show-ref`. LF does not, since it ends the line, and VT and FF do
 * not either: both give `unexpected line`. So this is {@link space} without
 * the LF, and not C's `isspace`.
 */
const separator = set(' \t\r')

const entryRule = /** @type {const} */ ([
    repeatFrom1(hexDigit),
    separator,
    repeatFrom1(not(set('\n'))),
    '\n',
    option(peeledRule),
])

const packedRule = /** @type {const} */ ([
    option([header, repeatFrom0(not(set('\n'))), '\n']),
    repeatFrom0(entryRule),
    eof,
])

const parsePacked = byteParser(packedRule)

/**
 * One `packed-refs` entry as a {@link PackedRef}, or `null` where the line
 * carries an id of another width, a name that is no whole ref name, or a
 * `^` line whose id is neither.
 *
 * The reader of ids is a leading parameter rather than a capture, so this
 * closes over nothing and lives here instead of inside {@link tryPacked}.
 *
 * @type {(id: (hex: Bytes) => Nullable<Oid>) => (e: Ast<typeof entryRule, Byte>) => Nullable<PackedRef>}
 */
const entryOf = id => ([h, , n, , p]) => {
    const oid = id(symbolsOf(h))
    if (oid === null) { return null }
    const name = byteArray(symbolsOf(n))
    if (!isWholeName(name)) { return null }
    const [hit] = p
    if (hit === undefined) { return { name, id: oid, peeled: null } }
    const peeled = id(symbolsOf(hit[1]))
    return peeled === null ? null : { name, id: oid, peeled }
}

/**
 * The refs `packed-refs` holds, in the order the file lists them, or `null`
 * where Git would refuse the file: a line that does not end in LF, a `^`
 * line with no ref line above it, a blank line, a comment below the first
 * line, or an id or a name that is not one.
 *
 * A name is checked as a whole ref name, the same rule a symbolic ref's
 * target passes, so one level is enough: `git show-ref` reads a line naming
 * `master`, `a` or `a/b`, and what it refuses is `@` alone, reported as
 * `packed refname is dangerous`, a leading or trailing space, and the
 * names that rule already refuses. The order is the file's and not sorted
 * here: a caller that wants one shadowing rule applies it, since a loose
 * ref beats a packed one of the same name and that is not this reader's
 * question.
 *
 * @throws If the input is not a list of bytes.
 *
 * @type {(oidBytes: OidBytes) => (input: Bytes) => Nullable<readonly PackedRef[]>}
 */
export const tryPacked = oidBytes => {
    const entry = entryOf(tryFromHexOf(oidBytes))
    return input => {
        const r = parsePacked(symbols(input))
        if (r[0] === 'error') { return null }
        const [[, entries]] = r[1]
        const read = entries.map(entry)
        return read.every(e => e !== null) ? /** @type {readonly PackedRef[]} */ (read) : null
    }
}
