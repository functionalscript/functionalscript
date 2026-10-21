/**
 * Proofs for the browser handlers. A `.mjs` because the handlers are impure;
 * they fetch `data:` URLs, which every host the suite runs on answers
 * without a network.
 */

import { assert, assertEq } from '../../asserts/module.f.js'
import { browserOperationMap } from './module.mjs'

/** The smallest WebAssembly module: the magic number and the version. */
const emptyModule = 'data:application/wasm;base64,AGFzbQEAAAA='

export const proof = {
    fetchText: async () => {
        const [tag, text] = await browserOperationMap.fetchText('data:text/plain,hello')
        assertEq(tag, 'ok')
        assertEq(text, 'hello')
    },
    instantiate: async () => {
        const result = await browserOperationMap.instantiate(emptyModule)
        assert(result[0] === 'ok')
        assertEq(Object.keys(result[1].exports).length, 0)
        assert(result[1].startup >= 0)
    },
    // Bytes that are not a module are the operation's error, not a throw.
    instantiateRefusesNotAModule: async () => {
        const [tag] = await browserOperationMap.instantiate('data:application/wasm;base64,AAAA')
        assertEq(tag, 'error')
    },
}
