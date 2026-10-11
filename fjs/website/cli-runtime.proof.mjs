/**
 * CLI clipboard binding against a recording DOM: listener registration,
 * clipboard promises and live-region updates require a host proof.
 * The shared helper is also exercised by the existing demo runtime proofs.
 */

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { startCli } from './cli-runtime.mjs'

/** @type {(writeText?: (text: string) => Promise<void>) => any} */
const dom = writeText => {
    /** @type {string[]} */
    const order = []
    /** @type {Map<string, string>} */
    const attributes = new Map()
    /** @type {(() => void)[]} */
    const listeners = []
    /** @type {(() => void)[]} */
    const timers = []
    const status = { textContent: '' }
    const text = 'fjs <file> & "value"\nnext\n'
    const button = {
        ownerDocument: { defaultView: {
            navigator: { clipboard: writeText === undefined ? undefined : { writeText } },
            clearTimeout: () => {},
            setTimeout: (/** @type {() => void} */ reset) => { timers.push(reset); return timers.length },
        } },
        getAttribute: (/** @type {string} */ name) => name === 'data-copy' ? text : attributes.get(name) ?? null,
        setAttribute: (/** @type {string} */ name, /** @type {string} */ value) => { attributes.set(name, value) },
        removeAttribute: (/** @type {string} */ name) => { attributes.delete(name) },
        querySelector: () => status,
        addEventListener: (/** @type {string} */ event, /** @type {() => void} */ listener) => {
            assertEq(event, 'click')
            order.push('bind')
            listeners.push(listener)
        },
    }
    const root = {
        querySelectorAll: () => [button, { getAttribute: () => null }],
        setAttribute: (/** @type {string} */ name) => { assertEq(name, 'data-copy-ready'); order.push('ready') },
    }
    return { root, button, text, status, attributes, listeners, timers, order }
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }

export const proof = {
    bindsBeforeShowingAndCopiesExactly: async () => {
        /** @type {string[]} */
        const copied = []
        const d = dom(async text => { copied.push(text) })
        startCli(d.root)
        assertStructurallySame(d.order, ['bind', 'ready'])
        assertEq(copied.length, 0)
        d.listeners[0]()
        d.listeners[0]()
        await settle()
        assertStructurallySame(copied, [d.text])
        assertEq(d.status.textContent, 'Copied!')
        assertEq(d.attributes.get('data-copy-feedback'), 'copied')
        assert(!d.attributes.has('aria-disabled'))
        d.timers[0]()
        assertEq(d.status.textContent, '')
        assert(!d.attributes.has('data-copy-feedback'))
    },
    clipboardUnavailable: async () => {
        const d = dom()
        startCli(d.root)
        d.listeners[0]()
        await settle()
        assertEq(d.status.textContent, 'Copy unavailable')
        assertEq(d.attributes.get('data-copy-feedback'), 'failed')
    },
    clipboardDenied: async () => {
        const d = dom(async () => { throw new Error('denied') })
        startCli(d.root)
        d.listeners[0]()
        await settle()
        assertEq(d.status.textContent, 'Copy failed')
        assert(!d.attributes.has('aria-disabled'))
    },
}
