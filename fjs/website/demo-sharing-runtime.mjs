/** URL/history and clipboard effects for the pure demo sharing contract.
 * @module
 * @import { Demo, DemoEvent } from './demo/types.ts'
 * @import { DemoController } from './private.ts'
 */
import { decodeFragment, encodeFragment, restoreInputs } from './demo/sharing/module.f.mjs'
import { copy } from './copy-runtime.mjs'
import { revealFragment } from './fragment-runtime.mjs'
import { scopeMarker } from './demo/control_ids/module.f.mjs'
import { demoMarker } from './style/module.f.js'

/** Bind the controls outside the patchable root. A root without these
 * controls does not consume navigation; a demo with no inputs copies its target.
 * @type {(root: Element, demo: Demo<any, DemoEvent, never>, controller: DemoController, startupEdited: boolean) => void}
 */
export const startDemoSharing = (root, demo, controller, startupEdited) => {
    const controls = root.nextElementSibling
    const view = root.ownerDocument.defaultView
    if (!controls?.hasAttribute('data-demo-sharing') || !view || started.has(root)) { return }
    started.add(root)
    /** @type {HTMLButtonElement} */
    const button = /** @type {HTMLButtonElement} */ (controls.querySelector('[data-copy-demo]'))
    const status = /** @type {HTMLElement | null} */ (controls.querySelector('[data-demo-link-status]'))
    /** @type {(message: string) => void} */
    const report = message => { if (status) { status.textContent = message; status.hidden = message === '' } }
    const sharing = demo.sharing ?? { fields: {}, examples: [], read: () => ({}), restore: () => demo.init }
    let request = 0
    const restore = (initial = false) => {
        const parsed = decodeFragment(view.location.hash)
        if (parsed[0] === 'error') { report(parsed[1]); return }
        if (parsed[1] === null) { return }
        if (initial && startupEdited) {
            report('Your edits were preserved; the demo link was not applied.')
            return
        }
        const inputs = restoreInputs(sharing, parsed[1])
        if (inputs[0] === 'error') { report(inputs[1]); return }
        const target = ++request
        const inputRevision = controller.revision()
        const earlyEdits = root.getAttribute('data-demo-input-edited')
        const hash = view.location.hash
        // Construct the whole state only after every field has passed validation.
        const state = sharing.restore(inputs[1])
        controller.replace(state, () => {
            report('Demo inputs restored.')
            view.requestAnimationFrame(() => revealFragment(root.ownerDocument))
        }, () => {
            const edited = inputRevision !== controller.revision() || earlyEdits !== root.getAttribute('data-demo-input-edited')
            if (edited) {
                if (target === request && hash === view.location.hash) { report('Your edits were preserved; the demo link was not applied.') }
                return 'edited'
            }
            return target === request && hash === view.location.hash ? 'apply' : 'navigated'
        }, !initial)
    }
    // A page has one primary Demo target. Extra embedded instances can copy
    // their inputs to that target without all consuming the same navigation.
    if ((root.getAttribute(scopeMarker) ?? root.getAttribute(demoMarker)) === root.getAttribute(demoMarker)) {
        view.addEventListener('hashchange', () => restore())
        restore(true)
    }
    button.addEventListener('click', event => {
        event.preventDefault()
        if (controller.busy()) { report('Wait for the demo inputs to finish updating, then copy the link.'); return }
        const encoded = encodeFragment(sharing, sharing.read(controller.read()))
        if (encoded[0] === 'error') { report(encoded[1]); return }
        report('')
        const url = `${view.location.origin}${view.location.pathname}${encoded[1]}`
        void copy(button, url)
    })
    controls.removeAttribute('hidden')
}
/** @type {WeakSet<Element>} */
const started = new WeakSet()
