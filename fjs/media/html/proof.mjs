/**
 * Proofs for the DOM renderer, driven against a DOM stand-in.
 *
 * A `.mjs` and not a `.f.mjs`: a renderer into a host can only be proven
 * against a stand-in for that host — the same bargain
 * `emergent_testing/browser/proof.mjs` makes. The stand-in records what it was
 * asked for and nothing else: the namespace each element was created in, its
 * attributes, its children in order, and — for `patch` — every change made to
 * an element that already existed.
 *
 * @import { Element as HtmlElement } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { fill, macrotask, patch, toDom } from './module.mjs'

const xhtml = 'http://www.w3.org/1999/xhtml'

const svg = 'http://www.w3.org/2000/svg'

/**
 * A document that creates recording elements. A factory so the mutually
 * recursive element and document types stay function-local.
 *
 * @type {() => any}
 */
const dom = () => {
    /**
     * Every change made through the stand-in, in order: what a proof reads to
     * say that a patch left something alone.
     *
     * @type {string[]}
     */
    const log = []
    /** @type {(data: string) => any} */
    const text = data => {
        /** @type {any} */
        const self = {
            nodeType: 3,
            get data() { return data },
            set data(/** @type {string} */ value) { data = value; log.push(`data ${value}`) },
        }
        return self
    }
    /** @type {(node: any) => any} */
    const node = n => typeof n === 'string' ? text(n) : n
    /** @type {any} */
    const document = {
        log,
        createTextNode: text,
        createElementNS: (/** @type {string} */ namespaceURI, /** @type {string} */ localName) => {
            /**
             * A form control's shown state: its default until something sets
             * it, as a browser's is until the reader edits it.
             *
             * @type {Map<string, unknown>}
             */
            const shown = new Map()
            /** @type {(name: string, fallback: () => unknown) => PropertyDescriptor} */
            const control = (name, fallback) => ({
                get: () => shown.has(name) ? shown.get(name) : fallback(),
                set: value => { shown.set(name, value); log.push(`${name} ${value}`) },
                enumerable: true,
            })
            /** @type {any} */
            const self = {
                nodeType: 1,
                localName,
                namespaceURI,
                ownerDocument: document,
                attributes: new Map(),
                children: [],
                // The namespace each attribute was set in: `null` for a plain
                // `setAttribute`, as the DOM reports it.
                namespaces: new Map(),
                setAttribute: (/** @type {string} */ name, /** @type {string} */ value) => {
                    self.attributes = new Map([...self.attributes, [name, value]])
                    self.namespaces = new Map([...self.namespaces, [name, null]])
                    log.push(`set ${name}`)
                },
                setAttributeNS: (/** @type {string} */ namespace, /** @type {string} */ name, /** @type {string} */ value) => {
                    self.attributes = new Map([...self.attributes, [name, value]])
                    self.namespaces = new Map([...self.namespaces, [name, namespace]])
                },
                replaceChildren: (/** @type {any[]} */ ...nodes) => { self.children = nodes.map(node) },
                get childNodes() { return self.children },
                appendChild: (/** @type {any} */ n) => {
                    self.children = [...self.children, n]
                    log.push('append')
                },
                replaceChild: (/** @type {any} */ n, /** @type {any} */ old) => {
                    self.children = self.children.map((/** @type {any} */ c) => c === old ? n : c)
                    log.push('replace')
                },
                removeChild: (/** @type {any} */ old) => {
                    self.children = self.children.filter((/** @type {any} */ c) => c !== old)
                    log.push('remove')
                },
                // A `template`'s own fragment, as an HTML template has one.
                content: /** @type {any} */ ({
                    children: [],
                    replaceChildren(/** @type {any[]} */ ...nodes) { this.children = nodes.map(node) },
                }),
                getAttribute: (/** @type {string} */ name) => self.attributes.get(name) ?? null,
                getAttributeNames: () => [...self.attributes.keys()],
                removeAttribute: (/** @type {string} */ name) => {
                    self.attributes = new Map([...self.attributes].filter(([k]) => k !== name))
                    log.push(`remove ${name}`)
                },
            }
            Object.defineProperties(self, {
                defaultValue: {
                    get: () => localName === 'textarea'
                        ? self.children.map((/** @type {any} */ c) => c.data).join('')
                        : self.attributes.get('value') ?? '',
                },
                value: control('value', () => self.defaultValue),
                defaultChecked: { get: () => self.attributes.has('checked') },
                checked: control('checked', () => self.defaultChecked),
                defaultSelected: { get: () => self.attributes.has('selected') },
                selected: control('selected', () => self.defaultSelected),
            })
            return self
        },
    }
    return document
}

