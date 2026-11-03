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
    const target = { parentElement: wrapper, scrollIntoView: () => { scrolls += 1 } }
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
    // A heading anchor is native: the runtime leaves its click, URL and
    // history to the browser and only reveals the target afterwards.
    headingAnchorIsNative: () => {
        const { doc, scrolls } = fixture('', 'heading')
        /** @type {((event: any) => void) | undefined} */
        let click
        doc.addEventListener = (/** @type {string} */ name, /** @type {(event: any) => void} */ listener) => { if (name === 'click') { click = listener } }
        /** @type {(() => void)[]} */
        const frames = []
        doc.defaultView.requestAnimationFrame = (/** @type {() => void} */ f) => { frames.push(f) }
        doc.baseURI = 'https://example.com/page/'
        const anchor = { getAttribute: () => '#heading' }
        class Target { closest(/** @type {string} */ selector) { return selector === 'a[href]' ? anchor : null } }
        doc.defaultView.Element = Target
        startFragments(doc)
        assertEq(scrolls(), 0)
        click?.({ target: new Target(), button: 0, preventDefault() { throw 'A heading anchor keeps its native navigation' } })
        assertEq(frames.length, 1)
        doc.defaultView.location.hash = '#heading'
        frames[0]()
        assertEq(scrolls(), 1)
    },
    // A README's code block copies its text, and shows its button once bound.
    readmeCopies: async () => {
        const { doc } = fixture('', 'readme')
        /** @type {string[]} */
        const copied = []
        /** @type {string[]} */
        const ready = []
        /** @type {(() => void)[]} */
        const clicks = []
        const status = { textContent: '' }
        const button = {
            ownerDocument: { defaultView: {
                navigator: { clipboard: { writeText: async (/** @type {string} */ text) => { copied.push(text) } } },
                clearTimeout: () => {},
                setTimeout: () => 0,
            } },
            getAttribute: (/** @type {string} */ name) => name === 'data-copy' ? 'npm test' : null,
            setAttribute: () => {},
            removeAttribute: () => {},
            querySelector: () => status,
            addEventListener: (/** @type {string} */ _, /** @type {() => void} */ listener) => { clicks.push(listener) },
        }
        const readme = {
            querySelectorAll: () => [button, { getAttribute: () => null }],
            setAttribute: (/** @type {string} */ name) => { ready.push(name) },
        }
        doc.querySelectorAll = (/** @type {string} */ selector) => selector === '[data-readme]' ? [readme] : []
        startFragments(doc)
        assertEq(ready.join(), 'data-copy-ready')
        assertEq(clicks.length, 1)
        clicks[0]()
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
        assertEq(copied.join(), 'npm test')
        assertEq(status.textContent, 'Copied!')
    },
    nestedEncodedTarget: () => {
        const { doc, outer, inner, scrolls } = fixture('#%E4%B8%AD%E6%96%87', '中文')
        revealFragment(doc)
        assert(outer.open)
        assert(inner.open)
        assertEq(scrolls(), 1)
    },
    demoTarget: () => {
        const { doc, scrolls } = fixture('#demo', 'demo')
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
