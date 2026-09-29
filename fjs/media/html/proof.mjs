/**
 * Proofs for the DOM renderer, driven against a DOM stand-in.
 *
 * A `.mjs` and not a `.f.mjs`: a renderer into a host can only be proven
 * against a stand-in for that host — the same bargain
 * `emergent_testing/browser/proof.mjs` makes. The stand-in records what it was
 * asked for and nothing else: the namespace each element was created in, its
 * attributes, and its children in order.
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
                setAttribute: (/** @type {string} */ name, /** @type {string} */ value) => {
                    self.attributes = new Map([...self.attributes, [name, value]])
                },
                replaceChildren: (/** @type {any[]} */ ...nodes) => { self.children = nodes },
            }
            return self
        },
    }
    return document
}

/**
 * What a rendered node is, as data a proof can compare: a string is itself,
 * an element its name, namespace, attributes and children.
 *
 * @type {(node: any) => unknown}
 */
const shape = node => typeof node === 'string'
    ? node
    : [node.localName, node.namespaceURI, Object.fromEntries(node.attributes), ...node.children.map(shape)]

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
        // Only an SVG `foreignObject` returns to HTML: in MathML it is a name.
        assertStructurallySame(shape(toDom(dom(), ['math', ['foreignObject', ['mi', 'x']]])),
            ['math', mathMl, {}, ['foreignObject', mathMl, {}, ['mi', mathMl, {}, 'x']]])
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
