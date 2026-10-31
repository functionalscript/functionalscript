/**
 * The proof of how the EDAG demo draws recursion, split off `./proof.f.mjs`,
 * which the website's build no longer accepted in one file at 128 KiB, as
 * `./switch.proof.f.mjs` was.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 */

import { graphOfText } from './demo.f.mjs'
import { _crossings, graphSvg } from '../../website/demo/graph/module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { occurrences } from '../../types/string/module.f.js'

export const proof = {
    /**
     * **Recursion is an arrow back to the function**, routed around the
     * cyclic group: `f(n)`'s callee is a back edge to the `=>` whose body holds
     * it. A `self` in a slot the inner function captures is the outer
     * one's, so the inner `=>`'s `frame 0` goes back to the outer, not
     * to itself, and the inner's own `g` call goes back to the inner.
     */
    recursion: () => {
        const backs = (/** @type {string} */ source) => {
            const g = unwrap(graphOfText(source))
            assertEq(_crossings(g), 0)
            return g.edges.flatMap(e => e.back === true
                ? [`${g.nodes[e.from].label} ${e.label} -> ${g.nodes[/** @type {number} */ (e.to)].label} ${e.to}`]
                : [])
        }
        assertStructurallySame(backs('const f = n => n < 1 ? 0 : f(n - 1); export default f;'), ['() callee -> => 0'])
        assertStructurallySame(
            backs('const f = n => { const g = m => m < 1 ? f(m) : g(m - 1); return g(n) }; export default f;'),
            ['=> frame 0 -> => 0', '() callee -> => 2'])
    },
    bundledRecursion: () => {
        const g = unwrap(graphOfText('const f = n => n < 1 ? 0 : f(n - 1) + f(n - 2); export default f;'))
        const returns = g.edges.flatMap((edge, index) => edge.back === true ? [index] : [])
        assertEq(returns.length, 2)
        const html = htmlToString(graphSvg({ ...g, trace: true, centerColumns: true }))
        assert(html.includes(`data-graph-members="${returns.join(' ')}"`), 'the two calls share a return trunk')
        assertEq(occurrences('marker-end="url(#graph-return-arrow)"')(html), 1)
        assertEq(_crossings(g), 0)
    },
}
