/**
 * Any written in the IR over the NaN box
 * ([runtime-in-ir.md](../../../../doc/sasha-gil/ir/runtime-in-ir.md)
 * checkpoint 4d-2,
 * [defined-hooks.md](../../../../doc/sasha-gil/ir/defined-hooks.md)):
 * the module defines `any`, counts a reference through `Ref`, and answers
 * the scalar functions and constants with bit operations. `number` joins
 * the copy variants. Linking it into programs is checkpoint 4e.
 *
 * Beside the two variants that programs link today, {@link module} and
 * {@link checked}, two more know the IR heap
 * ([long-strings.md](../../../../doc/sasha-gil/ir/long-strings.md), H3a):
 * a reference whose kind nibble is 9 is a long string in it, of kind 4,
 * which the hooks count through the Heap's `dup` and `drop` and `free` at
 * a count of 0, while NaNVM's references count through `Ref` as before.
 * {@link withHeap} imports the Heap interface, and
 * {@link checkedWithHeap}, for a debug build, the debug arena's, whose
 * `type_of` checks the block that a reference names. No program links
 * them before the heap does, at H3d.
 *
 * @module
 *
 * @import { Interface, Module, Term } from '../../types.ts'
 */

import { kinds, ref } from '../../l0/module.f.js'
import { FALSE, IR_STRING, NULL, TRUE, UNDEFINED, blockTerm, isIrStringTerm, isNumberTerm, isRefTerm } from '../box/module.f.js'
import { debugIface as debugHeap, iface as heap } from '../heap/module.f.js'
import {
    and, bool, call, canon, constant, eq, f64, f64c, fn, from_bits, hint, if_, int, let_,
    make, misuse, n, ne, only, or, own, seal, sealed, shr, signature, to_bits, u, unit, unseal,
} from '../../module.f.js'

/** A value of unknown kind, as this module defines it. */
export const any = sealed('Any', 'any')

/** A boolean of `any`. */
const boolean = only(any, 'boolean')

/** A number of `any`. */
const number = only(any, 'number')

/** A reference of `any`: an array, an object or a function. */
const reference = only(any, 'array', 'object', 'function')

/**
 * L0's kind of a scalar tag `(b >> 4) & 3`: boolean 2, undefined 0, null 1,
 * which is `((tag) + 1) % 3` over that tag. The IR has no integer remainder,
 * so the three tags are named.
 *
 * @type {(b: Term) => Term}
 */
const scalarKind = b => let_('tag', and(shr(b, n(4n)), n(3n)), tag =>
    if_(eq(tag, n(1n)), n(2n), if_(eq(tag, n(2n)), n(0n), n(1n))))

/** String literals of `any`, as L0's Any makes them. */
const stringLiteral = { variant: 'string', module: 'String', member: 'make_string' }

/**
 * The `any` that this module defines and its importers see: L0's Any with
 * `number` among the copy variants, so a value narrowed to a number needs no
 * count.
 *
 * @type {Interface['types']}
 */
const types = [['any', {
    variants: kinds,
    kind: 'kind',
    carrier: 'i64',
    dup: 'dup',
    drop: 'drop',
    copy: ['undefined', 'null', 'boolean', 'number'],
    literal: stringLiteral,
}]]

/**
 * The interface that importers of this module see: {@link types}, its
 * constants and its functions.
 *
 * @type {Interface}
 */
export const iface = {
    abi: 'fjs:l0',
    types,
    constants: [
        ['undefined', only(any, 'undefined')],
        ['null', only(any, 'null')],
        ['true', boolean],
        ['false', boolean],
    ],
    functions: [
        ['kind', signature([['v', any]], int(0n, 8n))],
        ['to_f64', signature([['v', number]], f64c)],
        ['from_f64', signature([['x', f64]], number)],
        ['to_bool', signature([['v', boolean]], bool)],
        ['from_bool', signature([['b', bool]], boolean)],
        ['same', signature([['a', reference], ['b', reference]], bool)],
        ['dup', signature([['v', any]], any)],
        ['drop', signature([own('v', any)], unit)],
    ],
}

/**
 * How this module defines `any`: its variants, its carrier, and the hooks
 * that tell its kind and count it. A module that defines Any for its own
 * check, as String's IR module does, takes this one.
 *
 * @type {NonNullable<Module['defines']>}
 */
export const defines = { name: 'Any', types }

/**
 * The kind of a reference's bits read from its `tttt` nibble by `pairs`
 * of a nibble and the L0 kind that it holds, with no call: bits whose
 * nibble is none of those are forged, and trap as a misuse, so `kind` may
 * not fail, as `checked`'s `kind_ref` may not.
 *
 * @type {(pairs: readonly (readonly [bigint, bigint])[]) => (b: Term) => Term}
 */
