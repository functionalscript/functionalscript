/**
 * Modules that the proofs under `fjs/ir` share, written by hand in the
 * constructors of [`module.f.js`](./module.f.js): `samples`, functions
 * of the kind that the first slice is for, among them one for each integer
 * instruction that the emitter writes, `corners`, the forms that the
 * emitter handles once each, `unknown`, functions over values of unknown
 * kind, as the third slice reads them, `loops`, the fourth slice's,
 * `records`, the fifth's, `constants`, `literals` and `arrays`, the
 * sixth's, and `throws`, the seventh's, which is in the plain stage, for
 * the lifetime pass, `bits`, the bit operators and a float's bits that
 * a runtime written in the IR reads a NaN box with, `addressing`, the
 * loads, the stores, `size` and `grow` of L0's `Memory`, which the heap of
 * such a runtime keeps its blocks with, and `narrowing`, branches on
 * comparisons that narrow a local, as that heap checks its pointers.
 * The [host proof](./wasm/proof.mjs) runs them all against JavaScript
 * twins.
 *
 * Data only, so no proof of its own: what each module is, is checked
 * wherever it is read.
 *
 * @import { Module, Term, Type } from './types.ts'
 */

import { any, builder, container, kinds, l0, memory, ref } from './l0/module.f.js'
import { isRefTerm } from './runtime/box/module.f.js'
import {
    abs, add, and, block, bool, br, call, cast, constant, div, eq, exact, f64, f64c, false_, field, float, fn, from_bits, get, i,
    if_, int, le, let_, lit, loop, lt, make, match, mul, n, ne, neg, never, next, not, only, or, own, product, return_, shl, shr,
    canon, seal as sealOf, sealed, sqrt, sub, throw_, to_bits, trap, true_, trunc_sat, u, unit, unseal, variant, xor,
} from './module.f.js'

/** `2 ** 40`, beside which `diff`'s operands lie. */
const far = 1n << 40n

/** A float literal, of `f64c` as a literal is. @type {(v: number) => Term} */
const c = v => lit(f64c, v)

/** Functions of the kind that the first slice is for, every one exported. @type {Module} */
export const samples = {
    imports: [],
    functions: [
        ['max', fn([['a', f64], ['b', f64]], f64, (a, b) => if_(lt(a, b), b, a))],
        ['sum', fn([['a', u(32)], ['b', u(32)]], int(0n, 0x1_ffff_fffen), (a, b) => add(a, b))],
        ['sign', fn([['x', i(64)]], int(-1n, 1n), x => if_(lt(x, n(0n)), n(-1n), if_(eq(x, n(0n)), n(0n), n(1n))))],
        ['clamp', fn([['x', i(32)], ['lo', i(32)], ['hi', i(32)]], i(32), (x, lo, hi) => if_(lt(x, lo), lo, if_(lt(hi, x), hi, x)))],
        ['area', fn([['w', i(16)], ['h', i(16)]], i(32), (w, h) => mul(w, h))],
        ['diff', fn([['a', int(far, far + 10n)], ['b', int(far, far + 10n)]], int(-10n, 10n), (a, b) => sub(a, b))],
        ['double', fn([['a', u(31)]], u(32), a => add(a, a))],
        ['delta', fn([['a', i(16)], ['b', i(16)]], i(32), (a, b) => sub(a, b))],
        ['product', fn([['a', u(32)], ['b', u(32)]], u(64), (a, b) => mul(a, b))],
        ['same', fn([['a', u(32)], ['b', u(32)]], bool, (a, b) => eq(a, b))],
        ['lessU32', fn([['a', u(32)], ['b', u(32)]], bool, (a, b) => lt(a, b))],
        ['lessMixed', fn([['a', u(32)], ['b', i(32)]], bool, (a, b) => lt(a, b))],
        ['lessU64', fn([['a', u(64)], ['b', u(64)]], bool, (a, b) => lt(a, b))],
        ['atMost', fn([['a', i(32)], ['b', i(32)]], bool, (a, b) => le(a, b))],
        ['atMostU32', fn([['a', u(32)], ['b', u(32)]], bool, (a, b) => le(a, b))],
        ['atMostI64', fn([['a', i(64)], ['b', i(64)]], bool, (a, b) => le(a, b))],
        ['atMostU64', fn([['a', u(64)], ['b', u(64)]], bool, (a, b) => le(a, b))],
        ['notEqual', fn([['a', i(64)], ['b', u(32)]], bool, (a, b) => ne(a, b))],
        ['toFloat', fn([['a', u(32)]], f64, a => float(a))],
        ['toFloatSigned', fn([['a', i(32)]], f64, a => float(a))],
        ['toFloatWide', fn([['a', u(53)]], f64, a => float(a))],
        ['average', fn([['a', i(32)], ['b', i(32)]], f64, (a, b) => div(float(add(a, b)), c(2)))],
        ['magnitude', fn([['x', f64]], f64, x => abs(neg(x)))],
        ['hypot', fn([['a', f64], ['b', f64]], f64, (a, b) => sqrt(add(mul(a, a), mul(b, b))))],
        ['distance', fn([['x', f64], ['y', f64], ['p', f64], ['q', f64]], f64, (x, y, p, q) =>
            call('self', 'hypot', [sub(p, x), sub(q, y)]))],
        ['safeDiv', fn([['a', f64], ['b', f64]], f64, (a, b) => if_(eq(b, c(0)), return_(c(0)), div(a, b)))],
        ['pow', fn([['x', f64], ['k', f64]], f64, (x, k) =>
            if_(le(k, c(0)), c(1), mul(x, call('self', 'pow', [x, sub(k, c(1))]))))],
        ['pick', fn([['a', f64], ['b', f64]], f64, (a, b) => let_('x', block('found', f64,
            let_('y', if_(lt(c(0), a), br('found', a), b), y => if_(lt(c(0), y), y, c(0)))), x => add(x, c(1))))],
        ['xor', fn([['a', bool], ['b', bool]], bool, (a, b) => if_(a, not(b), b))],
    ],
    exports: [
        'max', 'sum', 'sign', 'clamp', 'area', 'diff', 'double', 'delta', 'product', 'same', 'lessU32',
        'lessMixed', 'lessU64', 'atMost', 'atMostU32', 'atMostI64', 'atMostU64', 'notEqual', 'toFloat',
        'toFloatSigned', 'toFloatWide', 'average', 'magnitude', 'hypot', 'distance', 'safeDiv', 'pow',
        'pick', 'xor',
    ],
}

