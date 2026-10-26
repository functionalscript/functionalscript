/** The browser boundary for section navigation and heading clipboard controls. */

import { copy } from './copy-runtime.mjs'

/** Reveal a fragment's target without running tests or dispatching demo actions.
 * Demo-state restoration may call this again after its render changes layout.
 * @type {(doc: Document) => void}
 */
export const revealFragment = doc => {
    const hash = doc.defaultView?.location.hash
    if (!hash || hash === '#') return
    let id
    try {
        id = decodeURIComponent(hash.slice(1))
    } catch {
        // An invalid percent escape is an absent target, not a broken page.
        return
    }
    const target = doc.getElementById(id)
    if (!target) return
    for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.tagName === 'DETAILS') {
            /** @type {HTMLDetailsElement} */ (ancestor).open = true
        }
    }
    target.scrollIntoView({ block: 'start' })
}

/** Enhance the native links once per document. Copy never changes the URL.
 * @type {(doc: Document) => void}
 */
export const startFragments = doc => {
    const view = doc.defaultView
    if (!view || started.has(doc)) return
    started.add(doc)
    const reveal = () => revealFragment(doc)
    view.addEventListener('hashchange', reveal)
    view.addEventListener('load', reveal, { once: true })
    for (const button of doc.querySelectorAll('button[data-copy-fragment]')) {
        if (button.hasAttribute('data-copy-demo')) continue
        /** @type {HTMLButtonElement} */ (button).hidden = false
        const fallback = button.parentElement?.querySelector('a')
        if (fallback) fallback.hidden = true
    }
    doc.addEventListener('click', event => {
        const target = event.target
        if (!(target instanceof view.Element)) return
        const button = target.closest('button[data-copy-fragment]')
        if (button) {
            if (button.hasAttribute('data-copy-demo')) return
            event.preventDefault()
            event.stopPropagation()
            const url = new URL(view.location.href)
            url.hash = encodeURIComponent(button.getAttribute('data-copy-fragment') ?? '')
            void copy(/** @type {HTMLButtonElement} */ (button), url.href)
            return
        }
        // Clicking the current fragment does not emit hashchange. Reveal it
        // again if its parent section has since been folded, while retaining
        // the anchor's native URL/history and modified-click behavior.
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
        const anchor = target.closest('a[href]')
        if (!anchor) return
        let url
        try { url = new URL(anchor.getAttribute('href') ?? '', doc.baseURI) }
        catch { return }
        const { location } = view
        if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) {
            view.requestAnimationFrame(reveal)
        }
    })
    reveal()
}

/** @type {WeakSet<Document>} */
const started = new WeakSet()
