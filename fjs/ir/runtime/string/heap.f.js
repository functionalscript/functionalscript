/**
 * String IR module where the IR heap holds long strings
 * ([long-strings.md](../../../../doc/sasha-gil/ir/long-strings.md), H3b):
 * `length`, `unit`, `concat` and `substring` over the three forms that a
 * string takes under the note's choice 2: a short box, a long string in the
 * IR heap, whose box is `0x7FF9_0000_0000_0002 | p`, and NaNVM's own. It
 * defines Any, with the hooks of Any's `withHeap`, so that its bodies may
 * `unseal` under check, and imports the Heap interface, L0's `Memory` and
 * `Units`, and L0's String for NaNVM's strings. No program links it before
 * H3d.
 *
 * - **A long string's block** is a `u32` length, then the UTF-16 units, of
 *   type `0x40` (choice 4). A block holds at most `0x7FFF_FFFA` units, so
 *   that its bytes stay within the most that `alloc` takes, `0xFFFF_FFF8`,
 *   and a length past that is a misuse, as a forged box is.
 * - **The IR's own results are short, or in the IR heap.** `concat` of two
 *   strings that are short or in the IR heap, and `substring` of one,
 *   answer a short box where the result has 2 units at most, as NaNVM makes
 *   one under its emit policy, B, and a new block otherwise, whose units
 *   `Memory`'s `copy` writes, or the stores of a short box's units. An empty
 *   operand of `concat` answers the other, and a `substring` of every unit
 *   the string itself.
 * - **NaNVM's strings stay NaNVM's.** Where an operand of `concat` is
 *   NaNVM's, one in the IR heap is copied into a NaNVM string by `Units`'s
 *   `make_string`, as at a crossing (choice 1), and L0's `concat` joins
 *   them, so that the result is NaNVM's; a short box needs no copy. NaNVM's
 *   `length`, `unit` and `substring` answer for its strings, and B's
 *   short path for a short box, through
 *   [`ir.f.js`](./ir.f.js)'s functions.
 * - **Misuse traps, and L0's failures fail.** A sum of lengths past what a
 *   block holds is out of memory, and a short box of no tag in `concat` or
 *   `substring` is no value, both misuses. `unit` past the end and
 *   `substring` where `0 <= start <= end <= length` does not hold fail as
 *   L0's do, `not an index`.
 *
 * @module
 *
 * @import { Module, Term } from '../../types.ts'
 * @import { ShortTag } from './types.ts'
 */

import { assertOk } from '../../../asserts/module.f.js'
import { memory, ref, string, units } from '../../l0/module.f.js'
import {
    add, and, call, eq, false_, fn, hint, if_, int, le, let_, loop, lt, make, misuse, n, next, or, seal, shl, shr, sub,
    trap, true_, u, unit, unseal,
} from '../../module.f.js'
import { defines, withHeap as anyWithHeap } from '../any/module.f.js'
import { EMPTY, IR_STRING, blockTerm, isIrStringTerm } from '../box/module.f.js'
import { iface as heap } from '../heap/module.f.js'
import { byTag, fields, isShortBits, shortUnits, stringImport, unitOfTag } from './ir.f.js'
import { allTags, pack } from './short.f.js'

/** L0's index of a string's unit, and its length. */
const index = u(31)

/** A UTF-16 unit. */
const codeUnit = u(16)

/** An address in the memory. */
const address = u(32)

/** The most units that a block holds: its 4 bytes of length and 2 for each unit stay within `0xFFFF_FFF8`, the most that `alloc` takes. */
const most = 0x7FFF_FFFAn

/** The length of a block's string. */
const blockLength = int(0n, most)

/** The length of a short box's string: a tag holds 8 units at most. */
const shortLength = int(0n, 8n)

/** Which form a string's box has: 0 a short box, 1 a long string in the IR heap, 2 NaNVM's. */
const form = int(0n, 2n)

/** The type of a long string's block, which `alloc` takes: L0's kind 4 in the high nibble and form 0 in the low. */
const stringType = 0x40n

/** The box of a short string of one unit, and of two, whose units are 0: a unit's bits are `or`ed in. */
const one = assertOk(pack([0]))
const two = assertOk(pack([0, 0]))

/** L0's `Memory`'s function `name` of `args`, which the emitter writes as an instruction. @type {(name: string, args: readonly Term[]) => Term} */
const memoryOf = (name, args) => call('Memory', name, args)

/** The address `offset` bytes past `base`, which the mask keeps a `u(32)`. @type {(base: Term, offset: Term) => Term} */
const past = (base, offset) => and(add(base, offset), n(0xFFFF_FFFFn))

/** Where the units of the block at `p` start, 4 bytes in: a block is 8-aligned, so an `or` adds them. @type {(p: Term) => Term} */
const unitsOf = p => or(p, n(4n))

/** The string whose box is the bits `b`. @type {(b: Term) => Term} */
const boxed = b => seal(string, b)

