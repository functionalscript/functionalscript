/**
 * HTML serialization helpers: `Element`/`Attributes` builders, void-tag
 * handling, attribute/text escaping, and a UTF-8 emitter for full documents.
 * See `./types.ts` for the `Element`/`Node` type-level API.
 *
 * @module
 *
 * @import { List } from '../../types/list/types.ts'
 * @import { Entry, StringMap } from '../../types/object/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Element, Node } from './types.ts'
 */

import { map, flatMap, flat, concat as listConcat } from '../../types/list/module.f.mjs'
import { concat, concat as stringConcat } from '../../types/string/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { compose } from '../../types/function/module.f.js'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { includes } from '../../types/array/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { quotationMark, ampersand, lessThanSign, greaterThanSign } from '../../text/ascii/module.f.mjs'

const { fromCharCode } = String

/**
 * Void Elements
 *
 * https://developer.mozilla.org/en-US/docs/Glossary/Void_element
 */
const voidTagList = /** @type {const} */ ([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
])

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/style
 */
const rawText = /** @type {const} */ ([
    'script',
    'style'
])

/**
 * https://stackoverflow.com/questions/7381974/which-characters-need-to-be-escaped-in-html
 */
const escapeTable = /** @type {const} */ ({
    [quotationMark]: '&quot;',
    [ampersand]: '&amp;',
    [lessThanSign]: '&lt;',
    [greaterThanSign]: '&gt;',
})

/** @type {(code: number) => string} */
const escapeCharCode = code =>
    escapeTable[code] ?? fromCharCode(code)

const escape = compose(stringToList)(map(escapeCharCode))

/** @type {(n: Node) => List<string>} */
const node = n =>
    typeof n === 'string' ? escape(n) : element(n)

const nodes = flatMap(node)

/** @type {(n: Node) => string} */
const raw = n =>
    typeof n === 'string' ? n : ''

const mr = map(raw)

/**
 * The text of a raw-text element (`script`, `style`): its string children
 * joined, element children dropped, and every `</` escaped so the text cannot
 * close the element early.
 *
 * @type {(n: List<Node>) => string}
 */
export const rawTextContent = n => concat(mr(n)).replaceAll('</', '<\\/')

/** @type {(entry: Entry<string>) => List<string>} */
const attribute = ([name, value]) =>
    flat([[' ', name, '="'], escape(value), ['"']])

/** @type {(a: StringMap<string>) => List<string>} */
const attributes = a => flatMap(attribute)(definedEntries(a))

/**
 * Splits an element into its tag, its attributes (`{}` when it has none) and
 * its children.
 *
 * @type {(e: Element) => readonly [string, StringMap<string>, readonly Node[]]}
 */
export const parseElement = e => {
    const [tag, item1, ...list] = e
    return item1 === undefined ?
            [tag, {}, []] :
        typeof item1 === 'object' && !(item1 instanceof Array) ?
            [tag, item1, list] :
            [tag, {}, [item1, ...list]]
}

/**
 * Whether `tag` names a void element, which has no children and no end tag.
 */
export const isVoidTag = includes(voidTagList)

/**
 * Whether `tag` names a raw-text element, whose content is text only.
 */
export const isRawText = includes(rawText)

/**
 * Why a `script` element is refused wherever a tree is built into a page: a
 * browser runs it. `module.mjs` throws it from the DOM builders, and a caller
 * serializing a tree it did not write says it in its own refusal.
 */
/** @type {string} */
export const scriptRefusal = 'media/html: a `script` element is refused: built into a page, it would run'

/** @type {(c: number) => boolean} */
const isAsciiLetter = c => (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)

/** @type {(c: number) => boolean} */
const tagUnit = c => isAsciiLetter(c) || (c >= 0x30 && c <= 0x39) || c === 0x2d

/** @type {(c: number) => boolean} */
const attributeUnit = c => tagUnit(c) || c === 0x5f || c === 0x2e || c === 0x3a

/**
 * Whether `name` is an ASCII letter followed by code units `rest` accepts.
 *
 * @type {(rest: (c: number) => boolean) => (name: string) => boolean}
 */
const plainName = rest => name => name.length > 0 && isAsciiLetter(name.charCodeAt(0))
    && name.split('').every((_, i) => i === 0 || rest(name.charCodeAt(i)))

/** A tag a parser reads as written: an ASCII letter, then letters, digits and `-`. */
const plainTag = plainName(tagUnit)

/** An attribute name a parser reads as written: a tag's units, and `_`, `.` and `:`. */
const plainAttribute = plainName(attributeUnit)