const nibbleKind = pairs => b => let_('t', and(shr(b, n(48n)), n(0xFn)), t =>
    pairs.reduceRight((rest, [nibble, k]) => if_(eq(t, n(nibble)), n(k), rest), misuse('not a value')))

/** NaNVM's nibbles, each L0's own kind, 4 string to 8 function. */
const nanvmKinds = /** @type {const} */ ([[4n, 4n], [5n, 5n], [6n, 6n], [7n, 7n], [8n, 8n]])

/**
 * The kind of a reference's bits read from its `tttt` nibble, which holds
 * L0's kind (4 string to 8 function), with no call. NaNVM does not check
 * the handle here, so the bits of a dropped reference answer the kind they
 * had; `dup`, `drop` and `same` still go through `Ref`, which checks it.
 * The lifetime pass and the owned check keep a checked program from
 * reading a reference that it dropped.
 *
 * @type {(b: Term) => Term}
 */
const tagKind = nibbleKind(nanvmKinds)

/**
 * {@link tagKind} where the IR heap holds long strings: nibble 9 is a
 * string too.
 *
 * @type {(b: Term) => Term}
 */
const heapTagKind = nibbleKind([...nanvmKinds, /** @type {const} */ ([9n, 4n])])

/**
 * The kind of a reference's bits as NaNVM answers it: `Ref.kind_ref`, which
 * checks that the handle is live and that `tttt` is the kind it keeps for
 * it, and traps otherwise.
 *
 * @type {(b: Term) => Term}
 */
const checkedKind = b => call('Ref', 'kind_ref', [b])

/**
 * The block of the box `b` of a reference into the IR heap, for a debug
 * build: the box must have no bit but its tag's and its block's, and the
 * kind of its block, the high nibble of the debug arena's `type_of`, which
 * traps where the block's count is 0 or no block is there, must be a
 * string's. Any other box is a misuse.
 *
 * @type {(b: Term) => Term}
 */
const checkedBlock = b => if_(eq(b, or(n(IR_STRING), blockTerm(b))),
    let_('type', call('Heap', 'type_of', [blockTerm(b)]), t => if_(eq(shr(t, n(4n)), n(4n)), blockTerm(b), misuse('not a value'))),
    misuse('not a value'))

/**
 * {@link checkedKind} where the IR heap holds long strings: a reference
 * into it is a string's where {@link checkedBlock} takes it. Every other
 * reference asks NaNVM's `kind_ref`.
 *
 * @type {(b: Term) => Term}
 */
const checkedHeapKind = b => if_(isIrStringTerm(b), let_('block', checkedBlock(b), () => n(4n)), checkedKind(b))

/**
 * The block that the hooks count for the box `b` of a reference into the
 * IR heap: its address, or in a debug build the block that
 * {@link checkedBlock} takes, so that a forged box traps before any count
 * changes. `null` where the module knows no IR heap.
 *
 * @typedef {((b: Term) => Term) | null} BlockOf
 */

/** The hooks' block where no check is asked for: the address bits. @type {(b: Term) => Term} */
const plainBlock = blockTerm

/**
 * The hook `dup` over bits: a reference counts through `Ref`, or where
 * `block` is given and it names a block of the IR heap, through the Heap's
 * `dup` of the block that `block` answers, and every other box passes
 * through.
 *
 * @type {(block: BlockOf) => (b: Term) => Term}
 */
const dupOf = block => b => if_(call('self', 'isRef', [b]),
    block !== null ? if_(isIrStringTerm(b), let_('counted', call('Heap', 'dup', [block(b)]), () => b), call('Ref', 'dup_ref', [b]))
        : call('Ref', 'dup_ref', [b]),
    b)

/**
 * The hook `drop` over bits: a reference counts through `Ref`, or where
 * `block` is given and it names a block of the IR heap, through the Heap's
 * `drop` of the block that `block` answers, and the Heap's `free` takes
 * the block at a count of 0, since a long string holds no reference to
 * drop first. Every other box needs nothing.
 *
 * @type {(block: BlockOf) => (b: Term) => Term}
 */
const dropOf = block => b => if_(call('self', 'isRef', [b]),
    block !== null ? if_(isIrStringTerm(b),
        let_('p', block(b), p => if_(call('Heap', 'drop', [p]), call('Heap', 'free', [p]), make([]))),
        call('Ref', 'drop_ref', [b]))
        : call('Ref', 'drop_ref', [b]),
    make([]))

/**
 * Any's IR module with the kind of a reference given by `refKind`, whose
 * hooks count references into the IR heap through `heap`, the Heap
 * interface that it imports, on the block that `block` answers, or that
 * knows no IR heap where `heap` is `null`: it defines `any`, imports `Ref`,
 * and exports the functions and constants of {@link iface}, plus `isRef`
 * for proofs.
 *
 * @type {(refKind: (b: Term) => Term, heap: Interface | null, block: BlockOf) => Module}
 */
