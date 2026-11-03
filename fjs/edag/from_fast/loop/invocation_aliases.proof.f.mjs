/**
 * Invocation aliases keep the fixed parameters and the rest input in separate
 * positions. Equal presentation indices do not merge their binding identities.
 * @import { Function as FastFunction, Statement } from '../../../js/ast/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { invocationAliases } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    restAliasesKeepTheirOwnInvocationPosition: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const fixed = /** @type {const} */ ({ index: 0 })
        const rest = /** @type {const} */ ({ index: 0 })
        const self = /** @type {const} */ ({ index: 0 })
        const captured = /** @type {const} */ ({ index: 0 })
        const fixedAlias = /** @type {const} */ ({ index: 0 })
        const restAlias = /** @type {const} */ ({ index: 0 })
        const restAgain = /** @type {const} */ ({ index: 0 })
        const selfAlias = /** @type {const} */ ({ index: 0 })
        const captureAlias = /** @type {const} */ ({ index: 0 })
        /** @type {FastFunction} */
        const fn = { target: owner, parameters: [fixed], rest, self, captures: [{ binding: captured, value: 7 }],
            body: { statements: [], exit: ['return', owner, 0] } }
        /** @type {readonly Statement[]} */
        const aliases = [
            ['define', restAlias, ['ref', rest], 'lazy'],
            ['define', fixedAlias, ['ref', fixed], 'required'],
            ['define', selfAlias, ['ref', self], 'required'],
            ['define', restAgain, ['ref', restAlias], 'required'],
            ['define', captureAlias, ['ref', captured], 'lazy'],
        ]
        const lineages = invocationAliases(fn, aliases)
        assert(lineages !== null)
        assertStructurallySame(lineages, [[fixed, fixedAlias], [rest, restAlias, restAgain]])
        assertEq(lineages[0][0], fixed)
        assertEq(lineages[0][1], fixedAlias)
        assertEq(lineages[1][0], rest)
        assertEq(lineages[1][1], restAlias)
        assertEq(lineages[1][2], restAgain)
    },
})
