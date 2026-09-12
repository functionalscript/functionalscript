/**
 * Proofs for the demo runtime, driven against a DOM stand-in.
 *
 * A `.mjs` and not a `.f.mjs`: the runtime is the one impure half of a demo,
 * and an adapter to a host can only be proven against a stand-in for that
 * host — the same bargain `emergent_testing/browser/proof.mjs` makes. It is
 * opt-in by filename, which is how the suite loads a proof it may not import
 * blindly.
 *
 * The stand-in is small because the runtime asks for little: an element whose
 * contents can be replaced, a lookup by `name`, one listener, and a document
 * that remembers what has focus. The demos themselves arrive as `data:` URLs,
 * so a proof carries the module it drives rather than a fixture file.
 */

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { startDemo } from './demo-runtime.mjs'

/**
 * Every `name="…"` the rendered HTML declares, in order.
 *
 * The runtime hands the section a string and then looks elements up inside
 * it, so a stand-in that did not read the string back could not observe
 * whether focus was restored — it would answer for elements the render never
 * produced.
 *
 * @type {(html: string) => readonly string[]}
 */
const namesIn = html => html.split('name="').slice(1).map(rest => rest.split('"')[0])

/**
 * The DOM this runtime needs, and nothing else. A factory rather than
 * file-scope helpers so the mutually recursive element and document types stay
 * function-local.
 *
 * @type {(path: string) => any}
 */
const dom = path => {
    /** @type {any} */
    let active = null
    /** @type {readonly any[]} */
    let children = []
    /** @type {((event: any) => void)[]} */
    const listeners = []
    /** @type {((event: any) => void)[]} */
    const clicks = []
    /** @type {string[]} */
    const rendered = []
    /**
     * What the runtime did to the section, in order. A flag that goes up and
     * down inside one microtask cannot be caught by looking afterwards, so the
     * stand-in writes down each step as it happens and the proof reads the
     * sequence.
     *
     * @type {string[]} */
    const steps = []
    /** @type {any[]} */
    let buttons = []
    /** @type {(name: string) => any} */
    const element = (/** @type {string} */ name) => {
        /** @type {any} */
        const self = {
            name,
            selectionStart: 0,
            selectionEnd: 0,
            focus: () => { active = self },
            setSelectionRange: (/** @type {number} */ start, /** @type {number} */ end) => {
                self.selectionStart = start
                self.selectionEnd = end
            },
        }
        return self
    }
    /** @type {any} */
    const root = {
        textContent: '',
        attributes: new Map([['data-demo', path]]),
        getAttribute: (/** @type {string} */ name) => root.attributes.get(name) ?? null,
        get innerHTML() { return rendered.length === 0 ? '' : rendered[rendered.length - 1] },
        set innerHTML(/** @type {string} */ html) {
            rendered.push(html)
            steps.push('render')
            // **Replacing the contents detaches what was focused**, which is
            // the whole reason the runtime has to put focus back. A stand-in
            // that kept the old node focused would pass whether or not the
            // runtime restored anything — the proof would be describing the
            // stand-in rather than the code.
            if (children.includes(active)) { active = null }
            children = namesIn(html).map(element)
            buttons = children.filter(child => html.includes(`<button type="button" name="${child.name}"`))
        },
        querySelector: (/** @type {string} */ selector) =>
            children.find(child => selector.includes(`"${child.name}"`)) ?? null,
        contains: (/** @type {any} */ node) => children.includes(node),
        querySelectorAll: (/** @type {string} */ selector) =>
            selector === 'button' ? buttons : [],
        setAttribute: (/** @type {string} */ name, /** @type {string} */ value) => {
            root.attributes.set(name, value)
            if (name === 'data-demo-working') { steps.push('working') }
        },
        removeAttribute: (/** @type {string} */ name) => {
            root.attributes.delete(name)
            if (name === 'data-demo-working') { steps.push('idle') }
        },
        addEventListener: (/** @type {string} */ kind, /** @type {any} */ f) => {
            if (kind === 'input') { listeners.push(f) }
            if (kind === 'click') { clicks.push(f) }
        },
        ownerDocument: { get activeElement() { return active } },
    }
    return {
        root,
        // What the section was given, every time — a runtime that rendered
        // twice has said two things, and the last one alone cannot show it.
        rendered,
        activeName: () => active === null ? null : active.name,
        steps,
        working: () => root.attributes.has('data-demo-working'),
        disabled: () => buttons.map((/** @type {any} */ b) => b.disabled),
        caret: () => active === null ? null : active.selectionStart,
        focusOn: (/** @type {string} */ name, /** @type {number} */ caret) => {
            const el = root.querySelector(`[name="${name}"]`)
            el.focus()
            el.setSelectionRange(caret, caret)
        },
        /** @type {(name: string, value: string) => void} */
        input: (name, value) => {
            for (const f of listeners) { f({ target: { name, value } }) }
        },
        /** @type {(name: string) => void} */
        click: name => {
            for (const f of clicks) { f({ target: { name } }) }
        },
    }
}

/**
 * A demo module, as a URL the runtime can import.
 *
 * **Base64, not percent-encoding.** Bun 1.4.2 reads a percent-encoded `data:`
 * module as CommonJS the moment its payload holds a literal `.` — `event.kind`
 * is enough, and so is `1.5` — so the namespace arrives as
 * `__esModule`/`default` and the demo export is simply not there. Base64 has
 * no character a path sniffer can mistake for an extension, which sidesteps
 * the class rather than escaping the one character that triggers it. Node
 * reads either.
 *
 * @type {(source: string) => string}
 */