/**
 * Why `e` cannot be written into a page, or `null` when it can: the refusal a
 * caller serializing a tree it did not write makes, as the DOM builders in
 * `module.mjs` make theirs.
 *
 * **The page must read the tree the serializer was given.** The serializer
 * writes a tag or an attribute name as it is, and a parser reading the page
 * ends a name at whitespace, `/`, `>` or `=`. `['script ', …]` is written as
 * `<script >`, a script, and an attribute name holding `><script>` writes a
 * script element of its own. The DOM builders refuse such names, because the
 * DOM throws on them. So a name here is plain: a tag is an ASCII letter, then
 * letters, digits and `-`; an attribute name may also hold `_`, `.` and `:`,
 * which `xlink:href` needs. The parser reads such a name as it is written.
 *
 * **A `script` is refused in any case.** A browser reads a tag name ignoring
 * ASCII case, so `<SCRIPT>` written into a page runs as surely as `<script>`,
 * inside an `svg` too.
 *
 * **The children it looks under are the ones that are written.** A void
 * element's children and a raw-text one's elements are dropped, by the
 * serializer and the DOM builders alike, so they are never in the page. Which
 * elements those are is decided by the exact tag, as the serializer decides
 * it: a `BR` is not void to it, and its children are written.
 *
 * @type {(e: Element) => string | null}
 */
export const pageRefusal = e => {
    const [tag, attributes, children] = parseElement(e)
    if (!plainTag(tag)) {
        return `media/html: the tag '${tag}' is not a plain name: a page would read other markup`
    }
    if (tag.toLowerCase() === 'script') { return scriptRefusal }
    const name = definedEntries(attributes).map(([n]) => n).find(n => !plainAttribute(n))
    if (name !== undefined) {
        return `media/html: the attribute '${name}' is not a plain name: a page would read other markup`
    }
    if (isVoidTag(tag) || isRawText(tag)) { return null }
    return children.reduce(
        (/** @type {string | null} */ found, child) => found ?? (typeof child === 'string' ? null : pageRefusal(child)),
        null)
}

/**
 * Converts a FunctionalScript element into a list of HTML string chunks.
 *
 * Chunks are returned instead of a single string to support composition with
 * other list/string helpers in this codebase.
 *
 * @type {(e: Element) => List<string>}
 */
export const element = e => {
    const [tag, a, n] = parseElement(e)
    const open = flat([[`<`, tag], attributes(a), [`>`]])
    if (isVoidTag(tag)) {
        return open
    }
    return flat([open, isRawText(tag) ? [rawTextContent(n)] : nodes(n), ['</', tag, '>']])
}

/**
 * Builds a complete HTML document by prepending `<!DOCTYPE html>`.
 *
 * @type {(_: Element) => List<string>}
 */
export const html
    = compose(element)(listConcat(['<!DOCTYPE html>']))

/**
 * Renders an HTML element tree to a final string.
 *
 * @type {(_: Element) => string}
 */
export const htmlToString
    = compose(html)(stringConcat)

const commonHead = /** @type {const} */ ([
    ['meta', { charset: 'UTF-8' }],
    ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1.0' }],
])

/**
 * Renders a complete HTML document as a string: what {@link htmlUtf8} encodes.
 *
 * **A string, for a document larger than one `Vec`.** A `Vec` holds at most
 * `maxLengthBytes`, and a page can be larger — a demo's first view written
 * into it is one way — so a caller writing it chunks the string as it encodes
 * it, as `writeUtf8File` does.
 *
 * @type {(lang: string) => (...head: readonly Node[]) => (...body: readonly Node[]) => string}
 */
export const htmlDocument = lang => (...head) => (...body) =>
    htmlToString(['html', { lang },
        ['head', ...commonHead, ...head],
        ['body', ...body]])

/**
 * Renders a complete UTF-8 encoded HTML document as a `Vec`.
 *
 * Produces a full page with `<!DOCTYPE html>`, an `<html lang>` naming the
 * document's language, a `<head>` containing a UTF-8 `<meta charset>` and a
 * responsive-viewport `<meta>` followed by any extra `head` nodes, and a
 * `<body>` containing the provided `body` nodes.
 *
 * **The language is required, not defaulted.** A screen reader picks its
 * voice from it, a browser decides whether to offer translation by it, and
 * WCAG 2.2 makes it Level A (3.1.1, Language of Page). A default would be
 * right for some callers and silently wrong for the rest, and an omitted
 * attribute is the failure itself, so every document says what it is.
 * `lang` is a BCP 47 tag such as `en` or `uk`.
 *
 * @example
 * ```js
 * htmlUtf8('en')(['title', 'My Page'])(['h1', 'Hello'])
 * // Vec of UTF-8 bytes for:
 * // <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">...<title>My Page</title></head><body><h1>Hello</h1></body></html>
 * ```
 *
 * @type {(lang: string) => (...head: readonly Node[]) => (...body: readonly Node[]) => Vec}
 */
export const htmlUtf8 = lang => (...head) => (...body) =>
    utf8(htmlDocument(lang)(...head)(...body))
