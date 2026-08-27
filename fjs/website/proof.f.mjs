/**
 * @import { Dir } from '../effects/node/virtual/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { main } from './module.f.mjs'
import { emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../asserts/module.f.mjs'
import { utf8ToString } from '../text/module.f.mjs'

export const proof = {
    main: () => {
        assertNotNullish(main(), 'expected a program effect')
    },
    run: () => {
        /** @type {Dir} */
        const root = { '.github': { workflows: {} } }
        const state = { ...emptyState, root }
        const [generated, result] = virtual(state)(main())
        assertEq(exitCode(result), 0)
        const page = assertNotNullish(generated.root['index.html'], 'expected generated HTML')
        assertNotNullish(generated.root['_browser-test-entry.mjs'], 'expected generated entry module')
        assert(Array.isArray(page), 'expected the generated HTML to be a file')
        const source = page.map(value => utf8ToString(/** @type {Vec} */ (value))).join('')
        assert(source.includes('<h1>Emergent Testing in the Browser</h1>'))
        assert(source.includes('emergent-testing-in-javascript-e44760d71688'))
        assert(!source.includes('?sk='))
    },
}
