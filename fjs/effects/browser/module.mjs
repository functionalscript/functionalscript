/**
 * The browser operations' handlers, for a page to spread into its operation
 * map. Impure: they fetch, and read a clock and the heap.
 *
 * @module
 *
 * @import { ToAsyncOperationMap } from '../types.ts'
 * @import { BrowserOp } from './types.ts'
 */

import { io } from './../module.mjs'
import { ok } from '../../types/result/module.f.js'

/**
 * The response to a fetch of `path`, refused unless the site answered it
 * with a success status: a missing file's 404 page is not its text.
 *
 * @type {(path: string) => Promise<Response>}
 */
const fetchOk = async path => {
    const response = await fetch(path)
    if (!response.ok) { throw new Error(`${path}: HTTP ${response.status}`) }
    return response
}

/** @type {ToAsyncOperationMap<BrowserOp>} */
export const browserOperationMap = {
    fetchText: path => io(async () => (await fetchOk(path)).text()),
    // Fetched whole and then compiled, not streamed: streaming compilation
    // needs the server to answer `application/wasm`, and a site served
    // another way would fail to load rather than load slower.
    instantiate: path => io(async () => {
        const before = performance.now()
        const bytes = await (await fetchOk(path)).arrayBuffer()
        const { instance } = await WebAssembly.instantiate(bytes, {})
        const after = performance.now()
        return { exports: instance.exports, startup: after - before }
    }),
    jsHeapSize: async () => {
        const { memory } = /** @type {{ readonly memory?: { readonly usedJSHeapSize: number } }} */ (performance)
        return ok(memory === undefined ? null : memory.usedJSHeapSize)
    },
}
