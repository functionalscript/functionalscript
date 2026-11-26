/**
 * Any written in the IR over the NaN box
 * ([runtime-in-ir.md](../../../../doc/sasha-gil/ir/runtime-in-ir.md)
 * checkpoint 4d-2,
 * [defined-hooks.md](../../../../doc/sasha-gil/ir/defined-hooks.md)):
 * the module defines `any`, counts a reference through `Ref`, and answers
 * the scalar functions and constants with bit operations. `number` joins
 * the copy variants. Linking it into programs is checkpoint 4e.
 *
 * @module
 *
 * @import { Interface, Module, Term } from '../../types.ts'
 */

import { kinds, ref } from '../../l0/module.f.js'
import { FALSE, NULL, TRUE, UNDEFINED, isNumberTerm, isRefTerm } from '../box/module.f.js'
import {
    and, bool, call, canon, constant, eq, f64, f64c, fn, from_bits, if_, int, let_,
    make, n, ne, only, own, seal, sealed, shr, signature, to_bits, u, unit, unseal,
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
 * Any's IR module: it defines `any`, imports `Ref`, and exports the
 * functions and constants of {@link iface}, plus `isRef` for proofs.
 *
 * @type {Module}
 */
export const module = {
    imports: [ref],
    defines,
    constants: [
        ['undefined', { type: only(any, 'undefined'), value: seal(only(any, 'undefined'), n(UNDEFINED)) }],
        ['null', { type: only(any, 'null'), value: seal(only(any, 'null'), n(NULL)) }],
        ['false', { type: boolean, value: seal(boolean, n(FALSE)) }],
        ['true', { type: boolean, value: seal(boolean, n(TRUE)) }],
    ],
    functions: [
        // Whether bits are a dynamic reference.
        ['isRef', fn([['b', u(64)]], bool, b => isRefTerm(b))],
        // Hooks over bits: count a reference through Ref, pass every other box through.
        ['dup', fn([['b', u(64)]], u(64), b => if_(call('self', 'isRef', [b]), call('Ref', 'dup_ref', [b]), b))],
        ['drop', fn([['b', u(64)]], unit, b => if_(call('self', 'isRef', [b]), call('Ref', 'drop_ref', [b]), make([])))],
        // L0's kind from the box: numbers, short bigints, references, short strings, then scalar tags.
        ['kind', fn([['v', any]], int(0n, 8n), v => let_('b', unseal(v), b =>
            if_(isNumberTerm(b), n(3n),
                if_(eq(and(b, n(1n)), n(1n)), n(5n),
                    if_(call('self', 'isRef', [b]), call('Ref', 'kind_ref', [b]),
                        if_(ne(and(b, n(0xCn)), n(0n)), n(4n),
                            scalarKind(b)))))))],
        // A number's bits as an f64c; a float as a number's bits.
        ['to_f64', fn([['v', number]], f64c, v => canon(from_bits(unseal(v))))],
        ['from_f64', fn([['x', f64]], number, x => seal(number, to_bits(canon(x))))],
        // A boolean's sign bit; a bool as the true or false box.
        ['to_bool', fn([['v', boolean]], bool, v => ne(shr(unseal(v), n(63n)), n(0n)))],
        ['from_bool', fn([['b', bool]], boolean, b => if_(b, seal(boolean, n(TRUE)), seal(boolean, n(FALSE))))],
        // Reference identity through NaNVM, which traps on a dropped or forged box.
        ['same', fn([['a', reference], ['b', reference]], bool, (a, b) => call('Ref', 'same_ref', [unseal(a), unseal(b)]))],
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
}
