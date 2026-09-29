/**
 * Renders a `media/html` element into a DOM — the impure sibling of
 * [`./module.f.mjs`](./module.f.mjs), which renders the same element to text.
 *
 * **Built, not parsed.** A page that serialized an element and assigned the
 * string to `innerHTML` would pay for an escape on the way out and a parse on
 * the way back in, and would learn nothing either step did not already know.
 *
 * **The namespace the HTML parser would have chosen.** `innerHTML` puts an
 * `svg` subtree in the SVG namespace and a `math` subtree in MathML without
 * being asked; `createElement` would make an inert HTML element named `svg`,
 * and a diagram would render nothing. So every element is created in its
 * namespace: `svg` and `math` enter theirs from HTML, an SVG `foreignObject`
 * returns its children to HTML, and everything else inherits its parent's — a
 * `math` inside an `svg` included, which the parser keeps in SVG, and a
 * `foreignObject` inside a `math`, which is only a name there.
 *
 * @module
 *
 * @import { Element as HtmlElement } from './types.ts'
 */

const xhtml = 'http://www.w3.org/1999/xhtml'

const svg = 'http://www.w3.org/2000/svg'

const mathMl = 'http://www.w3.org/1998/Math/MathML'

/**
 * Creates the DOM element for `element` whose parent's children live in
 * `parent`, and fills it.
 *
 * @type {(document: Document, parent: string, element: HtmlElement) => Element}
 */
const create = (document, parent, element) => {
    const [tag] = element
    const namespace = parent !== xhtml ? parent : tag === 'svg' ? svg : tag === 'math' ? mathMl : xhtml
    return fill(document.createElementNS(namespace, tag), element)
}

/**
 * Writes a `media/html` element onto a DOM element — its attributes, then its
 * children — and answers the DOM element.
 *
 * **The children are replaced, in order.** Text and elements keep the
 * positions the element gives them, so `['p', 'a ', ['code', 'b'], ' c']` reads
 * as written; and what the target held before is gone, which is what lets a
 * pending row settle in place rather than gain a second line.
 *
 * **Attributes are added, not replaced.** One the element does not name is
 * left as it was.
 *
 * @type {(target: Element, element: HtmlElement) => Element}
 */
export const fill = (target, [, ...rest]) => {
    const [first] = rest
    const hasAttributes = first !== undefined && typeof first === 'object' && !(first instanceof Array)
    const attributes = hasAttributes ? /** @type {Readonly<Record<string, string>>} */ (first) : {}
    const children = /** @type {readonly (HtmlElement | string)[]} */ (hasAttributes ? rest.slice(1) : rest)
    for (const [name, value] of Object.entries(attributes)) { target.setAttribute(name, value) }
    const namespace = target.namespaceURI === svg && target.localName === 'foreignObject' ? xhtml : target.namespaceURI ?? xhtml
    target.replaceChildren(...children.map(child =>
        typeof child === 'string' ? child : create(target.ownerDocument, namespace, child)))
    return target
}

/**
 * Builds a new DOM element, owned by `document`, from a `media/html` element.
 *
 * @type {(document: Document, element: HtmlElement) => Element}
 */
export const toDom = (document, element) => create(document, xhtml, element)
