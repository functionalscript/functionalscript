/**
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { Env } from '../../effects/node/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { exitCode } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { rustdocStylesheet } from '../style/module.f.mjs'
import { main } from './module.f.mjs'

/** @type {(root: Dir, name: string) => string} */
const textOf = (root, name) => {
    const entity = root[name]
    assert(entity instanceof Array, `expected ${name} to be a file`)
    return entity.map(value => utf8ToString(/** @type {Vec} */ (value))).join('')
}

/** @type {(root: Dir, env?: Env) => readonly [Dir, number]} */
const run = (root, env = {}) => {
    const [state, result] = virtual({ ...emptyState, root })(main({ ...defaultNodeProgramOptions, env }))
    return [state.root, exitCode(result)]
}

const funding = { 'funding.json': [utf8('{"funding":{"channels":[{"description":"Support","address":"https://example.com/"}]}}')] }

export const proof = {
    // The three files `cargo doc` takes, from the same builders every page
    // uses: the header, the funding footer, and the bars' stylesheet.
    writes: () => {
        const [root, code] = run(funding)
        assertEq(code, 0)
        assert(textOf(root, '_rustdoc-header.html').startsWith('<header><nav aria-label="Site">'))
        assert(textOf(root, '_rustdoc-footer.html').includes('<a href="https://example.com/">Support'))
        assertEq(textOf(root, '_rustdoc.css'), rustdocStylesheet)
    },
    // A preview's header names its branch and commit, as every page's does.
    preview: () => {
        const [root] = run(funding, {
            WORKERS_CI_BRANCH: 'feature',
            WORKERS_CI_COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567',
        })
        const header = textOf(root, '_rustdoc-header.html')
        assert(header.includes('data-build'), header)
        assert(header.includes('0123456'), header)
    },
    // Without `funding.json` the footer is empty, not the build.
    noFunding: () => {
        const [root, code] = run({})
        assertEq(code, 0)
        assertEq(textOf(root, '_rustdoc-footer.html'), '')
    },
    // A `funding.json` that cannot be linked stops it, as it stops the site.
    badFunding: () => {
        const [, code] = run({ 'funding.json': [utf8('{"funding":{"channels":[{"address":"http://x"}]}}')] })
        assert(code !== 0)
    },
}
