/**
 * Clipboard enhancement for the static CLI reference. It executes no CLI code.
 * @module
 */

import { matches } from './cli/search/module.f.js'
import { copy } from './copy-runtime.mjs'

/** Bind each copy button before making the controls visible.
 * @type {(root: HTMLElement) => void}
 */
export const startCli = root => {
    for (const button of root.querySelectorAll('button')) {
        const text = button.getAttribute('data-copy')
        if (text === null) { continue }
        button.addEventListener('click', () => { void copy(button, text) })
    }
    root.setAttribute('data-copy-ready', '')
    startExplorer(root)
}

/** Bind DOM search and fragment-based selection after the static reference is available.
 * @type {(root: HTMLElement) => void}
 */
export const startExplorer = root => {
    const controls = root.querySelector('[data-cli-controls]')
    const input = root.querySelector('#cli-search')
    const clear = root.querySelector('[data-cli-clear]')
    const count = root.querySelector('[data-cli-count]')
    if (controls === null) { return }
    const view = root.ownerDocument.defaultView
    if (!(controls instanceof HTMLElement) || !(input instanceof HTMLInputElement)
        || !(clear instanceof HTMLButtonElement) || count === null || view === null) { return }
    const links = [...root.querySelectorAll('[data-cli-link]')]
    const sections = [...root.querySelectorAll('[data-cli-command]')]
    const select = () => {
        const target = sections.find(section => `#${encodeURIComponent(section.id)}` === view.location.hash) ?? sections[0]
        for (const section of sections) { section.toggleAttribute('hidden', section !== target) }
        for (const link of links) {
            if (link.getAttribute('href') === `#${encodeURIComponent(target.id)}`) { link.setAttribute('aria-current', 'true') }
            else { link.removeAttribute('aria-current') }
        }
    }
    const filter = () => {
        let visible = 0
        for (const link of links) {
            const show = matches(link.getAttribute('data-cli-search') ?? '', input.value)
            link.parentElement?.toggleAttribute('hidden', !show)
            if (show) { visible += 1 }
        }
        count.textContent = visible === 0 ? 'No commands found. Try another search.' : `${visible} of ${links.length} commands`
        clear.disabled = input.value.length === 0
    }
    input.addEventListener('input', filter)
    clear.addEventListener('click', () => { input.value = ''; filter(); input.focus() })
    view.addEventListener('hashchange', select)
    select()
    filter()
    controls.hidden = false
    root.setAttribute('data-cli-ready', '')
}

const root = typeof document === 'undefined' ? null : document.querySelector('[data-cli]')
if (root !== null && root instanceof HTMLElement) { startCli(root) }
