/** Host-boundary proofs for URL navigation, queued restoration and clipboard UI. */
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.js'
import { startDemoSharing } from './demo-sharing-runtime.mjs'
import { textSharing, recordSharing, encodeQuery, decodeQuery } from './demo/sharing/module.f.mjs'

/** @type {(sharing?: any, hash?: string) => any} */
const fixture = (sharing = textSharing('source', 'first', [['First', 'first', 'first'], ['Second', 'second', 'second']]), hash = '?example=second#demo') => {
    /** @type {Map<string, (() => void)[]>} */
    const windowEvents = new Map()
    /** @type {Map<string, (() => void)[]>} */
    const rootEvents = new Map()
    /** @type {Map<string, (event: any) => void>} */
    const buttonEvents = new Map()
    /** @type {string[]} */
    const copied = []
    /** @type {any[]} */
    const pending = []
    /** @type {Map<string, string>} */
    const attributes = new Map()
    const feedback = { textContent: '' }
    const status = { textContent: '' }
    let busy = false
    let revision = 0
    let restores = 0
    let scrolls = 0
    let state = sharing.restore(Object.fromEntries(Object.entries(sharing.fields).map(([name, field]) => [name, /** @type {any} */ (field).default])))
    const details = { tagName: 'DETAILS', open: false, parentElement: null }
    const target = { parentElement: details, scrollIntoView: () => { scrolls++ } }
    /** @type {any} */
    const document = { getElementById: (/** @type {string} */ id) => id === 'demo' ? target : null }
    /** @type {any} */
    const view = {
        location: new URL(hash, 'https://example.com/demo/'),
        navigator: { clipboard: { writeText: async (/** @type {string} */ text) => { copied.push(text) } } },
        addEventListener: (/** @type {string} */ name, /** @type {() => void} */ listener) => windowEvents.set(name, [...windowEvents.get(name) ?? [], listener]),
        requestAnimationFrame: (/** @type {() => void} */ callback) => callback(),
        setTimeout: () => 1, clearTimeout: () => {},
    }
    document.defaultView = view
    /** @type {any} */
    const button = {
        ownerDocument: document, hidden: true,
        addEventListener: (/** @type {string} */ name, /** @type {(event: any) => void} */ listener) => buttonEvents.set(name, listener),
        querySelector: () => feedback,
        setAttribute: (/** @type {string} */ name, /** @type {string} */ value) => attributes.set(name, value),
        removeAttribute: (/** @type {string} */ name) => attributes.delete(name),
    }
    /** @type {any} */
    const controls = {
        querySelector: (/** @type {string} */ selector) => selector === ':scope > [data-demo]' ? root : selector.includes('button[data-copy-demo]') ? button : status,
    }
    /** @type {any} */
    const root = {
        parentElement: controls, ownerDocument: document,
        getAttribute: () => '/demo.f.mjs',
        addEventListener: (/** @type {string} */ name, /** @type {() => void} */ listener) => rootEvents.set(name, [...rootEvents.get(name) ?? [], listener]),
    }
    /** @type {import('./demo/types.ts').Demo<any, import('./demo/types.ts').DemoEvent>} */
    const demo = { sharing, init: state, view: () => ['div'], update: () => () => { throw 'Restoration must not dispatch demo actions' } }
    const controller = {
        step: () => { throw 'The URL boundary must never dispatch action buttons' },
        read: () => state,
        busy: () => busy,
        revision: () => revision,
        replace: (/** @type {any} */ next, /** @type {() => void} */ after, /** @type {() => import('./demo/sharing/types.ts').RestoreDisposition} */ current, /** @type {boolean} */ initialize = false) => pending.push({ next, after, current, initialize }),
    }
    return {
        root, demo, view, controls, document, button, status, feedback, copied, pending, details, windowEvents,
        get hidden() { return button.hidden }, get restores() { return restores }, get state() { return state }, get scrolls() { return scrolls },
        start: (edited = false) => startDemoSharing(root, demo, controller, edited),
        flush: () => { for (const item of pending.splice(0)) { if (item.current() === 'apply') { state = item.next; restores++; item.after() } } },
        navigate: (/** @type {string} */ next) => { const url = new URL(next, 'https://example.com/demo/'); view.location.search = url.search; view.location.hash = url.hash; windowEvents.get('popstate')?.forEach(f => f()); windowEvents.get('hashchange')?.forEach(f => f()) },
        input: () => { revision += 1 },
        busy: (/** @type {boolean} */ value) => { busy = value },
        stateTo: (/** @type {any} */ value) => { state = value },
        click: async () => { buttonEvents.get('click')?.({ preventDefault() {}, stopPropagation() {} }); for (let i = 0; i < 5; i++) { await Promise.resolve() } },
    }
}
export const proof = {
    initialAndHistory: () => {
        const f = fixture()
        f.start()
        assertEq(f.hidden, false)
        assertEq(f.state, 'first')
        assertEq(f.pending.length, 1)
        assertEq(f.pending[0].initialize, false)
        f.flush()
        assertEq(f.state, 'second')
        assertEq(f.status.textContent, '')
        assertEq(f.status.hidden, true)
        assertEq(f.restores, 1)
        assertEq(f.details.open, true)
        assertEq(f.scrolls, 1)
        f.navigate('#demo')
        assertEq(f.pending[0].initialize, true)
        f.flush()
        assertEq(f.state, 'first')
        assertEq(f.status.hidden, true)
        f.navigate('#documentation')
        f.flush()
        assertEq(f.restores, 2)
        f.start()
        assertEq(f.windowEvents.get('hashchange').length, 1)
    },
    headingsAndQueryHistory: () => {
        const f = fixture(undefined, '?example=second#demo')
        f.start(); f.flush()
        f.stateTo('reader edit'); f.navigate('?example=second#heading'); f.flush()
        assertEq(f.state, 'reader edit')
        assertEq(f.restores, 1)
        f.navigate('?source=other#heading'); f.flush()
        assertEq(f.state, 'other')
        f.navigate('#heading'); f.flush()
        assertEq(f.state, 'first')
        const plain = fixture(undefined, '#heading')
        plain.start(true)
        assertEq(plain.pending.length, 0)
        assertEq(plain.status.textContent, '')
    },
    validationIsAtomic: () => {
        const sharing = recordSharing({ text: 'default', choice: 'a', checked: true }, { text: { default: 'default' }, choice: { default: 'a', choices: ['a', 'b'] }, checked: { default: true } })
        for (const hash of ['?example=retired', '?checked=invalid', '?example=a&example=b']) {
            const f = fixture(sharing, hash)
            f.start(); f.flush()
            assertEq(f.restores, 0)
            assert(f.status.textContent !== '')
            assertStructurallySame(f.state, { text: 'default', choice: 'a', checked: true })
        }
        const invalid = encodeQuery(textSharing('unknown', 'default'), { unknown: 'x' })
        assert(invalid[0] === 'ok')
        const f = fixture(sharing, invalid[1])
        f.start(); f.flush()
        assertEq(f.restores, 0)
        assert(f.status.textContent.includes('Unknown input'))
        const encoded = encodeQuery(sharing, { text: 'Hello 🌍', choice: 'b', checked: false })
        assert(encoded[0] === 'ok')
        f.navigate(encoded[1]); f.flush()
        assertStructurallySame(f.state, { text: 'Hello 🌍', choice: 'b', checked: false })
        assertEq(f.status.textContent, '')
        assertEq(f.status.hidden, true)
        assertEq(f.restores, 1)
    },
    startupAndLaterEdits: () => {
        const early = fixture()
        let marker = '0'
        early.root.getAttribute = (/** @type {string} */ name) => name === 'data-demo-input-edited' ? marker : '/demo.f.mjs'
        early.start(); marker = '1'; early.flush()
        assertEq(early.restores, 0)
        assert(early.status.textContent.includes('edits were preserved'))
        const f = fixture()
        f.start(true); f.flush()
        assertEq(f.restores, 0)
        assert(f.status.textContent.includes('edits were preserved'))
        f.navigate('#documentation'); f.navigate('?example=second'); f.input(); f.flush()
        assertEq(f.state, 'first')
        assert(f.status.textContent.includes('edits were preserved'))
        f.navigate('#documentation'); f.navigate('?example=second')
        f.navigate('?example=first')
        f.flush()
        assertEq(f.state, 'first')
        assertEq(f.restores, 1)
    },
    copyExamplesAndCustom: async () => {
        const f = fixture()
        f.start(); f.flush()
        await f.click()
        assertEq(f.copied[0], 'https://example.com/demo/?example=second#demo')
        assertEq(f.view.location.search, '?example=second')
        assertEq(f.feedback.textContent, 'Copied!')
        f.stateTo('Custom 🌍\n')
        await f.click()
        assertStructurallySame(decodeQuery(new URL(f.copied[1]).search), ['ok', { kind: 'inputs', values: { source: 'Custom 🌍\n' } }])
        const empty = fixture(undefined, '#documentation')
        empty.demo.sharing = undefined
        empty.start(); await empty.click()
        assertEq(empty.copied[0], 'https://example.com/demo/#demo')
    },
    copyFailures: async () => {
        const f = fixture(undefined, '#documentation')
        f.start(); f.busy(true); await f.click()
        assertEq(f.copied.length, 0)
        assert(f.status.textContent.includes('finish updating'))
        f.busy(false); f.stateTo('a'.repeat(20_000)); await f.click()
        assertEq(f.copied.length, 0)
        assert(f.status.textContent.includes('16 KiB'))
        f.stateTo('valid'); f.view.navigator.clipboard = undefined; await f.click()
        assertEq(f.feedback.textContent, 'Copy unavailable')
        f.view.navigator.clipboard = { writeText: async () => { throw 'denied' } }; await f.click()
        assertEq(f.feedback.textContent, 'Copy failed')
    },
    absentAndSecondaryControls: async () => {
        const absent = fixture(); absent.root.parentElement = null; absent.start()
        assertEq(absent.pending.length, 0)
        const extra = fixture()
        extra.controls.querySelector = (/** @type {string} */ selector) => selector === ':scope > [data-demo]' ? {} : extra.button
        extra.start()
        assertEq(extra.hidden, true)
        const noWindow = fixture(); noWindow.document.defaultView = null; noWindow.start()
        assertEq(noWindow.hidden, true)
        const implicitScope = fixture()
        implicitScope.root.getAttribute = (/** @type {string} */ name) => name === 'data-demo-scope' ? null : '/demo.f.mjs'
        implicitScope.start(); implicitScope.flush()
        assertEq(implicitScope.state, 'second')
        const secondary = fixture()
        secondary.root.getAttribute = (/** @type {string} */ name) => name === 'data-demo-scope' ? 'second' : '/demo.f.mjs'
        secondary.start(); secondary.flush()
        assertEq(secondary.restores, 0)
        await secondary.click()
        assertEq(secondary.copied[0], 'https://example.com/demo/#demo')
        const noStatus = fixture(undefined, '?example=retired')
        noStatus.controls.querySelector = (/** @type {string} */ selector) => selector === ':scope > [data-demo]' ? noStatus.root : selector.includes('button[data-copy-demo]') ? noStatus.button : null
        noStatus.start()
        assertEq(noStatus.pending.length, 0)
    },
}
