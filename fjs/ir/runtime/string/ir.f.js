/**
 * String IR module for short-string length/unit (variant B, memory-saving):
 * defines Any, with Any's own definition and hooks from
 * [`runtime/any`](../any/module.f.js), so standalone check may `unseal`;
 * re-decodes every Sergey
 * short tag, and falls through to L0 `String.length` / `String.unit` on a
 * long miss. `linkString` merges only the reached length/unit bodies into a
 * post-`linkAny` program and keeps the String import
 * ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md) S3).
 *
 * @module
 *
 * @import { Module, Term } from '../../types.ts'
 */

import { l0, ref, string } from '../../l0/module.f.js'
import { add, and, call, eq, false_, fn, if_, le, let_, n, ne, shr, trap, u, unseal } from '../../module.f.js'
import { defines, module as anyModule } from '../any/module.f.js'

/** Tag-2 mask: non-finite scalars vs references. */
const TAG2 = 0x7FF0_0000_0000_0003n

/** Scalar family under TAG2. */
const SCALAR = 0x7FF0_0000_0000_0000n

/** Empty-string box. */
const EMPTY = 0x7FF0_0000_0000_0008n

/** Index type of L0 length/unit. */
const index = u(31)

/** UTF-16 unit. */
const codeUnit = u(16)

/** L0 String interface, for the long miss of length/unit. */
const stringImport = /** @type {NonNullable<(typeof l0)[number]>} */ (
    l0.find(([k]) => k === 'String')
)

/** Whether bits are a short-string scalar. @type {(b: Term) => Term} */
const isShortBits = b => if_(eq(and(b, n(TAG2)), n(SCALAR)), ne(and(b, n(0xCn)), n(0n)), false_)

/** @type {(b: Term, mask: bigint, value: bigint) => Term} */
const tagIs = (b, mask, value) => eq(and(b, n(mask)), n(value))

/**
 * UTF-16 unit of a 6-bit alphabet code (`$`, `0`–`9`, `A`–`Z`, `_`, `a`–`z`).
 *
 * @type {(code: Term) => Term}
 */
const fromId6 = code => if_(eq(code, n(0n)), n(0x24n),
    if_(le(code, n(10n)), add(code, n(0x2fn)),
        if_(le(code, n(36n)), add(code, n(0x36n)),
            if_(eq(code, n(37n)), n(0x5fn), add(code, n(0x3bn))))))

/**
 * Length of a short-string box, or the long import.
 *
 * @type {(s: Term) => Term}
 */
const lengthBody = s => let_('b', unseal(s), b => if_(isShortBits(b),
    if_(tagIs(b, 0xFFFF_FFFF_FFFF_FFFFn, EMPTY), n(0n),
        if_(tagIs(b, 0xFFFF_FFFF_FF00_00FFn, 0x7FF0_0000_0000_0018n), n(1n),
            if_(tagIs(b, 0xFFFF_FF00_0000_00FFn, 0x7FF0_0000_0000_0028n), n(2n),
                if_(tagIs(b, 0xFFFF_FFF0_0000_00FFn, 0x7FF0_0000_0000_0048n), n(4n),
                    if_(tagIs(b, 0xFFFF_F800_0000_00FFn, 0x7FF0_0000_0000_0058n), n(5n),
                        if_(tagIs(b, 0xFFFC_0000_0000_00FFn, 0x7FF0_0000_0000_0068n), n(6n),
                            if_(tagIs(b, 0xFFF0_0000_0000_000Fn, 0x7FF0_0000_0000_0004n), n(3n),
                                if_(tagIs(b, 0xFFF0_0000_0000_000Fn, 0x7FF0_0000_0000_000Cn), n(8n),
                                    if_(tagIs(b, 0xFFF0_0000_0000_0007n, 0xFFF0_0000_0000_0004n), n(7n),
                                        call('String', 'length', [s])))))))))),
    call('String', 'length', [s])))

/**
 * Unit at `i` of a short-string box, or the long import. Out of range traps
 * as L0's `unit` (`not an index`).
 *
 * @type {(s: Term, i: Term) => Term}
 */
