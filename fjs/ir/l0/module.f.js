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
 *   carries it. `dup` and `drop` make it counted, and `undefined`, `null`
 *   and `boolean` are its copy variants
 *   ([slices.md](../todo/slices.md#later)): a value that holds only those
 *   needs no `dup` and no `drop`, and a `drop` of `any` that holds one
 *   does nothing.
 * - **`undefined`, `null`, `true` and `false` are Any's constants**, which a
 *   module imports as immutable globals that the host makes
 *   ([L0 design §3](../../../doc/sasha-gil/wasm/l0-design.md#3-constants-imported-immutable-globals)).
 *   A module borrows each, and nothing counts one.
 * - **A string literal is made by String's `make_string`** from its UTF-16
 *   units in memory
 *   ([L0 design §7](../../../doc/sasha-gil/wasm/l0-design.md#7-strings-utf-16-units-in-l0)),
 *   once, by the module's start function
 *   ([§6](../../../doc/sasha-gil/wasm/l0-design.md#6-literals-built-once-at-start-up)).
 *   It is no function of String's interface, since its arguments, an
 *   address and a length, are values only of the low level: `any` names it
 *   as the maker of its literals, which the emitter calls, and a module of
 *   the low level, which reads the memory, calls it through `Units`.
 * - **The casts' targets are the arguments.** `to_f64` takes a number and
 *   `to_bool` a boolean, so passing a value of unknown kind is a type error,
 *   and a module narrows its value with a `match` first. `from_f64` and
 *   `from_bool` are their inverses: a float or a boolean meets `any` through
 *   them
 *   ([definition.md's rule 6](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)).
 *   So does `same`, reference identity
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
 * - **A builder makes an array or an object**
 *   ([L0 design §8](../../../doc/sasha-gil/wasm/l0-design.md#8-containers-a-builder-handle-then-seal)):
 *   `begin_array(n)` answers a builder of `n` items and `begin_object(n)`
 *   one of `n` properties; each `push` or `push_property` owns it and the
 *   value (and the key, a string) and gives it back, `push_all` owns it,
 *   borrows an array and gives it back with each item of the array pushed
 *   in its order, a count more of each, and `seal` owns it
 *   and answers the array or the object, owned
 *   ([§9](../../../doc/sasha-gil/wasm/l0-design.md#9-objects-the-runtime-keeps-keys-unique-and-ordered):
 *   a repeated key keeps its first position and its last value). A builder
 *   is linear
 *   ([definition.md](../../../doc/sasha-gil/ir/definition.md#ownership-is-two-capabilities)):
 *   Containers names no `dup` and no `drop` for it, so each path consumes
 *   it once, by a `push`, a `push_all`, a `push_property` or a `seal`, and
 *   no `kind`, so nothing branches on it. An `i32` carries it. `push`,
 *   `push_all` and `push_property` give back the builder they own, so their imports take it once and
 *   answer nothing. Pushing more items than `n`, a `push_all` of what is
 *   no array, sealing with fewer, or a
 *   builder that is sealed already traps.
 * - **`find` is an object's property index**, or `-1` where it has no such
 *   key ([L0 design §9](../../../doc/sasha-gil/wasm/l0-design.md#9-objects-the-runtime-keeps-keys-unique-and-ordered)):
 *   `find(o, k)` borrows an object and a string key and answers an `i32`.
 *   `join` joins the strings of a borrowed array with a borrowed separator
 *   and answers an owned string; it fails where an item is not a string.
 *   `key(o, i)` borrows an object and answers the owned key of its property
 *   `i`, which traps at or past the end, as the view's `key` throws.
 * - **`call` invokes an existing function value**
 *   ([L0 design §12](../../../doc/sasha-gil/wasm/l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)):
 *   `call(f, args)` borrows a function and a sealed array of arguments and
 *   answers the result, owned. A throw from the function fails, as
 *   `throw` does. `text(f)` borrows a function and answers its source text,
 *   an owned string or `undefined`. `make_function(c, frame, length, text)`
 *   makes a function value of the module's code `c`, which takes the value
 *   itself as `self` and its arguments array, and owns the sealed `frame`
 *   array and the `text`; `frame(self, i)` answers item `i` of that frame,
 *   owned, so the code reads its captures
 *   ([slice 11b](../todo/slices.md#decisions-for-slice-11-2026-11-20)).
 *   A function that `make_function` did not make, or an `i` past its
 *   frame, traps as misuse.
 * - **A throw is Functions' `throw`**
 *   ([L0 design §13](../../../doc/sasha-gil/wasm/l0-design.md#13-errors-a-throw-traps)):
 *   it takes over a value, which the host keeps, and fails, so it answers
 *   `never`, and the emitter writes an `unreachable` after its call. The
 *   host reads the value after the trap, by `has_thrown` and `thrown`, and
 *   `recover` frees what the frames that the trap abandoned held.
 * - **A function that may fail says so**
 *   ([definition.md: One effect](../../../doc/sasha-gil/ir/definition.md#one-effect)):
 *   `throw`, `call`, and the functions that trap where the view throws, which
 *   definition.md marks: String's `unit` and `substring`, and Containers'
 *   `item`, `push`, `push_all`, `push_property`, `seal`, `join` and `key`, and Functions'
 *   `frame`, which traps for a function that `make_function` did not make
 *   or past its frame, as `item` does past its end. Every other function
 *   of L0 completes on the values of its parameters' types.
 * - **`Memory` is no host's**: its loads, its stores, `copy`, `size` and
 *   `grow` are the target's own instructions on the memory that the loader makes,
 *   which the interface says with `instructions`, so no host binds them. It
 *   is no part of `l0`: a module that keeps state of its own, as a heap
 *   does, imports it, beside L0 or alone
 *   ([heap.md](../../../doc/sasha-gil/ir/heap.md#memory-in-the-ir)).
 *
 * @module
 *
 * @import { Interface } from '../types.ts'
 */

import { bool, code, countsBits, f64, f64c, i, int, mayFail, never, only, own, sealed, signature, u, unit } from '../module.f.js'

/** A value of unknown kind. */
export const any = sealed('Any', 'any')

/** The kinds of `any`, in the order of their tags. */
export const kinds = ['undefined', 'null', 'boolean', 'number', 'string', 'bigint', 'array', 'object', 'function']

/** A length: L0's `i32` that is never negative. */
const index = u(31)

/** A size of the memory in pages of 64 KiB: no more than a 32-bit address reaches. */
const pages = int(0n, 0x1_0000n)

/** A value that L0's `same` takes: an array, an object or a function. */
const reference = only(any, 'array', 'object', 'function')

/** A string, the type of a string literal. */
export const string = only(any, 'string')

/** An array, which `seal` of a `begin_array` answers. */
export const array = only(any, 'array')

/** An object, which `seal` of a `begin_object` answers. */
export const object = only(any, 'object')

/** A function, which `call` takes and `make_function` answers. */
export const func = only(any, 'function')

/** An array or an object, which `seal` answers. */
export const container = only(any, 'array', 'object')

/** A string or `undefined`, the text `make_function` takes. */
const text = only(any, 'string', 'undefined')

/**
 * The code type of every L0 function value: `(self, args) -> any`, both
 * borrowed ([L0 design §12](../../../doc/sasha-gil/wasm/l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)).
 */
const functionCode = code([['borrow', func], ['borrow', array]], any)

/** A builder of an array or an object, which nothing copies or drops. */
export const builder = sealed('Containers', 'builder')

/** A boolean. */
const boolean = only(any, 'boolean')

/** The interface that seals `any`. @type {Interface} */
const anyInterface = {
    abi: 'fjs:l0',
    types: [['any', { variants: kinds, kind: 'kind', carrier: 'i64', dup: 'dup', drop: 'drop', copy: ['undefined', 'null', 'boolean'], literal: { variant: 'string', module: 'String', member: 'make_string' } }]],
    constants: [['undefined', only(any, 'undefined')], ['null', only(any, 'null')], ['true', boolean], ['false', boolean]],
    functions: [
        ['kind', signature([['v', any]], int(0n, 8n))],
        ['to_f64', signature([['v', only(any, 'number')]], f64c)],
        ['from_f64', signature([['x', f64]], only(any, 'number'))],
        ['to_bool', signature([['v', only(any, 'boolean')]], bool)],
        ['from_bool', signature([['b', bool]], boolean)],
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
 * array or the value of the property `i` of an object, owned; `find`, the
 * index of an object's property or `-1`; `join`, the owned string of an
 * array's string items with a separator; and the builder's: `begin_array`
 * and `begin_object`, a builder of `n` items or properties, `push` and
 * `push_property`, which own the builder and an item or a key and a value
 * and give the builder back, `push_all`, which owns the builder, borrows an
 * array and gives the builder back with each item of the array pushed, and `seal`, which owns the builder and answers
 * the array or the object; and `key`, the owned string key of the
 * property `i` of an object, which a spread of one copies.
 *
 * @type {Interface['functions']}
 */
const containers = [
    ['item', mayFail(signature([['c', container], ['i', index]], any))],
    ['find', signature([['o', object], ['k', string]], i(32))],
    ['begin_array', signature([['n', index]], builder)],
    ['begin_object', signature([['n', index]], builder)],
    ['push', mayFail(signature([own('b', builder), own('v', any)], builder, 'b'))],
    ['push_all', mayFail(signature([own('b', builder), ['a', array]], builder, 'b'))],
    ['push_property', mayFail(signature([own('b', builder), own('k', string), own('v', any)], builder, 'b'))],
    ['seal', mayFail(signature([own('b', builder)], container))],
    ['join', mayFail(signature([['parts', array], ['separator', string]], string))],
    ['key', mayFail(signature([['o', object], ['i', index]], string))],
]

/**
 * Functions' functions besides its `length`: `make_function`, which makes
 * a function value of an IR `code`, its frame, its length and its text;
 * `call`, which borrows a function and its arguments array and may fail
 * where the function throws; `text`, the owned source text of a function,
 * a string or `undefined`; `throw`, which takes over a value and fails, so
 * that it answers `never`; and `frame`, the owned item `i` of the frame of
 * a function that `make_function` made, which its code reads through
 * `self`.
 *
 * @type {Interface['functions']}
 */
const functions = [
    ['make_function', signature([
        ['c', functionCode],
        own('frame', array),
        ['length', index],
        own('text', text),
    ], func)],
    ['call', mayFail(signature([['f', func], ['args', array]], any))],
    ['text', signature([['f', func]], text)],
    ['throw', mayFail(signature([own('v', any)], never))],
    ['frame', mayFail(signature([['self', func], ['i', index]], any))],
]

/**
 * The functions of the modules of L0 that have more than a `length`, and
 * their types: Containers' builder, carried by an `i32`.
 *
 * @type {readonly (readonly [string, Interface['functions'], Interface['types']])[]}
 */
const more = [['String', strings, []], ['Containers', containers, [['builder', { variants: ['builder'], carrier: 'i32' }]]], ['Functions', functions, []]]

/**
 * `Ref`, NaNVM's functions of references, over their bits, which the module
 * that defines `any` in the IR imports: `kind_ref`, the kind of a
 * reference; `dup_ref`, the bits of a new owner of it; `drop_ref`, which
 * gives one up; and `same_ref`, whether two references are one. Each traps
 * on bits that are no reference, which is a misuse, so none declares that
 * it may fail, as L0's `dup` and `drop` do not
 * ([defined-hooks.md](../../../doc/sasha-gil/ir/defined-hooks.md#anys-hooks-written-out)).
 *
 * @type {readonly [string, Interface]}
 */
export const ref = ['Ref', {
    abi: 'fjs:l0',
    types: [],
    functions: [
        ['kind_ref', signature([['b', u(64)]], int(0n, 8n))],
        ['dup_ref', countsBits('dup', signature([['b', u(64)]], u(64)))],
        ['drop_ref', countsBits('drop', signature([['b', u(64)]], unit))],
        ['same_ref', signature([['a', u(64)], ['b', u(64)]], bool)],
    ],
}]

/**
 * `Memory`, the memory that the loader makes
 * ([L0 design §5](../../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)),
 * which a module that keeps state of its own, such as a heap, reads and
 * writes ([heap.md](../../../doc/sasha-gil/ir/heap.md#memory-in-the-ir)):
 * `load8` to `load64` answer the `u(8)` to `u(64)` at an address, its low
 * byte first, `store8` to `store64` write one there, `copy(to, from, n)`
 * writes the `n` bytes at `from` to `to` as they were before it, so the two
 * may overlap, `size` answers the memory's size in pages of 64 KiB, and
 * `grow` adds pages and answers the size before, or `-1` where the memory
 * cannot grow. Its functions are no
 * imports but the target's own instructions, which the interface says, and
 * their calls touch the memory, so each keeps its place in every pass. An
 * address past the memory traps, which is a misuse, so none declares that
 * it may fail, as `Ref`'s functions do not.
 *
 * @type {readonly [string, Interface]}
 */
export const memory = ['Memory', {
    abi: 'fjs:l0',
    instructions: true,
    types: [],
    functions: [
        ...[8, 16, 32, 64].map(n => /** @type {const} */ ([`load${n}`, signature([['a', u(32)]], u(n))])),
        ...[8, 16, 32, 64].map(n => /** @type {const} */ ([`store${n}`, signature([['a', u(32)], ['v', u(n)]], unit)])),
        ['copy', signature([['to', u(32)], ['from', u(32)], ['n', u(32)]], unit)],
        ['size', signature([], pages)],
        ['grow', signature([['n', pages]], int(-1n, 0x1_0000n))],
    ],
}]

/**
 * `Units`, String's maker at the low level, where an address is a value:
 * `make_string(p, n)`, the owned string of the `n` UTF-16 units at `p`, the
 * low byte of each first, which the emitter also names as the maker of the
 * literals of `any`. A module that copies a string of the IR heap into one
 * of the host's, as each crossing into NaNVM does, imports it
 * ([long-strings.md, choice 1](../../../doc/sasha-gil/ir/long-strings.md#1-whether-nanvm-holds-references-into-the-ir-heap)).
 * Units past the memory are a misuse, so it declares no failure.
 *
 * @type {readonly [string, Interface]}
 */
export const units = ['Units', {
    abi: 'fjs:l0',
    types: [],
    functions: [['make_string', signature([['p', u(32)], ['n', index]], string)]],
}]

/** The interfaces of L0, by their names. @type {readonly (readonly [string, Interface])[]} */
export const l0 = [
    ['Any', anyInterface],
    ...lengths.map(([module, param, ks]) => {
        const [, fns, types] = more.find(([k]) => k === module) ?? ['', [], []]
        return /** @type {const} */ ([module, lengthOf(param, ks, fns, types)])
    }),
]
