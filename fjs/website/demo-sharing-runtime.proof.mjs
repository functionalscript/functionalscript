/** Host-boundary proofs for URL navigation, queued restoration and history. */

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.js'
import { startDemoSharing, writeDelay } from './demo-sharing-runtime.mjs'
import { textSharing, recordSharing, encodeQuery, defaultsOf } from './demo/sharing/module.f.mjs'

/** @type {(sharing?: any, hash?: string) => any} */
const fixture = (sharing = textSharing('source', 'first', [['First', 'first', 'first'], ['Second', 'second', 'second']]), hash = '?example=second#demo') => {
    /** @type {Map<string, (() => void)[]>} */
    const windowEvents = new Map()
    /** @type {Map<string, (() => void)[]>} */
    const rootEvents = new Map()
    /** @type {any[]} */
    const pending = []
    const status = { textContent: '' }
    let busy = false
    let revision = 0
    let restores = 0
    let scrolls = 0
    let state = sharing.restore(defaultsOf(sharing.fields))
    /** @type {string[]} */
    const pushed = []
    /** @type {string[]} */
    const replaced = []
    /** @type {Map<number, { run: () => void, delay: number }>} */
    const timers = new Map()
    let nextTimer = 0
    /** @type {(edited: boolean) => void} */
    let settled = () => {}
    const details = { tagName: 'DETAILS', open: false, parentElement: null }
    const target = { parentElement: details, scrollIntoView: () => { scrolls += 1 } }
    /** @type {any} */
    const document = { getElementById: (/** @type {string} */ id) => id === 'demo' ? target : null }
    /** @type {any} */
    const view = {
        location: new URL(hash, 'https://example.com/demo/'),
        addEventListener: (/** @type {string} */ name, /** @type {() => void} */ listener) => windowEvents.set(name, [...windowEvents.get(name) ?? [], listener]),
        requestAnimationFrame: (/** @type {() => void} */ callback) => callback(),
        history: {
            pushState: (/** @type {unknown} */ _, /** @type {string} */ __, /** @type {string} */ url) => { pushed.push(url); go(url) },
            replaceState: (/** @type {unknown} */ _, /** @type {string} */ __, /** @type {string} */ url) => { replaced.push(url); go(url) },
        },
        setTimeout: (/** @type {() => void} */ run, /** @type {number} */ delay) => { nextTimer += 1; timers.set(nextTimer, { run, delay }); return nextTimer },
        clearTimeout: (/** @type {number | undefined} */ timer) => { if (timer !== undefined) { timers.delete(timer) } },
    }
    /** @type {(url: string) => void} */
    const go = url => {
        const next = new URL(url, view.location.href)
        view.location.search = next.search
        view.location.hash = next.hash
    }
    document.defaultView = view
    /** @type {any} */
    const controls = {
        querySelector: (/** @type {string} */ selector) => selector === ':scope > [data-demo]' ? root : selector.includes('[data-demo-link-status]') ? status : null,
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
        settled: (/** @type {(edited: boolean) => void} */ listener) => { settled = listener },
        replace: (/** @type {any} */ next, /** @type {() => void} */ after, /** @type {() => import('./demo/sharing/types.ts').RestoreDisposition} */ current, /** @type {boolean} */ initialize = false) => pending.push({ next, after, current, initialize }),
    }
    const wait = () => {
        for (const [id, { run, delay }] of [...timers]) {
            assertEq(delay, writeDelay)
            timers.delete(id)
            run()
        }
    }
    return {
        root, demo, view, controls, document, status, pending, pushed, replaced, timers, details, windowEvents,
        get bound() { return windowEvents.has('popstate') }, get restores() { return restores }, get state() { return state }, get scrolls() { return scrolls },
        start: (edited = false) => startDemoSharing(root, demo, controller, edited),
        flush: () => { for (const item of pending.splice(0)) { if (item.current() === 'apply') { state = item.next; restores += 1; item.after() } } },
        navigate: (/** @type {string} */ next) => { const url = new URL(next, 'https://example.com/demo/'); view.location.search = url.search; view.location.hash = url.hash; windowEvents.get('popstate')?.forEach(f => f()); windowEvents.get('hashchange')?.forEach(f => f()) },
        input: () => { revision += 1 },
        // A reader edit, then the pause that writes it.
        edit: (/** @type {any} */ value) => { revision += 1; state = value; settled(true); wait() },
        // A reader edit still inside its pause.
        type: (/** @type {any} */ value) => { revision += 1; state = value; settled(true) },
        // An action or automatic step that changes the inputs.
        act: (/** @type {any} */ value) => { state = value; settled(false) },
        wait: () => wait(),
        event: (/** @type {string} */ name, /** @type {any} */ event = {}) => windowEvents.get(name)?.forEach(f => /** @type {(event: any) => void} */ (f)(event)),
        busy: (/** @type {boolean} */ value) => { busy = value },
        stateTo: (/** @type {any} */ value) => { state = value },
    }
}
export const proof = {
    initialAndHistory: () => {
        const f = fixture()
        f.start()
        assertEq(f.bound, true)
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
    absentAndSecondaryControls: () => {
        const absent = fixture(); absent.root.parentElement = null; absent.start()
        assertEq(absent.pending.length, 0)
        const extra = fixture()
        extra.controls.querySelector = (/** @type {string} */ selector) => selector === ':scope > [data-demo]' ? {} : extra.status
        extra.start()
        assertEq(extra.bound, false)
        const sparse = fixture(recordSharing({}, { absent: undefined }), '#demo')
        sparse.start(); sparse.flush()
        assertEq(sparse.bound, true)
        assertEq(sparse.pushed.length, 0)
        const noWindow = fixture(); noWindow.document.defaultView = null; noWindow.start()
        assertEq(noWindow.bound, false)
        const implicitScope = fixture()
        implicitScope.root.getAttribute = (/** @type {string} */ name) => name === 'data-demo-scope' ? null : '/demo.f.mjs'
        implicitScope.start(); implicitScope.flush()
        assertEq(implicitScope.state, 'second')
        const secondary = fixture()
        secondary.root.getAttribute = (/** @type {string} */ name) => name === 'data-demo-scope' ? 'second' : '/demo.f.mjs'
        secondary.start(); secondary.flush()
        assertEq(secondary.restores, 0)
        assertEq(secondary.bound, false)
        const noStatus = fixture(undefined, '?example=retired')
        noStatus.controls.querySelector = (/** @type {string} */ selector) => selector === ':scope > [data-demo]' ? noStatus.root : null
        noStatus.start()
        assertEq(noStatus.pending.length, 0)
    },
    editsPushHistory: () => {
        const f = fixture(undefined, '?example=second#heading')
        f.start(); f.flush()
        f.edit('Custom 🌍')
        assertEq(f.pushed[0], '/demo/?source=Custom%20%F0%9F%8C%8D#heading')
        f.edit('Custom 🌍')
        assertEq(f.pushed.length, 1)
        f.edit('first')
        assertEq(f.pushed[1], '/demo/#heading')
        assertEq(f.view.location.search, '')
        f.edit('second')
        assertEq(f.pushed[2], '/demo/?example=second#heading')
        assertEq(f.restores, 1)
        f.navigate('#heading'); f.flush()
        assertEq(f.state, 'first')
        f.status.textContent = 'kept'
        f.edit('z')
        assertEq(f.status.textContent, 'kept')
        f.edit('x'.repeat(20_000))
        assertEq(f.pushed.length, 4)
        assert(f.status.textContent.includes('16 KiB'))
        f.edit('y')
        assertEq(f.status.textContent, '')
        assertEq(f.pushed[4], '/demo/?source=y#heading')
        const empty = fixture(recordSharing({}, {}), '#demo')
        empty.start(); empty.edit({})
        assertEq(empty.pushed.length, 0)
    },
    // Typing faster than the pause is one history entry, not one per key.
    burstIsOneEntry: () => {
        const f = fixture(undefined, '#heading')
        f.start()
        for (const value of ['a', 'ab', 'abc', 'abcd']) { f.type(value) }
        assertEq(f.timers.size, 1)
        assertEq(f.pushed.length, 0)
        f.wait()
        assertStructurallySame(f.pushed, ['/demo/?source=abcd#heading'])
    },
    // An action or automatic work keeps the address bar current without
    // adding history; a burst that also holds a reader edit pushes.
    actionsReplace: () => {
        const f = fixture(undefined, '#heading')
        f.start()
        f.act('second'); f.wait()
        assertStructurallySame(f.replaced, ['/demo/?example=second#heading'])
        assertEq(f.pushed.length, 0)
        f.act('second'); f.wait()
        assertEq(f.replaced.length, 1)
        f.type('mine'); f.act('mine+1'); f.wait()
        assertStructurallySame(f.pushed, ['/demo/?source=mine%2B1#heading'])
        f.act('mine+2'); f.wait()
        assertEq(f.replaced.at(-1), '/demo/?source=mine%2B2#heading')
        assertEq(f.pushed.length, 1)
    },
    // A write that comes due while a step runs waits for that step's drain.
    busyDefers: () => {
        const f = fixture(undefined, '#heading')
        f.start()
        f.type('a'); f.busy(true); f.wait()
        assertEq(f.pushed.length, 0)
        f.busy(false); f.type('ab'); f.wait()
        assertStructurallySame(f.pushed, ['/demo/?source=ab#heading'])
    },
    // A browser that refuses the write (Safari's and Firefox's rate limits
    // throw) leaves the demo working, and the next write tries again.
    refusedWrite: () => {
        const f = fixture(undefined, '#heading')
        f.start()
        const push = f.view.history.pushState
        f.view.history.pushState = () => { throw 'SecurityError' }
        f.edit('a')
        assertEq(f.view.location.search, '')
        assertEq(f.status.hidden, undefined)
        f.view.history.pushState = push
        f.edit('ab')
        assertStructurallySame(f.pushed, ['/demo/?source=ab#heading'])
    },
    // Following a link, or leaving, writes the pending edit at once, so the
    // link's own history entry comes after it.
    flushes: () => {
        const f = fixture(undefined, '#heading')
        f.start()
        f.type('a')
        f.event('click', { target: { closest: () => null } })
        assertEq(f.pushed.length, 0)
        f.event('click', { target: { closest: (/** @type {string} */ s) => s === 'a[href]' ? {} : null } })
        assertStructurallySame(f.pushed, ['/demo/?source=a#heading'])
        assertEq(f.timers.size, 0)
        f.event('click', { target: null })
        f.type('ab')
        f.event('pagehide')
        assertEq(f.pushed.at(-1), '/demo/?source=ab#heading')
        f.event('pagehide')
        assertEq(f.pushed.length, 2)
    },
    // Back or Forward during the pause drops the pending write: it must not
    // overwrite the entry the reader went to.
    navigationCancels: () => {
        const f = fixture(undefined, '#heading')
        f.start()
        f.type('a')
        f.navigate('#other')
        assertEq(f.timers.size, 0)
        f.wait()
        assertEq(f.pushed.length, 0)
    },
}
