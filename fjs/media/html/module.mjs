/**
 * Renders a `media/html` element into a DOM — the impure sibling of
 * [`./module.f.mjs`](./module.f.mjs), which renders the same element to text.
 * It also holds {@link macrotask}, the yield a page renders across.
 *
 * **Built, not parsed.** A page that serialized an element and assigned the
 * string to `innerHTML` would pay for an escape on the way out and a parse on
 * the way back in, and would learn nothing either step did not already know.
 *
 * **Into an HTML document.** The DOM this module writes to is a page's: an
 * HTML document, with HTML's rules for it. An XML document — XHTML among
 * them — keeps rules of its own, such as case-sensitive attribute names on
 * an HTML element, and is out of scope.
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
    return fill(document.createElementNS(namespaceFor(rules, tag), tag), element)
}

/**
 * The namespace a `tag` element is created in by the rules of `rules`.
 *
 * @type {(rules: string, tag: string) => string}
 */
const namespaceFor = (rules, tag) =>
    rules !== xhtml ? rules : tag === 'svg' ? svg : tag === 'math' ? mathMl : xhtml

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
const content = (target, tag, children) =>
    childrenFor(tag, children).map(child =>
        typeof child === 'string' ? child : create(target.ownerDocument, rulesFor(target, child[0]), child))

/**
 * The children a `tag` element holds, by the serializer's rules: none for a
 * void tag, the joined text for a raw-text one (none for no text, as the
 * parser makes none), and otherwise each child in order.
 *
 * @type {(tag: string, children: readonly HtmlNode[]) => readonly HtmlNode[]}
 */
const childrenFor = (tag, children) => {
    if (isVoidTag(tag)) { return [] }
    if (isRawText(tag)) {
        const text = rawTextContent(children)
        return text === '' ? [] : [text]
    }
    return children
}

/**
 * `Node.TEXT_NODE`, spelled out: a host's `Node` global is not something
 * this module should need to find.
 */
const textNode = 3

/**
 * Brings an existing DOM element into line with a `media/html` element of
 * the same tag, in place, and answers the DOM element.
 *
 * **What is already right is left alone.** A node that stays is the same
 * node, so what a reader was doing with it survives: focus, the caret, an
 * open selection, its undo history, and whatever the browser's text input
 * holds for it, such as a composition in progress. A
 * page that rebuilt the element instead handed all of that to a node the
 * reader never touched. That is the whole reason this exists beside
 * {@link fill}.
 *
 * - **Attributes are made exactly the element's.** One it does not name is
 *   removed, and one it names is written only when its value differs. On an
 *   HTML element a name is compared as the browser stores it, ASCII
 *   lowercase: `TITLE` is the `title` already there, not a stranger to
 *   remove and add back on every patch.
 * - **Children are matched by position.** A text node takes the new text; an
 *   element of the tag and namespace the child would be created with is
 *   patched in turn; anything else is replaced by a new node. Extra children
 *   go.
 * - **A form control shows what its markup says.** Markup sets a control's
 *   default — an `input`'s `value` attribute, a `textarea`'s text, a
 *   `checked` or `selected` attribute — and the browser shows the default
 *   only until the reader edits it, so a patched control whose shown state
 *   differs from its default is set to it. A control that already shows it,
 *   which is every field a reader just typed into, is not touched.
 *
 * The element's tag is not checked against the target's: which one to patch
 * is the caller's decision. A `script` is refused, as {@link fill} refuses it.
 *
 * @type {(target: Element, element: HtmlElement) => Element}
 */