/**
 * Builds `element` in a fresh stand-in document, answered as the stand-in so a
 * proof can read what it recorded.
 *
 * @type {(element: HtmlElement) => any}
 */
const build = element => toDom(dom(), element)

/**
 * Builds `element` in `document`, answered as the stand-in: what a `patch`
 * proof builds first and then changes.
 *
 * @type {(document: any, element: HtmlElement) => any}
 */
const built = (document, element) => toDom(document, element)

/**
 * What a rendered node is, as data a proof can compare: a string is itself,
 * an element its name, namespace, attributes and children.
 *
 * @type {(node: any) => unknown}
 */
const shape = node => node.nodeType === 3
    ? node.data
    : [node.localName, node.namespaceURI, Object.fromEntries(node.attributes), ...node.children.map(shape)]

/**
 * The namespace of the first element on the path down through first element
 * children — the one element a case below is about.
 *
 * @type {(node: any) => string}
 */
const innermost = node => {
    const child = node.children.find((/** @type {any} */ c) => c.nodeType !== 3)
    return child === undefined ? node.namespaceURI : innermost(child)
}

export const proof = {
    // Text and elements keep the positions the element gives them.
    mixedContentKeepsItsOrder: () => {
        const node = toDom(dom(), ['p', { class: 'x' }, 'a ', ['code', 'b'], ' c'])
        assertStructurallySame(shape(node),
            ['p', xhtml, { class: 'x' }, 'a ', ['code', xhtml, {}, 'b'], ' c'])
    },
    /**
     * **An `svg` subtree is SVG**, as the HTML parser would have made it: an
     * HTML element named `svg` renders nothing. Its descendants inherit the
     * namespace, and `foreignObject` hands its children back to HTML.
     */
    svgIsInItsNamespace: () => {
        const node = toDom(dom(), ['div',
            ['svg', { viewBox: '0 0 1 1' }, ['g', ['foreignObject', ['p', 't']]]]])
        assertStructurallySame(shape(node),
            ['div', xhtml, {},
                ['svg', svg, { viewBox: '0 0 1 1' },
                    ['g', svg, {}, ['foreignObject', svg, {}, ['p', xhtml, {}, 't']]]]])
    },
    // `math` enters MathML the same way.
    mathIsInItsNamespace: () => {
        const node = toDom(dom(), ['math', ['mi', 'x']])
        assertStructurallySame(shape(node),
            ['math', 'http://www.w3.org/1998/Math/MathML', {}, ['mi', 'http://www.w3.org/1998/Math/MathML', {}, 'x']])
    },
    /**
     * **Foreign content does not switch again.** The HTML parser enters SVG or
     * MathML only from HTML, so a `math` inside an `svg` is an SVG element
     * named `math`, and an `svg` inside a `math` is MathML.
     */
    foreignContentKeepsItsNamespace: () => {
        const mathMl = 'http://www.w3.org/1998/Math/MathML'
        assertStructurallySame(shape(toDom(dom(), ['svg', ['math', ['mi', 'x']]])),
            ['svg', svg, {}, ['math', svg, {}, ['mi', svg, {}, 'x']]])
        assertStructurallySame(shape(toDom(dom(), ['math', ['svg']])),
            ['math', mathMl, {}, ['svg', mathMl, {}]])
    },
    /**
     * **Below an integration point the parser returns to HTML**, and only
     * there. The cases are the standard's whole list, each with the innermost
     * element's namespace the parser gives it, checked against Chromium's.
     *
     * A case that stays foreign uses `foo`, not `span`: `span` is one of the
     * HTML tags the parser moves out of SVG and MathML altogether, the rule
     * this module does not copy.
     */
    integrationPointsReturnToHtml: () => {
        const mathMl = 'http://www.w3.org/1998/Math/MathML'
        /** @type {readonly (readonly [HtmlElement, string])[]} */
        const cases = [
            // SVG: `foreignObject`, `desc` and `title`.
            [['svg', ['foreignObject', ['span']]], xhtml],
            [['svg', ['desc', ['span']]], xhtml],
            [['svg', ['title', ['span']]], xhtml],
            [['svg', ['g', ['foo']]], svg],
            // MathML text integration points, except `mglyph` and `malignmark`.
            [['math', ['mi', ['span']]], xhtml],
            [['math', ['mo', ['span']]], xhtml],
            [['math', ['mn', ['span']]], xhtml],
            [['math', ['ms', ['span']]], xhtml],
            [['math', ['mtext', ['span']]], xhtml],
            [['math', ['mi', ['mglyph']]], mathMl],
            [['math', ['mi', ['malignmark']]], mathMl],
            [['math', ['mrow', ['foo']]], mathMl],
            // HTML's rules there include entering SVG.
            [['math', ['mi', ['svg', ['g']]]], svg],
            // `annotation-xml`: HTML by its `encoding`, in any case; SVG always.
            [['math', ['annotation-xml', { encoding: 'text/html' }, ['span']]], xhtml],
            [['math', ['annotation-xml', { encoding: 'Application/XHTML+XML' }, ['span']]], xhtml],
            [['math', ['annotation-xml', { encoding: 'text/plain' }, ['foo']]], mathMl],
            [['math', ['annotation-xml', ['foo']]], mathMl],
            [['math', ['annotation-xml', ['svg', ['g']]]], svg],
            // A name is an integration point only in its own namespace.
            [['math', ['foreignObject', ['foo']]], mathMl],
            [['svg', ['mi', ['foo']]], svg],
        ]
        for (const [element, namespace] of cases) {
            assertEq(innermost(toDom(dom(), element)), namespace)
        }
    },
    /**
     * **The serializer's rules for content**, so an element reads the same
     * built or serialized: a void element gets no children, and a `style`
     * only its text, element children dropped and `</` escaped.
     */
    voidAndRawTextFollowTheSerializer: () => {
        assertStructurallySame(shape(toDom(dom(), ['br', { id: 'x' }, 'text', ['b']])),
            ['br', xhtml, { id: 'x' }])
        assertStructurallySame(shape(toDom(dom(), ['style', 'a{}', ['span', 'dropped'], '</style>'])),
            ['style', xhtml, {}, 'a{}<\\/style>'])
        // No text, no node: the parser makes none for `<style></style>`.
        assertStructurallySame(shape(toDom(dom(), ['style', ['span']])), ['style', xhtml, {}])
    },
    /**
     * **A `script` is refused**, in either namespace and by either entry
     * point: built and connected, it would run, where the `innerHTML` it
     * replaces left it inert.
     */
    throw: {
        script: () => toDom(dom(), ['div', ['script', 'alert(1)']]),
        svgScript: () => toDom(dom(), ['svg', ['script', 'alert(1)']]),
        fillScript: () => fill(toDom(dom(), ['div']), ['script', 'alert(1)']),
        patchScript: () => patch(toDom(dom(), ['div']), ['script', 'alert(1)']),
    },
    /**
     * **On an SVG or MathML element, the parser's namespaced attributes go
     * into their namespaces**, and everything else is set as written: on HTML,
     * a name not on the list, and a name whose case differs from it.
     */
    foreignAttributesAreNamespaced: () => {
        const xlink = 'http://www.w3.org/1999/xlink'
        const xml = 'http://www.w3.org/XML/1998/namespace'
        const xmlns = 'http://www.w3.org/2000/xmlns/'
        const use = build(['svg', { xmlns: svg, 'xmlns:xlink': xlink }, ['use', {
            'xlink:href': '#a', 'xlink:actuate': 'x', 'xlink:arcrole': 'x', 'xlink:role': 'x',
            'xlink:show': 'x', 'xlink:title': 'x', 'xlink:type': 'x',
            'xml:lang': 'en', 'xml:space': 'preserve', 'xlink:other': 'x', 'XLINK:HREF': 'x', href: '#b',
        }]])
        assertStructurallySame(Object.fromEntries(use.namespaces), { xmlns, 'xmlns:xlink': xmlns })
        assertStructurallySame(Object.fromEntries(use.children[0].namespaces), {
            'xlink:href': xlink, 'xlink:actuate': xlink, 'xlink:arcrole': xlink, 'xlink:role': xlink,
            'xlink:show': xlink, 'xlink:title': xlink, 'xlink:type': xlink,
            'xml:lang': xml, 'xml:space': xml, 'xlink:other': null, 'XLINK:HREF': null, href: null,
        })
        const math = build(['math', { 'xlink:href': '#a' }])
        assertEq(math.namespaces.get('xlink:href'), xlink)
        const a = build(['a', { 'xlink:href': '#a' }])
        assertEq(a.namespaces.get('xlink:href'), null)
    },
    /**
     * **A `template`'s children go into its `content`**, where the parser puts
     * them and where cloning reads them; the element itself keeps none. Only
     * an HTML `template` has one: in SVG it is an ordinary name.
     */
    templateFillsItsContent: () => {
        const template = build(['template', ['p', 'x']])
        assertStructurallySame(template.children, [])
        assertStructurallySame(template.content.children.map(shape), [['p', xhtml, {}, 'x']])
        const inSvg = build(['svg', ['template', ['g']]])
        assertStructurallySame(shape(inSvg.children[0]), ['template', svg, {}, ['g', svg, {}]])
    },
    /**
     * **`fill` replaces the children and adds to the attributes.** What lets a
     * pending row settle in place: its old text goes, and an attribute the new
     * element does not name stays.
     */
    fillReplacesChildrenAndAddsAttributes: () => {
        const document = dom()
        const target = toDom(document, ['li', { 'data-id': '1', 'data-status': 'pending' }, 'waiting', ['span', '…']])
        const answer = fill(target, ['li', { 'data-status': 'pass' }, 'PASS'])
        assertEq(answer, target)
        assertStructurallySame(shape(target),
            ['li', xhtml, { 'data-id': '1', 'data-status': 'pass' }, 'PASS'])
    },
    // Inside an SVG target, a filled child stays SVG.
    fillInheritsTheTargetNamespace: () => {
        const target = toDom(dom(), ['svg'])
        fill(target, ['svg', ['circle']])
        assertStructurallySame(shape(target), ['svg', svg, {}, ['circle', svg, {}]])
    },
    /**
     * **`patch` keeps what matches and replaces what does not.** An element of
     * the same tag is the same node afterwards, and so is a text node; an
     * element of another tag is replaced, extra children go, missing ones are
     * appended, and the attributes become exactly the element's.
     */
    patchKeepsWhatMatches: () => {
        const document = dom()
        const target = built(document, ['div', { id: 'd', class: 'old' }, ['input', { name: 'a' }], 'hi', ['p', 't'], ['b']])
        const [input, hi] = target.children
        const answer = patch(target, ['div', { class: 'new', title: 't' }, ['input', { name: 'a' }], 'ho', ['span', 's'], ['b']])
        assertEq(answer, target)
        assertEq(target.children[0], input)
        assertEq(target.children[1], hi)
        assertStructurallySame(shape(target),
            ['div', xhtml, { class: 'new', title: 't' }, ['input', xhtml, { name: 'a' }], 'ho', ['span', xhtml, {}, 's'], ['b', xhtml, {}]])
        patch(target, ['div', ['input', { name: 'a' }]])
        assertStructurallySame(shape(target), ['div', xhtml, {}, ['input', xhtml, { name: 'a' }]])
        patch(target, ['div', ['input', { name: 'a' }], 'x', ['i']])
        assertStructurallySame(shape(target), ['div', xhtml, {}, ['input', xhtml, { name: 'a' }], 'x', ['i', xhtml, {}]])
        assertEq(target.children[0], input)
    },
    /**
     * **What is already right is not touched**: patching an element with
     * itself changes nothing, so a field the reader holds sees no write.
     */
    patchLeavesWhatIsRight: () => {
        const document = dom()
        /** @type {HtmlElement} */
        const element = ['div', { class: 'c' }, ['label', 'L'], ['input', { name: 'a', value: 'x' }], ['textarea', 't'], 'text']
        const target = built(document, element)
        const before = document.log.length
        patch(target, element)
        assertStructurallySame(document.log.slice(before), [])
    },
    /**
     * **An HTML attribute is compared as the browser stores it.** A browser
     * lowercases an HTML attribute's name when it is set, so a view that
     * spells `TITLE` finds `title` on the element; compared as written, every
     * patch removed it and added it back. SVG keeps its case: `viewBox` is
     * not `viewbox`.
     */
    patchComparesHtmlNamesLowercase: () => {
        const document = dom()
        // The stand-in stores names as written, so it is given what a
        // browser would hold: `title`, lowercase.
        const target = built(document, ['div', { title: 'x', 'data-Ä': 'y' }, ['svg', { viewBox: '0 0 1 1' }]])
        const before = document.log.length
        patch(target, ['div', { TITLE: 'x', 'data-Ä': 'y' }, ['svg', { viewBox: '0 0 1 1' }]])
        assertStructurallySame(document.log.slice(before), [])
        patch(target, ['div', { TITLE: 'z', 'data-Ä': 'y' }, ['svg', { viewBox: '0 0 1 1' }]])
        assertEq(target.attributes.get('title'), 'z')
        assertEq(target.attributes.has('TITLE'), false)
    },
    /**
     * **A node of another kind at a position is replaced**: an element where
     * text was, text where an element was, and an element of the right tag in
     * the wrong namespace — an HTML `a` is not the SVG `a` a diagram needs.
     */
    patchReplacesAnotherKind: () => {
        const target = built(dom(), ['svg', 'x', ['g']])
        patch(target, ['svg', ['g'], 'y'])
        assertStructurallySame(shape(target), ['svg', svg, {}, ['g', svg, {}], 'y'])
        const html = built(dom(), ['div', ['a']])
        const a = html.children[0]
        patch(html, ['div', ['svg', ['a']]])
        patch(html.children[0], ['svg', ['a']])
        assertEq(html.children[0].children[0].namespaceURI, svg)
        assert(html.children[0].children[0] !== a, 'expected a new element')
        const inSvg = built(dom(), ['svg', ['g']])
        inSvg.children[0].namespaceURI = xhtml
        patch(inSvg, ['svg', ['g']])
        assertEq(inSvg.children[0].namespaceURI, svg)
    },
    // The serializer's rules for content hold for a patch too.
    patchFollowsTheSerializer: () => {
        const target = built(dom(), ['div', ['br'], ['style', 'a{}']])
        patch(target, ['div', ['br', 'text'], ['style', 'b{}', ['span']]])
        assertStructurallySame(shape(target), ['div', xhtml, {}, ['br', xhtml, {}], ['style', xhtml, {}, 'b{}']])
    },
    /**
     * **A form control shows what its markup says.** A field the reader has
     * edited shows their text, not its default, so a patch whose markup says
     * something else sets it — and one whose markup says the same leaves it:
     * that is the field under the reader's fingers.
     */
    patchShowsAControlsDefault: () => {
        const document = dom()
        const target = built(document, ['form',
            ['input', { value: 'a' }],
            ['textarea', 'a'],
            ['input', { type: 'checkbox' }],
            ['select', ['option', { selected: '' }, 'x'], ['option', 'y']],
            ['input', { type: 'file' }],
            ['p'],
        ])
        const [input, area, box, select] = target.children
        input.value = 'typed'
        area.value = 'typed'
        const before = document.log.length
        patch(target, ['form',
            ['input', { value: 'typed' }],
            ['textarea', 'typed'],
            ['input', { type: 'CheckBox', checked: '' }],
            ['select', ['option', 'x'], ['option', { selected: '' }, 'y']],
            ['input', { type: 'file', value: 'z' }],
            ['p'],
        ])
        assertEq(input.value, 'typed')
        assertEq(area.value, 'typed')
        assertEq(box.checked, true)
        assertStructurallySame(select.children.map((/** @type {any} */ o) => o.selected), [false, true])
        assert(!document.log.slice(before).some((/** @type {string} */ entry) => entry.startsWith('value')), document.log.join(', '))
        patch(target, ['form', ['input', { value: 'b' }], ['textarea', 'b']])
        assertEq(input.value, 'b')
        assertEq(area.value, 'b')
    },
    // A task queued before the yield runs before it resumes, which no
    // microtask can promise: that next task is where a paint happens.
    macrotaskYieldsToTheNextTask: async () => {
        let ran = false
        setTimeout(() => { ran = true }, 0)
        await Promise.resolve()
        assert(!ran)
        await macrotask()
        assert(ran)
    },
}
