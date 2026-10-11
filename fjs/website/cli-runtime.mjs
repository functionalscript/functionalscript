/**
 * Clipboard enhancement for the static CLI reference. It executes no CLI code.
 * @module
 */

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
}

const root = typeof document === 'undefined' ? null : document.querySelector('[data-cli]')
if (root !== null && root instanceof HTMLElement) { startCli(root) }