/**
 * The forms that the samples leave out: words at their ends, a local of
 * `unit`, a `match` of one arm and one with `false` first, the three terms
 * of type `never` that WASM does not know end, a literal widened where it
 * is returned, and `let`s whose locals the name section names twice.
 *
 * @type {Module}
 */
export const corners = {
    imports: [],
    functions: [
        ['topU32', fn([], u(32), lit(u(32), 0xffff_ffffn))],
        ['topU64', fn([], u(64), lit(u(64), 0xffff_ffff_ffff_ffffn))],
        ['bottomI64', fn([], i(64), lit(i(64), -(1n << 63n)))],
        ['wide', fn([['x', bool]], u(64), x => if_(x, n(1n), lit(u(64), 1n << 40n)))],
        ['unitLocal', fn([['a', bool]], bool, () => let_('nothing', make([]), x => variant(bool, 'true', x)))],
        ['oneArm', fn([['a', bool]], f64, a => match(a, [[null, null, c(1)]]))],
        ['falseFirst', fn([['a', bool]], f64, a => match(a, [[['false'], null, c(0)], [['true'], null, c(1)]]))],
        ['neverBlock', fn([['x', f64]], f64, x => block('out', never, return_(x)))],
        ['neverIf', fn([['a', bool]], f64, a => if_(a, return_(c(1)), return_(c(2))))],
        ['spin', fn([['x', f64]], never, x => call('self', 'spin', [x]))],
        ['guarded', fn([['a', bool], ['x', f64]], f64, (a, x) => if_(a, call('self', 'spin', [x]), x))],
        ['twice', fn([['a', bool]], bool, a =>
            if_(a, let_('t', true_, t => t), let_('t', false_, t => t)))],
    ],
    exports: ['topU32', 'topU64', 'bottomI64', 'wide', 'unitLocal', 'oneArm', 'falseFirst', 'neverBlock', 'neverIf', 'guarded', 'twice'],
}

/**
 * The bit operators and a float's bits: `and`, `or` and `xor` in each word
 * and across two, shifts by a literal count and by a parameter (`drained` by one that
 * may reach 32, which WASM's `i32` shifts would read modulo 32), and
 * `to_bits` of an `f64c` and `from_bits`,
 * which a runtime written in the IR reads a NaN box with: `reference` builds a
 * reference's bits, `nibble` reads its kind back, and `signOf` reads a
 * float's sign bit. `negBits` reads the bits of a negated float through
 * `canon`, where `neg` of a NaN flips its sign bit.
 *
 * @type {Module}
 */
export const bits = {
    imports: [],
    functions: [
        ['mask', fn([['a', u(64)], ['b', u(16)]], u(16), (a, b) => and(a, b))],
        ['either', fn([['a', u(8)], ['b', u(32)]], u(32), (a, b) => or(a, b))],
        ['flip', fn([['a', u(64)], ['b', u(64)]], u(64), (a, b) => xor(a, b))],
        ['reference', fn([['k', u(4)], ['p', u(32)]], u(64), (k, p) => or(shl(k, n(48n)), shl(p, n(2n))))],
        ['shifted', fn([['a', u(8)], ['k', u(3)]], u(16), (a, k) => xor(shl(a, k), shr(a, k)))],
        ['drained', fn([['a', u(32)], ['k', u(6)]], u(32), (a, k) => shr(a, k))],
        ['nibble', fn([['x', u(64)]], u(4), x => and(shr(x, n(48n)), n(15n)))],
        ['bitsOf', fn([['x', f64c]], u(64), x => to_bits(x))],
        ['ofBits', fn([['b', u(64)]], f64, b => from_bits(b))],
        ['signOf', fn([['x', f64c]], u(1), x => shr(to_bits(x), n(63n)))],
        ['negBits', fn([['x', f64]], u(64), x => to_bits(canon(neg(x))))],
    ],
    exports: ['mask', 'either', 'flip', 'reference', 'shifted', 'drained', 'nibble', 'bitsOf', 'ofBits', 'signOf', 'negBits'],
}

