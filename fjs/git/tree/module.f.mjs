/**
 * A tree: entries of `mode SP name NUL id`, one after another with no
 * separator and no terminator. The id is the raw object id, every byte
 * value allowed, and its fixed width is what delimits an entry: nothing
 * follows it but the next entry or the end. That width is the
 * repository's, 20 bytes under SHA-1 and 32 under SHA-256, so the reader
 * and the writer take it as a parameter.
 *
 * Reading is one thing and vouching another. The reader takes any entry
 * the grammar covers — a padded mode, a name holding `/`, entries out of
 * order — so that an object `git fsck` would flag is still read, and the
 * writer returns it byte for byte. {@link validate} is where those are
 * refused, as `fsck` refuses them, over the entry list: the checks that
 * hold on every platform, not the NTFS and HFS+ look-alikes of `.git`
 * (`git~1`, `.git.`, a `.git` with ignorable code points in it) that
 * `fsck` also refuses on behalf of a checkout there.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Bytes, OidBytes } from '../types.ts'
 * @import { TreeEntry } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { ascii, byte, byteArray, byteParser, not, symbols, symbolsOf } from '../../ebnf/byte/module.f.mjs'
import { eof, range, repeatFrom0, repeatFrom1, set, times } from '../../ebnf/module.f.mjs'
import { length as bitLength, msb, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { flat } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'

const sp = /** @type {const} */ (0x20)

const nul = /** @type {const} */ (0)

const slash = /** @type {const} */ (0x2F)

const dot = /** @type {const} */ (0x2E)

const octal = range('07')

const modeDigits = repeatFrom1(octal)

const nameBytes = repeatFrom1(not(set('\0')))

const toVec = u8ListToVec(msb)

const toBytes = u8List(msb)

/**
 * Whether a list of digits spells a mode the grammar reads: one or more
 * octal digits.
 *
 * @type {(digits: readonly number[]) => boolean}
 */
const isMode = digits => digits.length !== 0 && digits.every(d => d >= 0x30 && d <= 0x37)

/** @type {(digits: readonly number[]) => number} */
const fromOctal = digits => digits.reduce((n, d) => n * 8 + d - 0x30, 0)

/**
 * The mode of an entry as the number its digits spell: `100644` is the
 * octal `0o100644`, the value Git keeps in memory.
 *
 * @throws If the digits are not one or more octal digits: an entry a
 * reader built has them, and one a caller built must.
 *
 * @type {(e: TreeEntry) => number}
 */
export const mode = e => {
    const digits = byteArray(e.mode)
    assert(isMode(digits), ['not a mode', digits])
    return fromOctal(digits)
}

/**
 * The modes Git writes, by their canonical spelling: a file, an executable,
 * a symbolic link, a submodule, and a subtree — five digits, not six.
 */
const modes = ['100644', '100755', '120000', '160000', '40000'].map(s => fromOctal(ascii(s)))

const subtree = fromOctal(ascii('40000'))

const dotGit = ascii('.git')

/** A byte with an ASCII capital folded to its small letter. @type {(b: number) => number} */
const lower = b => b >= 0x41 && b <= 0x5A ? b + 0x20 : b

/**
 * Whether a name is `.git` in any case: the entry a checkout must never
 * write, refused by `git fsck` as `hasDotgit`.
 *
 * @type {(name: readonly number[]) => boolean}
 */
const isDotGit = name => name.length === dotGit.length && name.every((b, i) => lower(b) === dotGit[i])

/**
 * Reads a tree of a repository with ids `oidBytes` wide, or refuses it: an
 * entry without SP or NUL, a mode that is not octal digits, an empty name,
 * an id cut short, or bytes after the last entry. The empty tree reads as
 * no entries.
 *
 * @throws If an item of the payload is not a byte.
 *
 * @type {(oidBytes: OidBytes) => (payload: Bytes) => Nullable<readonly TreeEntry[]>}
 */
export const tryRead = oidBytes => {
    const parse = byteParser([repeatFrom0([modeDigits, ' ', nameBytes, '\0', times(oidBytes)(byte)]), eof])
    return payload => {
        const r = parse(symbols(payload))
        if (r[0] === 'error') { return null }
        const [[entries]] = r[1]
        return entries.map(([m, , n, , id]) => ({
            mode: symbolsOf(m),
            name: symbolsOf(n),
            oid: toVec(symbolsOf(id)),
        }))
    }
}

