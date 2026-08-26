/**
 * @import { Dir } from '../effects/node/virtual/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { main } from './module.f.mjs'
import { emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { assertEq, assertNotNullish } from '../asserts/module.f.mjs'

export const proof = {
    main: () => {
        assertNotNullish(main(), 'expected a program effect')
    },
    run: () => {
        /** @type {Dir} */
        const root = { '.github': { workflows: {} } }
        const state = { ...emptyState, root }
        const [_, result] = virtual(state)(main())
        assertEq(exitCode(result), 0)
        assertNotNullish(state.root['index.html'], 'expected generated HTML')
        assertNotNullish(state.root['browser-test-entry.mjs'], 'expected generated entry module')
    },
}