/** L0's `Memory`'s function `name` of `args`, which the emitter writes as an instruction. @type {(name: string, args: readonly Term[]) => Term} */
const memoryOf = (name, args) => call('Memory', name, args)

/**
 * A store of `bits` bits of `v` at offset `o` of a page that the call grows
 * for itself, then a load of `read` bits there, which reads the store. The
 * page starts where the memory ended before the `grow`, so it holds none of
 * a host's bytes: NaNVM keeps its stack at the memory's start, and the
 * counting host bytes of its own. The mask keeps the address a `u(32)`, so
 * that it takes 32-bit instructions, and changes it only where the memory
 * already has all 65,536 pages; a `grow` that the host refuses otherwise
 * leaves the address past the memory, where the store traps.
 *
 * @type {(bits: number, read: number) => (o: Term, v: Term) => Term}
 */
const storeThenLoad = (bits, read) => (o, v) => let_('end', memoryOf('size', []), end =>
    let_('grown', memoryOf('grow', [n(1n)]), () =>
        let_('a', add(mul(and(end, n(0xFFFFn)), n(0x1_0000n)), o), a =>
            let_('stored', memoryOf(`store${bits}`, [a, v]), () => memoryOf(`load${read}`, [a])))))

/** A size of the memory in pages of 64 KiB, as `Memory` answers one. */
const pages = int(0n, 0x1_0000n)

/**
 * L0's `Memory`, alone, on any host's memory: a store of each width and a
 * load of the same width at the same offset of a page that the call grows,
 * which answers what was stored; a load of 16 bits of 64 that were stored,
 * which answers their low 16 bits, since the low byte comes first; what a
 * `grow` answers, the size before it, less the size that `size` answered
 * just before, so 0, or `-1` where the host refuses; and how much a `grow`
 * changes the size. A host decides how large its memory starts, so only
 * changes are answered. Each store answers `unit`, which a `let` binds and
 * nothing reads, and stays before its load.
 *
 * @type {Module}
 */
export const addressing = {
    imports: [memory],
    functions: [
        ['stored8', fn([['o', u(16)], ['v', u(8)]], u(8), storeThenLoad(8, 8))],
        ['stored16', fn([['o', u(16)], ['v', u(16)]], u(16), storeThenLoad(16, 16))],
        ['stored32', fn([['o', u(16)], ['v', u(32)]], u(32), storeThenLoad(32, 32))],
        ['stored64', fn([['o', u(16)], ['v', u(64)]], u(64), storeThenLoad(64, 64))],
        ['lowFirst', fn([['o', u(16)], ['v', u(64)]], u(16), storeThenLoad(64, 16))],
        ['grown', fn([['k', pages]], int(-0x1_0001n, 0x1_0000n), k => let_('before', memoryOf('size', []), before =>
            let_('g', memoryOf('grow', [k]), g => if_(eq(g, n(-1n)), n(-1n), sub(g, before)))))],
        ['after', fn([['k', pages]], int(-0x1_0000n, 0x1_0000n), k => let_('before', memoryOf('size', []), before =>
            let_('grown', memoryOf('grow', [k]), () => sub(memoryOf('size', []), before))))],
    ],
    exports: ['stored8', 'stored16', 'stored32', 'stored64', 'lowFirst', 'grown', 'after'],
}

/**
 * Branches on comparisons that narrow a local to the range that the other
 * operand allows: a sum of two `u(32)` that fits 32 bits again where its
 * check holds, as a bump pointer does, a `u(64)` read as `u(32)` below
 * `2^32`, a count that is not 0, and an `i(64)` bounded on both sides, into
 * a signed word of 32 bits, by a `not` of one comparison and the other.
 *
 * @type {Module}
 */
export const narrowing = {
    imports: [],
    functions: [
        ['fitted', fn([['a', u(32)], ['b', u(32)]], u(32), (a, b) => let_('q', add(a, b), q => if_(le(q, n(0xFFFF_FFFFn)), q, n(0n))))],
        ['low', fn([['w', u(64)]], u(32), w => if_(lt(w, n(0x1_0000_0000n)), w, n(0n)))],
        ['nonzero', fn([['w', u(64)]], int(1n, 0xFFFF_FFFF_FFFF_FFFFn), w => if_(eq(w, n(0n)), n(1n), w))],
        ['withinFive', fn([['x', i(64)]], int(-5n, 5n), x => if_(not(lt(x, n(-5n))), if_(le(x, n(5n)), x, n(5n)), n(-5n)))],
    ],
    exports: ['fitted', 'low', 'nonzero', 'withinFive'],
}

/**
 * Any's carrier, as only the module that defines `any` sees it: a module
 * that defines Any itself, with `any`'s variants and carrier and none of
 * its hooks, so that its values are linear here. `carrierOf` unseals a
 * value of a copy variant or a number, `isReference` tests the README's
 * dynamic-reference pattern on the bits, and `boxOf` seals a float's bits
 * as a number. Its proofs run on NaNVM's `.wasm`, whose values are NaN
 * boxes, and not on the counting host, whose are not.
 *
 * @type {Module}
 */
