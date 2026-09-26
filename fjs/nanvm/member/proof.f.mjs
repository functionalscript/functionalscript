/**
 * Proofs for the member-function groups. What each case answers is proven
 * through `data`, in [`../proof.f.mjs`](../proof.f.mjs); here, only what
 * this module owns: its groups.
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { groups } from './module.f.mjs'

export const proof = {
    /** One group per method: a second group would split its cases. */
    oneGroupPerMethod: () => {
        const methods = groups.map(g => g.method)
        assertEq(new Set(methods).size, methods.length)
    },
    /** Case names are unique within a group, as Rust test names must be. */
    uniqueNames: () => {
        for (const g of groups) {
            const names = g.cases.map(c => c.name)
            assertEq(new Set(names).size, names.length)
        }
    },
}
