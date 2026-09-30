/**
 * Renders a `media/html` element into a DOM — the impure sibling of
 * [`./module.f.mjs`](./module.f.mjs), which renders the same element to text.
 *
 * **Built, not parsed.** A page that serialized an element and assigned the
 * string to `innerHTML` would pay for an escape on the way out and a parse on
 * the way back in, and would learn nothing either step did not already know.
 *
 * **Built as written.** `toDom` builds exactly the tree the element gives,
 * with every name spelled as it is written. It does not copy the fix-ups the
 * HTML parser applies when it reads markup as text: it does not lowercase a
 * tag or correct an attribute's case (`SVG`, `viewbox`), insert the `tbody` a
 * table gets, read a `textarea` or `title` element child as literal text, or
 * move an HTML tag such as `p` out of SVG. An element that relies on one of
 * those is built as written, which is what the element says.
 *
 * It decides only what the element cannot say, and refuses only what would
 * act differently once built:
 *
 * - **Namespaces.** An element names its tag, not its namespace, and
 *   `createElement('svg')` would make an inert HTML element, so a diagram
 *   would render nothing. Each element is created in the namespace the parser
 *   would give it. Under HTML, `svg` and `math` enter their namespaces and
 *   anything else is HTML. Under SVG or MathML, an element keeps its parent's
 *   namespace (a `math` inside an `svg` is SVG), except below an integration
 *   point, where HTML's rules apply again; {@link rulesFor} holds the
 *   standard's list. On an SVG or MathML element, an attribute such as
 *   `xlink:href` goes into its namespace; {@link foreignAttributes} holds that
 *   list.
 * - **`template`.** Its children go into its `content`, where the parser puts
 *   them and where cloning reads them.
 * - **`script`.** Refused: built and connected, it would run, where the
 *   `innerHTML` it replaces left it inert.
 *
 * @module
 *
 * @import { Element as HtmlElement, Node as HtmlNode } from './types.ts'
 */

import { definedEntries } from '../../types/object/module.f.mjs'
import { isRawText, isVoidTag, parseElement, rawTextContent } from './module.f.mjs'

const xhtml = 'http://www.w3.org/1999/xhtml'

const svg = 'http://www.w3.org/2000/svg'

const mathMl = 'http://www.w3.org/1998/Math/MathML'

const xlink = 'http://www.w3.org/1999/xlink'

/**
 * The SVG elements whose children the parser reads as HTML.
 *
 * @type {readonly string[]}
 */
const svgHtmlIntegrationPoints = ['foreignObject', 'desc', 'title']

/**
 * The MathML elements whose element children the parser reads as HTML — all
 * but `mglyph` and `malignmark`, which stay MathML.
 *
 * @type {readonly string[]}
 */
const mathMlTextIntegrationPoints = ['mi', 'mo', 'mn', 'ms', 'mtext']

/**
 * The `encoding` values, compared ignoring ASCII case, that make a MathML
 * `annotation-xml` read its children as HTML.
 *
 * @type {readonly string[]}
 */
const htmlEncodings = ['text/html', 'application/xhtml+xml']

/**
 * Whether the parser reads a `tag` child of this MathML element by HTML's
 * rules.
 *
 * An `annotation-xml` reads an `svg` child that way whatever its `encoding`,
 * which is how an SVG drawing enters an annotation.
 *
 * @type {(target: Element, tag: string) => boolean}
 */
const mathMlReadsAsHtml = (target, tag) => {
    const { localName } = target
    return mathMlTextIntegrationPoints.includes(localName)
        ? tag !== 'mglyph' && tag !== 'malignmark'
        : localName === 'annotation-xml'
            && (tag === 'svg' || htmlEncodings.includes((target.getAttribute('encoding') ?? '').toLowerCase()))
}

/**
 * The attributes the parser puts into a namespace on an SVG or MathML
 * element, each with that namespace. An attribute not listed is set as
 * written.
 *
 * @type {ReadonlyMap<string, string>}
 */
