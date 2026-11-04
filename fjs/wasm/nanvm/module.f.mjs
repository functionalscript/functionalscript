/**
 * The two adapter modules that give NaNVM, a Rust runtime, L0's two-value
 * results on stable Rust
 * ([`nanvm-adapter.md`](../../../doc/sasha-gil/wasm/nanvm-adapter.md)).
 *
 * Stable Rust returns a pair through memory, and cannot name a function
 * type with two results, so NaNVM splits each such call in two: a status
 * and then the value, kept by whoever made the call. These modules join
 * the halves back into L0's `(i32, any)` on each side:
 *
 * - [`inbound`](#inbound) is imported by NaNVM. Its `invoke` calls a
 *   program's code through the shared table, answers the status, and keeps
 *   the value for `invoke_value`.
 * - [`outbound`](#outbound) is imported by the program in NaNVM's place for
 *   `call`. Its `call` asks NaNVM's `call_status`, then `call_value`.
 *
 * They are two modules, not one, because NaNVM imports the first and the
 * second imports NaNVM: one module would be a cycle no loader can
 * instantiate.
 *
 * @module
 *
 * @import { FuncType, Module } from '../../media/wasm/types.ts'
 */

/** A module with none of anything. @type {Module} */
const empty = {
    types: [], imports: [], functions: [], tables: [], memories: [], globals: [], exports: [],
    start: null, elements: [], dataCount: null, data: [], customs: [],
}

/** The type of all code, and of L0 `call`. @type {FuncType} */
const code = { params: ['i64', 'i64'], results: ['i32', 'i64'] }

/** A half that answers the status. @type {FuncType} */
const status = { params: ['i64', 'i64'], results: ['i32'] }

/** A half that answers the value. @type {FuncType} */
const value = { params: [], results: ['i64'] }

/** `invoke`'s type: a code index, then `self` and `args`. @type {FuncType} */
const invoke = { params: ['i32', 'i64', 'i64'], results: ['i32'] }

/** The import module NaNVM names to reach [`inbound`](#inbound). */
export const inboundName = 'fjs:nanvm-inbound'

/**
 * The module NaNVM imports as `fjs:nanvm-inbound`. It imports the shared
 * table from the loader, as `fjs:loader` `table`, and exports:
 *
 * - `invoke(code, self, args) -> status`: the code at index `code` of the
 *   table, called with `self` and `args`, its value kept;
 * - `invoke_value() -> any`: the value the last `invoke` kept.
 *
 * NaNVM reads `invoke_value` right after `invoke`, before any other call
 * can run another `invoke`.
 *
 * @type {Module}
 */
export const inbound = {
    ...empty,
    types: [code, invoke, value],
    imports: [
        { module: 'fjs:loader', name: 'table', desc: ['table', { element: 'funcref', limits: { min: 0, max: null } }] },
    ],
    functions: [
        {
            type: 1,
            locals: [[1, 'i64']],
            body: [
                ['local.get', 1],
                ['local.get', 2],
                ['local.get', 0],
                ['call_indirect', 0, 0],
                ['local.set', 3],
                ['local.get', 3],
                ['global.set', 0],
            ],
        },
        { type: 2, locals: [], body: [['global.get', 0]] },
    ],
    globals: [{ type: { type: 'i64', mutable: true }, init: [['i64.const', 0n]] }],
    exports: [
        { name: 'invoke', kind: 'func', index: 0 },
        { name: 'invoke_value', kind: 'func', index: 1 },
    ],
}

/**
 * The module the program imports L0 `call` from, in NaNVM's place. It
 * imports NaNVM's two halves, as `nanvm` `call_status` and `call_value`,
 * and exports `call(f, args) -> (status, any)`.
 *
 * @type {Module}
 */
export const outbound = {
    ...empty,
    types: [code, status, value],
    imports: [
        { module: 'nanvm', name: 'call_status', desc: ['func', 1] },
        { module: 'nanvm', name: 'call_value', desc: ['func', 2] },
    ],
    functions: [
        {
            type: 0,
            locals: [],
            body: [
                ['local.get', 0],
                ['local.get', 1],
                ['call', 0],
                ['call', 1],
            ],
        },
    ],
    exports: [{ name: 'call', kind: 'func', index: 2 }],
}
