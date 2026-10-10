/**
 * Extended JSON: the ordinary JSON data model with `bigint` added to the
 * primitive leaves, so bare integer syntax survives a parse exactly.
 *
 * It is a runtime representation, not a syntax. `stringify` emits ordinary,
 * valid JSON text — there is no `123n` literal, tagged object, or
 * quoted-integer convention — and ordinary JavaScript consumers of that text
 * are free to read it back into whatever numeric representation they use,
 * `JSON.parse`'s `number` included. What the extended codec adds is that
 * *this* codec reads it back into the same runtime value it wrote.
 *
 * ### Parse
 *
 * The split is lexical, not mathematical: **a lexeme containing `.` or `e` /
 * `E` is a `number`, even when its value is an integer.**
 *
 * ```text
 * 123    -> 123n        -123   -> -123n      0     -> 0n
 * -0     -> -0          1.5    -> 1.5        1.0   -> 1
 * 1e3    -> 1000        1E3    -> 1000
 * ```
 *
 * `-0` is the exception to bare integer syntax: `bigint` has no negative zero,
 * so keeping it as a `number` is what preserves the sign the JSON text spells.
 *
 * The extended domain is exact where it claims to be, so it rejects rather
 * than rounds: a lexeme whose value is outside the finite `number` range
 * (`1e400`) is a parse `error`, not `Infinity`. Ordinary rounding within that
 * range is inherent to `number` and is not an error — `1e-400` is `0`, and
 * `0.1` is the nearest double, as everywhere else.
 *
 * ### Serialize
 *
 * Spelling follows the runtime type of the leaf, so parsing the output returns
 * the value that was written:
 *
 * ```text
 * 0n -> 0     -> 0n        3n -> 3    -> 3n
 * 0  -> 0.0   -> 0         3  -> 3.0  -> 3
 * -0 -> -0    -> -0
 * ```
 *
 * A `bigint` is always its full base-10 digits, **never** exponent notation,
 * however large: exponent syntax belongs to the `number` side and would parse
 * back as one. A whole-valued `number` other than `-0` gets a non-integer
 * spelling (`3.0`) for the same reason. This `.0` rule is the extended codec's
 * own; the standard codec in [`../module.f.mjs`](../module.f.mjs) has its own
 * numeric spelling and does not route through here.
 *
 * `NaN`, `Infinity` and `-Infinity` cannot arrive from JSON text but can be
 * supplied programmatically, and JSON has no syntax for them. They serialize
 * as `null`, matching what `JSON.stringify` does with them.
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { NumberPolicy } from '../parser/types.ts'
 * @import { Primitive, Unknown } from './types.ts'
 * @import { Codec } from '../serializer/types.ts'
 * @import { Chunk } from '../../../text/marked/types.ts'
 */

import { error, ok } from '../../../types/result/module.f.mjs'
import { parse as parseWith } from '../parser/module.f.mjs'
import { isBareInteger, numberLexeme } from '../number/module.f.mjs'
import { codec, leafSerialize, nullSerialize } from '../serializer/module.f.mjs'

const { isFinite } = Number

const { is } = Object

/**
 * The extended numeric policy, applied to the number's exact lexeme.
 *
 * Bare integer syntax is materialized as `bigint` straight from that lexeme —
 * never through `number`, which would round anything above
 * `Number.MAX_SAFE_INTEGER`. Everything else is `number`, and is rejected if
 * the finite `number` range cannot hold it.
 *
 * @type {NumberPolicy<number | bigint>}
 */
const numberPolicy = value => {
    if (isBareInteger(numberLexeme(value))) {
        return ok(value === '-0' ? -0 : BigInt(value))
    }
    const n = Number(value)
    return isFinite(n) ? ok(n) : error(`number is out of the finite range: ${value}`)
}

/**
 * Parses `text` as extended JSON, reporting failure as a `Result` rather than
 * throwing.
 *
 * @type {(text: string) => Result<Unknown, string>}
 */
export const parse = parseWith(numberPolicy)

/** @type {List<Chunk>} */
const negativeZeroSerialize = [['-0', 'number']]

/**
 * Spells a `number` so that reparsing it returns a `number` — never a
 * `bigint`.
 *
 * A whole-valued `number` already spells itself with `.` or `e` often enough
 * (`1e+21`, `1.5`); when it does not, `.0` is appended, which is the same
 * value in JSON and the other lexical branch on the way back. `-0` is written
 * out as the exact token `-0`, the one bare integer the parser keeps as a
 * `number`.
 *
 * @type {(value: number) => List<Chunk>}
 */
const numberSerialize = value => {
    if (is(value, -0)) { return negativeZeroSerialize }
    if (!isFinite(value)) { return nullSerialize }
    const text = `${value}`
    return [[isBareInteger(numberLexeme(text)) ? `${text}.0` : text, 'number']]
}

/**
 * Spells a `bigint` as its full base-10 digits. `BigInt`'s own decimal form is
 * exactly that: no `n` suffix, and no exponent notation at any magnitude.
 *
 * @type {(value: bigint) => List<Chunk>}
 */
const bigintSerialize = value => [[`${value}`, 'number']]

/**
 * The extended codec: the `number` spelling above, and `bigint` added to the
 * leaves. `serialize` writes a value as a list of string chunks, and
 * `stringify` as ordinary JSON text.
 *
 * @type {Codec<Primitive>}
 */
export const { serialize, stringify } = codec(leafSerialize(numberSerialize)({ bigint: bigintSerialize }))
