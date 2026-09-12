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
 * - A loose ref file ignores everything after its first line;
 *   `packed-refs` refuses a blank line or a comment after the first,
 *   as `fatal: unexpected line`.
 * - A loose ref tolerates trailing space, TAB and CR;
 *   `packed-refs` separates the id from the name with exactly *one*
 *   whitespace byte, so a second space becomes the name's first character
 *   and Git then calls it `packed refname is dangerous`.
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
import { isName } from '../refname/module.f.mjs'

const slash = /** @type {const} */ (0x2F)

/** The bytes Git's own reader skips after a loose ref's id. */
const trailing = set(' \t\r')

/**
 * A hex digit, in either case. An entry of `packed-refs` and a `^` line
 * both begin with one, which is what keeps the file LL(1): a `#` can then
 * only be the header, and the header is the first line or nothing.
 */
const hexDigit = set('0123456789abcdefABCDEF')

/** The prefix a symbolic ref's target must carry, as bytes. */
const refsPrefix = /** @type {const} */ ([0x72, 0x65, 0x66, 0x73, slash])

/**
 * A loose ref file: the id, then whatever the writer left after it.
 *
 * Measured on Git 2.43.0, writing each of these into `refs/heads/master`
 * and asking `git rev-parse master`. Accepted: the id alone, the id and LF
 * as Git writes it, the id with trailing SP, TAB or CRLF, the id in upper
 * case, and the id with a second line of junk after the LF. Refused as
 * `ignoring broken ref`: a leading space, a short id, and an empty file. So
 * the first line is the whole contract and the rest of the file is not
 * read.
 */
const looseRule = /** @type {const} */ ([
    repeatFrom1(not(set(' \t\r\n'))),
    repeatFrom0(trailing),
    option(['\n', repeatFrom0(byte)]),
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
 * The keyword is case-sensitive and the whitespace after it is free.
 * Measured by writing each into `.git/HEAD` and asking
 * `git symbolic-ref HEAD`: `ref: <n>` with LF, without LF, with no space
 * after the colon, with two spaces, with a trailing space, with CRLF and
 * with a trailing TAB all give the same target. `REF: <n>` gives none —
 * Git stops recognising the file as `HEAD` at all.
 */
const symbolicRule = /** @type {const} */ ([
    'ref:',
    repeatFrom0(trailing),
    repeatFrom1(not(set(' \t\r\n'))),
    repeatFrom0(trailing),
    option('\n'),
    eof,
])

const parseSymbolic = byteParser(symbolicRule)

/**
 * Whether a whole ref name is one a symbolic ref may point at: `refs/`,
 * then a name {@link isName} takes.
 *
 * This is stricter than `git check-ref-format` and the difference is
 * measured, not assumed. `check-ref-format a/b` passes, and `ref: a/b` in
 * `HEAD` is refused; so are `ORIG_HEAD`, `MERGE_HEAD`, `HEAD`, `master`,
 * `refs` and `refs/`. `refs/x` is the shortest target Git accepts, and
 * `refs/heads/@` and `refs/@/x` both pass, which is why {@link isName}
 * takes `@` as a component.
 *
 * So `check-ref-format`'s "two components, and not `@` alone" is its own
 * rule and not this one: a target's first component must be `refs`, and
 * what follows is one name.
 *
 * @type {(name: readonly number[]) => boolean}
 */
const isTarget = name =>
    name.length > refsPrefix.length
    && refsPrefix.every((b, i) => name[i] === b)
    && isName(name.slice(refsPrefix.length))

/**
 * What a ref file holds: the ref another one names, or the id this one
 * does. `null` where the file is neither — a `ref:` line whose target is no
 * ref name, or bytes that are no id of the repository's width.
 *
 * The symbolic form is tried first because the two are disjoint: `ref:` is
 * no hex id, so a file that begins with it cannot be read as one.
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
            return isTarget(name) ? { kind: 'symbolic', target: name } : null
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

const entryRule = /** @type {const} */ ([
    repeatFrom1(hexDigit),
    set(' \t'),
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
 * The refs `packed-refs` holds, in the order the file lists them, or `null`
 * where Git would refuse the file: a line that does not end in LF, a `^`
 * line with no ref line above it, a blank line, a comment below the first
 * line, or an id or a name that is not one.
 *
 * A name is checked as a whole ref name, the same rule a symbolic ref's
 * target passes, so a packed line naming `a/b` or holding a leading space
 * is refused rather than answered. The order is the file's and not sorted
 * here: a caller that wants one shadowing rule applies it, since a loose
 * ref beats a packed one of the same name and that is not this reader's
 * question.
 *
 * @throws If the input is not a list of bytes.
 *
 * @type {(oidBytes: OidBytes) => (input: Bytes) => Nullable<readonly PackedRef[]>}
 */
export const tryPacked = oidBytes => {
    const id = tryFromHexOf(oidBytes)
    return input => {
        const r = parsePacked(symbols(input))
        if (r[0] === 'error') { return null }
        const [[, entries]] = r[1]
        /** @type {(e: Ast<typeof entryRule, Byte>) => Nullable<PackedRef>} */
        const entryOf = ([h, , n, , p]) => {
            const oid = id(symbolsOf(h))
            if (oid === null) { return null }
            const name = byteArray(symbolsOf(n))
            if (!isTarget(name)) { return null }
            const [hit] = p
            if (hit === undefined) { return { name, id: oid, peeled: null } }
            const peeled = id(symbolsOf(hit[1]))
            return peeled === null ? null : { name, id: oid, peeled }
        }
        const read = entries.map(entryOf)
        return read.every(e => e !== null) ? /** @type {readonly PackedRef[]} */ (read) : null
    }
}