/** The short box of the units `c0`, and of `c0` and `c1`, as NaNVM's emit policy B makes them. @type {(c0: Term, c1?: Term) => Term} */
const short = (c0, c1) => boxed(c1 === undefined ? or(n(one), shl(c0, n(8n))) : or(or(n(two), shl(c0, n(8n))), shl(c1, n(24n))))

/** The form of a string's bits: a short box is tested first, since an `s7x7` box may hold any nibble. @type {(b: Term) => Term} */
const formOf = b => if_(isShortBits(b), n(0n), if_(isIrStringTerm(b), n(1n), n(2n)))

/** The length of a string of form 0 or 1 by its bits. @type {(b: Term, f: Term) => Term} */
const lengthOf = (b, f) => if_(eq(f, n(0n)), call('self', 'short_length', [b]), call('self', 'block_length', [blockTerm(b)]))

/**
 * The first unit of a string of one unit, of form 0 or 1, by its bits: a
 * short box of one unit is an `s1x16`, the one tag that holds one.
 *
 * @type {(b: Term, f: Term) => Term}
 */
const firstUnit = (b, f) => if_(eq(f, n(0n)), and(shr(b, n(8n)), n(0xFFFFn)), memoryOf('load16', [unitsOf(blockTerm(b))]))

/** The unit `i` of a string of form `f`, 0 or 1, by its bits, where `i` is below its length. @type {(b: Term, f: 0n | 1n, i: Term) => Term} */
const unitFrom = (b, f, i) => f === 0n ? call('self', 'short_unit', [b, i])
    : memoryOf('load16', [past(unitsOf(blockTerm(b)), shl(i, n(1n)))])

/** The NaNVM string of the units of a long string in the IR heap, by its bits, which the caller owns. @type {(b: Term) => Term} */
const copied = b => let_('p', blockTerm(b), p =>
    call('Units', 'make_string', [unitsOf(p), call('self', 'block_length', [p])]))

/**
 * The string of a new block of `k` units, of 3 to {@link most}, which
 * `write` writes from where the block's units start, after the length. The
 * string is sealed straight from `alloc`, which answers its first owner,
 * and the writes go through its bits.
 *
 * @type {(k: Term, write: (to: Term) => Term) => Term}
 */
const block = (k, write) => let_('made', boxed(or(n(IR_STRING), call('Heap', 'alloc', [n(stringType), add(shl(k, n(1n)), n(4n))]))), s =>
    let_('q', blockTerm(unseal(s)), q =>
        let_('length', memoryOf('store32', [q, k]), () =>
            let_('units', write(unitsOf(q)), () => s))))

/**
 * The stores at `to` of the units of a short box of `tag`, from its
 * {@link fields}, in their order. `fields` lists the tags in the order of
 * `allTags`.
 *
 * @type {(to: Term, b: Term, tag: ShortTag) => Term}
 */
const stores = (to, b, tag) => {
    const [, shifts, mask, of] = fields[Number(allTags.indexOf(tag))]
    return shifts.reduceRight(
        (rest, shift, k) => let_(`unit${k}`, memoryOf('store16', [k === 0 ? to : past(to, n(BigInt(2 * k))), of(and(shr(b, n(shift)), n(mask)))]), () => rest),
        make([]))
}

/**
 * `concat` where neither string is NaNVM's: an empty one answers the other,
 * two of one unit each a short box, and any other two a new block of both
 * strings' units, where a block holds them.
 *
 * @type {(a: Term, b: Term, x: Term, y: Term, fa: Term, fb: Term) => Term}
 */
const joined = (a, b, x, y, fa, fb) => let_('la', lengthOf(x, fa), la => let_('lb', lengthOf(y, fb), lb =>
    if_(eq(la, n(0n)), b,
        if_(eq(lb, n(0n)), a,
            let_('total', add(la, lb), total =>
                if_(eq(total, n(2n)), short(firstUnit(x, fa), firstUnit(y, fb)),
                    if_(le(total, n(most)),
                        block(total, to => let_('first', call('self', 'put', [to, x, fa, la]), () =>
                            call('self', 'put', [past(to, shl(la, n(1n))), y, fb, lb]))),
                        misuse('out of memory'))))))))

/**
 * `concat` where a string is NaNVM's: one in the IR heap is copied into a
 * NaNVM string first, and L0's `concat` joins them.
 *
 * @type {(a: Term, b: Term, x: Term, y: Term, fa: Term, fb: Term) => Term}
 */
const hosted = (a, b, x, y, fa, fb) =>
    if_(eq(fa, n(1n)), let_('copy', copied(x), c => call('String', 'concat', [c, b])),
        if_(eq(fb, n(1n)), let_('copy', copied(y), c => call('String', 'concat', [a, c])),
            call('String', 'concat', [a, b])))

/**
 * `substring` of a string of form `f`, 0 or 1, of length `len`, whose bits
 * are `x`: every unit is the string itself, 2 units at most a short box,
 * and more a new block, which `copy` writes from a block and the stores of
 * each unit from a short box.
 *
 * @type {(s: Term, x: Term, f: 0n | 1n, len: Term, start: Term, end: Term) => Term}
 */
