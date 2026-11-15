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
 *   carries it. `dup` and `drop` make it counted: every value of `any` is
 *   counted in this slice (copy variants wait until after slice 6).
 * - **`undefined`, `null`, `true` and `false` are Any's constants**, which a
 *   module imports as immutable globals that the host makes
 *   ([L0 design §3](../../../doc/sasha-gil/wasm/l0-design.md#3-constants-imported-immutable-globals)).
 *   A module borrows each, and nothing drops one.
 * - **A string literal is made by String's `make_string`** from its UTF-16
 *   units in memory
 *   ([L0 design §7](../../../doc/sasha-gil/wasm/l0-design.md#7-strings-utf-16-units-in-l0)),
 *   once, by the module's start function
 *   ([§6](../../../doc/sasha-gil/wasm/l0-design.md#6-literals-built-once-at-start-up)).
 *   It is no function of String's interface, since its arguments, an
 *   address and a length, are no values of the IR: `any` names it as the
 *   maker of its literals, and only the emitter calls it.
 * - **The casts' targets are the arguments.** `to_f64` takes a number and
 *   `to_bool` a boolean, so passing a value of unknown kind is a type error,
 *   and a module narrows its value with a `match` first. So does `same`,
 *   reference identity
 *   ([L0 design §14](../../../doc/sasha-gil/wasm/l0-design.md#14-identity-same-is-reference-identity-and-a-runtime-may-merge-equal-values)),
 *   which takes two arrays, objects or functions.
 * - **`length` is one function per module**
 *   ([L0 design §18](../../../doc/sasha-gil/wasm/l0-design.md#18-what-length-item-and-key-mean-for-each-kind)):
 *   a string's UTF-16 units, a bigint's words, the items of an array or the
 *   properties of an object, and a function's declared parameters. All of
 *   them are the one `length` import.
 * - **A string's unit is String's `unit`**, which L0 names so and
 *   modular-l0.md's memo calls `at`: the UTF-16 unit at an index of
 *   `u(31)`, which traps at or past the end, as the view's `unit` throws.
 * - **`from_unit`, `concat` and `substring` answer an owned string, and
 *   Containers' `item` an owned value**, which the caller drops: the item
 *   of an array or the value of a property of an object, counted once more
 *   ([L0 design §10](../../../doc/sasha-gil/wasm/l0-design.md#10-lifetime-reference-counting-borrowed-arguments-owned-results)).
 *   `item` and `substring` trap where the view throws: at or past the end,
 *   and where `start` is past `end`.
 * - **A builder makes an array**
 *   ([L0 design §8](../../../doc/sasha-gil/wasm/l0-design.md#8-containers-a-builder-handle-then-seal)):
 *   `begin_array(n)` answers a builder of `n` items, each `push` owns it
 *   and an item and gives it back, and `seal` owns it and answers the
 *   array, owned. A builder is linear
 *   ([definition.md](../../../doc/sasha-gil/ir/definition.md#ownership-is-two-capabilities)):
 *   Containers names no `dup` and no `drop` for it, so each path consumes
 *   it once, by a `push` or a `seal`, and no `kind`, so nothing branches on
 *   it. An `i32` carries it. `push` gives back the builder it owns, so its
 *   import takes it once and answers nothing. Pushing more items than `n`,
 *   sealing with fewer, or a builder that is sealed already traps.
 * - **A throw is Functions' `throw`**
 *   ([L0 design §13](../../../doc/sasha-gil/wasm/l0-design.md#13-errors-a-throw-traps)):
 *   it takes over a value, which the host keeps, and fails, so it answers
 *   `never`, and the emitter writes an `unreachable` after its call. The
 *   host reads the value after the trap, by `has_thrown` and `thrown`, and
 *   `recover` frees what the frames that the trap abandoned held.
 * - **A function that may fail says so**
 *   ([definition.md: One effect](../../../doc/sasha-gil/ir/definition.md#one-effect)):
 *   `throw`, and the functions that trap where the view throws, which
 *   definition.md marks: String's `unit` and `substring`, and Containers'
 *   `item`, `push` and `seal`. Every other function of L0 completes on
 *   the values of its parameters' types.
 *
 * @module
 *
 * @import { Interface } from '../types.ts'
 */

import { bool, f64c, int, mayFail, never, only, own, sealed, signature, u, unit } from '../module.f.js'

/** A value of unknown kind. */
export const any = sealed('Any', 'any')

/** The kinds of `any`, in the order of their tags. */
export const kinds = ['undefined', 'null', 'boolean', 'number', 'string', 'bigint', 'array', 'object', 'function']

/** A length: L0's `i32` that is never negative. */
const index = u(31)

/** A value that L0's `same` takes: an array, an object or a function. */
const reference = only(any, 'array', 'object', 'function')

/** A string, the type of a string literal. */
export const string = only(any, 'string')

/** An array, which `seal` answers. */
export const array = only(any, 'array')

/** A builder of an array, which nothing copies or drops. */
export const builder = sealed('Containers', 'builder')

/** A boolean. */
const boolean = only(any, 'boolean')

/** The interface that seals `any`. @type {Interface} */
const anyInterface = {
    abi: 'fjs:l0',
    types: [['any', { variants: kinds, kind: 'kind', carrier: 'i64', dup: 'dup', drop: 'drop', literal: { variant: 'string', module: 'String', member: 'make_string' } }]],
    constants: [['undefined', only(any, 'undefined')], ['null', only(any, 'null')], ['true', boolean], ['false', boolean]],
    functions: [
        ['kind', signature([['v', any]], int(0n, 8n))],
        ['to_f64', signature([['v', only(any, 'number')]], f64c)],
        ['to_bool', signature([['v', only(any, 'boolean')]], bool)],
        ['same', signature([['a', reference], ['b', reference]], bool)],
        ['dup', signature([['v', any]], any)],
        ['drop', signature([own('v', any)], unit)],
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

/** An interface of `types`, whose functions are the `length` of some kinds, then `more`. @type {(param: string, kinds: readonly string[], more: Interface['functions'], types: Interface['types']) => Interface} */
const lengthOf = (param, kinds, more, types) => ({
    abi: 'fjs:l0',
    types,
    functions: [['length', signature([[param, only(any, ...kinds)]], index)], ...more],
})

/**
 * String's functions besides its `length`: `unit`, the UTF-16 unit of a
 * string at an index; `from_unit`, the owned string of one unit; `concat`,
 * the owned join of two borrowed strings; and `substring`, the owned string
 * of the units of `s` from `start` up to `end`.
 *
 * @type {Interface['functions']}
 */
const strings = [
    ['unit', mayFail(signature([['s', string], ['i', index]], u(16)))],
    ['from_unit', signature([['c', u(16)]], string)],
    ['concat', signature([['a', string], ['b', string]], string)],
    ['substring', mayFail(signature([['s', string], ['start', index], ['end', index]], string))],
]

/**
 * Containers' functions besides its `length`: `item`, the item `i` of an
 * array or the value of the property `i` of an object, owned; and the
 * builder's: `begin_array`, a builder of `n` items, `push`, which owns the
 * builder and an item and gives the builder back, and `seal`, which owns
 * the builder and answers the array.
 *
 * @type {Interface['functions']}
 */
const containers = [
    ['item', mayFail(signature([['c', only(any, 'array', 'object')], ['i', index]], any))],
    ['begin_array', signature([['n', index]], builder)],
    ['push', mayFail(signature([own('b', builder), own('v', any)], builder, 'b'))],
    ['seal', mayFail(signature([own('b', builder)], array))],
]

/**
 * Functions' functions besides its `length`: `throw`, which takes over a
 * value and fails, so that it answers `never`.
 *
 * @type {Interface['functions']}
 */
const functions = [
    ['throw', mayFail(signature([own('v', any)], never))],
]

/**
 * The functions of the modules of L0 that have more than a `length`, and
 * their types: Containers' builder, carried by an `i32`.
 *
 * @type {readonly (readonly [string, Interface['functions'], Interface['types']])[]}
 */
const more = [['String', strings, []], ['Containers', containers, [['builder', { variants: ['builder'], carrier: 'i32' }]]], ['Functions', functions, []]]

/** The interfaces of L0, by their names. @type {readonly (readonly [string, Interface])[]} */
export const l0 = [
    ['Any', anyInterface],
    ...lengths.map(([module, param, ks]) => {
        const [, fns, types] = more.find(([k]) => k === module) ?? ['', [], []]
        return /** @type {const} */ ([module, lengthOf(param, ks, fns, types)])
    }),
]
