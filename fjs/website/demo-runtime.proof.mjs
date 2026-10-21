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

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.js'
import { startDemo } from './demo-runtime.mjs'
import { toDom } from '../media/html/module.mjs'

/**
 * The DOM this runtime needs, and nothing else. A factory rather than
 * file-scope helpers so the mutually recursive element and document types stay
 * function-local.
 *
 * @type {(path: string) => any}
 */
const dom = path => {
    /** @type {Map<string, ((event: any) => void)[]>} */
    const events = new Map()
    /** @type {Map<number, { reset: () => void, delay: number }>} */
    const copyTimers = new Map()
    let nextTimer = 0
    /** @type {any} */
    let active = null
    let workedWith = ''
    /** @type {any[]} */
    let children = []
    /** @type {((event: any) => void)[]} */
    const listeners = []
    /** @type {((event: any) => void)[]} */
    const clicks = []
    /** @type {((event: any) => void)[]} */
    const scrolls = []
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
     * The first element under the section named `name` — what a reader means
     * by "that field", however the name is spelled.
     *
     * @type {(name: string) => any}
     */
    const named = name => descendants().find(node => node.name !== '' && node.name === name) ?? null
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
        defaultView: {
            navigator: {},
            setTimeout: (/** @type {() => void} */ reset, /** @type {number} */ delay) => {
                nextTimer += 1
                copyTimers.set(nextTimer, { reset, delay })
                return nextTimer
            },
            clearTimeout: (/** @type {number} */ timer) => { copyTimers.delete(timer) },
        },
        get activeElement() { return active },
        createElementNS: (/** @type {string} */ _, /** @type {string} */ tag) => element(tag),
        createTextNode: text,
    }
    /** @type {(tag: string) => any} */
    const element = tag => {
        /** @type {boolean | null} */
        let off = null
        /** @type {string | null} */
        let dirty = null
        /** @type {boolean | null} */
        let checked = null
        /** @type {boolean | null} */
        let selected = null
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
            hasAttribute: (/** @type {string} */ name) => self.attributes.has(name),
            // The element before this one under the same parent, as a DOM
            // answers it: elements only, `null` for the first.
            get previousElementSibling() {
                const siblings = self.parent === null ? [] : self.parent.childNodes.filter((/** @type {any} */ c) => c.nodeType === 1)
                return siblings[siblings.indexOf(self) - 1] ?? null
            },
            // The one selector the runtime asks of an element: a textarea in
            // a highlighted field's wrapper.
            matches: (/** @type {string} */ selector) =>
                selector === '[data-editor] > textarea' && self.localName === 'textarea'
                    && self.parent !== null && self.parent.attributes !== undefined && self.parent.attributes.has('data-editor'),
            // As a DOM does: the text of everything under it, and, set, one
            // text node in its place.
            get textContent() {
                /** @type {(node: any) => string} */
                const textOf = node => node.nodeType === 3 ? node.data : node.childNodes.map(textOf).join('')
                return self.childNodes.map(textOf).join('')
            },
            set textContent(/** @type {string} */ value) {
                self.childNodes = [adopt(self, value)]
                changed(self)
            },
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
            // A select's value is its selected option's, the first one when
            // none is, as a browser answers it.
            get value() {
                if (self.localName !== 'select') { return dirty ?? self.defaultValue }
                const option = self.options.find((/** @type {any} */ o) => o.selected) ?? self.options[0]
                return option?.getAttribute('value') ?? ''
            },
            set value(/** @type {string} */ value) { dirty = value; changed(self) },
            // The reader's keystroke: what the field shows changes, and, when
            // the proof says, the caret is where the edit ended; that is not a
            // render.
            type: (/** @type {string} */ value, /** @type {number | undefined} */ caret) => {
                dirty = value
                if (caret !== undefined) {
                    self.selectionStart = caret
                    self.selectionEnd = caret
                }
            },
            // A checkable control and an option show their markup's default
            // until the reader picks, as a browser's do.
            get defaultChecked() { return self.attributes.has('checked') },
            get checked() { return checked ?? self.defaultChecked },
            set checked(/** @type {boolean} */ value) { checked = value },
            get defaultSelected() { return self.attributes.has('selected') },
            get selected() { return selected ?? self.defaultSelected },
            set selected(/** @type {boolean} */ value) { selected = value },
            get options() { return self.childNodes.filter((/** @type {any} */ c) => c.localName === 'option') },
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
            // Until set, it is what the markup says, as a browser's is.
            get disabled() { return off ?? self.attributes.has('disabled') },
            set disabled(/** @type {boolean} */ value) {
                if (value !== self.disabled) { steps.push(value ? 'disabled' : 'enabled') }
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
        // A name holding a quote, a backslash or a line break is not a
        // selector's text: a browser refuses such a selector, and so does this.
        querySelector: (/** @type {string} */ selector) => {
            const name = selector.slice('[name="'.length, -'"]'.length)
            if (name.includes('"') || name.includes('\\') || name.includes('\n')) {
                throw new SyntaxError(`'${selector}' is not a valid selector`)
            }
            return named(name)
        },
        contains: (/** @type {any} */ node) => descendants().includes(node),
        querySelectorAll: (/** @type {string} */ selector) =>
            descendants().filter(node =>
                selector === 'button' ? node.localName === 'button'
                    : selector === '[data-editor] > textarea' ? node.matches(selector)
                        : selector === '[name]' && node.name !== ''),
        setAttribute: (/** @type {string} */ name, /** @type {string} */ value) => {
            root.attributes.set(name, value)
            if (name === 'data-demo-working') { workedWith = value; steps.push('working') }
        },
        removeAttribute: (/** @type {string} */ name) => {
            root.attributes.delete(name)
            if (name === 'data-demo-working') { steps.push('idle') }
        },
        setPointerCapture: (/** @type {number} */ id) => { steps.push(`capture ${id}`) },
        addEventListener: (/** @type {string} */ kind, /** @type {any} */ f) => {
            events.set(kind, [...(events.get(kind) ?? []), f])
            if (kind === 'input') { listeners.push(f) }
            if (kind === 'click') { clicks.push(f) }
            if (kind === 'scroll') { scrolls.push(f) }
        },
        ownerDocument: document,
    }
    return {
        root,
        dispatch: (/** @type {string} */ kind, /** @type {any} */ event) => {
            for (const f of events.get(kind) ?? []) { f(event) }
        },
        resetCopies: () => {
            assert(copyTimers.size > 0)
            for (const [id, { reset, delay }] of copyTimers) {
                assertEq(delay, 2_000)
                copyTimers.delete(id)
                reset()
            }
        },
        // What the section was given, every time — a runtime that rendered
        // twice has said two things, and the last one alone cannot show it.
        rendered,
        named,
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
            const el = named(name)
            el.focus()
            el.setSelectionRange(caret, caret)
        },
        /**
         * The reader typing `value` into the field named `name`: the field
         * shows it, then says so.
         *
         * @type {(name: string, value: string, caret?: number) => void}
         */
        input: (name, value, caret) => {
            const field = named(name)
            if (field !== null) { field.type(value, caret) }
            for (const f of listeners) { f({ target: field ?? { name, value } }) }
        },
        /**
         * The reader ticking or unticking the checkbox named `name`, whose
         * value is `on` either way.
         *
         * @type {(name: string, checked: boolean) => void}
         */
        toggle: (name, checked) => {
            for (const f of listeners) { f({ target: { name, type: 'checkbox', value: 'on', checked } }) }
        },
        /**
         * The reader scrolling the field named `name`: its scroll is heard at
         * the section, as a capturing listener hears it.
         *
         * @type {(name: string) => void}
         */
        scroll: name => {
            const field = named(name)
            for (const f of scrolls) { f({ target: field }) }
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
                name, disabled, title: 'Copy', ownerDocument: document,
                status: { textContent: '' },
                attributes: {},
                setAttribute: (/** @type {string} */ key, /** @type {string} */ value) => { self.attributes[key] = value },
                removeAttribute: (/** @type {string} */ key) => { delete self.attributes[key] },
                querySelector: (/** @type {string} */ key) => key === '[data-copy-status]' ? self.status : null,
                getAttribute: (/** @type {string} */ key) => key === 'data-copy' ? copy ?? null : null,
                closest: (/** @type {string} */ s) => matches(s) ? self : null,
            }
            const target = nested ? { closest: self.closest } : self
            self.activate = () => { for (const f of clicks) { f({ target }) } }
            self.activate()
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
 * A demo with a highlighted field: a textarea laid over a coloured copy of its
 * text, marked as the stylesheet and the runtime know them. The copy colours
 * the whole text as one keyword.
 */
const highlighted = moduleUrl(`
export const demo = {
    init: 'a b',
    update: state => event => () => ['ok', event.kind === 'input' ? event.value : event.kind === 'click' ? state + 'x' : state],
    // the first character is a keyword and the rest plain, so the copy has two
    // text nodes and the terminator; the copy is a \`span\` or a \`div\` by the
    // text's length, so a click that changes the length builds it anew, as a
    // patch does when a view's element changes its place
    view: text => {
        const head = text.slice(0, 1)
        const tail = text.slice(1)
        return ['div', ['span', { 'data-editor': '' },
            [text.length % 2 === 0 ? 'div' : 'span', { 'data-mirror': '' },
                ...(head === '' ? [] : [['span', { 'data-token': 'keyword' }, head]]),
                ...(tail === '' ? [] : [tail]),
                '\\u200b'],
            ['textarea', { name: 'text' }, text]],
            ['button', { name: 'more' }, 'more']]
    },
}
`)

/**
 * A demo over `controls` that shows the last input it heard as
 * `name=value`, and its section with that view already built into it, as the
 * build writes it — with `built` in place of `controls` where the build writes
 * them differently.
 *
 * @type {(controls: readonly any[], built?: readonly any[]) => { readonly d: ReturnType<typeof dom>, readonly fields: () => readonly any[] }}
 */
const prerendered = (controls, built = controls) => {
    const d = dom(moduleUrl(`
const controls = ${JSON.stringify(controls)}
export const demo = {
    init: '',
    update: state => event => () => ['ok', event.kind === 'input' ? event.name + '=' + event.value : state],
    view: state => ['div', ...controls, ['pre', state]],
}
`))
    d.root.replaceChildren(toDom(d.root.ownerDocument, ['div', ...built, ['pre', '']]))
    return { d, fields: () => d.root.querySelectorAll('[name]') }
}

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

/** @type {(limit: number) => string} */
const incremental = limit => moduleUrl(`
export const demo = {
    init: { count: 0, running: false },
    nextEvent: state => state.running ? { kind: 'click', name: 'next' } : null,
    update: state => event => () => ['ok',
        event.kind === 'input' ? { ...state, running: false }
            : event.kind !== 'click' ? state
                : event.name === 'go' ? { ...state, running: !state.running }
                    : { count: state.count + 1, running: state.count + 1 < ${limit} }],
    view: state => ['div', ['input', { name: 'text', value: '' }],
        ['button', { name: 'go', type: 'button' }, state.running ? 'Stop' : 'Go'],
        ['pre', String(state.count)]],
}
`)

export const proof = {
    svgControls: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: '',
    update: s => e => () => ['ok', e.kind === 'input' ? e.value : e.kind === 'click' ? e.name : s],
    view: s => ['div', ['input', { type: 'range', name: 'x', value: s }], ['pre', s]],
}
`))
        await startDemo(d.root)
        await settle()
        let blurred = 0
        const control = { getAttribute: () => 'point:0,2', blur: () => { blurred += 1 } }
        const target = { closest: (/** @type {string} */ s) => s === '[data-demo-click]' ? control : null }
        d.dispatch('click', { target, detail: 1 })
        await settle()
        assert(d.root.innerHTML.includes('<pre>point:0,2</pre>'))
        assertEq(blurred, 1)
        let prevented = 0
        d.dispatch('keydown', { target, key: ' ', preventDefault: () => { prevented += 1 } })
        await settle()
        assertEq(prevented, 1)
        assertEq(blurred, 1)
        d.dispatch('keydown', { target, key: 'Escape', preventDefault: () => { prevented += 1 } })
        assertEq(prevented, 1)
        const field = d.root.querySelector('[name="x"]')
        field.min = '-1'
        field.max = '3'
        const svg = {
            getAttribute: (/** @type {string} */ name) => new Map([['data-demo-x-min', '-2'], ['data-demo-x-max', '4'], ['data-demo-x-left', '0'], ['data-demo-x-right', '600']]).get(name),
            getScreenCTM: () => ({ inverse: () => ({}) }),
            createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x } } }),
        }
        const handle = { getAttribute: () => 'x', closest: () => svg }
        const pointerTarget = { closest: () => handle }
        d.dispatch('pointerdown', { target: pointerTarget, pointerId: 1, preventDefault: () => {} })
        assert(d.steps.includes('capture 1'))
        d.dispatch('pointermove', { pointerId: 2, clientX: 300, clientY: 0 })
        d.dispatch('pointermove', { pointerId: 1, clientX: 800, clientY: 0 })
        await settle()
        assert(d.root.innerHTML.includes('<pre>3.000</pre>'))
        d.dispatch('pointerup', {})
        d.dispatch('pointermove', { pointerId: 1, clientX: 0, clientY: 0 })
        await settle()
        assert(d.root.innerHTML.includes('<pre>3.000</pre>'))
    },
    automaticEvents: async () => {
        const d = dom(incremental(3))
        await startDemo(d.root)
        await settle()
        const before = d.steps.length
        d.click('go')
        for (let i = 0; i < 10 && !d.root.innerHTML.includes('<pre>3</pre>'); i += 1) { await settle() }
        assert(d.root.innerHTML.includes('<pre>3</pre>'), d.root.innerHTML)
        assert(d.root.innerHTML.includes('>Go</button>'), d.root.innerHTML)
        // Only the reader's click disables controls; automatic turns allow Stop.
        assertEq(d.steps.slice(before).filter((/** @type {string} */ s) => s === 'disabled').length, 1)
        const rendered = d.rendered.length
        await settle()
        assertEq(d.rendered.length, rendered)
    },
    /**
     * **`nextDelay` holds a state on screen.** The automatic event waits
     * that long: a turn later it has not run, and once the delay is over it
     * has. A reader's event in between cancels it, as it cancels any
     * scheduled turn.
     */
    /**
     * **A checkbox reports whether it is checked**: its value when it is,
     * nothing when it is not, though its value is the same either way.
     */
    checkboxInput: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: '',
    update: state => event => () => ['ok', event.kind === 'input' ? \`\${event.name}=\${event.value}\` : state],
    view: state => ['div', ['pre', state]],
}
`))
        await startDemo(d.root)
        await settle()
        d.toggle('animate', false)
        await settle()
        assert(d.root.innerHTML.includes('<pre>animate=</pre>'), d.root.innerHTML)
        d.toggle('animate', true)
        await settle()
        assert(d.root.innerHTML.includes('<pre>animate=on</pre>'), d.root.innerHTML)
    },
    delayedEvents: async () => {
        const source = moduleUrl(`
export const demo = {
    init: 'still',
    nextEvent: state => state === 'held' ? { kind: 'click', name: 'later' } : null,
    nextDelay: () => 300,
    update: state => event => () => ['ok', event.kind === 'click' ? (event.name === 'hold' ? 'held' : event.name) : state],
    view: state => ['div', ['button', { type: 'button', name: 'hold' }, 'Hold'], ['button', { type: 'button', name: 'other' }, 'Other'], ['pre', state]],
}
`)
        /** @type {(ms: number) => Promise<void>} */
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
        const d = dom(source)
        await startDemo(d.root)
        await settle()
        d.click('hold')
        await settle()
        // Still held a while after: a runtime that ignored the delay would
        // have run the next event by now. The delay is long enough that a
        // slow host still checks well inside it.
        await sleep(20)
        await settle()
        assert(d.root.innerHTML.includes('<pre>held</pre>'), d.root.innerHTML)
        await sleep(400)
        await settle()
        assert(d.root.innerHTML.includes('<pre>later</pre>'), d.root.innerHTML)
        // A reader's click during the wait cancels the automatic event.
        const e = dom(source)
        await startDemo(e.root)
        await settle()
        e.click('hold')
        await settle()
        e.click('other')
        await settle()
        await sleep(400)
        await settle()
        assert(e.root.innerHTML.includes('<pre>other</pre>'), e.root.innerHTML)
        // A reader who asked for less motion is not held: the next event
        // runs at once.
        const r = dom(source)
        const view = r.root.ownerDocument.defaultView
        r.root.ownerDocument.defaultView = { ...view, matchMedia: (/** @type {string} */ query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }) }
        await startDemo(r.root)
        await settle()
        r.click('hold')
        await settle()
        await sleep(20)
        await settle()
        assert(r.root.innerHTML.includes('<pre>later</pre>'), r.root.innerHTML)
    },
    automaticInputKeepsControls: async () => {
        const d = dom(incremental(20))
        await startDemo(d.root)
        await settle()
        try {
            d.click('go')
            await settle()
            await settle()
            const before = d.steps.length
            d.input('text', 'changed')
            const during = await new Promise(resolve => setTimeout(() => resolve(d.disabled()), 0))
            assertStructurallySame(during, [false])
            await settle()
            assert(!d.steps.slice(before).includes('disabled'))
            assert(d.root.innerHTML.includes('>Go</button>'), d.root.innerHTML)
        } finally {
            d.input('text', '')
            await settle()
        }
    },
    automaticEventsStop: async () => {
        const d = dom(incremental(20))
        await startDemo(d.root)
        await settle()
        try {
            d.click('go')
            await settle()
            await settle()
            assert(d.root.innerHTML.includes('>Stop</button>'), d.root.innerHTML)
            assertStructurallySame(d.disabled(), [false])
            d.click('go')
            await settle()
            await settle()
            const stopped = d.root.innerHTML
            assert(stopped.includes('>Go</button>'), stopped)
            await settle()
            assertEq(d.root.innerHTML, stopped)
            d.click('go')
            await settle()
            d.input('text', 'changed')
            await settle()
            await settle()
            const edited = d.root.innerHTML
            assert(edited.includes('>Go</button>'), edited)
            await settle()
            assertEq(d.root.innerHTML, edited)
        } finally {
            d.input('text', '')
            await settle()
        }
    },
    copyCode: async () => {
        const d = dom(echo)
        /** @type {string[]} */
        const copied = []
        d.root.ownerDocument.defaultView = { ...d.root.ownerDocument.defaultView, navigator: { clipboard: {
            writeText: async (/** @type {string} */ text) => { copied.push(text) },
        } } }
        await startDemo(d.root)
        await settle()
        const renders = d.rendered.length
        const button = d.click('', { copy: "hello ' world", nested: true })
        assertEq(button.disabled, false)
        assertEq(button.attributes['aria-disabled'], 'true')
        button.activate()
        await settle()
        assertStructurallySame(copied, ["hello ' world"])
        assertEq(button.status.textContent, 'Copied!')
        assertEq(button.title, 'Copy')
        assertEq(button.attributes['data-copy-feedback'], 'copied')
        assertEq(button.disabled, false)
        assertEq(button.attributes['aria-disabled'], undefined)
        assertEq(d.rendered.length, renders)
        d.click('', { copy: '', disabled: true })
        await settle()
        assertEq(copied.length, 1)
        const empty = d.click('', { copy: '' })
        await settle()
        assertStructurallySame(copied, ["hello ' world", ''])
        assertEq(empty.status.textContent, 'Copied!')
        d.resetCopies()
        assertEq(button.title, 'Copy')
        assertEq(button.status.textContent, '')
        assertEq(button.attributes['data-copy-feedback'], undefined)
    },
    copyUnavailable: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        const button = d.click('', { copy: 'hello' })
        await settle()
        assertEq(button.status.textContent, 'Copy unavailable')
        assertEq(button.attributes['data-copy-feedback'], 'failed')
        assertEq(button.disabled, false)
        assert(!d.root.textContent.startsWith('demo failed'))
        d.resetCopies()
        assertEq(button.status.textContent, '')
        assertEq(button.title, 'Copy')
        assertEq(button.attributes['data-copy-feedback'], undefined)
    },
    copyDenied: async () => {
        const d = dom(echo)
        d.root.ownerDocument.defaultView = { ...d.root.ownerDocument.defaultView, navigator: { clipboard: {
            writeText: async () => { throw new Error('denied') },
        } } }
        await startDemo(d.root)
        await settle()
        const button = d.click('', { copy: 'hello' })
        await settle()
        assertEq(button.status.textContent, 'Copy failed')
        assertEq(button.attributes['data-copy-feedback'], 'failed')
        assertEq(button.disabled, false)
        assert(!d.root.textContent.startsWith('demo failed'))
        d.resetCopies()
        assertEq(button.status.textContent, '')
        assertEq(button.title, 'Copy')
        assertEq(button.attributes['data-copy-feedback'], undefined)
    },
    copyWithoutWindow: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        d.root.ownerDocument.defaultView = null
        d.click('', { copy: 'hello' })
        await settle()
        assert(d.root.textContent.startsWith('demo failed'))
        assert(d.root.textContent.includes('copy control has no window'))
    },
    /**
     * **The build's first view is taken over as it is**, with what the reader
     * typed into it while the runtime loaded: the field keeps its element and
     * its text, and the demo hears the text after `start`, as if typed then.
     * Rendering `init` again would have put the field back to its markup.
     */
    takesOverThePrerenderedView: async () => {
        const d = dom(echo)
        d.root.replaceChildren(toDom(d.root.ownerDocument,
            ['div', ['input', { name: 'text', value: '' }], ['pre', '']]))
        const field = d.named('text')
        field.type('typed early')
        await startDemo(d.root)
        assertEq(d.named('text').value, 'typed early')
        await settle()
        assertEq(d.named('text'), field)
        assertEq(field.value, 'typed early')
        assert(d.root.innerHTML.includes('<pre>typed early</pre>'), d.root.innerHTML)
    },
    /**
     * **A radio counts once it is the one checked**, not the one the reader
     * unchecked: fields are taken in document order, so a choice written
     * before the default would otherwise be followed by the default's value,
     * and the demo would end on the old choice.
     */
    takesOverARadioBeforeTheDefault: async () => {
        const { d, fields } = prerendered([
            ['input', { type: 'radio', name: 'r', value: 'a' }],
            ['input', { type: 'radio', name: 'r', value: 'b', checked: '' }]])
        const [a, b] = fields()
        a.checked = true
        b.checked = false
        await startDemo(d.root)
        await settle()
        assert(d.root.innerHTML.includes('<pre>r=a</pre>'), d.root.innerHTML)
    },
    // A select the reader changed is heard with its selected option's value.
    takesOverASelect: async () => {
        const { d } = prerendered([['select', { name: 's' },
            ['option', { value: 'x', selected: '' }, 'x'],
            ['option', { value: 'y' }, 'y']]])
        const [x, y] = d.named('s').options
        x.selected = false
        y.selected = true
        await startDemo(d.root)
        await settle()
        assert(d.root.innerHTML.includes('<pre>s=y</pre>'), d.root.innerHTML)
    },
    // A file input's value is the reader's pick, never a demo's input.
    takesOverWithoutAFile: async () => {
        const { d } = prerendered([['input', { type: 'file', name: 'f' }]])
        d.named('f').type('C:\\fakepath\\a.txt')
        await startDemo(d.root)
        await settle()
        assert(d.root.innerHTML.includes('<pre></pre>'), d.root.innerHTML)
    },
    /**
     * **The build's disabled buttons come alive with the first render.** The
     * build disables them because a click before the runtime loads goes
     * nowhere; the render after `start` makes the attributes the demo's own.
     */
    enablesThePrerenderedActions: async () => {
        const { d } = prerendered(
            [['button', { type: 'button', name: 'go' }, 'go']],
            [['button', { type: 'button', name: 'go', disabled: '' }, 'go']])
        assertStructurallySame(d.disabled(), [true])
        await startDemo(d.root)
        await settle()
        assertStructurallySame(d.disabled(), [false])
    },
    // A pointer control the build marked `aria-disabled` loses the mark the
    // same way, which is what lets the stylesheet give it the pointer back.
    unmarksThePrerenderedPointerActions: async () => {
        const { d } = prerendered(
            [['span', { 'data-demo-click': 'p' }, 'p']],
            [['span', { 'data-demo-click': 'p', 'aria-disabled': 'true' }, 'p']])
        assert(d.root.innerHTML.includes('aria-disabled="true"'), d.root.innerHTML)
        await startDemo(d.root)
        await settle()
        assert(!d.root.innerHTML.includes('aria-disabled'), d.root.innerHTML)
    },
    // A field the reader left alone is not an event, and nor is a button.
    takesOverWithoutEdits: async () => {
        const d = dom(echo)
        d.root.replaceChildren(toDom(d.root.ownerDocument,
            ['div', ['input', { name: 'text', value: 'kept' }], ['button', { name: 'go' }, 'go'], ['pre', 'kept']]))
        await startDemo(d.root)
        await settle()
        assert(d.root.innerHTML.includes('<pre></pre>'), d.root.innerHTML)
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
     * **A keystroke shows in a highlighted field at once, and the colours
     * around it stay.** The textarea's own text is transparent, so its
     * coloured copy is the only text the reader sees, and the render that
     * colours it comes after the demo's work and the inputs queued before it.
     * The edit is made in the one text node it falls in, in the turn of the
     * event; the render then recolours it for what it is.
     */
    echoesATypedValue: async () => {
        const d = dom(highlighted)
        await startDemo(d.root)
        await settle()
        const mirror = () => d.root.firstElementChild.childNodes[0].childNodes[0]
        assertEq(mirror().childNodes.length, 3)
        const [keyword, tail] = mirror().childNodes
        // typed inside the keyword: the keyword's own node takes it, and
        // nothing else is touched
        d.input('text', 'aX b', 2)
        assertEq(mirror().textContent, 'aX b\u200b')
        assert(mirror().childNodes[0] === keyword && mirror().childNodes[1] === tail, 'the nodes are the same')
        assertEq(keyword.childNodes[0].data, 'aX')
        assertEq(tail.data, ' b')
        // typed in the plain tail: the tail takes it, and the keyword is untouched
        d.input('text', 'aX bc', 5)
        assertEq(mirror().textContent, 'aX bc\u200b')
        assertEq(mirror().childNodes[0].childNodes[0].data, 'aX')
        assertEq(mirror().childNodes[1].data, ' bc')
        await settle()
        // after the render: coloured for what it is
        assertEq(mirror().textContent, 'aX bc\u200b')
        assertEq(mirror().childNodes[0].localName, 'span')
    },
    /**
     * **The caret says which of equal characters is new.** Typing `a` before
     * the `a`s of `aaa` leaves `aaaa`, and the new `a` could be any of them,
     * across the border between the keyword and the plain text. It is the one
     * the caret is after.
     */
    echoesIntoARunOfEqualCharacters: async () => {
        const d = dom(highlighted)
        await startDemo(d.root)
        await settle()
        const mirror = () => d.root.firstElementChild.childNodes[0].childNodes[0]
        d.input('text', 'aaa', 3)
        await settle()
        assertEq(mirror().childNodes[0].childNodes[0].data, 'a')
        assertEq(mirror().childNodes[1].data, 'aa')
        d.input('text', 'aaaa', 1)
        assertEq(mirror().childNodes[0].childNodes[0].data, 'aa')
        assertEq(mirror().childNodes[1].data, 'aa')
    },
    // A deletion inside one node is made there too.
    echoesADeletion: async () => {
        const d = dom(highlighted)
        await startDemo(d.root)
        await settle()
        const mirror = () => d.root.firstElementChild.childNodes[0].childNodes[0]
        const tail = mirror().childNodes[1]
        d.input('text', 'ab', 1)
        assertEq(mirror().textContent, 'ab\u200b')
        assert(mirror().childNodes[1] === tail && tail.data === 'b', 'the tail lost its space')
    },
    /**
     * **An edit across tokens is shown as plain text**, and an edit into an
     * empty copy is made in its terminator: no colour is right for what
     * replaces text that spans two tokens, and the render colours it.
     */
    echoesAnEditAcrossTokens: async () => {
        const d = dom(highlighted)
        await startDemo(d.root)
        await settle()
        const mirror = () => d.root.firstElementChild.childNodes[0].childNodes[0]
        d.input('text', '', 0)
        assertEq(mirror().childNodes.length, 1)
        assertEq(mirror().textContent, '\u200b')
        // into the empty copy: its one node takes the text
        const only = mirror().childNodes[0]
        d.input('text', 'x', 1)
        assertEq(mirror().textContent, 'x\u200b')
        assert(mirror().childNodes[0] === only, 'the terminator took it')
    },
    // A copy that does not end in its terminator is not trusted: it is
    // written again as plain text.
    echoesIntoACopyWithoutItsTerminator: async () => {
        const d = dom(highlighted)
        await startDemo(d.root)
        await settle()
        const mirror = () => d.root.firstElementChild.childNodes[0].childNodes[0]
        mirror().childNodes[2].data = 'Q'
        d.input('text', 'aX b', 2)
        assertEq(mirror().childNodes.length, 1)
        assertEq(mirror().textContent, 'aX b\u200b')
    },
    /**
     * **The copy follows the textarea's scroll**, as the reader scrolls and
     * across a render, which puts the textarea back where it was and may
     * change what the copy holds.
     */
    followsTheScroll: async () => {
        const d = dom(highlighted)
        await startDemo(d.root)
        await settle()
        const field = () => d.root.querySelector('[name="text"]')
        const mirror = () => d.root.firstElementChild.childNodes[0].childNodes[0]
        field().scrollTop = 120
        field().scrollLeft = 30
        d.scroll('text')
        assertEq(mirror().scrollTop, 120)
        assertEq(mirror().scrollLeft, 30)
        // a render: the textarea is put back, and the copy follows it
        field().scrollTop = 200
        d.input('text', 'ab')
        await settle()
        assertEq(field().scrollTop, 200)
        assertEq(mirror().scrollTop, 200)
        assertEq(mirror().scrollLeft, 30)
    },
    /**
     * **A render that builds the copy anew puts it back where the textarea
     * is**, with no input event to echo: a fresh element starts scrolled to the
     * top.
     */
    followsTheScrollAfterARenderWithoutInput: async () => {
        const d = dom(highlighted)
        await startDemo(d.root)
        await settle()
        const field = () => d.root.querySelector('[name="text"]')
        const mirror = () => d.root.firstElementChild.childNodes[0].childNodes[0]
        field().scrollTop = 150
        const before = mirror()
        d.click('more')
        await settle()
        assert(mirror() !== before, 'the copy was built anew')
        assertEq(field().scrollTop, 150)
        assertEq(mirror().scrollTop, 150)
    },
    // A scroll in a field that has no copy, or that is no highlighted field,
    // is none of the runtime's business.
    ignoresAScrollOutsideAHighlightedField: async () => {
        const d = dom(echo)
        await startDemo(d.root)
        await settle()
        const renders = d.rendered.length
        d.scroll('text')
        d.input('text', 'x')
        await settle()
        assert(d.rendered.length > renders)
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
    /**
     * **A demo may ask for random bits.** The runtime answers `randomInt`
     * with the shared handler, a whole number in `[0, 2^32)`: the demo
     * dispatches it as a `Do` node, spelled out because a fixture imports
     * nothing, and shows whether the answer was one.
     */
    answersRandomInt: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: 'idle',
    update: state => event => event.kind !== 'click' ? () => ['ok', state] : {
        command: 'randomInt',
        payload: [],
        continuation: r => () => ['ok', r[0] === 'ok' && Number.isInteger(r[1]) && r[1] >= 0 && r[1] < 0x1_0000_0000 ? 'random' : 'not: ' + JSON.stringify(r)],
    },
    view: text => ['div', ['button', { type: 'button', name: 'roll' }, 'Roll'], ['pre', text]],
}
`))
        await startDemo(d.root)
        await settle()
        d.click('roll')
        await settle()
        assert(d.root.innerHTML.includes('<pre>random</pre>'), d.root.innerHTML)
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
     * **A field keeps its size, focus and scroll whatever its name holds.** A
     * demo names its fields freely, and a quote or a line break in a name is
     * not selector text — a lookup that put the name in a selector would find
     * nothing, or throw and abort the render. The field here moves, so it is a
     * new element, and every kind of memory has to find it again by name.
     */
    keepsAFieldWhoseNameIsNotSelectorText: async () => {
        for (const name of ['say "hi"', 'two\nlines']) {
            const d = dom(moduleUrl(`
const name = ${JSON.stringify(name)}
export const demo = {
    init: '',
    update: state => event => () => ['ok', event.kind === 'input' ? event.value : state],
    view: text => text === 'shift'
        ? ['div', ['p', 'moved'], ['input', { name, value: text }]]
        : ['div', ['input', { name, value: text }], ['pre', text]],
}
`))
            await startDemo(d.root)
            await settle()
            const before = d.named(name)
            before.style.width = '600px'
            before.style.height = '300px'
            before.scrollTop = 120
            before.scrollLeft = 30
            d.focusOn(name, 3)
            d.input(name, 'shift')
            await settle()
            assert(!d.root.textContent.startsWith('demo failed'), d.root.textContent)
            const after = d.named(name)
            assert(after !== before, 'expected the field to be a new element')
            assertEq(after.style.width, '600px')
            assertEq(after.style.height, '300px')
            assertEq(d.activeName(), name)
            assertEq(d.caret(), 3)
            assertEq(after.scrollTop, 120)
            assertEq(after.scrollLeft, 30)
        }
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
    preservesDisabledActions: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: 'waiting',
    update: state => event => () => ['ok', event.kind === 'input' ? event.value : state],
    view: state => ['div',
        ['input', { name: 'text', value: state }],
        ['button', { name: 'go', ...(state === 'ready' ? {} : { disabled: '' }) }, 'Go'],
    ],
}
`))
        await startDemo(d.root)
        await settle()
        assertStructurallySame(d.disabled(), [true])
        d.input('text', 'ready')
        await settle()
        assertStructurallySame(d.disabled(), [false])
        d.input('text', 'invalid')
        await settle()
        assertStructurallySame(d.disabled(), [true])
    },
    saysItIsWorking: async () => {
        const d = dom(moduleUrl(`
export const demo = {
    init: 'idle',
    update: state => event => () => ['ok', event.kind === 'click' ? 'done' : state],
    view: text => ['div', ['button', { type: 'button', name: 'go' }, 'Go'], ['pre', text]],
}
`))
        await startDemo(d.root)
        assert(d.working(), 'start must mark the page while its update runs')
        assertStructurallySame(d.disabled(), [true])
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