export const sealing = {
    imports: [],
    defines: { name: 'Any', types: [['any', { variants: kinds, carrier: 'i64' }]] },
    functions: [
        ['carrierOf', fn([['v', only(any, 'undefined', 'null', 'boolean', 'number')]], u(64), v => unseal(v))],
        ['isReference', fn([['v', any]], bool, v => isRefTerm(unseal(v)))],
        ['boxOf', fn([['x', f64c]], only(any, 'number'), x => sealOf(only(any, 'number'), to_bits(x)))],
    ],
    exports: ['carrierOf', 'isReference', 'boxOf'],
}

/** A cell of `tagging`, which its module defines. */
const cell = sealed('T', 'cell')

/**
 * A module that defines `T.cell`, whose tag its own `tag` answers from the
 * low bit of its carrier, as a `match` of a cell reads it.
 *
 * @type {Module}
 */
export const tagging = {
    imports: [],
    defines: { name: 'T', types: [['cell', { variants: ['small', 'big'], kind: 'tag', carrier: 'i64' }]] },
    functions: [
        ['tag', fn([['v', cell]], int(0n, 1n), v => and(unseal(v), n(1n)))],
        ['size', fn([['v', cell]], u(8), v => match(v, [[['small'], null, n(1n)], [['big'], null, n(2n)]]))],
    ],
    exports: ['size'],
}

/** A cell of `counting`, which its module defines and counts. */
const counted = sealed('C', 'cell')

/**
 * A module that defines a counted `C.cell`, whose `dup` and `drop` work on
 * its carrier's bits, as Any's do: here `dup` gives the bits back and
 * `drop` does nothing, so it runs on any host. A small cell is copy, and
 * the lifetime pass copies and drops a big one through the hooks.
 *
 * @type {Module}
 */
export const counting = {
    imports: [],
    defines: { name: 'C', types: [['cell', { variants: ['small', 'big'], kind: 'tag', carrier: 'i64', dup: 'dup', drop: 'drop', copy: ['small'] }]] },
    functions: [
        ['tag', fn([['v', counted]], int(0n, 1n), v => and(unseal(v), n(1n)))],
        ['dup', fn([['b', u(64)]], u(64), b => b)],
        ['drop', fn([['b', u(64)]], unit, () => make([]))],
        ['small', fn([], only(counted, 'small'), () => sealOf(only(counted, 'small'), n(0n)))],
        ['keep', fn([['v', counted]], counted, v => v)],
        ['forget', fn([own('v', counted)], u(8), () => n(1n))],
        ['size', fn([own('v', counted)], u(8), v => match(v, [[['small'], null, n(1n)], [['big'], null, n(2n)]]))],
    ],
    exports: ['small', 'keep', 'forget', 'size'],
}

/** A value of `referencing`, which its module defines and counts. */
const refOf = sealed('R', 'ref')


/**
 * A module that defines a counted `R.ref` over NaNVM's NaN boxes, whose
 * hooks count a reference through `Ref`, NaNVM's own functions of
 * references, and pass the bits of any other box through, as Any's will
 * ([defined-hooks.md](../../doc/sasha-gil/ir/defined-hooks.md#anys-hooks-written-out)).
 * `keep` copies a borrowed value, `take` moves an owned one, `forget`
 * drops one, and `pair` takes two copies of a borrowed one, which it then
 * drops. It runs on NaNVM's `.wasm` only, since the counting host's values
 * are no NaN boxes and it has no `Ref`.
 *
 * @type {Module}
 */
export const referencing = {
    imports: [ref],
    defines: { name: 'R', types: [['ref', { variants: ['value'], carrier: 'i64', dup: 'dup', drop: 'drop' }]] },
    functions: [
        ['dup', fn([['b', u(64)]], u(64), b => if_(isRefTerm(b), call('Ref', 'dup_ref', [b]), b))],
        ['drop', fn([['b', u(64)]], unit, b => if_(isRefTerm(b), call('Ref', 'drop_ref', [b]), make([])))],
        ['keep', fn([['v', refOf]], refOf, v => v)],
        ['take', fn([own('v', refOf)], refOf, v => v)],
        ['forget', fn([own('v', refOf)], u(8), () => n(1n))],
        ['pair', fn([['v', refOf]], u(8), v => let_('a', call('self', 'take', [v]), () => let_('b', call('self', 'take', [v]), () => n(2n))))],
    ],
    exports: ['keep', 'take', 'forget', 'pair'],
}

/** A call of an L0 function, by its interface and its name. @type {(module: string, name: string) => (...args: readonly Term[]) => Term} */
const l0Call = (module, name) => (...args) => call(module, name, args)

const kindOf = l0Call('Any', 'kind')

const toF64 = l0Call('Any', 'to_f64')

/** The `length` of an L0 module. @type {(module: string) => (...args: readonly Term[]) => Term} */
const lengthOf = module => l0Call(module, 'length')

