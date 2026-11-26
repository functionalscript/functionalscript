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
 * @import { ShortTag } from './types.ts'
 */

import { l0, ref, string } from '../../l0/module.f.js'
import { add, and, call, eq, false_, fn, if_, le, let_, n, ne, shr, trap, u, unseal } from '../../module.f.js'
import { defines, module as anyModule } from '../any/module.f.js'
import { SCALAR, TAG2 } from '../box/module.f.js'
import { allTags, patterns } from './short.f.js'

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
 * The short tags tested in turn, in the order of `short.f.js`'s
 * {@link patterns}: the answer of the first that `b` matches, or `miss`.
 *
 * @type {(b: Term, answer: (tag: ShortTag) => Term, miss: Term) => Term}
 */
const byTag = (b, answer, miss) => patterns.reduceRight(
    (rest, [tag, mask, value]) => if_(tagIs(b, mask, value), answer(tag), rest),
    miss)

/**
 * Length of a short-string box, or the long import. A tag's index in
 * `allTags` is the unit count it holds.
 *
 * @type {(s: Term) => Term}
 */
const lengthBody = s => let_('b', unseal(s), b => if_(isShortBits(b),
    byTag(b, tag => n(BigInt(allTags.indexOf(tag))), call('String', 'length', [s])),
    call('String', 'length', [s])))

/**
 * Unit at `i` of a short tag's box: the empty string has none, a one-unit
 * string's is inline, and the others call this module's function for the tag.
 *
 * @type {(tag: ShortTag, b: Term, i: Term) => Term}
 */
const unitOfTag = (tag, b, i) => tag === 'empty' ? call('self', 'oob', [])
    : tag === 's1x16' ? if_(eq(i, n(0n)), and(shr(b, n(8n)), n(0xffffn)), call('self', 'oob', []))
    : call('self', `unit_${tag}`, [b, i])

/**
 * Unit at `i` of a short-string box, or the long import. Out of range traps
 * as L0's `unit` (`not an index`).
 *
 * @type {(s: Term, i: Term) => Term}
 */
const unitBody = (s, i) => let_('b', unseal(s), b => if_(isShortBits(b),
    byTag(b, tag => unitOfTag(tag, b, i), call('String', 'unit', [s, i])),
    call('String', 'unit', [s, i])))

/**
 * Unrolled unit at a fixed shift, mapped by `of`: compares `i` to each index
 * so the shift count stays a singleton below 64.
 *
 * @type {(b: Term, i: Term, shifts: readonly bigint[], mask: bigint, of: (bits: Term) => Term) => Term}
 */
const unitOf = (b, i, shifts, mask, of) => {
    /** @type {(k: number) => Term} */
    const go = k => k === shifts.length ? call('self', 'oob', [])
        : if_(eq(i, n(BigInt(k))), of(and(shr(b, n(shifts[Number(k)])), n(mask))), go(k + 1))
    return go(0)
}

/** {@link unitOf} where the bits are the unit itself. @type {(b: Term, i: Term, shifts: readonly bigint[], mask: bigint) => Term} */
const unitAt = (b, i, shifts, mask) => unitOf(b, i, shifts, mask, bits => bits)

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
        ['unit_s2x16', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [8n, 24n], 0xffffn))],
        ['unit_s3x16', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [4n, 20n, 36n], 0xffffn))],
        ['unit_s4x7', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [8n, 15n, 22n, 29n], 0x7fn))],
        ['unit_s5x7', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [8n, 15n, 22n, 29n, 36n], 0x7fn))],
        ['unit_s6x7', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [8n, 15n, 22n, 29n, 36n, 43n], 0x7fn))],
        ['unit_s7x7', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitAt(b, i, [3n, 10n, 17n, 24n, 31n, 38n, 45n], 0x7fn))],
        // Eight 6-bit alphabet codes starting at bit 4.
        ['unit_s8x6', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) =>
            unitOf(b, i, [4n, 10n, 16n, 22n, 28n, 34n, 40n, 46n], 0x3fn, fromId6))],
        ['length', fn([['s', string]], index, s => lengthBody(s))],
        ['unit', fn([['s', string], ['i', index]], codeUnit, (s, i) => unitBody(s, i))],
    ],
    exports: ['length', 'unit'],
}