export const patch = (target, element) => {
    const [tag, attributes, children] = parseElement(element)
    if (tag === 'script') { throw new Error('media/html: a `script` element is refused: built into a page, it would run') }
    const wanted = definedEntries(attributes).map(([name, value]) =>
        /** @type {const} */ ([storedName(target, name), value]))
    const names = new Set(wanted.map(([name]) => name))
    for (const name of target.getAttributeNames()) {
        if (!names.has(name)) { target.removeAttribute(name) }
    }
    for (const [name, value] of wanted) {
        if (target.getAttribute(name) !== value) { setAttribute(target, name, value) }
    }
    const parent = childrenOf(target)
    const nodes = [...parent.childNodes]
    const next = childrenFor(tag, children)
    next.forEach((child, i) => {
        const node = nodes.at(i)
        if (typeof child === 'string') {
            if (node?.nodeType === textNode) {
                const text = /** @type {Text} */ (node)
                if (text.data !== child) { text.data = child }
                return
            }
            place(parent, node, target.ownerDocument.createTextNode(child))
            return
        }
        const [childTag] = child
        const rules = rulesFor(target, childTag)
        const same = node !== undefined
            && /** @type {Element} */ (node).localName === childTag
            && /** @type {Element} */ (node).namespaceURI === namespaceFor(rules, childTag)
        if (same) {
            patch(/** @type {Element} */ (node), child)
            return
        }
        place(parent, node, create(target.ownerDocument, rules, child))
    })
    for (const node of nodes.slice(next.length)) { parent.removeChild(node) }
    showDefault(target)
    return target
}

/**
 * The name an attribute is stored under on `target`: ASCII lowercase on an
 * HTML element, as a browser lowercases it when it is set, and as written
 * on an SVG or MathML one, where case is part of the name (`viewBox`).
 *
 * The lowercasing is an HTML document's rule. In an XML document an HTML
 * element keeps a name's case, which is one reason such a document is out
 * of this module's scope.
 *
 * @type {(target: Element, name: string) => string}
 */
const storedName = (target, name) => target.namespaceURI !== xhtml
    ? name
    : [...name].map(c => c >= 'A' && c <= 'Z' ? c.toLowerCase() : c).join('')

/**
 * Puts `fresh` where `node` is, or after the last child when there is no
 * `node` there.
 *
 * @type {(parent: ParentNode, node: ChildNode | undefined, fresh: Node) => void}
 */
const place = (parent, node, fresh) => {
    if (node === undefined) {
        parent.appendChild(fresh)
    } else {
        parent.replaceChild(fresh, node)
    }
}

/**
 * Makes an HTML form control show its default, where it shows something
 * else.
 *
 * A checkbox or radio button shows `checked`, not a value — its `value` is
 * what it submits. A file input's value is the reader's pick and can only be
 * cleared, so it is left alone.
 *
 * @type {(target: Element) => void}
 */
const showDefault = target => {
    if (target.namespaceURI !== xhtml) { return }
    if (target.localName === 'option') {
        const option = /** @type {HTMLOptionElement} */ (target)
        if (option.selected !== option.defaultSelected) { option.selected = option.defaultSelected }
        return
    }
    if (target.localName === 'textarea') {
        const area = /** @type {HTMLTextAreaElement} */ (target)
        if (area.value !== area.defaultValue) { area.value = area.defaultValue }
        return
    }
    if (target.localName !== 'input') { return }
    const input = /** @type {HTMLInputElement} */ (target)
    const type = (input.getAttribute('type') ?? '').toLowerCase()
    if (type === 'checkbox' || type === 'radio') {
        if (input.checked !== input.defaultChecked) { input.checked = input.defaultChecked }
        return
    }
    if (type === 'file') { return }
    if (input.value !== input.defaultValue) { input.value = input.defaultValue }
}

/**
 * Builds a new DOM element, owned by `document`, from a `media/html` element.
 *
 * @type {(document: Document, element: HtmlElement) => Element}
 */
export const toDom = (document, element) => create(document, xhtml, element)

/**
 * Return to the event loop, so the browser can paint what was just set.
 *
 * **A macrotask, and that is the whole point.** Work on the page runs on the
 * one thread that paints, so a change made and then awaited is made and
 * blocked in the same task, and nobody ever sees it. Draining the microtask
 * queue is part of that same task, which is why an `await` of a resolved
 * promise is not enough: a paint waits for the next task.
 *
 * @type {() => Promise<void>}
 */
export const macrotask = () => new Promise(resolve => { setTimeout(resolve, 0) })
