/**
 * Browser/Node host for IR-emitted WASM on NaNVM L0: instantiate and a timed
 * call of a named export that answers a string (or other value read through
 * the host). Layout decoding lives in [`layout.mjs`](../../../ir/wasm/layout.mjs).
 * Used by the emit script and by `effects/browser`'s `instantiateIr`.
 *
 * @module
 */

import { nanvmHost } from '../../../ir/l0/host/nanvm/module.mjs'
import { host as nativeHost } from '../../../ir/native/host/module.mjs'
import { layoutOf } from '../../../ir/wasm/layout.mjs'

export { layoutOf }

/**
 * A ready IR program: compiled L0 + program modules, layout, and the export
 * to invoke. `invoke` makes a fresh NaNVM host and instance, then times only
 * the export call (plus host read/drop), matching the Rust→WASM path where
 * sample load sits outside the timed `run_sample`.
 *
 * @type {(l0: WebAssembly.Module, program: WebAssembly.Module, exportName: string) => {
 *   readonly invoke: () => {
 *     readonly value: unknown,
 *     readonly memory: number,
 *     readonly growth: number,
 *     readonly time: number,
 *   },
 * }}
 */
export const bindIr = (l0, program, exportName) => {
    const { data, entries } = layoutOf(program)
    const make = nanvmHost(l0)
    return {
        invoke: () => {
            const h = make([], data, entries)
            const { exports } = new WebAssembly.Instance(program, {
                'fjs:l0': h.imports,
                'fjs:l1-native': h.native ?? nativeHost(h.read, h.own, h.fail),
            })
            if (typeof exports.init === 'function') { exports.init() }
            h.keep()
            const f = exports[exportName]
            if (typeof f !== 'function') {
                throw new Error(`the IR module does not export ${exportName}`)
            }
            const memory = /** @type {{ readonly buffer?: { readonly byteLength: number } } | undefined} */ (
                h.imports.memory ?? exports.memory)
            const before = memory?.buffer?.byteLength ?? 0
            const started = performance.now()
            const handle = f()
            const value = h.read(handle)
            h.imports.drop(handle)
            const time = performance.now() - started
            const after = memory?.buffer?.byteLength ?? before
            return { value, memory: after, growth: after - before, time }
        },
    }
}

/**
 * Compiles L0 and program bytes into a bound IR runner, measuring startup
 * (compile only — not host instantiation).
 *
 * @type {(l0Bytes: ArrayBuffer, programBytes: ArrayBuffer, exportName: string) => {
 *   readonly invoke: () => {
 *     readonly value: unknown,
 *     readonly memory: number,
 *     readonly growth: number,
 *     readonly time: number,
 *   },
 *   readonly startup: number,
 * }}
 */
export const compileIr = (l0Bytes, programBytes, exportName) => {
    const before = performance.now()
    const l0 = new WebAssembly.Module(l0Bytes)
    const program = new WebAssembly.Module(programBytes)
    const bound = bindIr(l0, program, exportName)
    const after = performance.now()
    return { ...bound, startup: after - before }
}