/**
 * Functions over values of unknown kind, each parameter borrowed: L1's
 * `toBoolean`, as one `match` of its operand, and the forms that the
 * emitter writes once each for a `match` of `any`: the tag read where the
 * one arm that is tested tests it, and into a local where more arms are;
 * an operand that is no local; one arm alone; a cast; a `match` whose
 * every arm traps; and a call that lends `any` on.
 *
 * @type {Module}
 */
export const unknown = {
    imports: l0,
    functions: [
        ['toBoolean', fn([['v', any]], bool, v => match(v, [
            [['boolean'], 'b', l0Call('Any', 'to_bool')(get('b'))],
            [['number'], 'x', let_('f', toF64(get('x')), f => if_(eq(f, f), ne(f, c(0)), false_))],
            [['string'], 's', ne(lengthOf('String')(get('s')), n(0n))],
            [['bigint'], 'g', ne(lengthOf('BigInt')(get('g')), n(0n))],
            [['array', 'object', 'function'], null, true_],
            [null, null, false_],
        ]))],
        ['kindOf', fn([['v', any]], int(0n, 8n), v => kindOf(v))],
        ['isNumber', fn([['v', any]], bool, v => match(v, [[['number'], null, true_], [null, null, false_]]))],
        ['size', fn([['v', any]], u(31), v => match(let_('w', v, w => w), [
            [['string'], 's', lengthOf('String')(get('s'))],
            [['array', 'object'], 'c', lengthOf('Containers')(get('c'))],
            [['function'], 'f', lengthOf('Functions')(get('f'))],
            [null, null, n(0n)],
        ]))],
        ['tag', fn([['v', any]], int(0n, 8n), v => match(v, [[null, 'x', kindOf(get('x'))]]))],
        ['number', fn([['v', any]], f64c, v => cast(only(any, 'number'), v, 'x', toF64))],
        ['fail', fn([['v', any]], f64, v => match(v, [[['number'], null, trap('a number')], [null, null, trap('no number')]]))],
        ['falsy', fn([['v', any]], bool, v => not(call('self', 'toBoolean', [v])))],
    ],
    exports: ['toBoolean', 'kindOf', 'isNumber', 'size', 'tag', 'number', 'fail', 'falsy'],
}

/** A string. */
const string = only(any, 'string')

/** String's `unit` of `s` at the index that the float `i` holds exactly, which is bound to `name`. @type {(s: Term, i: Term, name: string) => Term} */
const unitAt = (s, i, name) => exact(u(31), i, name, k => call('String', 'unit', [s, k]))

/**
 * Loops: L1's `stringEquals` and `stringLess` by hand, each counter a float
 * as FAST has it, read as an index through `exact`, and the forms that the
 * emitter writes once each for a loop: two parameters, which a `br` sets at
 * once, a loop in a loop that repeats the outer one, a parameter of `any`,
 * `exact` of a term and of a literal, and `trunc_sat` to each kind of word
 * and bound.
 *
 * @type {Module}
 */
export const loops = {
    imports: l0,
    functions: [
        ['stringEquals', fn([['a', any], ['b', any]], bool, (a, b) =>
            cast(string, a, 'a.string', sa =>
            let_('n', float(lengthOf('String')(sa)), length =>
            cast(string, b, 'b.string', sb =>
            if_(eq(length, float(lengthOf('String')(sb))),
                loop('L', [['i', f64, c(0)]], i =>
                    if_(lt(i, length),
                        if_(eq(unitAt(sa, i, 'i.a'), unitAt(sb, i, 'i.b')), next('L', [['i', add(i, c(1))]]), false_),
                        true_)),
                false_)))))],
        ['stringLess', fn([['a', any], ['b', any]], bool, (a, b) =>
            cast(string, a, 'a.string', sa =>
            let_('na', float(lengthOf('String')(sa)), na =>
            cast(string, b, 'b.string', sb =>
            let_('nb', float(lengthOf('String')(sb)), nb =>
            loop('L', [['i', f64, c(0)]], i =>
                if_(lt(i, na),
                    if_(lt(i, nb),
                        let_('x', unitAt(sa, i, 'i.a'), x =>
                        let_('y', unitAt(sb, i, 'i.b'), y =>
                        if_(eq(x, y), next('L', [['i', add(i, c(1))]]), lt(x, y)))),
                        false_),
                    lt(na, nb))))))))],
        ['factorial', fn([['x', f64]], f64, x =>
            loop('L', [['k', f64, x], ['acc', f64, c(1)]], (k, acc) =>
                if_(lt(c(0), k), next('L', [['k', sub(k, c(1))], ['acc', mul(acc, k)]]), acc)))],
        ['triangle', fn([['x', f64]], f64, x =>
            loop('Outer', [['i', f64, c(0)], ['s', f64, c(0)]], (i, s) =>
                if_(lt(i, x),
                    loop('Inner', [['j', f64, c(0)], ['t', f64, s]], (j, t) =>
                        if_(lt(j, i), next('Inner', [['j', add(j, c(1))], ['t', add(t, c(1))]]), next('Outer', [['i', add(i, c(1))], ['s', t]]))),
                    s)))],
        ['kindAfter', fn([['v', any], ['x', f64]], int(0n, 8n), (v, x) =>
            loop('L', [['w', any, v], ['k', f64, x]], (w, k) =>
                if_(lt(c(0), k), next('L', [['w', w], ['k', sub(k, c(1))]]), kindOf(w))))],
        ['index', fn([['x', f64]], u(31), x => exact(u(31), x, 'k', k => k))],
        ['indexOfSum', fn([['x', f64]], u(31), x => exact(u(31), add(x, c(1)), 'k', k => k))],
        ['three', fn([], u(31), () => exact(u(31), c(3), 'k', k => k))],
        ['toU31', fn([['x', f64]], u(31), x => trunc_sat(u(31), x))],
        ['toI32', fn([['x', f64]], i(32), x => trunc_sat(i(32), x))],
        ['toU32', fn([['x', f64]], u(32), x => trunc_sat(u(32), x))],
        ['toSmall', fn([['x', f64]], int(-5n, 300n), x => trunc_sat(int(-5n, 300n), x))],
        ['toU64', fn([['x', f64]], u(64), x => trunc_sat(u(64), x))],
        ['toI64', fn([['x', f64]], i(64), x => trunc_sat(i(64), x))],
        ['toWide', fn([['x', f64]], int(10n, 1n << 40n), x => trunc_sat(int(10n, 1n << 40n), x))],
        ['toNegative', fn([['x', f64]], int(-(1n << 40n), -3n), x => trunc_sat(int(-(1n << 40n), -3n), x))],
    ],
    exports: [
        'stringEquals', 'stringLess', 'factorial', 'triangle', 'kindAfter', 'index', 'indexOfSum', 'three',
        'toU31', 'toI32', 'toU32', 'toSmall', 'toU64', 'toI64', 'toWide', 'toNegative',
    ],
}

