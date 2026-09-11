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

import { assert, assertEq } from '../asserts/module.f.mjs'
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
    /** @type {string[]} */
    const rendered = []
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
            // **Replacing the contents detaches what was focused**, which is
            // the whole reason the runtime has to put focus back. A stand-in
            // that kept the old node focused would pass whether or not the
            // runtime restored anything — the proof would be describing the
            // stand-in rather than the code.
            if (children.includes(active)) { active = null }
            children = namesIn(html).map(element)
        },
        querySelector: (/** @type {string} */ selector) =>
            children.find(child => selector.includes(`"${child.name}"`)) ?? null,
        contains: (/** @type {any} */ node) => children.includes(node),
        addEventListener: (/** @type {string} */ kind, /** @type {any} */ f) => {
            if (kind === 'input') { listeners.push(f) }
        },
        ownerDocument: { get activeElement() { return active } },
    }
    return {
        root,
        // What the section was given, every time — a runtime that rendered
        // twice has said two things, and the last one alone cannot show it.
        rendered,
        activeName: () => active === null ? null : active.name,
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
    }
}

/** A demo module, as a URL the runtime can import. */
/** @type {(source: string) => string} */
const moduleUrl = source => `data:text/javascript,${encodeURIComponent(source)}`

/**
 * A demo that echoes what was typed into a named field — the smallest thing
 * that renders a field, reads an event and shows a state.
 */
const echo = moduleUrl(`
import { pureOk } from '${new URL('../effects/module.f.mjs', import.meta.url).href}'
export const demo = {
    init: '',
    update: state => event => pureOk(event.kind === 'input' ? event.value : state),
    view: text => ['div', ['input', { name: 'text', value: text }], ['pre', text]],
}
`)

/** Lets the queued update settle: the runtime chains each event onto a promise. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

export const proof = {
    /**
     * **The first render is the demo's own `init`**, before any event, so a
     * page shows what a demo is before it shows what it does.
     */
    rendersInit: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
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
