/**
 * The browser handler for `instantiateIr`: fetches NaNVM L0 and an
 * IR-emitted program, compiles both, and binds an `invoke` for the page.
 *
 * @module
 *
 * @import { ToAsyncOperationMap } from '../../../effects/types.ts'
 * @import { InstantiateIr } from '../../../effects/browser/types.ts'
 */

import { io } from '../../../effects/module.mjs'
import { fetchOk } from '../../../effects/browser/module.mjs'
import { compileIr } from './host.mjs'

/** @type {ToAsyncOperationMap<InstantiateIr>} */
export const instantiateIrOperationMap = {
    instantiateIr: (l0Path, programPath, exportName) => io(async () => {
        const before = performance.now()
        const [l0Bytes, programBytes] = await Promise.all([
            (await fetchOk(l0Path)).arrayBuffer(),
            (await fetchOk(programPath)).arrayBuffer(),
        ])
        const fetchMs = performance.now() - before
        const compiled = compileIr(l0Bytes, programBytes, exportName)
        return { invoke: compiled.invoke, startup: fetchMs + compiled.startup }
    }),
}
