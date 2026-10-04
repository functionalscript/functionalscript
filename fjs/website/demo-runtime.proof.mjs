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
 * that creates elements and remembers what has focus. The demos themselves arrive as `data:` URLs,
 * so a proof carries the module it drives rather than a fixture file.
 */

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { startDemo } from './demo-runtime.mjs'

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
    let workedWith = ''
    /** @type {any[]} */
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
    /**
     * What the runtime asked of the elements themselves: every `focus` and
     * `setSelectionRange`, by name. A field the reader is typing into must
     * see neither, because either one interrupts what the operating system
     * is doing with it.
     *
     * @type {string[]} */
    const touched = []
    /**
     * Every element under the section, depth first — what a selector searches.
     *
     * @type {() => readonly any[]}
     */
    const descendants = () => {
        /** @type {(node: any) => readonly any[]} */
        const walk = node => node.nodeType === 3 ? [] : [node, ...node.childNodes.flatMap(walk)]
        return children.flatMap(walk)
    }
    /**
     * The markup a node stands for, so a proof can say what was rendered in
     * the words a demo wrote it in. A field shows its current value, which is
     * what a reader sees.
     *
     * @type {(node: any) => string}
     */
    const markup = node => {
        if (node.nodeType === 3) { return node.data }
        const attributes = new Map(node.attributes)
        if (node.localName === 'input') { attributes.set('value', node.value) }
        return `<${node.localName}${[...attributes].map(([k, v]) => ` ${k}="${v}"`).join('')}>${node.childNodes.map(markup).join('')}</${node.localName}>`
    }
    /**
     * Records a change the reader can see: one `render` step for a run of
     * changes, and what the section shows after each. A change to an element
     * not yet in the section is a node being built, not one being shown.
     *
     * @type {(node: any) => void}
     */
    const changed = node => {
        if (node !== root && !descendants().includes(node)) { return }
        rendered.push(root.innerHTML)
        if (steps.at(-1) !== 'render') { steps.push('render') }
    }
    /** @type {(parent: any, node: any) => any} */
    const adopt = (parent, node) => {
        const child = typeof node === 'string' ? text(node) : node
        child.parent = parent
        return child
    }
    /** @type {(data: string) => any} */
    const text = data => {
        /** @type {any} */
        const self = {
            nodeType: 3,
            parent: null,
            get data() { return data },
            set data(/** @type {string} */ value) { data = value; changed(self.parent) },
        }
        return self
    }
    /** @type {any} */
    const document = {
        get activeElement() { return active },
        createElementNS: (/** @type {string} */ _, /** @type {string} */ tag) => element(tag),
        createTextNode: text,
    }
    /** @type {(tag: string) => any} */
    const element = tag => {
        let off = false
        /** @type {string | null} */
        let dirty = null
        /** @type {any} */
        const self = {
            nodeType: 1,
            parent: null,
            localName: tag,
            namespaceURI: 'http://www.w3.org/1999/xhtml',
            ownerDocument: document,
            attributes: new Map(),
            childNodes: [],
            get name() { return self.attributes.get('name') ?? '' },
            getAttribute: (/** @type {string} */ name) => self.attributes.get(name) ?? null,
            getAttributeNames: () => [...self.attributes.keys()],
            setAttribute: (/** @type {string} */ name, /** @type {string} */ value) => {
                self.attributes.set(name, value)
                changed(self)
            },
            removeAttribute: (/** @type {string} */ name) => {
                self.attributes.delete(name)
                changed(self)
            },
            replaceChildren: (/** @type {any[]} */ ...nodes) => {
                self.childNodes = nodes.map(node => adopt(self, node))
                changed(self)
            },
            appendChild: (/** @type {any} */ node) => {
                self.childNodes = [...self.childNodes, adopt(self, node)]
                changed(self)
            },
            replaceChild: (/** @type {any} */ node, /** @type {any} */ old) => {
                self.childNodes = self.childNodes.map((/** @type {any} */ c) => c === old ? adopt(self, node) : c)
                if (active !== null && !descendants().includes(active)) { active = null }
                changed(self)
            },
            removeChild: (/** @type {any} */ old) => {
                self.childNodes = self.childNodes.filter((/** @type {any} */ c) => c !== old)
                if (active !== null && !descendants().includes(active)) { active = null }
                changed(self)
            },
            // A field shows its markup's default until the reader types, as
            // a browser's does — so a patch has something to leave alone.
            get defaultValue() { return self.attributes.get('value') ?? '' },
            get value() { return dirty ?? self.defaultValue },
            set value(/** @type {string} */ value) { dirty = value; changed(self) },
            // The reader's keystroke: what the field shows changes, and that
            // is not a render.
            type: (/** @type {string} */ value) => { dirty = value },
            selectionStart: 0,
            selectionEnd: 0,
            style: { width: '', height: '' },
            scrollTop: 0,
            scrollLeft: 0,
            focus: () => { active = self; touched.push(`focus ${self.name}`) },
            setSelectionRange: (/** @type {number} */ start, /** @type {number} */ end) => {
                self.selectionStart = start
                self.selectionEnd = end
                touched.push(`select ${self.name}`)
            },
            // The same sequence the flag and the render write to: a control
            // that goes unavailable and back inside one turn cannot be caught
            // by looking afterwards either.
            get disabled() { return off },
            set disabled(/** @type {boolean} */ value) {
                if (value !== off) { steps.push(value ? 'disabled' : 'enabled') }
                off = value
            },
        }
        return self
    }
    /** @type {any} */
    const root = {
        get textContent() {
            /** @type {(node: any) => string} */
            const textOf = node => node.nodeType === 3 ? node.data : node.childNodes.map(textOf).join('')
            return children.map(textOf).join('')
        },
        // As a DOM does: the contents become one text node.
        set textContent(/** @type {string} */ value) {
            if (descendants().includes(active)) { active = null }
            children = [adopt(root, value)]
        },
        attributes: new Map([['data-demo', path]]),
        getAttribute: (/** @type {string} */ name) => root.attributes.get(name) ?? null,
        get innerHTML() { return children.map(markup).join('') },
        get childNodes() { return children },
        get firstElementChild() { return children.find(c => c.nodeType === 1) ?? null },
        replaceChildren: (/** @type {any[]} */ ...nodes) => {
            // **Replacing the contents detaches what was focused**, which is
            // the whole reason the runtime has to put focus back. A stand-in
            // that kept the old node focused would pass whether or not the
            // runtime restored anything — the proof would be describing the
            // stand-in rather than the code.
            if (descendants().includes(active)) { active = null }
            children = nodes.map(node => adopt(root, node))
            changed(root)
        },
        querySelector: (/** @type {string} */ selector) =>
            descendants().find(node => node.name !== '' && selector === `[name="${node.name}"]`) ?? null,
        contains: (/** @type {any} */ node) => descendants().includes(node),
        querySelectorAll: (/** @type {string} */ selector) =>
            descendants().filter(node =>
                selector === 'button' ? node.localName === 'button' : selector === '[name]' && node.name !== ''),
        setAttribute: (/** @type {string} */ name, /** @type {string} */ value) => {
            root.attributes.set(name, value)
            if (name === 'data-demo-working') { workedWith = value; steps.push('working') }
        },
        removeAttribute: (/** @type {string} */ name) => {
            root.attributes.delete(name)
            if (name === 'data-demo-working') { steps.push('idle') }
        },
        addEventListener: (/** @type {string} */ kind, /** @type {any} */ f) => {
            if (kind === 'input') { listeners.push(f) }
            if (kind === 'click') { clicks.push(f) }
        },
        ownerDocument: document,
    }
    return {
        root,
        // What the section was given, every time — a runtime that rendered
        // twice has said two things, and the last one alone cannot show it.
        rendered,
        activeName: () => active === null ? null : active.name,
        steps,
        /**
         * Writes a step of its own from a macrotask queued at a known moment.
         *
         * The yield the runtime takes after raising its flag is not visible as
         * a call, only as a gap — so a marker queued *before* the event lands
         * between the flag and the render exactly when that gap exists, and
         * after the render when it does not.
         *
         * @type {(name: string) => void}
         */
        mark: name => { setTimeout(() => steps.push(name), 0) },
        working: () => root.attributes.has('data-demo-working'),
        // The last value the flag carried, kept after it is removed: the
        // attribute lives for one turn, so reading it afterwards reads nothing.
        workedWith: () => workedWith,
        disabled: () => root.querySelectorAll('button').map((/** @type {any} */ b) => b.disabled),
        caret: () => active === null ? null : active.selectionStart,
        focusOn: (/** @type {string} */ name, /** @type {number} */ caret) => {
            const el = root.querySelector(`[name="${name}"]`)
            el.focus()
            el.setSelectionRange(caret, caret)
        },
        /**
         * The reader typing `value` into the field named `name`: the field
         * shows it, then says so.
         *
         * @type {(name: string, value: string) => void}
         */
        input: (name, value) => {
            const field = root.querySelector(`[name="${name}"]`)
            if (field !== null) { field.type(value) }
            for (const f of listeners) { f({ target: { name, value } }) }
        },
        touched,
        /**
         * A click on the element named `name`, which is a
         * `<button type="button">` unless the proof says otherwise, or on
         * unnamed markup `nested` inside it.
         *
         * `closest` answers the one selector the runtime asks, a list of a
         * tag and a tag with a `type`, from what the element is — so a
         * runtime that asked for something else finds no button at all.
         *
         * @type {(name: string, options?: { readonly tagName?: string, readonly type?: string, readonly nested?: boolean, readonly copy?: string, readonly disabled?: boolean }) => any}
         */
        click: (name, { tagName = 'BUTTON', type = 'button', nested = false, copy, disabled = false } = {}) => {
            /** @type {(selector: string) => boolean} */
            const matches = selector => selector.split(', ').some(one =>
                one === tagName.toLowerCase() || one === `${tagName.toLowerCase()}[type="${type}"]`)
            /** @type {any} */
            const self = {
                name, disabled, ownerDocument: document,
                getAttribute: (/** @type {string} */ key) => key === 'data-copy' ? copy ?? null : null,
                closest: (/** @type {string} */ s) => matches(s) ? self : null,
            }
            const target = nested ? { closest: self.closest } : self
            for (const f of clicks) { f({ target }) }
            return self
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
    copyCode: async () => {
        const d = dom(echo)
        /** @type {string[]} */
        const copied = []
        d.root.ownerDocument.defaultView = { navigator: { clipboard: {
            writeText: async (/** @type {string} */ text) => { copied.push(text) },
        } } }
        await startDemo(d.root)
        await settle()
        const renders = d.rendered.length
        const button = d.click('', { copy: "hello ' world", nested: true })
        assert(button.disabled)
        await settle()
        assertStructurallySame(copied, ["hello ' world"])
        assertEq(button.textContent, 'Copied')
        assertEq(button.disabled, false)
        assertEq(d.rendered.length, renders)
        d.click('', { copy: '', disabled: true })
        await settle()
        assertEq(copied.length, 1)
        const empty = d.click('', { copy: '' })
        await settle()
        assertStructurallySame(copied, ["hello ' world", ''])
        assertEq(empty.textContent, 'Copied')
    },
    copyUnavailable: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        const button = d.click('', { copy: 'hello' })
        await settle()
        assertEq(button.textContent, 'Copy unavailable')
        assertEq(button.disabled, false)
        assert(!d.root.textContent.startsWith('demo failed'))
    },
    copyDenied: async () => {
        const d = dom(echo)
        d.root.ownerDocument.defaultView = { navigator: { clipboard: {
            writeText: async () => { throw new Error('denied') },
        } } }
        await startDemo(d.root)
        await settle()
        const button = d.click('', { copy: 'hello' })
        await settle()
        assertEq(button.textContent, 'Copy failed')
        assertEq(button.disabled, false)
        assert(!d.root.textContent.startsWith('demo failed'))
    },
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
     * **A render never shows a state older than an event already queued.**
     * Rendering replaces the field being typed into, so a render of the
     * state after `a`, landing once the reader has typed `ab`, would put a
     * field holding `a` under their next keystroke — and the `b` is gone.
     */
    skipsAStaleRender: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        const before = d.rendered.length
        d.input('text', 'a')
        d.input('text', 'ab')
        await settle()
        await settle()
        const after = d.rendered.slice(before)
        assert(!after.some((/** @type {string} */ html) => html.includes('value="a"')), after.join('\n'))
        assert(after[after.length - 1].includes('value="ab"'), after.join('\n'))
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
     * **A manual resize survives a re-render too, and by the same
     * reasoning as the caret.** A browser's drag sets a field's own inline
     * `style.width`/`style.height`; a fresh element from the next render
     * starts with neither, so without a restore a field widened by hand
     * narrows back the moment its text changes.
     */
    keepsManualResize: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        const before = d.root.querySelector('[name="text"]')
        before.style.width = '600px'
        before.style.height = '300px'
        d.input('text', 'ab')
        await settle()
        const after = d.root.querySelector('[name="text"]')
        assertEq(after.style.width, '600px')
        assertEq(after.style.height, '300px')
    },
    /**
     * **A scrolled field stays scrolled across a re-render.** A render follows
     * every keystroke, so a field that lost its offset would jump back to its
     * first line as the reader typed.
     */
    keepsScrollOffset: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        const before = d.root.querySelector('[name="text"]')
        before.scrollTop = 120
        before.scrollLeft = 30
        d.input('text', 'ab')
        await settle()
        const after = d.root.querySelector('[name="text"]')
        assertEq(after.scrollTop, 120)
        assertEq(after.scrollLeft, 30)
    },
    /**
     * **Only a button asks.** A click in a field places a caret or ends a
     * mouse selection; sending it to the demo re-rendered the field under the
     * reader's hands for an event no demo acts on.
     */
    ignoresAClickOutsideAButton: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        const renders = d.rendered.length
        d.click('text', { tagName: 'INPUT', type: 'text' })
        d.click('text', { tagName: 'TEXTAREA', type: 'textarea' })
        d.click('text', { tagName: 'INPUT', type: 'checkbox' })
        await settle()
        assertEq(d.rendered.length, renders)
    },
    // An `<input type="button">` is a button too, and asks like one.
    acceptsAnInputButton: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: 'idle',
    update: state => event => () => ['ok', event.kind === 'click' ? event.name : state],
    view: text => ['div', ['input', { type: 'button', name: 'go', value: 'Go' }], ['pre', text]],
}
`))
        await startDemo(d.root)
        await settle()
        d.click('go', { tagName: 'INPUT', type: 'button' })
        await settle()
        assert(d.root.innerHTML.includes('<pre>go</pre>'), d.root.innerHTML)
    },
    /**
     * **Typing keeps the field.** The element the reader types into is the
     * one still there after the render, and the runtime neither focuses it
     * again nor sets its selection: both are already the reader's.
     */
    typingKeepsTheField: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        const before = d.root.querySelector('[name="text"]')
        d.focusOn('text', 0)
        const touches = d.touched.length
        for (const text of ['a', 'aa', 'aaa']) {
            d.input('text', text)
            await settle()
        }
        assertEq(d.root.querySelector('[name="text"]'), before)
        assertEq(d.activeName(), 'text')
        assertStructurallySame(d.touched.slice(touches), [])
        assert(d.root.innerHTML.includes('<pre>aaa</pre>'), d.root.innerHTML)
    },
    /**
     * **A field whose place in the view changes is a new element**, and
     * focus and the caret come back to it by name.
     */
    refocusesAFieldThatMoved: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: '',
    update: state => event => () => ['ok', event.kind === 'input' ? event.value : state],
    view: text => text === 'shift'
        ? ['div', ['p', 'moved'], ['input', { name: 'text', value: text }]]
        : ['div', ['input', { name: 'text', value: text }], ['pre', text]],
}
`))
        await startDemo(d.root)
        await settle()
        const before = d.root.querySelector('[name="text"]')
        d.focusOn('text', 3)
        d.input('text', 'shift')
        await settle()
        const after = d.root.querySelector('[name="text"]')
        assert(after !== before, 'expected the field to be a new element')
        assertEq(d.activeName(), 'text')
        assertEq(d.caret(), 3)
    },
    /**
     * **A field shows the state, not only what was typed.** A demo that
     * answers a keystroke with different text gets its text into the field,
     * as the field's default would be on a fresh element.
     */
    showsTheStateInAField: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: '',
    update: state => event => () => ['ok', event.kind === 'input' ? event.value.toUpperCase() : state],
    view: text => ['div', ['input', { name: 'text', value: text }]],
}
`))
        await startDemo(d.root)
        await settle()
        d.input('text', 'ab')
        await settle()
        assertEq(d.root.querySelector('[name="text"]').value, 'AB')
    },
    /**
     * **A click on a button's label is a click on the button.** A label may
     * be markup of its own — `['button', { name: 'go' }, ['strong', 'Go']]` —
     * and then the target is the `<strong>`, whichever part the reader hit.
     */
    acceptsAClickInsideAButton: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: 'idle',
    update: state => event => () => ['ok', event.kind === 'click' ? event.name : state],
    view: text => ['div', ['button', { type: 'button', name: 'go' }, ['strong', 'Go']], ['pre', text]],
}
`))
        await startDemo(d.root)
        await settle()
        d.click('go', { nested: true })
        await settle()
        assert(d.root.innerHTML.includes('<pre>go</pre>'), d.root.innerHTML)
    },
    // A resized or scrolled field that a later state simply stops rendering
    // has nowhere to put its size or offset back — skipped rather than thrown,
    // the same as a restored caret finding no field to focus.
    dropsAManualResizeForAFieldThatIsGone: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: '',
    update: state => event => () => ['ok', event.kind === 'input' ? event.value : state],
    view: text => text === 'hide'
        ? ['div', ['pre', 'gone']]
        : ['div', ['input', { name: 'text', value: text }], ['pre', text]],
}
`))
        await startDemo(d.root)
        await settle()
        const before = d.root.querySelector('[name="text"]')
        before.style.width = '600px'
        before.scrollTop = 120
        d.input('text', 'hide')
        await settle()
        assert(!d.root.textContent.startsWith('demo failed'), d.root.textContent)
        assertEq(d.root.querySelector('[name="text"]'), null)
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
        // Queued now, so it runs on the turn *after* this one: it lands
        // wherever the runtime's own yield puts the boundary.
        d.mark('turn')
        d.click('go')
        await settle()
        /**
         * **Three mechanisms, in one sequence.** The flag goes up and the
         * control goes unavailable together; `turn` is a macrotask queued
         * before the event, so where it lands *is* the yield — between the
         * two and the render, which is the gap a browser paints in; then the
         * render, and the flag down.
         *
         * Asserted as an order rather than by looking afterwards, because
         * each lives for a single turn: a proof that checked the end state
         * passed with the disabling and the yield both deleted, which is how
         * they came to be unprotected.
         *
         * **`enabled` last, and that is what gives the control back.** The
         * render patches the section, so the button is the one that was
         * disabled; the explicit re-enable is the only thing that makes it
         * available again.
         */
        assertStructurallySame(
            d.steps.slice(before),
            ['working', 'disabled', 'turn', 'render', 'idle', 'enabled'])
        assert(!d.working(), 'expected the flag down once the update finished')
        assertStructurallySame(d.disabled(), [false])
    },
    /**
     * **A demo may add to the word, and cannot replace it.** The runtime owns
     * "Working…" because it runs every demo; what it cannot know is that this
     * demo's next turn is minutes rather than milliseconds. `wait` answers
     * that, and it lands in the attribute's *value*, which the stylesheet
     * appends — so the general word survives whatever a demo says.
     *
     * It is read from the state the demo is about to be given, not the one it
     * returns: a warning that arrives after the wait is not a warning.
     */
    waitAddsToTheWord: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: 'slow',
    update: state => event => () => ['ok', event.kind === 'click' ? 'quick' : state],
    view: text => ['div', ['button', { type: 'button', name: 'go' }, 'Go'], ['pre', text]],
    wait: state => state === 'slow' ? 'about 2 minutes' : null,
}
`))
        await startDemo(d.root)
        await settle()
        d.click('go')
        await settle()
        // The state at the click was `slow`, so that is what was announced —
        // not the `quick` the turn produced.
        assertEq(d.workedWith(), ' (about 2 minutes)')
        // And the second turn, from a state with nothing unusual to say,
        // leaves the value empty so the stylesheet renders the word alone.
        d.click('go')
        await settle()
        assertEq(d.workedWith(), '')
    },
    /**
     * **A demo without `wait` is the ordinary case**, and gets the general
     * word with nothing appended. The field is optional so that silence means
     * "nothing unusual" rather than "nobody remembered".
     */
    noWaitIsSilent: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: 'idle',
    update: state => event => () => ['ok', 'done'],
    view: text => ['div', ['button', { type: 'button', name: 'go' }, 'Go'], ['pre', text]],
}
`))
        await startDemo(d.root)
        await settle()
        d.click('go')
        await settle()
        assertEq(d.workedWith(), '')
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
    update: state => event => () => {
        if (event.kind === 'click') { throw new Error('boom') }
        return ['ok', state]
    },
    view: text => ['div', ['button', { type: 'button', name: 'go' }, 'Go'], ['pre', text]],
}
`))
        await startDemo(d.root)
        await settle()
        const before = d.steps.length
        d.mark('turn')
        d.click('go')
        await settle()
        assert(d.root.textContent.startsWith('demo failed: boom'), d.root.textContent)
        // The report replaces the section's contents, button and all, so
        // there is nothing left to re-enable.
        assertStructurallySame(
            d.steps.slice(before),
            ['working', 'disabled', 'turn', 'idle'])
    },
    /**
     * **A report is not a view**, so the next event rebuilds the section
     * rather than patching the report's text.
     */
    rendersOverAReportedFailure: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: '',
    update: state => event => () => {
        if (event.kind === 'click') { throw new Error('boom') }
        return ['ok', event.kind === 'input' ? event.value : state]
    },
    view: text => ['div', ['button', { type: 'button', name: 'go' }, 'Go'], ['pre', text]],
}
`))
        await startDemo(d.root)
        await settle()
        d.click('go')
        await settle()
        d.input('other', 'x')
        await settle()
        assert(d.root.innerHTML.includes('<pre>x</pre>'), d.root.innerHTML)
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
