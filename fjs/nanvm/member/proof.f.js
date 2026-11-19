/**
 * Proofs for the member-function groups. What each case answers is proven
 * through `data`, in [`../proof.f.mjs`](../proof.f.mjs); here, only what
 * this module owns: its groups.
 */

import { assertEq } from '../../asserts/module.f.js'
import { groups } from './module.f.js'
import { dedup } from '../../types/array/module.f.js'
import { nameOf } from '../../types/object/name/module.f.js'

export const proof = {
    /** One group per method: a second group would split its cases. */
    oneGroupPerMethod: () => {
        const methods = groups.map(g => g.method)
        assertEq(dedup(methods).length, methods.length)
    },
    /** Case names are unique within a group, as Rust test names must be. */
    uniqueNames: () => {
        for (const g of groups) {
            const names = g.cases.map(c => nameOf(c))
            assertEq(dedup(names).length, names.length)
        }
    },
}
