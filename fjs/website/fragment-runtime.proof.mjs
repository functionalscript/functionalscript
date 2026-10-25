import { assert, assertEq } from '../asserts/module.f.js'
import { revealFragment, startFragments } from './fragment-runtime.mjs'

/** Minimal DOM boundary: nested collapsed ancestors and observable scrolling.
 * @type {(fragment: string, id: string) => any}
 */
const fixture = (fragment, id) => {
    /** @type {any} */
    const outer = { tagName: 'DETAILS', open: false, parentElement: null }
    /** @type {any} */
    const inner = { tagName: 'DETAILS', open: false, parentElement: outer }
    /** @type {any} */
    const wrapper = { tagName: 'DIV', parentElement: inner }
    let scrolls = 0
    /** @type {any} */
    const target = { parentElement: wrapper, scrollIntoView: () => { scrolls++ } }
    /** @type {Map<string, () => void>} */
    const events = new Map()
    /** @type {any} */
    const doc = {
        defaultView: {
            location: new URL(`https://example.com/page/${fragment}`),
            addEventListener: (/** @type {string} */ name, /** @type {() => void} */ callback) => events.set(name, callback),
        },
        getElementById: (/** @type {string} */ name) => name === id ? target : null,
        querySelectorAll: () => [],
        addEventListener: () => {},
    }
    return { doc, outer, inner, events, scrolls: () => scrolls }
}

export const proof = /** @type {const} */ ({
    demoControlWaitsForState: () => {
        const { doc } = fixture('', 'demo')
        const fallback = { hidden: false }
        const demo = { hidden: true, hasAttribute: () => true }
        const heading = { hidden: true, hasAttribute: () => false, parentElement: { querySelector: () => fallback } }
        doc.querySelectorAll = () => [demo, heading]
        /** @type {((event: any) => void) | undefined} */
        let click
        doc.addEventListener = (/** @type {string} */ name, /** @type {(event: any) => void} */ listener) => { if (name === 'click') { click = listener } }
        class Target { closest() { return demo } }
        doc.defaultView.Element = Target
        startFragments(doc)
        assertEq(demo.hidden, true)
        assertEq(heading.hidden, false)
        assertEq(fallback.hidden, true)
        click?.({ target: new Target(), preventDefault() { throw 'Demo copy belongs to the state runtime' } })
    },
    nestedEncodedTarget: () => {
        const { doc, outer, inner, scrolls } = fixture('#%E4%B8%AD%E6%96%87', '中文')
        revealFragment(doc)
        assert(outer.open)
        assert(inner.open)
        assertEq(scrolls(), 1)
    },
    demoNamespace: () => {
        const { doc, scrolls } = fixture('#demo:example=hex-escape', 'demo')
        revealFragment(doc)
        assertEq(scrolls(), 1)
    },
    absentTargets: () => {
        for (const hash of ['', '#', '#missing', '#%zz']) {
            const { doc, outer, scrolls } = fixture(hash, 'heading')
            revealFragment(doc)
            assertEq(outer.open, false)
            assertEq(scrolls(), 0)
        }
        revealFragment(/** @type {Document} */ (/** @type {unknown} */ ({ defaultView: null })))
    },
    startupAndHistory: () => {
        const { doc, events, inner, scrolls } = fixture('#heading', 'heading')
        startFragments(doc)
        assertEq(scrolls(), 1)
        startFragments(doc)
        assertEq(scrolls(), 1)
        inner.open = false
        events.get('hashchange')?.()
        assert(inner.open)
        assertEq(scrolls(), 2)
        events.get('load')?.()
        assertEq(scrolls(), 3)
        startFragments(/** @type {Document} */ (/** @type {unknown} */ ({ defaultView: null })))
    },
})
