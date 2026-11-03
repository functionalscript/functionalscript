/** URL/history effects for the pure demo sharing contract.
 * @module
 * @import { Demo, DemoEvent } from './demo/types.ts'
 * @import { DemoController } from './demo/sharing/types.ts'
 */

import { decodeQuery, encodeQuery, restoreInputs } from './demo/sharing/module.f.mjs'
import { definedEntries } from '../types/object/module.f.mjs'
import { revealFragment } from './fragment-runtime.mjs'
import { scopeMarker } from './demo/control_ids/module.f.mjs'
import { demoMarker } from './style/module.f.js'

/** Keep the address bar on the demo's inputs. A root without its section's
 * status slot does not consume navigation. The heading's own anchor is native
 * and needs no binding: the address bar is the link to share.
 * @type {(root: Element, demo: Demo<any, DemoEvent, never>, controller: DemoController, startupEdited: boolean) => void}
 */
export const startDemoSharing = (root, demo, controller, startupEdited) => {
    const section = root.parentElement
    const status = /** @type {HTMLElement | null | undefined} */ (section?.querySelector(':scope > summary > [data-demo-link-status]'))
    const view = root.ownerDocument.defaultView
    if (!status || section?.querySelector(':scope > [data-demo]') !== root || !view || started.has(root)) { return }
    started.add(root)
    /** @type {(message: string) => void} */
    const report = message => { status.textContent = message; status.hidden = message === '' }
    const sharing = demo.sharing ?? { fields: {}, examples: [], read: () => ({}), restore: () => demo.init }
    let request = 0
    const restore = (initial = false) => {
        const parsed = decodeQuery(view.location.search)
        if (parsed[0] === 'error') { report(parsed[1]); return }
        if (initial && startupEdited) {
            report('Your edits were preserved; the demo link was not applied.')
            return
        }
        const inputs = restoreInputs(sharing, parsed[1])
        if (inputs[0] === 'error') { report(inputs[1]); return }
        const target = ++request
        const inputRevision = controller.revision()
        const earlyEdits = root.getAttribute('data-demo-input-edited')
        const locationKey = `${view.location.search}\0${view.location.hash}`
        // Construct the whole state only after every field has passed validation.
        const state = sharing.restore(inputs[1])
        controller.replace(state, () => {
            report('')
            view.requestAnimationFrame(() => revealFragment(root.ownerDocument))
        }, () => {
            const edited = inputRevision !== controller.revision() || earlyEdits !== root.getAttribute('data-demo-input-edited')
            if (edited) {
                if (target === request && locationKey === `${view.location.search}\0${view.location.hash}`) { report('Your edits were preserved; the demo link was not applied.') }
                return 'edited'
            }
            return target === request && locationKey === `${view.location.search}\0${view.location.hash}` ? 'apply' : 'navigated'
        }, !initial)
    }
    // A page has one primary Demo target. Extra embedded instances can copy
    // their inputs to that target without all consuming the same navigation.
    if ((root.getAttribute(scopeMarker) ?? root.getAttribute(demoMarker)) === root.getAttribute(demoMarker)) {
        let search = view.location.search
        let locationKey = `${search}\0${view.location.hash}`
        let cancel = () => {}
        const navigate = () => {
            const next = `${view.location.search}\0${view.location.hash}`
            if (next === locationKey) { return }
            cancel()
            const changed = search !== view.location.search
            search = view.location.search
            locationKey = next
            if (changed || search === '' && view.location.hash === '#demo') { restore() }
        }
        // The address bar follows the demo's inputs, written once the demo has
        // been quiet for `writeDelay`: a burst of typing is one write. A burst
        // with a reader edit pushes, so Back walks the edits; one made only by
        // actions or automatic work replaces, so it adds no history. The write
        // runs outside the demo's queue and a browser that refuses it (rate
        // limits) only leaves the address bar behind; the next write retries.
        // The heading fragment stays as it is.
        if (definedEntries(sharing.fields).length !== 0) {
            // Clears only its own refusal, not another notice.
            let refused = false
            /** @type {number | undefined} */
            let timer
            let push = false
            const write = () => {
                timer = undefined
                // A step is still running; its own drain schedules the write.
                if (controller.busy()) { return }
                const edit = push
                push = false
                const encoded = encodeQuery(sharing, sharing.read(controller.read()))
                if (encoded[0] === 'error') { report(encoded[1]); refused = true; return }
                if (refused) { report(''); refused = false }
                const query = encoded[1].slice(0, encoded[1].indexOf('#'))
                if (query === view.location.search) { return }
                const url = `${view.location.pathname}${query}${view.location.hash}`
                try {
                    if (edit) { view.history.pushState(null, '', url) } else { view.history.replaceState(null, '', url) }
                } catch {
                    return
                }
                search = view.location.search
                locationKey = `${search}\0${view.location.hash}`
            }
            controller.settled(edited => {
                push ||= edited
                view.clearTimeout(timer)
                timer = view.setTimeout(write, writeDelay)
            })
            // Leaving the page, or following a link from it, writes at once, so
            // the link's history entry comes after the edits it follows.
            const flush = () => {
                if (timer === undefined) { return }
                view.clearTimeout(timer)
                write()
            }
            view.addEventListener('pagehide', flush)
            view.addEventListener('click', event => {
                const target = /** @type {Element | null} */ (event.target)
                if (target?.closest?.('a[href]')) { flush() }
            }, true)
            // Back or Forward leaves the pending edits where they were.
            cancel = () => {
                view.clearTimeout(timer)
                timer = undefined
                push = false
            }
        }
        view.addEventListener('popstate', navigate)
        view.addEventListener('hashchange', navigate)
        if (search !== '' || view.location.hash === '#demo') { restore(true) }
    }
}
/** How long the demo stays quiet before the address bar is written, in ms:
 * typing writes once per pause, under every browser's history rate limit.
 * @type {number}
 */
export const writeDelay = 400

/** @type {WeakSet<Element>} */
const started = new WeakSet()
