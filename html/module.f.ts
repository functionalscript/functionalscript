import { map, flatMap, flat, concat as listConcat, type List } from '../types/list/module.f.ts'
import { concat as stringConcat } from '../types/string/module.f.ts'
import type * as O from '../types/object/module.f.ts'
import { compose } from '../types/function/module.f.ts'
import * as utf16 from '../text/utf16/module.f.ts'
const { stringToList } = utf16
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

type Element1 = readonly [Tag, ...Node[]]

type Element2 = readonly [Tag, Attributes, ...Node[]]

export type Element = Element1 | Element2

type Attributes = {
    readonly [k in string]: string
}

type Node = Element | string

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

const attribute = ([name, value]: O.Entry<string>) =>
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
    return voidTagList.includes(tag) ?
        open :
        flat([open, nodes(n), ['</', tag, '>']])
}

export const html
    : (_: Element) => List<string>
    = compose(element)(listConcat(['<!DOCTYPE html>']))

export const htmlToString
    : (_: Element) => string
    = compose(html)(stringConcat)
