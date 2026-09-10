/**
 * An ident: the value of an `author`, `committer` or `tagger` header,
 * `name SP < email > SP time SP tz`, read as a second pass over the bytes
 * the header block cut out.
 *
 * The SP before `<` cannot be a symbol of the rule: the name's repetition
 * may end in SP, so `' <'` after it is a first/follow conflict the backend
 * refuses. The name is read up to `<`, and the reader requires its last
 * byte to be SP and drops it, refusing a name that does not end in one.
 * `eof` closes the rule, so trailing bytes are refused rather than left.
 *
 * Git's own reader is lenient, and old history holds idents without an
 * email or with a malformed zone. This reader is a `try*`: an ident the
 * grammar does not cover is refused, not repaired, and the raw header
 * stays in the header list either way. Which of those forms are worth
 * accepting is decided when one is met, as an issue naming the object.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes } from '../types.ts'
 * @import { Ident } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { ascii, byteArray, byteParser, not, symbols, symbolsOf } from '../../ebnf/byte/module.f.mjs'
import { eof, range, repeatFrom0, repeatFrom1, set, times } from '../../ebnf/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { flat } from '../../types/list/module.f.mjs'

const sp = /** @type {const} */ (0x20)

const lf = /** @type {const} */ (0x0A)

const lt = /** @type {const} */ (0x3C)

const gt = /** @type {const} */ (0x3E)

const digit = range('09')

const name = repeatFrom0(not(set('<\n')))

const email = repeatFrom0(not(set('>\n')))

const time = repeatFrom1(digit)

const zone = /** @type {const} */ ([set('+-'), times(4)(digit)])

/** The ident rule, to the end of the value. */
export const ident = /** @type {const} */ ([name, '<', email, '>', ' ', time, ' ', zone, eof])

const parse = byteParser(ident)

/**
 * Whether a digit string is canonical decimal — no leading zero ahead of
 * another digit — so that what is read is what {@link write} spells.
 *
 * @type {(digits: readonly number[]) => boolean}
 */
const canonical = digits => digits.length === 1 || digits[0] !== 0x30

/** @type {(digits: readonly number[]) => bigint} */
const decimal = digits => digits.reduce((n, d) => n * 10n + BigInt(d - 0x30), 0n)

/**
 * Reads an ident, or refuses it: no `<` or `>`, a name that does not end
 * in SP, a time that is not canonical decimal, a zone that is not a sign
 * and four digits, or anything after the zone.
 *
 * @throws If an item of the value is not a byte.
 *
 * @type {(value: Bytes) => Nullable<Ident>}
 */
export const tryRead = value => {
    const r = parse(symbols(value))
    if (r[0] === 'error') { return null }
    const [[n, , e, , , t, , [sign, z]]] = r[1]
    const spaced = symbolsOf(n)
    const digits = symbolsOf(t)
    return spaced.length !== 0 && spaced[spaced.length - 1] === sp && canonical(digits)
        ? {
            name: spaced.slice(0, -1),
            email: symbolsOf(e),
            time: decimal(digits),
            tz: codePointListToString([sign.symbol, ...symbolsOf(z)]),
        }
        : null
}

/**
 * Whether `tz` is a zone as the format spells it: a sign and four digits.
 *
 * @type {(tz: string) => boolean}
 */
const isZone = tz => {
    const c = ascii(tz)
    return c.length === 5 && (c[0] === 0x2B || c[0] === 0x2D) && c.slice(1).every(d => d >= 0x30 && d <= 0x39)
}

/**
 * An ident's bytes, as a header value: the inverse of {@link tryRead},
 * byte for byte.
 *
 * @throws On an ident the format cannot spell — a name holding `<` or LF,
 * an email holding `>` or LF, a negative time, a zone that is not a sign
 * and four digits — or a name or email holding a number that is no byte.
 *
 * @type {(i: Ident) => Bytes}
 */
export const write = ({ name, email, time, tz }) => {
    const n = byteArray(name)
    const e = byteArray(email)
    assert(n.every(b => b !== lt && b !== lf), ['not a name', n])
    assert(e.every(b => b !== gt && b !== lf), ['not an email', e])
    assert(time >= 0n, ['not a time', time])
    assert(isZone(tz), ['not a zone', tz])
    return flat([n, [sp, lt], e, [gt, sp], ascii(`${time} ${tz}`)])
}
