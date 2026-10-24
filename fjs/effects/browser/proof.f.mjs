/**
 * @import { Do, IoChannel, NotImplemented } from '../types.ts'
 * @import { FetchText, Instantiate, JsHeapSize, WasmInstance } from './types.ts'
 */

import { assertEq } from '../../asserts/module.f.js'
import { fetchText, instantiate, jsHeapSize } from './module.f.mjs'

export const proof = {
    fetchText: () => {
        const { command, payload } = /** @type {Do<FetchText, string, IoChannel>} */ (fetchText('/a.wat'))
        assertEq(command, 'fetchText')
        assertEq(payload[0], '/a.wat')
    },
    instantiate: () => {
        const { command, payload } = /** @type {Do<Instantiate, WasmInstance, IoChannel>} */ (instantiate('/a.wasm'))
        assertEq(command, 'instantiate')
        assertEq(payload[0], '/a.wasm')
    },
    jsHeapSize: () => {
        const { command, payload } = /** @type {Do<JsHeapSize, number | null, NotImplemented>} */ (jsHeapSize())
        assertEq(command, 'jsHeapSize')
        assertEq(payload.length, 0)
    },
}
