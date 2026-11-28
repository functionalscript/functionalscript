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
export const stringImport = /** @type {NonNullable<(typeof l0)[number]>} */ (
    l0.find(([k]) => k === 'String')
)

/** Whether bits are a short-string scalar. @type {(b: Term) => Term} */
export const isShortBits = b => if_(eq(and(b, n(TAG2)), n(SCALAR)), ne(and(b, n(0xCn)), n(0n)), false_)

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

/** A field that is the unit itself. @type {(bits: Term) => Term} */
const plain = bits => bits

/**
 * Where each short tag keeps its units: the shift of each unit's field, in
 * the units' order, the mask of a field, and how a field reads as its
 * unit, which only `s8x6` maps, through its 6-bit alphabet. A tag's units
 * are as many as its shifts.
 *
 * @type {readonly (readonly [tag: ShortTag, shifts: readonly bigint[], mask: bigint, of: (bits: Term) => Term])[]}
 */
export const fields = [
    ['empty', [], 0n, plain],
    ['s1x16', [8n], 0xffffn, plain],
    ['s2x16', [8n, 24n], 0xffffn, plain],
    ['s3x16', [4n, 20n, 36n], 0xffffn, plain],
    ['s4x7', [8n, 15n, 22n, 29n], 0x7fn, plain],
    ['s5x7', [8n, 15n, 22n, 29n, 36n], 0x7fn, plain],
    ['s6x7', [8n, 15n, 22n, 29n, 36n, 43n], 0x7fn, plain],
    ['s7x7', [3n, 10n, 17n, 24n, 31n, 38n, 45n], 0x7fn, plain],
    // Eight 6-bit alphabet codes starting at bit 4.
    ['s8x6', [4n, 10n, 16n, 22n, 28n, 34n, 40n, 46n], 0x3fn, fromId6],
]

/**
 * The short tags tested in turn, in the order of `short.f.js`'s
 * {@link patterns}: the answer of the first that `b` matches, or `miss`.
 *
 * @type {(b: Term, answer: (tag: ShortTag) => Term, miss: Term) => Term}
 */
export const byTag = (b, answer, miss) => patterns.reduceRight(
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
export const unitOfTag = (tag, b, i) => tag === 'empty' ? call('self', 'oob', [])
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
 * so the shift count stays a singleton below 64, and `beyond` past the last.
 *
 * @type {(b: Term, i: Term, shifts: readonly bigint[], mask: bigint, of: (bits: Term) => Term, beyond: Term) => Term}
 */
export const unitOf = (b, i, shifts, mask, of, beyond) => {
    /** @type {(k: number) => Term} */
    const go = k => k === shifts.length ? beyond
        : if_(eq(i, n(BigInt(k))), of(and(shr(b, n(shifts[Number(k)])), n(mask))), go(k + 1))
    return go(0)
}

/**
 * The functions of the short path's units, which a module that answers
 * them holds: `oob`, the trap past the end, and the unit of each tag that
 * holds more than one, from its {@link fields}.
 *
 * @type {Module['functions']}
 */
export const shortUnits = [
    // Shared OOB trap for short unit.
    ['oob', fn([], codeUnit, () => trap('not an index'))],
    ...fields.filter(([, shifts]) => shifts.length > 1).map(([tag, shifts, mask, of]) => /** @type {const} */ ([
        `unit_${tag}`,
        fn([['b', u(64)], ['i', index]], codeUnit, (b, i) => unitOf(b, i, shifts, mask, of, call('self', 'oob', []))),
    ])),
]

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
        ...shortUnits,
        ['length', fn([['s', string]], index, s => lengthBody(s))],
        ['unit', fn([['s', string], ['i', index]], codeUnit, (s, i) => unitBody(s, i))],
    ],
    exports: ['length', 'unit'],
}
