import { map, flatMap, flat, concat as listConcat, type List } from '../types/list/module.f.ts'
import { concat, concat as stringConcat } from '../types/string/module.f.ts'
import type { Entry } from '../types/object/module.f.ts'
import { compose } from '../types/function/module.f.ts'
import { stringToList } from '../text/utf16/module.f.ts'

const { fromCharCode } = String
const { entries } = Object

type Tag = string

/**
 * Void Elements
 *
 * https://developer.mozilla.org/en-US/docs/Glossary/Void_element
 */
const voidTagList: readonly string[] = [
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
]

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/style
 */
const rawText: readonly string[] = [
    'script',
    'style'
]

type Element1 = readonly [Tag, ...Node[]]

type Element2 = readonly [Tag, Attributes, ...Node[]]

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

export const element = (e: Element): List<string> => {
    const [tag, a, n] = parseElement(e)
    const open = flat([[`<`, tag], attributes(a), [`>`]])
    if (voidTagList.includes(tag)) {
        return open
    }
    return flat([open, rawText.includes(tag) ? [rawMap(n)] : nodes(n), ['</', tag, '>']])
}

export const html
    : (_: Element) => List<string>
    = compose(element)(listConcat(['<!DOCTYPE html>']))

export const htmlToString
    : (_: Element) => string
    = compose(html)(stringConcat)
