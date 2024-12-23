import { map, flatMap, flat, concat as listConcat, type List } from '../types/list/module.f.ts'
import { concat as stringConcat } from '../types/string/module.f.ts'
import * as O from '../types/object/module.f.ts'
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

type VoidTagList = typeof voidTagList

type VoidTag = keyof VoidTagList

const isVoid
    : (tag: string) => boolean
    = tag => (voidTagList as readonly string[]).includes(tag)

type Element1 = readonly[Tag, ...Node[]]

type Element2 = readonly[Tag, Attributes, ...Node[]]

export type Element = Element1 | Element2

type Attributes = {
    readonly[k in string]: string
}

export type Node = Element | string

/**
 * https://stackoverflow.com/questions/7381974/which-characters-need-to-be-escaped-in-html
 */
const escapeCharCode
    : (code: number) => string
    = code => {
    switch (code) {
        case 0x22: return '&quot;'
        case 0x26: return '&amp;'
        case 0x3C: return '&lt;'
        case 0x3E: return '&gt;'
        default: return fromCharCode(code)
    }
}

const escape = compose(stringToList)(map(escapeCharCode))

const node
: (n: Node) => List<string>
= n => typeof n === 'string' ? escape(n) : element(n)

const nodes = flatMap(node)

const attribute
: (a: O.Entry<string>) => List<string>
= ([name, value]) => flat([[' ', name, '="'], escape(value), ['"']])

const attributes
: (a: Attributes) => List<string>
= compose(entries)(flatMap(attribute))

const open
: (t: string) => (a: Attributes) => List<string>
= t => a => flat([[`<`, t], attributes(a), [`>`]])

const element3
: (t: string) => (an: readonly[Attributes, readonly Node[]]) => List<string>
= t => ([a, n]) => {
    const o = flat([[`<`, t], attributes(a), [`>`]])
    return isVoid(t) ? o : flat([o, nodes(n), ['</', t, '>']])
}

export const element
: (element: Element) => List<string>
= e => {
    const [t, a, ...n] = e
    return element3(t)(a === undefined ? [{}, []]: typeof a === 'object' && !(a instanceof Array) ? [a, n] : [{}, [a, ...n]])
}

export const html
: (_: Element) => List<string>
= compose(element)(listConcat(['<!DOCTYPE html>']))

export const htmlToString
: (_: Element) => string
= compose(html)(stringConcat)