const sliced = (s, x, f, len, start, end) =>
    if_(le(end, len),
        if_(le(start, end),
            if_(if_(eq(start, n(0n)), eq(end, len), false_), s,
                let_('k', sub(end, start), k =>
                    if_(le(k, n(2n)),
                        if_(eq(k, n(0n)), boxed(n(EMPTY)),
                            if_(eq(k, n(1n)), short(unitFrom(x, f, start)),
                                short(unitFrom(x, f, start), unitFrom(x, f, add(start, n(1n)))))),
                        block(k, to => f === 1n
                            ? memoryOf('copy', [to, past(unitsOf(blockTerm(x)), shl(start, n(1n))), shl(k, n(1n))])
                            : loop('unit', [['j', shortLength, n(0n)]], j => if_(lt(j, k),
                                let_('stored', memoryOf('store16', [past(to, shl(j, n(1n))), call('self', 'short_unit', [x, add(start, j)])]), () =>
                                    next('unit', [['j', add(j, n(1n))]])),
                                make([]))))))),
            trap('not an index')),
        trap('not an index'))

/**
 * The hooks that Any's `defines` names, with the function they call, from
 * Any's `withHeap`: a long string in the IR heap counts through the Heap.
 *
 * @type {Module['functions']}
 */
const hooks = anyWithHeap.functions.filter(([k]) => k === 'isRef' || k === 'dup' || k === 'drop' || k === 'kind')

/**
 * String where the IR heap holds long strings, which `linkHeap` links from
 * H3d on: it exports String's `length`, `unit`, `concat` and `substring`.
 *
 * @type {Module}
 */
export const withHeap = {
    imports: [ref, ['Heap', heap], memory, stringImport, units],
    defines,
    functions: [
        ...hooks,
        ...shortUnits,
        // A block's length, which a block holds at most `most` of: a longer one is forged.
        ['block_length', hint('always', fn([['p', address]], blockLength, p =>
            let_('n', memoryOf('load32', [p]), k => if_(le(k, n(most)), k, misuse('not a value')))))],
        // A short box's length by its tag, whose index in `allTags` is its units.
        ['short_length', fn([['b', u(64)]], shortLength, b => byTag(b, tag => n(BigInt(allTags.indexOf(tag))), misuse('not a value')))],
        // A short box's unit `i`, which traps past its end as L0's `unit` does.
        ['short_unit', fn([['b', u(64)], ['i', index]], codeUnit, (b, i) => byTag(b, tag => unitOfTag(tag, b, i), misuse('not a value')))],
        // The stores of a short box's units at `to`, each tag's own.
        ['short_store', fn([['to', address], ['b', u(64)]], unit, (to, b) =>
            byTag(b, tag => stores(to, b, tag), misuse('not a value')))],
        // The units of a string of form 0 or 1 at `to`: a block's by one `copy`, a short box's by their stores.
        ['put', fn([['to', address], ['b', u(64)], ['f', form], ['len', blockLength]], unit, (to, b, f, len) =>
            if_(eq(f, n(1n)), memoryOf('copy', [to, unitsOf(blockTerm(b)), shl(len, n(1n))]), call('self', 'short_store', [to, b])))],
        ['length', fn([['s', string]], index, s => let_('b', unseal(s), b =>
            if_(isShortBits(b), byTag(b, tag => n(BigInt(allTags.indexOf(tag))), call('String', 'length', [s])),
                if_(isIrStringTerm(b), call('self', 'block_length', [blockTerm(b)]), call('String', 'length', [s])))))],
        ['unit', fn([['s', string], ['i', index]], codeUnit, (s, i) => let_('b', unseal(s), b =>
            if_(isShortBits(b), byTag(b, tag => unitOfTag(tag, b, i), call('String', 'unit', [s, i])),
                if_(isIrStringTerm(b),
                    let_('p', blockTerm(b), p => if_(lt(i, call('self', 'block_length', [p])),
                        memoryOf('load16', [past(unitsOf(p), shl(i, n(1n)))]),
                        call('self', 'oob', []))),
                    call('String', 'unit', [s, i])))))],
        ['concat', fn([['a', string], ['b', string]], string, (a, b) => let_('x', unseal(a), x => let_('y', unseal(b), y =>
            let_('fa', formOf(x), fa => let_('fb', formOf(y), fb =>
                if_(if_(eq(fa, n(2n)), true_, eq(fb, n(2n))), hosted(a, b, x, y, fa, fb), joined(a, b, x, y, fa, fb)))))))],
        ['substring', fn([['s', string], ['start', index], ['end', index]], string, (s, start, end) => let_('x', unseal(s), x =>
            if_(isShortBits(x), let_('len', call('self', 'short_length', [x]), len => sliced(s, x, 0n, len, start, end)),
                if_(isIrStringTerm(x), let_('len', call('self', 'block_length', [blockTerm(x)]), len => sliced(s, x, 1n, len, start, end)),
                    call('String', 'substring', [s, start, end])))))],
    ],
    exports: ['length', 'unit', 'concat', 'substring'],
}
