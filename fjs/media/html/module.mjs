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
 * and a diagram would render nothing. So every element is created by the rules
 * the parser would apply at its place in the tree:
 *
 * - under HTML, `svg` and `math` enter their namespaces and anything else is
 *   HTML;
 * - under SVG or MathML, an element keeps its parent's namespace — a `math`
 *   inside an `svg` is SVG — except below an integration point, where the
 *   parser returns to HTML's rules. {@link rulesFor} holds the standard's
 *   list of them.
 *
 * **One parser rule is not copied.** Meeting an HTML tag such as `p` or `div`
 * directly inside SVG or MathML, the parser closes the foreign element and puts
 * the tag after it. A builder keeps the tree it was given, so such an element
 * is created where it was written, in the foreign namespace.
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
 * **A `script` is refused.** Serialized and parsed through `innerHTML`, a
 * script is inert; built and connected, it runs. A view describes what to
 * show, so one that names a script throws rather than executes it.
 *
 * @type {(target: Element, element: HtmlElement) => Element}
 */
export const fill = (target, element) => {
    const [tag, attributes, children] = parseElement(element)
    if (tag === 'script') { throw new Error('media/html: a `script` element is refused: built into a page, it would run') }
    for (const [name, value] of definedEntries(attributes)) { target.setAttribute(name, value) }
    target.replaceChildren(...content(target, tag, children))
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
