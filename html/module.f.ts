import { map, flatMap, flat, concat as listConcat, type List } from '../types/list/module.f.ts'
import { concat, concat as stringConcat } from '../types/string/module.f.ts'
import type { Entry } from '../types/object/module.f.ts'
import { compose } from '../types/function/module.f.ts'
import { stringToList } from '../text/utf16/module.f.ts'
import { includes } from '../types/array/module.f.ts'
import { type Vec } from '../types/bit_vec/module.f.ts'
import { utf8 } from '../text/module.f.ts'

const { fromCharCode } = String
const { entries } = Object

type Tag = string

/**
 * Void Elements
 *
 * https://developer.mozilla.org/en-US/docs/Glossary/Void_element
 */
const voidTagList = [
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
] as const

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/style
 */
const rawText = [
    'script',
    'style'
] as const

type Element1 = readonly [Tag, ...Node[]]

type Element2 = readonly [Tag, Attributes, ...Node[]]

/**
 * A FunctionalScript representation of an HTML element.
 *
 * - `[tag, ...children]` for elements without attributes.
 * - `[tag, attributes, ...children]` for elements with attributes.
 */
export type Element = Element1 | Element2

type Attributes = {
    readonly [k in string]: string
}

export type Node = Element | string

/**
 * https://stackoverflow.com/questions/7381974/which-characters-need-to-be-escaped-in-html
 */
const escapeCharCode = (code: number) => {
    switch (code) {
        case 0x22: return '&quot;'
        case 0x26: return '&amp;'
        case 0x3C: return '&lt;'
        case 0x3E: return '&gt;'
        default: return fromCharCode(code)
    }
}

const escape = compose(stringToList)(map(escapeCharCode))

const node = (n: Node) =>
    typeof n === 'string' ? escape(n) : element(n)

const nodes = flatMap(node)

const raw = (n: Node) =>
    typeof n === 'string' ? n : ''

const mr = map(raw)

// Escape closing tags in raw text elements
const rawMap = (n: List<Node>) => concat(mr(n)).replaceAll('</', '<\\/')

const attribute = ([name, value]: Entry<string>) =>
    flat([[' ', name, '="'], escape(value), ['"']])

const attributes = compose(entries)(flatMap(attribute))

const parseElement = (e: Element): readonly[string, Attributes, readonly Node[]] => {
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
 */
export const element = (e: Element): List<string> => {
    const [tag, a, n] = parseElement(e)
    const open = flat([[`<`, tag], attributes(a), [`>`]])
    if (isVoidTag(tag)) {
        return open
    }
    return flat([open, isRawText(tag) ? [rawMap(n)] : nodes(n), ['</', tag, '>']])
}

/**
 * Builds a complete HTML document by prepending `<!DOCTYPE html>`.
 */
export const html
    : (_: Element) => List<string>
    = compose(element)(listConcat(['<!DOCTYPE html>']))

/**
 * Renders an HTML element tree to a final string.
 */
export const htmlToString
    : (_: Element) => string
    = compose(html)(stringConcat)

const metaUtf8 = ['meta', { charset: 'UTF-8' }] as const

export const htmlUtf8 = (...head: readonly Node[]) => (body: Element): Vec =>
    utf8(htmlToString(['html', ['head', metaUtf8, ...head], body]))
