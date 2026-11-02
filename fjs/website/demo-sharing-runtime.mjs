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
        const navigate = () => {
            const next = `${view.location.search}\0${view.location.hash}`
            if (next === locationKey) { return }
            const changed = search !== view.location.search
            search = view.location.search
            locationKey = next
            if (changed || search === '' && view.location.hash === '#demo') { restore() }
        }
        // Each settled edit pushes its inputs, so the address bar is the link
        // and Back walks the edits. The heading fragment stays as it is.
        if (definedEntries(sharing.fields).length !== 0) {
            // Clears only its own refusal, not another notice.
            let refused = false
            controller.settled(() => {
                const encoded = encodeQuery(sharing, sharing.read(controller.read()))
                if (encoded[0] === 'error') { report(encoded[1]); refused = true; return }
                if (refused) { report(''); refused = false }
                const query = encoded[1].slice(0, encoded[1].indexOf('#'))
                if (query === view.location.search) { return }
                view.history.pushState(null, '', `${view.location.pathname}${query}${view.location.hash}`)
                search = view.location.search
                locationKey = `${search}\0${view.location.hash}`
            })
        }
        view.addEventListener('popstate', navigate)
        view.addEventListener('hashchange', navigate)
        if (search !== '' || view.location.hash === '#demo') { restore(true) }
    }
}
/** @type {WeakSet<Element>} */
const started = new WeakSet()
