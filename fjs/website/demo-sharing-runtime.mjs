/** URL/history and clipboard effects for the pure demo sharing contract.
 * @module
 * @import { Demo, DemoEvent } from './demo/types.ts'
 * @import { DemoController } from './demo/sharing/types.ts'
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
    const section = root.parentElement
    const button = /** @type {HTMLButtonElement | null | undefined} */ (section?.querySelector(':scope > summary button[data-copy-demo]'))
    const menu = /** @type {HTMLElement | null | undefined} */ (button?.parentElement?.querySelector('[data-demo-link-menu]'))
    const sectionButton = menu?.querySelector('[data-copy-demo-section]')
    const inputsButton = /** @type {HTMLButtonElement | null | undefined} */ (menu?.querySelector('[data-copy-demo-inputs]'))
    const view = root.ownerDocument.defaultView
    if (!button || !menu || !sectionButton || !inputsButton || section?.querySelector(':scope > [data-demo]') !== root || !view || started.has(root)) { return }
    started.add(root)
    const status = /** @type {HTMLElement | null} */ (section?.querySelector(':scope > summary > [data-demo-link-status]') ?? null)
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
            report('')
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
    // Restoration also works when a browser keeps the native section anchor.
    if (typeof menu.hidePopover !== 'function') { return }
    // The native invoker provides Escape, outside-click dismissal, Tab order,
    // and focus restoration. Prevent clicks reaching the section disclosure.
    button.addEventListener('click', event => event.stopPropagation())
    menu.addEventListener('click', event => event.stopPropagation())
    menu.addEventListener('toggle', event => {
        if (event.newState !== 'open') { return }
        const anchor = button.getBoundingClientRect()
        const bounds = menu.getBoundingClientRect()
        menu.style.left = `${Math.max(16, Math.min(anchor.left, view.innerWidth - bounds.width - 16))}px`
        menu.style.top = `${Math.max(16, anchor.bottom + bounds.height + 6 <= view.innerHeight
            ? anchor.bottom + 6 : anchor.top - bounds.height - 6)}px`
    })
    /** @type {(hash: string) => void} */
    const copyLink = hash => {
        menu.hidePopover()
        button.focus()
        report('')
        void copy(button, `${view.location.origin}${view.location.pathname}${hash}`)
    }
    sectionButton.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()
        copyLink(`#${encodeURIComponent(button.getAttribute('data-copy-fragment') ?? 'demo')}`)
    })
    inputsButton.disabled = Object.keys(sharing.fields).length === 0
    if (inputsButton.disabled) { inputsButton.title = 'This demo has no inputs' }
    inputsButton.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()
        if (controller.busy()) { menu.hidePopover(); button.focus(); report('Wait for the demo inputs to finish updating, then copy the link.'); return }
        const encoded = encodeFragment(sharing, sharing.read(controller.read()))
        if (encoded[0] === 'error') { menu.hidePopover(); button.focus(); report(encoded[1]); return }
        copyLink(encoded[1])
    })
    menu.hidden = false
    button.hidden = false
    const fallback = button.parentElement?.querySelector('a')
    if (fallback) { /** @type {HTMLAnchorElement} */ (fallback).hidden = true }
}
/** @type {WeakSet<Element>} */
const started = new WeakSet()
