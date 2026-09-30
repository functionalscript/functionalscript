/**
 * Proofs for the DOM renderer, driven against a DOM stand-in.
 *
 * A `.mjs` and not a `.f.mjs`: a renderer into a host can only be proven
 * against a stand-in for that host — the same bargain
 * `emergent_testing/browser/proof.mjs` makes. The stand-in records what it was
 * asked for and nothing else: the namespace each element was created in, its
 * attributes, and its children in order.
 *
 * @import { Element as HtmlElement } from './types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { fill, toDom } from './module.mjs'

const xhtml = 'http://www.w3.org/1999/xhtml'

const svg = 'http://www.w3.org/2000/svg'

/**
 * A document that creates recording elements. A factory so the mutually
 * recursive element and document types stay function-local.
 *
 * @type {() => any}
 */
const dom = () => {
    /** @type {any} */
    const document = {
        createElementNS: (/** @type {string} */ namespaceURI, /** @type {string} */ localName) => {
            /** @type {any} */
            const self = {
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
                },
                setAttributeNS: (/** @type {string} */ namespace, /** @type {string} */ name, /** @type {string} */ value) => {
                    self.attributes = new Map([...self.attributes, [name, value]])
                    self.namespaces = new Map([...self.namespaces, [name, namespace]])
                },
                replaceChildren: (/** @type {any[]} */ ...nodes) => { self.children = nodes },
                // A `template`'s own fragment, as an HTML template has one.
                content: /** @type {any} */ ({
                    children: [],
                    replaceChildren(/** @type {any[]} */ ...nodes) { this.children = nodes },
                }),
                getAttribute: (/** @type {string} */ name) => self.attributes.get(name) ?? null,
            }
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
 * What a rendered node is, as data a proof can compare: a string is itself,
 * an element its name, namespace, attributes and children.
 *
 * @type {(node: any) => unknown}
 */
const shape = node => typeof node === 'string'
    ? node
    : [node.localName, node.namespaceURI, Object.fromEntries(node.attributes), ...node.children.map(shape)]

/**
 * The namespace of the first element on the path down through first element
 * children — the one element a case below is about.
 *
 * @type {(node: any) => string}
 */
const innermost = node => {
    const child = node.children.find((/** @type {any} */ c) => typeof c !== 'string')
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
}