const moduleOf = (refKind, heap, block) => ({
    imports: heap === null ? [ref] : [ref, ['Heap', heap]],
    defines,
    constants: [
        ['undefined', { type: only(any, 'undefined'), value: seal(only(any, 'undefined'), n(UNDEFINED)) }],
        ['null', { type: only(any, 'null'), value: seal(only(any, 'null'), n(NULL)) }],
        ['false', { type: boolean, value: seal(boolean, n(FALSE)) }],
        ['true', { type: boolean, value: seal(boolean, n(TRUE)) }],
    ],
    functions: [
        // Whether bits are a dynamic reference: two bit operations, which the inline pass writes into each hook that asks.
        ['isRef', hint('always', fn([['b', u(64)]], bool, b => isRefTerm(b)))],
        // Hooks over bits: count a reference through Ref, or through the Heap where it is one, pass every other box through.
        ['dup', fn([['b', u(64)]], u(64), dupOf(block))],
        ['drop', fn([['b', u(64)]], unit, dropOf(block))],
        // L0's kind from the box: numbers, short bigints, references (by `refKind`), short strings, then scalar tags.
        ['kind', fn([['v', any]], int(0n, 8n), v => let_('b', unseal(v), b =>
            if_(isNumberTerm(b), n(3n),
                if_(eq(and(b, n(1n)), n(1n)), n(5n),
                    if_(call('self', 'isRef', [b]), refKind(b),
                        if_(ne(and(b, n(0xCn)), n(0n)), n(4n),
                            scalarKind(b)))))))],
        // A number's bits as an f64c; a float as a number's bits.
        ['to_f64', hint('always', fn([['v', number]], f64c, v => canon(from_bits(unseal(v)))))],
        ['from_f64', hint('always', fn([['x', f64]], number, x => seal(number, to_bits(canon(x)))))],
        // A boolean's sign bit; a bool as the true or false box.
        ['to_bool', hint('always', fn([['v', boolean]], bool, v => ne(shr(unseal(v), n(63n)), n(0n))))],
        ['from_bool', hint('always', fn([['b', bool]], boolean, b => if_(b, seal(boolean, n(TRUE)), seal(boolean, n(FALSE)))))],
        // Reference identity through NaNVM, which traps on a dropped or forged box.
        ['same', hint('always', fn([['a', reference], ['b', reference]], bool, (a, b) => call('Ref', 'same_ref', [unseal(a), unseal(b)])))],
        // Owned-stage helpers for proofs on NaNVM: copy, move, drop, and the constants.
        ['keep', fn([['v', any]], any, v => v)],
        ['take', fn([own('v', any)], any, v => v)],
        ['forget', fn([own('v', any)], u(8), () => n(1n))],
        ['undefinedOf', fn([], only(any, 'undefined'), () => constant('self', 'undefined'))],
        ['nullOf', fn([], only(any, 'null'), () => constant('self', 'null'))],
        ['falseOf', fn([], boolean, () => constant('self', 'false'))],
        ['trueOf', fn([], boolean, () => constant('self', 'true'))],
    ],
    exports: [
        'isRef', 'kind', 'to_f64', 'from_f64', 'to_bool', 'from_bool', 'same', 'dup', 'drop',
        'keep', 'take', 'forget', 'undefinedOf', 'nullOf', 'falseOf', 'trueOf',
    ],
})

/**
 * Any's IR module, which programs link: the kind of a reference is read
 * from its bits ({@link tagKind}).
 *
 * @type {Module}
 */
export const module = moduleOf(tagKind, null, null)

/**
 * Any's IR module for a debug build: the kind of a reference is NaNVM's
 * checked `kind_ref` ({@link checkedKind}), so a dropped or forged reference
 * traps there too. `lower` links it where its runtime says `checkedKind`.
 *
 * @type {Module}
 */
export const checked = moduleOf(checkedKind, null, null)

/**
 * Any's IR module where the IR heap holds long strings: nibble 9 is a
 * string's, read from the bits as every other kind, and the hooks count it
 * through the Heap interface that it imports.
 *
 * @type {Module}
 */
export const withHeap = moduleOf(heapTagKind, heap, plainBlock)

/**
 * {@link checked} where the IR heap holds long strings: the kind of one,
 * and the hooks before they count one, ask the debug arena's `type_of`,
 * through the debug interface that it imports, so a dropped or forged
 * reference into the IR heap traps, and changes no count.
 *
 * @type {Module}
 */
export const checkedWithHeap = moduleOf(checkedHeapKind, debugHeap, checkedBlock)
