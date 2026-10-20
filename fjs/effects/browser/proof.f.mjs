/**
 * @import { Do, IoChannel } from '../types.ts'
 * @import { FetchText, Instantiate, WasmInstance } from './types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { fetchText, instantiate } from './module.f.mjs'

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
}
