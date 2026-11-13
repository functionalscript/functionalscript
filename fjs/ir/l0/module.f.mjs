/**
 * The interfaces of L0 as data: what a module of the [IR](../README.md)
 * needs to know of the WASM runtime's core to read a value of unknown kind,
 * as [definition.md](../../../doc/sasha-gil/ir/definition.md#modules-and-interfaces)
 * writes them, split into the modules of
 * [modular-l0.md](../../../doc/sasha-gil/wasm/modular-l0.md). A host binds
 * all of them to the `fjs:l0` imports, which
 * [`host`](./host/module.f.js) provides on a JavaScript host.
 *
 * - **`any` is sealed by Any.** Its variants are the nine kinds in the order
 *   of the tags that `kind` answers, which are the
 *   [L0 view's](../../wasm/runtime/l0/module.f.js), and a WASM `i64`
 *   carries it.
 * - **The casts' targets are the arguments.** `to_f64` takes a number and
 *   `to_bool` a boolean, so passing a value of unknown kind is a type error,
 *   and a module narrows its value with a `match` first.
 * - **`length` is one function per module**
 *   ([L0 design §18](../../../doc/sasha-gil/wasm/l0-design.md#18-what-length-item-and-key-mean-for-each-kind)):
 *   a string's UTF-16 units, a bigint's words, the items of an array or the
 *   properties of an object, and a function's declared parameters. All of
 *   them are the one `length` import.
 * - **A string's unit is String's `unit`**, which L0 names so and
 *   modular-l0.md's memo calls `at`: the UTF-16 unit at an index of
 *   `u(31)`, which traps at or past the end, as the view's `unit` throws.
 *
 * These are the parts of L0 that [the slices](../todo/slices.md) read so
 * far, and every parameter borrows. A function that gives a value of `any`,
 * which its caller would own, joins with the slice that counts values.
 *
 * @module
 *
 * @import { Interface } from '../types.ts'
 */

import { bool, f64c, int, only, sealed, signature, u } from '../module.f.mjs'

/** A value of unknown kind. */
export const any = sealed('Any', 'any')

/** The kinds of `any`, in the order of their tags. */
export const kinds = ['undefined', 'null', 'boolean', 'number', 'string', 'bigint', 'array', 'object', 'function']

/** A length: L0's `i32` that is never negative. */
const index = u(31)

/** The interface that seals `any`. @type {Interface} */
const anyInterface = {
    abi: 'fjs:l0',
    types: [['any', { variants: kinds, kind: 'kind', carrier: 'i64' }]],
    functions: [
        ['kind', signature([['v', any]], int(0n, 8n))],
        ['to_f64', signature([['v', only(any, 'number')]], f64c)],
        ['to_bool', signature([['v', only(any, 'boolean')]], bool)],
    ],
}

/**
 * The modules of L0 that have a `length`, each with the name of its
 * parameter and the kinds that it takes: a string's, a bigint's, a
 * container's and a function's.
 *
 * @type {readonly (readonly [module: string, param: string, kinds: readonly string[]])[]}
 */
export const lengths = [['String', 's', ['string']], ['BigInt', 'b', ['bigint']], ['Containers', 'c', ['array', 'object']], ['Functions', 'f', ['function']]]

/** An interface whose functions are the `length` of some kinds, then `more`. @type {(param: string, kinds: readonly string[], more: Interface['functions']) => Interface} */
const lengthOf = (param, kinds, more) => ({
    abi: 'fjs:l0',
    types: [],
    functions: [['length', signature([[param, only(any, ...kinds)]], index)], ...more],
})

/**
 * String's functions besides its `length`: `unit`, the UTF-16 unit of a
 * string at an index, which traps where the index is not before the end.
 *
 * @type {Interface['functions']}
 */
const strings = [['unit', signature([['s', only(any, 'string')], ['i', index]], u(16))]]

/** The interfaces of L0, by their names. @type {readonly (readonly [string, Interface])[]} */
export const l0 = [
    ['Any', anyInterface],
    ...lengths.map(([module, param, ks]) => /** @type {const} */ ([module, lengthOf(param, ks, module === 'String' ? strings : [])])),
]