/** A product of `f64` fields, by their names. @type {(...names: readonly string[]) => Type} */
const floats = (...names) => product(names.map(k => /** @type {const} */ ([k, f64])))

/**
 * Records: L1's `stringIndex` by hand, whose loop's one parameter is a
 * product of its counter and its value, and the forms that the emitter
 * writes once each for a product: a local of one, a loop whose value is
 * one, a `match` of one whose arms meet in a wider field, a field of a term
 * that is no local, first or after others, a product that widens where it
 * is no `make`, a field of `unit` and a product in a product, a loop of a
 * product beside other parameters, a `match` of `any` whose arms are
 * products, and a product of values of `any`.
 *
 * @type {Module}
 */
export const records = {
    imports: l0,
    functions: [
        ['stringIndex', fn([['s', string]], f64, s =>
            let_('n', float(lengthOf('String')(s)), length =>
            if_(if_(eq(length, c(0)), true_, if_(lt(c(1), length), eq(float(unitAt(s, c(0), 'first')), c(0x30)), false_)),
                c(-1),
                field(loop('L', [['r', floats('i', 'value'), make([['i', c(0)], ['value', c(0)]])]], r =>
                    if_(if_(lt(field(r, 'i'), length), le(c(0), field(r, 'value')), false_),
                        let_('u', float(unitAt(s, field(r, 'i'), 'i')), u =>
                        let_('d', if_(if_(le(c(0x30), u), le(u, c(0x39)), false_), sub(u, c(0x30)), c(-1)), d =>
                        let_('value', if_(lt(d, c(0)), c(-1), add(mul(field(r, 'value'), c(10)), d)), value =>
                        next('L', [['r', make([['i', add(field(r, 'i'), c(1))], ['value', if_(lt(c(0xffff_ffff), value), c(-1), value)]])]])))),
                        r)), 'value'))))],
        ['midpoint', fn([['a', f64], ['b', f64]], f64, (a, b) =>
            let_('p', make([['lo', a], ['hi', b]]), p => div(add(field(p, 'lo'), field(p, 'hi')), c(2))))],
        ['fib', fn([['x', f64]], f64, x =>
            field(loop('L', [['r', floats('a', 'b', 'k'), make([['a', c(0)], ['b', c(1)], ['k', c(0)]])]], r =>
                if_(lt(field(r, 'k'), x),
                    next('L', [['r', make([['a', field(r, 'b')], ['b', add(field(r, 'a'), field(r, 'b'))], ['k', add(field(r, 'k'), c(1))]])]]),
                    r)), 'a'))],
        ['choose', fn([['k', bool], ['x', u(8)], ['y', u(64)]], u(64), (k, x, y) =>
            field(if_(k, make([['v', x], ['w', true_]]), make([['v', y], ['w', false_]])), 'v'))],
        ['middle', fn([['k', bool], ['x', f64]], f64, (k, x) =>
            field(if_(k, make([['a', x], ['b', c(2)], ['d', c(3)]]), make([['a', c(4)], ['b', neg(x)], ['d', x]])), 'b'))],
        ['widened', fn([['x', u(8)], ['y', u(32)]], u(64), (x, y) =>
            let_('r', make([['a', x], ['b', y]]), r =>
            field(block('B', product([['a', u(64)], ['b', u(64)]]), br('B', r)), 'b')))],
        ['nested', fn([['x', f64]], f64, x =>
            let_('r', make([['u', make([])], ['p', make([['a', x], ['b', mul(x, x)]])]]), r =>
            let_('none', field(r, 'u'), () =>
            sub(field(field(r, 'p'), 'b'), field(field(r, 'p'), 'a')))))],
        ['steps', fn([['x', f64]], f64, x =>
            loop('L', [['u', unit, make([])], ['k', f64, x], ['r', floats('lo', 'hi'), make([['lo', c(0)], ['hi', c(1)]])]], (u, k, r) =>
                if_(lt(c(0), k),
                    next('L', [['u', u], ['k', sub(k, c(1))], ['r', make([['lo', field(r, 'hi')], ['hi', add(field(r, 'lo'), field(r, 'hi'))]])]]),
                    field(r, 'lo'))))],
        ['describe', fn([['v', any]], f64, v =>
            field(match(v, [
                [['number'], 'x', make([['k', c(1)], ['n', call('Any', 'to_f64', [get('x')])]])],
                [null, null, make([['k', c(0)], ['n', c(0)]])],
            ]), 'n'))],
        ['kindOfFirst', fn([['v', any], ['w', any]], int(0n, 8n), (v, w) =>
            let_('r', make([['p', v], ['q', w]]), r => kindOf(field(r, 'p'))))],
    ],
    exports: ['stringIndex', 'midpoint', 'fib', 'choose', 'middle', 'widened', 'nested', 'steps', 'describe', 'kindOfFirst'],
}

