/**
 * HTML serialization helpers: `Element`/`Attributes` builders, void-tag
 * handling, attribute/text escaping, and a UTF-8 emitter for full documents.
 * See `./types.ts` for the `Element`/`Node` type-level API.
 *
 * @module
 */
/** @import { List } from '../../types/list/types.ts' */
import { map, flatMap, flat, concat as listConcat } from '../../types/list/module.f.mjs'
import { concat, concat as stringConcat } from '../../types/string/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
/** @import { Entry, StringMap } from '../../types/object/types.ts' */
import { compose } from '../../types/function/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { includes } from '../../types/array/module.f.mjs'
/** @import { Vec } from '../../types/bit_vec/types.ts' */
import { utf8 } from '../../text/module.f.mjs'
import { quotationMark, ampersand, lessThanSign, greaterThanSign } from '../../text/ascii/module.f.mjs'
/** @import { Element, Node } from './types.ts' */

const { fromCharCode } = String

/** @typedef {StringMap<string>} _Attributes */

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
    escapeTable[/** @type {keyof typeof escapeTable} */ (code)] ?? fromCharCode(code)

const escape = compose(stringToList)(map(escapeCharCode))

/** @type {(n: Node) => List<string>} */
const node = n =>
    typeof n === 'string' ? escape(n) : element(n)

const nodes = flatMap(node)

/** @type {(n: Node) => string} */
const raw = n =>
    typeof n === 'string' ? n : ''

const mr = map(raw)

// Escape closing tags in raw text elements
/** @type {(n: List<Node>) => string} */
const rawMap = n => concat(mr(n)).replaceAll('</', '<\\/')

/** @type {(entry: Entry<string>) => List<string>} */
const attribute = ([name, value]) =>
    flat([[' ', name, '="'], escape(value), ['"']])

/** @type {(a: _Attributes) => List<string>} */
const attributes = a => flatMap(attribute)(definedEntries(a))

/** @type {(e: Element) => readonly [string, _Attributes, readonly Node[]]} */
const parseElement = e => {
    const [tag, item1, ...list] = e
    return item1 === undefined ?
            [tag, {}, []] :
        typeof item1 === 'object' && !(item1 instanceof Array) ?
            [tag, item1, list] :
            [tag, {}, [item1, ...list]]
}

const isVoidTag = includes(voidTagList)

const isRawText = includes(rawText)

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
    return flat([open, isRawText(tag) ? [rawMap(n)] : nodes(n), ['</', tag, '>']])
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
 * Renders a complete UTF-8 encoded HTML document as a `Vec`.
 *
 * Produces a full page with `<!DOCTYPE html>`, a `<head>` containing a UTF-8
 * `<meta charset>` and a responsive-viewport `<meta>` followed by any extra
 * `head` nodes, and a `<body>` containing the provided `body` nodes.
 *
 * @example
 * ```js
 * htmlUtf8(['title', 'My Page'])(['h1', 'Hello'])
 * // Vec of UTF-8 bytes for:
 * // <!DOCTYPE html><html><head><meta charset="UTF-8">...<title>My Page</title></head><body><h1>Hello</h1></body></html>
 * ```
 *
 * @type {(...head: readonly Node[]) => (...body: readonly Node[]) => Vec}
 */
export const htmlUtf8 = (...head) => (...body) =>
    utf8(htmlToString(['html',
        ['head', ...commonHead, ...head],
        ['body', ...body]]
    ))
