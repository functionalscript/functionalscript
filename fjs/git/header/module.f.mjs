/**
 * The header block a commit and a tag share: `key SP value LF` lines, a
 * line beginning with SP continuing the value before it, one empty line,
 * and the message to the end of the object.
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
 * @import { Ast, Meta } from '../../ebnf/ast/types.ts'
 * @import { Byte } from '../../ebnf/byte/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes } from '../types.ts'
 * @import { Header, Payload } from './types.ts'
 */

import { byte, byteParser, not, symbols } from '../../ebnf/byte/module.f.mjs'
import { eof, repeatFrom0, repeatFrom1, set } from '../../ebnf/module.f.mjs'
import { flat, flatMap } from '../../types/list/module.f.mjs'

const lf = 0x0A

const sp = 0x20

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
 * The payload of a commit or a tag: the header block, the empty line, and
 * the message to the end of the input.
 */
export const payload = /** @type {const} */ ([headers, '\n', repeatFrom0(byte), eof])

const parse = byteParser(payload)

/** @type {(leaves: readonly Meta<Byte>[]) => readonly number[]} */
const symbolsOf = leaves => leaves.map(({ symbol }) => symbol)

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
    const [[hs, , message]] = r[1]
    return { headers: hs.map(headerOf), message: symbolsOf(message) }
}

/**
 * A value's bytes as written: an LF in a value begins a continuation
 * line, so it is followed by the SP the reader dropped.
 *
 * @type {(value: Bytes) => Bytes}
 */
const valueBytes = flatMap(b => b === lf ? [lf, sp] : [b])

/** @type {(h: Header) => Bytes} */
const headerBytes = ([k, v]) => flat([k, [sp], valueBytes(v), [lf]])

/**
 * A payload's bytes: every header as it was read, the empty line, and the
 * message. The inverse of {@link tryRead}, byte for byte.
 *
 * @type {(p: Payload) => Bytes}
 */
export const write = ({ headers, message }) =>
    flat([flat(headers.map(headerBytes)), [lf], message])