/** A constant of the module. @type {(name: string) => Term} */
const self = name => constant('self', name)

/** A `dup` of a value of `any`, which the caller owns. @type {(x: Term) => Term} */
const dup = x => call('Any', 'dup', [x])

/**
 * Constants, which `init` evaluates in their order, each reading only
 * those before it: the module's own of each word that a global holds, a
 * float, a range of 32 bits and one of 64, a `bool` and strings, one read
 * through a function of the module, one with a `let` and one with a loop
 * whose value is a product, whose block type the type section holds; and
 * Any's, which the module imports and borrows. A constant owns its value,
 * and a function that answers one answers a `dup` of it.
 *
 * @type {Module}
 */
export const constants = {
    imports: l0,
    constants: [
        ['half', { type: f64, value: div(c(1), c(2)) }],
        ['quarter', { type: f64, value: mul(self('half'), self('half')) }],
        ['eighth', { type: f64, value: let_('q', self('quarter'), q => call('self', 'halve', [q])) }],
        ['answer', { type: u(8), value: n(42n) }],
        ['far', { type: i(64), value: n(-far) }],
        ['less', { type: bool, value: lt(self('half'), self('quarter')) }],
        ['six', { type: f64, value: field(loop('L', [['k', f64, c(0)], ['s', f64, c(0)]], (k, s) =>
            if_(lt(k, c(4)), next('L', [['k', add(k, c(1))], ['s', add(s, k)]]), make([['k', k], ['s', s]]))), 's') }],
        ['a', { type: string, value: call('String', 'from_unit', [n(0x61n)]) }],
        ['aa', { type: string, value: call('String', 'concat', [self('a'), self('a')]) }],
        ['nothing', { type: only(any, 'null'), value: dup(constant('Any', 'null')) }],
    ],
    functions: [
        ['halve', fn([['x', f64]], f64, x => mul(x, self('half')))],
        ['eighth', fn([], f64, self('eighth'))],
        ['answer', fn([], u(8), self('answer'))],
        ['far', fn([], i(64), self('far'))],
        ['less', fn([], bool, self('less'))],
        ['six', fn([], f64, self('six'))],
        ['aa', fn([], string, dup(self('aa')))],
        ['lengthOfAa', fn([], u(31), lengthOf('String')(self('aa')))],
        ['nothingKind', fn([], int(0n, 8n), kindOf(self('nothing')))],
        ['truth', fn([['b', bool]], bool, b => if_(b, call('Any', 'to_bool', [constant('Any', 'true')]), call('Any', 'to_bool', [constant('Any', 'false')])))],
        ['orUndefined', fn([['v', any]], any, v => match(v, [[['number'], 'x', dup(get('x'))], [null, null, dup(constant('Any', 'undefined'))]]))],
    ],
    exports: ['halve', 'eighth', 'answer', 'far', 'less', 'six', 'aa', 'lengthOfAa', 'nothingKind', 'truth', 'orUndefined'],
}

/**
 * String literals, which the start function makes once each from their
 * UTF-16 units in the data segment: the empty string, one that the module
 * writes three times and makes once, one past ASCII and a pair of
 * surrogates. A constant holds a `dup` of one, and another joins it with a
 * literal. A function that answers one answers a `dup` of it, and the
 * others read one's length and its units, and join a parameter with one.
 *
 * @type {Module}
 */
