/**
 * Browser/Node host for IR-emitted WASM on NaNVM L0: layout, instantiate,
 * and a timed call of a named export that answers a string (or other value
 * read through the host). Used by the emit script and by
 * `effects/browser`'s `instantiateIr`.
 *
 * @module
 */

import { nanvmHost } from '../../../ir/l0/host/nanvm/module.mjs'
import { host as nativeHost } from '../../../ir/native/host/module.mjs'

/** The unsigned LEB128 numbers that `bytes` hold, one after another. @type {(bytes: Uint8Array) => readonly number[]} */
const ulebs = bytes => {
    /** @type {number[]} */
    const out = []
    let n = 0
    let unit = 1
    for (const b of bytes) {
        n += (b % 0x80) * unit
        if (b < 0x80) {
            out.push(n)
            n = 0
            unit = 1
        } else {
            unit *= 0x80
        }
    }
    return out
}

/**
 * What a module's `fjs.layout` asks for: the bytes of its data segments
 * and the entries of its table, `0` each where it has none.
 *
 * @type {(m: WebAssembly.Module) => { readonly data: number, readonly entries: number }}
 */
export const layoutOf = m => {
    const [section] = WebAssembly.Module.customSections(m, 'fjs.layout')
    const [data = 0, , entries = 0] = section === undefined ? [] : ulebs(new Uint8Array(section))
    return { data, entries }
}

/**
 * A ready IR program: compiled L0 + program modules, layout, and the export
 * to invoke. `invoke` makes a fresh NaNVM host, runs the export, and answers
 * the host-read value plus linear-memory size before/after.
 *
 * @type {(l0: WebAssembly.Module, program: WebAssembly.Module, exportName: string) => {
 *   readonly invoke: () => { readonly value: unknown, readonly memory: number, readonly growth: number },
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
            const handle = f()
            const value = h.read(handle)
            h.imports.drop(handle)
            const after = memory?.buffer?.byteLength ?? before
            return { value, memory: after, growth: after - before }
        },
    }
}

/**
 * Compiles L0 and program bytes into a bound IR runner, measuring startup.
 *
 * @type {(l0Bytes: ArrayBuffer, programBytes: ArrayBuffer, exportName: string) => {
 *   readonly invoke: () => { readonly value: unknown, readonly memory: number, readonly growth: number },
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