const moduleUrl = source => `data:text/javascript;base64,${btoa(source)}`

/**
 * A demo that echoes what was typed into a named field — the smallest thing
 * that renders a field, reads an event and shows a state.
 *
 * **A fixture imports nothing.** A `data:` module has no file of its own to
 * resolve against, and runtimes disagree about a `file:` specifier written
 * inside one: Node resolves it, Bun does not, so a fixture reaching for
 * `pureOk` passed under one runner of this suite and failed under another.
 * Spelling the `Pure` effect out — a thunk answering `ok` — keeps every
 * fixture self-contained. It is the one place here that names the `Result`
 * representation instead of its constructor, because it is the one place that
 * cannot import it.
 */
const echo = moduleUrl(`
export const demo = {
    init: '',
    update: state => event => () => ['ok', event.kind === 'input' ? event.value : state],
    view: text => ['div', ['input', { name: 'text', value: text }], ['pre', text]],
}
`)

/**
 * Lets a queued update settle.
 *
 * Two turns, not one: the runtime yields to the event loop after raising its
 * working flag so a browser can paint it, so an update spans a macrotask
 * boundary of its own.
 *
 * @type {() => Promise<void>}
 */
const settle = async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
    await new Promise(resolve => setTimeout(resolve, 0))
}

export const proof = {
    /**
     * **The first render is the demo's own `init`**, before any event, so a
     * page shows what a demo is before it shows what it does.
     */
    rendersInit: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        // First, because a fixture that will not load reports *through* the
        // runtime and renders nothing — and `rendered[0] is undefined` is a
        // poor way to learn that a runtime disagreed about a specifier.
        assert(!d.root.textContent.startsWith('demo failed'), d.root.textContent)
        assert(d.rendered[0].includes('name="text"'), d.rendered[0])
        assert(d.rendered[0].includes('value=""'), d.rendered[0])
    },
    // An input event reaches `update`, and the state it answers is rendered.
    inputDrivesUpdate: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        d.input('text', 'ab')
        await settle()
        assert(d.root.innerHTML.includes('value="ab"'), d.root.innerHTML)
        assert(d.root.innerHTML.includes('<pre>ab</pre>'), d.root.innerHTML)
    },
    /**
     * **Focus and the caret survive a re-render.** Replacing the section's
     * contents destroys the element being typed into; a new one takes its
     * place with the same `name`, but focus belongs to the node. Without the
     * restore a demo accepts one character and drops the reader.
     */
    keepsFocusAndCaret: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        d.focusOn('text', 1)
        d.input('text', 'ab')
        await settle()
        assertEq(d.activeName(), 'text')
        assertEq(d.caret(), 1)
    },
    /**
     * **The page says it is waiting, and stops being asked again.** A demo
     * renders once, after its effect finishes, so it cannot paint "still
     * going" itself: the loop that dispatched the command is the only thing
     * that knows one is outstanding. Buttons are disabled rather than dimmed —
     * a queued second click would be honoured after the first finished, which
     * is a demo doing its work twice because somebody was impatient.
     */
    saysItIsWorking: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: 'idle',
    update: state => event => () => ['ok', event.kind === 'click' ? 'done' : state],
    view: text => ['div', ['button', { type: 'button', name: 'go' }, 'Go'], ['pre', text]],
}
`))
        await startDemo(d.root)
        await settle()
        assert(!d.working(), 'expected the page to be idle before an event')
        assertStructurallySame(d.disabled(), [false])
        const before = d.steps.length
        d.click('go')
        await settle()
        // **The flag goes up before the work and down after the render.** It
        // lives for one microtask, so looking afterwards can only ever see it
        // down; the order is the thing worth asserting, and the order is what
        // a reader sees.
        assertStructurallySame(d.steps.slice(before), ['working', 'render', 'idle'])
        assert(!d.working(), 'expected the flag down once the update finished')
        assertStructurallySame(d.disabled(), [false])
    },
    /**
     * **A demo that throws is reported, not swallowed.** `update` and `view`
     * are total by construction, so a throw is a defect — and a blank section
     * is what a demo rendering nothing looks like, which is the one thing it
     * must not be mistaken for.
     */
    reportsAThrowFromUpdate: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: '',
    update: () => () => { throw new Error('boom') },
    view: text => ['pre', text],
}
`))
        await startDemo(d.root)
        d.input('text', 'x')
        await settle()
        assert(d.root.textContent.startsWith('demo failed: boom'), d.root.textContent)
    },
    /**
     * **The first render is reported like every later one.** It runs before
     * the queue exists, so a `view(init)` that throws would otherwise reject a
     * promise the page script does not await and leave the section blank.
     */
    reportsAThrowFromTheFirstRender: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: '',
    update: state => () => state,
    view: () => { throw new Error('early') },
}
`))
        await startDemo(d.root)
        await settle()
        assert(d.root.textContent.startsWith('demo failed: early'), d.root.textContent)
    },
    // A module that names no `demo` is a defect too, and says which module.
    reportsAModuleWithoutADemo: async () => {
        const d = dom(moduleUrl('export const notADemo = 1'))
        await startDemo(d.root)
        await settle()
        assert(d.root.textContent.startsWith('demo failed:'), d.root.textContent)
        assert(d.root.textContent.includes('exports no demo'), d.root.textContent)
    },
    // A section with no `data-demo` is not a demo section, and is left alone.
    ignoresASectionWithoutAPath: async () => {
        const d = dom(echo)
        d.root.attributes.delete('data-demo')
        await startDemo(d.root)
        assertEq(d.rendered.length, 0)
        assertEq(d.root.textContent, '')
    },
}