export const literals = {
    imports: l0,
    constants: [
        ['hello', { type: string, value: dup(lit(string, 'hello')) }],
        ['greeting', { type: string, value: call('String', 'concat', [self('hello'), lit(string, ', world')]) }],
    ],
    functions: [
        ['empty', fn([], string, dup(lit(string, '')))],
        ['hello', fn([], string, dup(lit(string, 'hello')))],
        ['greeting', fn([], string, dup(self('greeting')))],
        ['accent', fn([], u(31), lengthOf('String')(lit(string, 'caf\u00e9')))],
        ['smile', fn([], u(16), call('String', 'unit', [lit(string, '\u{1F600}'), n(1n)]))],
        ['suffixed', fn([['s', string]], string, s => call('String', 'concat', [s, lit(string, 'hello')]))],
    ],
    exports: ['empty', 'hello', 'greeting', 'accent', 'smile', 'suffixed'],
}

/** Containers' `begin_array` of `k` items. @type {(k: Term) => Term} */
const begin = k => call('Containers', 'begin_array', [k])

/** Containers' `push` of `v` onto the builder `b`, which gives the builder back. @type {(b: Term, v: Term) => Term} */
const push = (b, v) => call('Containers', 'push', [b, v])

/** Containers' `seal` of the builder `b`, which answers its array. @type {(b: Term) => Term} */
const seal = b => call('Containers', 'seal', [b])

/**
 * Arrays, which Containers' builder makes, in the owned stage: `begin_array`
 * of a count, a `push` of each item, which owns the item and the builder and
 * gives the builder back, and `seal`, which owns the builder and answers the
 * array. The empty array; a pair of values, each a `dup` of a parameter; an
 * array of the module's own and a value, whose constant `init` builds; a
 * builder that `let`s hold between its calls; one that a loop pushes onto,
 * a round for each item; and the length of one, which the function then
 * drops.
 *
 * @type {Module}
 */
export const arrays = {
    imports: l0,
    constants: [
        ['letters', { type: container, value: seal(push(push(begin(n(2n)), dup(lit(string, 'a'))), dup(lit(string, 'b')))) }],
    ],
    functions: [
        ['emptyArray', fn([], container, seal(begin(n(0n))))],
        ['pairOf', fn([['a', any], ['b', any]], container, (a, b) => seal(push(push(begin(n(2n)), dup(a)), dup(b))))],
        ['lettersAnd', fn([['v', any]], container, v => seal(push(push(begin(n(2n)), dup(self('letters'))), dup(v))))],
        ['bound', fn([['v', any]], container, v => let_('b', begin(n(1n)), b => let_('c', push(b, dup(v)), seal)))],
        ['repeated', fn([['v', any], ['k', u(8)]], container, (v, k) =>
            loop('L', [['b', builder, begin(k)], ['i', f64, c(0)]], (b, i) =>
                if_(lt(i, float(k)), next('L', [['b', push(b, dup(v))], ['i', add(i, c(1))]]), seal(b))))],
        ['itemCount', fn([['v', any]], u(31), v =>
            let_('a', seal(push(begin(n(1n)), dup(v))), a =>
            let_('k', lengthOf('Containers')(a), k =>
            let_('d', call('Any', 'drop', [a]), () => k))))],
    ],
    exports: ['emptyArray', 'pairOf', 'lettersAnd', 'bound', 'repeated', 'itemCount'],
}

/** A throw of a string literal, which `Functions.throw` takes over a `dup` of. @type {(text: string) => Term} */
const throwing = text => throw_(lit(string, text))

/** The length of `v` where it is a string, and a throw of `text` where it is not. @type {(v: Term, text: string) => Term} */
const textLength = (v, text) => match(v, [[['string'], 's', lengthOf('String')(get('s'))], [null, null, throwing(text)]])

/**
 * Functions that fail, in the plain stage, for the lifetime pass, which
 * drops what a function owns before it throws: the length of a string
 * that the function owns, and a throw of a literal for any other value; a
 * throw of the value itself, of type `never`; a string doubled, which a
 * throw drops for a second parameter of another kind; a function that
 * borrows its value and throws, and one that calls it while it owns a
 * string, which the throw abandons; String's `unit`, which traps past the
 * end of a string, as the view does; and `kind`, which cannot fail.
 *
 * @type {Module}
 */
export const throws = {
    imports: l0,
    functions: [
        ['ownedLength', fn([own('v', any)], u(31), v => textLength(v, 'not a string'))],
        ['rethrow', fn([own('v', any)], never, v => throw_(v))],
        ['doubled', fn([['a', any], ['b', any]], string, (a, b) => match(a, [
            [['string'], 's', let_('t', call('String', 'concat', [get('s'), get('s')]), t => match(b, [[['string'], null, t], [null, null, throwing('b')]]))],
            [null, null, throwing('a')],
        ]))],
        ['checked', fn([['v', any]], u(31), v => textLength(v, 'not a string'))],
        ['viaCallee', fn([['a', string], ['v', any]], u(32), (a, v) =>
            let_('t', call('String', 'concat', [a, a]), t => add(lengthOf('String')(t), call('self', 'checked', [v]))))],
        ['unitOf', fn([['s', string], ['i', u(31)]], u(16), (s, i) => call('String', 'unit', [s, i]))],
        ['kindOf', fn([['v', any]], int(0n, 8n), v => kindOf(v))],
    ],
    exports: ['ownedLength', 'rethrow', 'doubled', 'checked', 'viaCallee', 'unitOf', 'kindOf'],
}
