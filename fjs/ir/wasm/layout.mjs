/**
 * Reads a module's `fjs.layout` custom section: how many bytes of data
 * segments and how many table entries the host must make. Shared by the
 * emitter's host proofs and by the demo IR runner — not a test helper.
 *
 * @module
 */

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