const foreignAttributes = new Map([
    ...['actuate', 'arcrole', 'href', 'role', 'show', 'title', 'type'].map(name =>
        /** @type {const} */ ([`xlink:${name}`, xlink])),
    ['xml:lang', 'http://www.w3.org/XML/1998/namespace'],
    ['xml:space', 'http://www.w3.org/XML/1998/namespace'],
    ['xmlns', 'http://www.w3.org/2000/xmlns/'],
    ['xmlns:xlink', 'http://www.w3.org/2000/xmlns/'],
])

/**
 * Sets one attribute on `target`: in its namespace when the parser would put
 * it in one, and as written otherwise.
 *
 * @type {(target: Element, name: string, value: string) => void}
 */
const setAttribute = (target, name, value) => {
    const namespace = target.namespaceURI === xhtml ? undefined : foreignAttributes.get(name)
    if (namespace === undefined) {
        target.setAttribute(name, value)
    } else {
        target.setAttributeNS(namespace, name, value)
    }
}

/**
 * Where `target`'s children go: a `template`'s `content`, and the element
 * itself otherwise.
 *
 * @type {(target: Element) => ParentNode}
 */
const childrenOf = target =>
    target.namespaceURI === xhtml && target.localName === 'template'
        ? /** @type {HTMLTemplateElement} */ (target).content
        : target

/**
 * The namespace whose rules create a `tag` child of `target`: HTML's, unless
 * `target` is SVG or MathML and not an integration point for that child.
 *
 * @type {(target: Element, tag: string) => string}
 */
const rulesFor = (target, tag) => {
    const { namespaceURI, localName } = target
    return namespaceURI === svg ? (svgHtmlIntegrationPoints.includes(localName) ? xhtml : svg)
        : namespaceURI === mathMl ? (mathMlReadsAsHtml(target, tag) ? xhtml : mathMl)
        : xhtml
}

/**
 * Creates the DOM element for `element` by the rules of `rules`, and fills it:
 * HTML's switch `svg` and `math` into their namespaces, and a foreign
 * namespace keeps its own.
 *
 * @type {(document: Document, rules: string, element: HtmlElement) => Element}
 */
const create = (document, rules, element) => {
    const [tag] = element
    const namespace = rules !== xhtml ? rules : tag === 'svg' ? svg : tag === 'math' ? mathMl : xhtml
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
 * **The serializer's rules for content.** A void element such as `br` gets no
 * children, and a `style` gets only its text, with element children dropped —
 * both by the helpers [`./module.f.mjs`](./module.f.mjs) serializes with, so
 * the same element reads the same whichever way it reaches the page.
 *
 * A `template`'s children go into its `content`, and a `script` is refused;
 * the module documentation says why.
 *
 * @type {(target: Element, element: HtmlElement) => Element}
 */
export const fill = (target, element) => {
    const [tag, attributes, children] = parseElement(element)
    if (tag === 'script') { throw new Error('media/html: a `script` element is refused: built into a page, it would run') }
    for (const [name, value] of definedEntries(attributes)) { setAttribute(target, name, value) }
    childrenOf(target).replaceChildren(...content(target, tag, children))
    return target
}

/**
 * What `fill` puts inside a `tag` element, by the serializer's rules: nothing
 * for a void tag, the joined text for a raw-text one (no node for no text, as
 * the parser makes none), and otherwise each child in order.
 *
 * @type {(target: Element, tag: string, children: readonly HtmlNode[]) => readonly (Element | string)[]}
 */
const content = (target, tag, children) => {
    if (isVoidTag(tag)) { return [] }
    if (isRawText(tag)) {
        const text = rawTextContent(children)
        return text === '' ? [] : [text]
    }
    return children.map(child =>
        typeof child === 'string' ? child : create(target.ownerDocument, rulesFor(target, child[0]), child))
}

/**
 * Builds a new DOM element, owned by `document`, from a `media/html` element.
 *
 * @type {(document: Document, element: HtmlElement) => Element}
 */
export const toDom = (document, element) => create(document, xhtml, element)