/**
 * The bytes an entry sorts by: its name, with `/` appended where the entry
 * is a subtree, since Git orders a tree as if every subtree's name ended
 * in one.
 *
 * @type {(e: TreeEntry) => readonly number[]}
 */
const sortKey = e => mode(e) === subtree ? [...byteArray(e.name), slash] : byteArray(e.name)

/**
 * Byte-wise order: the first differing byte decides, and a prefix comes
 * first.
 *
 * @type {(a: readonly number[], b: readonly number[]) => number}
 */
const compare = (a, b) => {
    const n = Math.min(a.length, b.length)
    const i = a.findIndex((x, i) => i < n && x !== b[i])
    return i === -1 ? a.length - b.length : a[i] - b[i]
}

/**
 * What is wrong with one entry, or `null`: the checks `git fsck` makes on
 * an entry alone.
 *
 * @type {(e: TreeEntry) => Nullable<string>}
 */
const problem = e => {
    const digits = byteArray(e.mode)
    const name = byteArray(e.name)
    return digits.length > 1 && digits[0] === 0x30 ? 'zero-padded mode'
        : !modes.includes(mode(e)) ? 'unknown mode'
        : name.length === 0 ? 'empty name'
        : name.includes(slash) ? 'slash in name'
        : name.every(b => b === dot) && name.length <= 2 ? 'dot name'
        : isDotGit(name) ? '.git name'
        : null
}

/**
 * What is wrong between an entry and the one before it, or `null`: the
 * same name twice, a file and a subtree of one name included, since Git
 * refuses the pair as `duplicateEntries` whatever their modes; or the
 * order Git requires broken.
 *
 * @type {(a: TreeEntry, b: TreeEntry) => Nullable<string>}
 */
const pairProblem = (a, b) =>
    compare(byteArray(a.name), byteArray(b.name)) === 0 ? 'duplicate name'
        : compare(sortKey(a), sortKey(b)) >= 0 ? 'not sorted'
        : null

/**
 * Vouches for a tree as `git fsck` does, or refuses it, naming the first
 * entry it cannot vouch for and why: a zero-padded mode, a mode that is
 * none of the five Git writes, an empty name, a name holding `/`, a name
 * that is `.` or `..`, a name that is `.git` in any case, a name twice
 * whatever the modes, or entries out of the order Git requires — by name,
 * a subtree as if its name ended in `/`.
 *
 * Separate from {@link tryRead} on purpose: a reader reads what it can,
 * and only this says no.
 *
 * @type {(entries: readonly TreeEntry[]) => Result<readonly TreeEntry[], string>}
 */
export const validate = entries => {
    const problems = entries.map(problem)
    const i = problems.findIndex(p => p !== null)
    if (i !== -1) { return error(`${problems[i]} at ${i}`) }
    const pairs = entries.map((e, i) => i === 0 ? null : pairProblem(entries[i - 1], e))
    const j = pairs.findIndex(p => p !== null)
    return j === -1 ? ok(entries) : error(`${pairs[j]} at ${j}`)
}

/**
 * @throws On an entry the format cannot spell: a mode that is not one or
 * more octal digits, an empty name or one holding NUL, an id that is not
 * `oidBytes` wide, or a number that is no byte in the mode or the name.
 *
 * @type {(oidBytes: OidBytes) => (e: TreeEntry) => Bytes}
 */
const entryBytes = oidBytes => e => {
    const digits = byteArray(e.mode)
    const name = byteArray(e.name)
    assert(isMode(digits), ['not a mode', digits])
    assert(name.length !== 0 && !name.includes(nul), ['not a name', name])
    assert(bitLength(e.oid) === BigInt(oidBytes) * 8n, ['not an id', e.oid])
    return flat([digits, [sp], name, [nul], toBytes(e.oid)])
}

/**
 * A tree's bytes: every entry as it was read. The inverse of
 * {@link tryRead}, byte for byte, for entries in any order — a writer
 * returns what it was given, and {@link validate} is where an order is
 * required.
 *
 * @throws On an entry the format cannot spell; see {@link entryBytes}.
 *
 * @type {(oidBytes: OidBytes) => (entries: readonly TreeEntry[]) => Bytes}
 */
export const write = oidBytes => {
    const bytes = entryBytes(oidBytes)
    return entries => flat(entries.map(bytes))
}