const unitBody = (s, i) => let_('b', unseal(s), b => if_(isShortBits(b),
    if_(tagIs(b, 0xFFFF_FFFF_FFFF_FFFFn, EMPTY), call('self', 'oob', []),
        if_(tagIs(b, 0xFFFF_FFFF_FF00_00FFn, 0x7FF0_0000_0000_0018n),
            if_(eq(i, n(0n)), and(shr(b, n(8n)), n(0xffffn)), call('self', 'oob', [])),
            if_(tagIs(b, 0xFFFF_FF00_0000_00FFn, 0x7FF0_0000_0000_0028n),
                call('self', 'unit2', [b, i]),
                if_(tagIs(b, 0xFFFF_FFF0_0000_00FFn, 0x7FF0_0000_0000_0048n),
                    call('self', 'unit4x7', [b, i]),
                    if_(tagIs(b, 0xFFFF_F800_0000_00FFn, 0x7FF0_0000_0000_0058n),
                        call('self', 'unit5x7', [b, i]),
                        if_(tagIs(b, 0xFFFC_0000_0000_00FFn, 0x7FF0_0000_0000_0068n),
                            call('self', 'unit6x7', [b, i]),
                            if_(tagIs(b, 0xFFF0_0000_0000_000Fn, 0x7FF0_0000_0000_0004n),
                                call('self', 'unit3x16', [b, i]),
                                if_(tagIs(b, 0xFFF0_0000_0000_000Fn, 0x7FF0_0000_0000_000Cn),
                                    call('self', 'unit8', [b, i]),
                                    if_(tagIs(b, 0xFFF0_0000_0000_0007n, 0xFFF0_0000_0000_0004n),
                                        call('self', 'unit7x7', [b, i]),
                                        call('String', 'unit', [s, i])))))))))),
    call('String', 'unit', [s, i])))

/**
 * Unrolled unit at a fixed shift: compares `i` to each index so the shift
 * count stays a singleton below 64.
 *
 * @type {(b: Term, i: Term, shifts: readonly bigint[], mask: bigint) => Term}
 */
const unitAt = (b, i, shifts, mask) => {
    /** @type {(k: number) => Term} */
    const go = k => k === shifts.length ? call('self', 'oob', [])
        : if_(eq(i, n(BigInt(k))), and(shr(b, n(shifts[Number(k)])), n(mask)), go(k + 1))
    return go(0)
}

/**
 * The hooks that Any's `defines` names, with the function they call, taken
 * from Any's own module: the one definition of how a box is counted and
 * which kind it is.
 *
 * @type {Module['functions']}
 */
const anyHooks = anyModule.functions.filter(([k]) => k === 'isRef' || k === 'dup' || k === 'drop' || k === 'kind')

/**
 * Variant B String IR module: it defines Any, as Any's module does, only so
 * standalone check may `unseal`; `linkString` reaches length/unit (and their
 * helpers) alone.
 *
 * @type {Module}
 */
export const module = {
    imports: [ref, stringImport],
    defines,
    functions: [
        ...anyHooks,
        // Shared OOB trap for short unit.
        ['oob', fn([], codeUnit, () => trap('not an index'))],
        ['unit2', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [8n, 24n], 0xffffn))],
        ['unit3x16', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [4n, 20n, 36n], 0xffffn))],
        ['unit4x7', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [8n, 15n, 22n, 29n], 0x7fn))],
        ['unit5x7', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [8n, 15n, 22n, 29n, 36n], 0x7fn))],
        ['unit6x7', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [8n, 15n, 22n, 29n, 36n, 43n], 0x7fn))],
        ['unit7x7', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [3n, 10n, 17n, 24n, 31n, 38n, 45n], 0x7fn))],
        // Eight 6-bit alphabet codes starting at bit 4.
        ['unit8', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            if_(eq(i, n(0n)), fromId6(and(shr(b, n(4n)), n(0x3fn))),
                if_(eq(i, n(1n)), fromId6(and(shr(b, n(10n)), n(0x3fn))),
                    if_(eq(i, n(2n)), fromId6(and(shr(b, n(16n)), n(0x3fn))),
                        if_(eq(i, n(3n)), fromId6(and(shr(b, n(22n)), n(0x3fn))),
                            if_(eq(i, n(4n)), fromId6(and(shr(b, n(28n)), n(0x3fn))),
                                if_(eq(i, n(5n)), fromId6(and(shr(b, n(34n)), n(0x3fn))),
                                    if_(eq(i, n(6n)), fromId6(and(shr(b, n(40n)), n(0x3fn))),
                                        if_(eq(i, n(7n)), fromId6(and(shr(b, n(46n)), n(0x3fn))),
                                            call('self', 'oob', []))))))))))],
        ['length', fn([['s', string]], index, s => lengthBody(s))],
        ['unit', fn([['s', string], ['i', index]], codeUnit, (s, i) => unitBody(s, i))],
    ],
    exports: ['length', 'unit'],
}
