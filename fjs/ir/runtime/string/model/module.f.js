/**
 * A plain FunctionalScript model of String's IR module where the IR heap
 * holds long strings ([heap.f.js](../heap.f.js),
 * [long-strings.md, choice 2](../../../../../doc/sasha-gil/ir/long-strings.md#2-which-long-strings-live-in-the-ir-heap)),
 * which the module's host proof runs beside its WASM on the same
 * operations: each result must have the model's form and units, and where
 * the model answers an operand itself, the operand's bits.
 *
 * - **A string is its form and its units** ({@link Str}): a short box, a
 *   block in the IR heap, or the host's own.
 * - **What the IR makes** is short where it has 2 units at most, as
 *   NaNVM's emit policy B boxes them, and a block otherwise.
 * - **`concat`** of two strings that are short or in the IR heap answers
 *   the other where one is empty, and what the IR makes otherwise. Where
 *   one is the host's, the host joins them, so the result is the host's,
 *   or short where the host's emit policy boxes that many units,
 *   `hostShort` at most.
 * - **`substring`** answers `null` where `0 <= start <= end <= length`
 *   does not hold, where the module fails. Of a string that is short or in
 *   the IR heap, every unit is the string itself, and any other part what
 *   the IR makes; of the host's, the host's part, as for `concat`.
 * - **No cap.** A sum past `0x7FFF_FFFA` units is out of memory in the
 *   module, which no proof reaches, so the model has none.
 *
 * @module
 *
 * @import { Str } from './types.ts'
 */

/** The string of the host's units `units`: short where the host boxes that many, `hostShort` at most. @type {(hostShort: number, units: readonly number[]) => Str} */
const hosted = (hostShort, units) => ({ form: units.length <= hostShort ? 'short' : 'host', units })

/** The string of `units` that the IR makes: short at 2 units at most, and a block otherwise. @type {(units: readonly number[]) => Str} */
export const made = units => ({ form: units.length <= 2 ? 'short' : 'ir', units })

/** `concat` of `a` and `b`, where the host boxes `hostShort` units at most. @type {(hostShort: number) => (a: Str, b: Str) => Str} */
export const concat = hostShort => (a, b) =>
    a.form === 'host' || b.form === 'host' ? hosted(hostShort, [...a.units, ...b.units])
    : a.units.length === 0 ? b
    : b.units.length === 0 ? a
    : made([...a.units, ...b.units])

/** `substring` of `s` from `start` to `end`, or `null` where the module fails. @type {(hostShort: number) => (s: Str, start: number, end: number) => Str | null} */
export const substring = hostShort => (s, start, end) =>
    !(0 <= start && start <= end && end <= s.units.length) ? null
    : s.form === 'host' ? hosted(hostShort, s.units.slice(start, end))
    : start === 0 && end === s.units.length ? s
    : made(s.units.slice(start, end))

/** The unit `i` of `s`, or `null` where the module fails, past its end. @type {(s: Str, i: number) => number | null} */
export const unit = (s, i) => 0 <= i && i < s.units.length ? s.units[Number(i)] : null
