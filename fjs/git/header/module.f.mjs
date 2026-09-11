/**
 * The header block a commit and a tag share: `key SP value LF` lines, a
 * line beginning with SP continuing the value before it, then the empty
 * line and the message to the end of the object — or nothing, where the
 * object ends at its last header's LF, which Git reads as the same object
 * with no message.
 *
 * Generic on purpose, the way Git's own reader is: which keys are required,
 * in what order, and what their values mean are checks on the header list
 * after the parse, not branches of the grammar. A variant over the known
 * keys would conflict with the unknown-header branch on every first byte,
 * and would refuse a commit the moment a tool adds a header. So this
 * module reads the shape every commit and tag shares and understands none
 * of it; a commit reader and a tag reader interpret the list it returns.
 *
 * @module
 *
 * @import { Ast } from '../../ebnf/ast/types.ts'
 * @import { Byte } from '../../ebnf/byte/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes } from '../types.ts'
 * @import { Header, Payload } from './types.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.mjs'
import { ascii, byte, byteArray, byteLength, byteParser, not, symbols, symbolsOf } from '../../ebnf/byte/module.f.mjs'
import { eof, option, repeatFrom0, repeatFrom1, set } from '../../ebnf/module.f.mjs'
import { flat, flatMap } from '../../types/list/module.f.mjs'

const lf = /** @type {const} */ (0x0A)

const sp = /** @type {const} */ (0x20)

const key = repeatFrom1(not(set(' \n')))

const line = /** @type {const} */ ([repeatFrom0(not(set('\n'))), '\n'])

const continuation = /** @type {const} */ ([' ', line])

/**
 * One header: a key, SP, the first line, and the continuation lines.
 * LL(1) as written: a continuation round starts on SP, and what may follow
 * the repetition is a key's first byte, which is not SP, or the empty
 * line's LF.
 */
export const header = /** @type {const} */ ([key, ' ', line, repeatFrom0(continuation)])

export const headers = repeatFrom0(header)

/**
 * The payload of a commit or a tag: the header block, then the empty line
 * and the message to the end of the input — or the end of the input at
 * once, since Git ends a header block at a line that is no header and the
 * input's end is one of those. `git hash-object -t tag` writes a tag whose
 * last byte is its last header's LF, and `<id>^{}` follows it; a commit
 * spelled the same way gives up its tree. Both are the same object as the
 * spelling with the empty line and an empty message, so {@link write}
 * writes that one.
 *
 * LL(1) either way: a header begins with a key byte, which is neither SP
 * nor LF, so an LF after the block can only be the empty line and the end
 * of the input can only be the end.
 */
export const payload = /** @type {const} */ ([headers, option(['\n', repeatFrom0(byte)]), eof])

const parse = byteParser(payload)

/**
 * A header's node folded to the header: the key's bytes, and the value's,
 * each continuation line joined to the line before it by the LF that
 * separated them, with its leading SP dropped.
 *
 * @type {(node: Ast<typeof header, Byte>) => Header}
 */
const headerOf = ([k, , [first], rounds]) => [
    symbolsOf(k),
    [...symbolsOf(first), ...rounds.flatMap(([, [l]]) => [lf, ...symbolsOf(l)])],
]

/**
 * Reads the payload of a commit or a tag, or refuses it: a header line
 * without a SP, a first line beginning with SP, no empty line before the
 * end of the input.
 *
 * @type {(input: Bytes) => Nullable<Payload>}
 */
export const tryRead = input => {
    const r = parse(symbols(input))
    if (r[0] === 'error') { return null }
    const [[hs, tail]] = r[1]
    const [rest] = tail
    return { headers: hs.map(headerOf), message: rest === undefined ? [] : symbolsOf(rest[1]) }
}

/**
 * Whether a header's key is `key`, compared as bytes: the well-known keys
 * are ASCII, and a key is bytes.
 *
 * @type {(h: Header, key: string) => boolean}
 */
export const keyIs = ([k], key) => {
    const a = byteArray(k)
    const b = ascii(key)
    return a.length === b.length && a.every((x, j) => x === b[j])
}

/**
 * The value of the header at `i` where its key is `key`, or `null`: a
 * commit and a tag are read by position, as Git reads them — `tree` first
 * in one, `object` first in the other — and the same key elsewhere is a
 * header Git does not know.
 *
 * @type {(p: Payload, i: number, key: string) => Nullable<Bytes>}
 */
export const valueAt = (p, i, key) => {
    if (i >= p.headers.length) { return null }
    const h = p.headers[i]
    return keyIs(h, key) ? h[1] : null
}

/**
 * The values of every header whose key is `key`, in order: the headers
 * Git reads by key rather than position, `encoding`, `gpgsig` and
 * `mergetag` among them, wherever they sit in the list.
 *
 * @type {(p: Payload, key: string) => readonly Bytes[]}
 */
export const valuesOf = (p, key) => p.headers.flatMap(h => keyIs(h, key) ? [h[1]] : [])

/**
 * Whether a NUL sits in any header, key or value: the grammar reads one,
 * since a key is any byte but SP and LF and a value any byte at all, and
 * `git fsck` refuses the object as `nulInHeader`, so the `validate` of a
 * commit and of a tag both ask.
 *
 * @type {(p: Payload) => boolean}
 */
export const hasNulHeader = p => p.headers.some(([k, v]) => byteArray(k).includes(0) || byteArray(v).includes(0))

/**
 * A value's bytes as written: an LF in a value begins a continuation
 * line, so it is followed by the SP the reader dropped.
 *
 * @type {(value: Bytes) => Bytes}
 */
const valueBytes = flatMap(b => b === lf ? [lf, sp] : [b])

/**
 * A list a caller means as bytes, walked once to refuse an item that is no
 * byte, and handed back as the list it is, never held: a value may be as
 * long as a `mergetag`'s and a message as long as its author wrote, and
 * the writer puts neither ceiling on them that an array would.
 *
 * @throws If an item is not a byte.
 *
 * @type {(bytes: Bytes) => Bytes}
 */
const checked = bytes => {
    assertNotNullish(byteLength(bytes), 'not bytes')
    return bytes
}

/**
 * @throws On a key the format cannot spell — empty, or holding SP or LF —
 * since {@link tryRead} would read what was written as a different header,
 * and on a key or a value holding a number that is no byte, or a hole. A
 * header comes from a read or from a caller that built one, and the type
 * cannot say which numbers it holds, so the writer checks: the key as an
 * array, since its bytes are looked at, the value as the list it is.
 *
 * @type {(h: Header) => Bytes}
 */
const headerBytes = ([k, v]) => {
    const key = byteArray(k)
    assert(key.length !== 0 && key.every(b => b !== sp && b !== lf), ['not a header key', key])
    return flat([key, [sp], valueBytes(checked(v)), [lf]])
}

/**
 * A payload's bytes: every header as it was read, the empty line, and the
 * message. The inverse of {@link tryRead}, byte for byte.
 *
 * @throws On a key the format cannot spell, and on a key, a value or a
 * message holding a number that is no byte; see {@link headerBytes}.
 *
 * @type {(p: Payload) => Bytes}
 */
export const write = ({ headers, message }) =>
    flat([flat(headers.map(headerBytes)), [lf], checked(message)])
