/** URL/history and clipboard effects for the pure demo sharing contract.
 * @module
 * @import { Demo, DemoEvent } from './demo/types.ts'
 * @import { DemoController } from './demo/sharing/types.ts'
 */
import { decodeQuery, encodeQuery, restoreInputs } from './demo/sharing/module.f.mjs'
import { copy } from './copy-runtime.mjs'
import { revealFragment } from './fragment-runtime.mjs'
import { scopeMarker } from './demo/control_ids/module.f.mjs'
import { demoMarker } from './style/module.f.js'

/** Bind the controls outside the patchable root. A root without these
 * controls does not consume navigation; a demo with no inputs copies its target.
 * @type {(root: Element, demo: Demo<any, DemoEvent, never>, controller: DemoController, startupEdited: boolean) => void}
 */
export const startDemoSharing = (root, demo, controller, startupEdited) => {
    const section = root.parentElement
    const button = /** @type {HTMLButtonElement | null | undefined} */ (section?.querySelector(':scope > summary button[data-copy-demo]'))
    const view = root.ownerDocument.defaultView
    if (!button || section?.querySelector(':scope > [data-demo]') !== root || !view || started.has(root)) { return }
    started.add(root)
    const status = /** @type {HTMLElement | null} */ (section?.querySelector(':scope > summary > [data-demo-link-status]') ?? null)
    /** @type {(message: string) => void} */
    const report = message => { if (status) { status.textContent = message; status.hidden = message === '' } }
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
        view.addEventListener('popstate', navigate)
        view.addEventListener('hashchange', navigate)
        if (search !== '' || view.location.hash === '#demo') { restore(true) }
    }
    button.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()
        if (controller.busy()) { report('Wait for the demo inputs to finish updating, then copy the link.'); return }
        const encoded = encodeQuery(sharing, sharing.read(controller.read()))
        if (encoded[0] === 'error') { report(encoded[1]); return }
        report('')
        const url = `${view.location.origin}${view.location.pathname}${encoded[1]}`
        void copy(button, url)
    })
    button.hidden = false
    const fallback = button.parentElement?.querySelector('a')
    if (fallback) { /** @type {HTMLAnchorElement} */ (fallback).hidden = true }
}
/** @type {WeakSet<Element>} */
const started = new WeakSet()
