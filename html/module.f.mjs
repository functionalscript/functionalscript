// @ts-self-types="./module.f.d.mts"
import * as list from '../types/list/module.f.mjs'
const { map, flatMap, flat, concat: listConcat } = list
import * as s from '../types/string/module.f.mjs'
const { concat: stringConcat } = s
import * as O from '../types/object/module.f.mjs'
import * as f from '../types/function/module.f.mjs'
const { compose } = f
import * as utf16 from '../text/utf16/module.f.mjs'
const { stringToList } = utf16
const { fromCharCode } = String
const { entries } = Object

/** @typedef {string} Tag */

// https://developer.mozilla.org/en-US/docs/Glossary/Void_element
const voidTagList = /** @type {const} */([
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

/** @typedef {typeof voidTagList} VoidTagList */

/** @typedef {keyof voidTagList} VoidTag */

/** @type {(tag: string) => boolean} */
const isVoid = tag => voidTagList.includes(/** @type {any} */(tag))

/** @typedef {readonly[Tag, ...Node[]]} Element1*/

/** @typedef {readonly[Tag, Attributes, ...Node[]]} Element2 */

/** @typedef {Element1 | Element2 } Element */

/**
 * @typedef {{
 *  readonly[k in string]: string
 * }} Attributes
 */

// /** @typedef {list.List<Node>} Nodes */

/** @typedef {Element | string} Node */

/**
 * https://stackoverflow.com/questions/7381974/which-characters-need-to-be-escaped-in-html
 *
 * @type {(code: number) => string}
 */
const escapeCharCode = code => {
    switch (code) {
        case 0x22: return '&quot;'
        case 0x26: return '&amp;'
        case 0x3C: return '&lt;'
        case 0x3E: return '&gt;'
        default: return fromCharCode(code)
    }
}

const escape = compose(stringToList)(map(escapeCharCode))

/** @type {(n: Node) => list.List<string>} */
const node = n => typeof n === 'string' ? escape(n) : element(n)

const nodes = flatMap(node)

/** @type {(a: O.Entry<string>) => list.List<string>} */
const attribute = ([name, value]) => flat([[' ', name, '="'], escape(value), ['"']])

/** @type {(a: Attributes) => list.List<string>} */
const attributes = compose(entries)(flatMap(attribute))

/** @type {(t: string) => (a: Attributes) => list.List<string>} */
const open = t => a => flat([[`<`, t], attributes(a), [`>`]])

/** @type {(t: string) => (an: readonly[Attributes, readonly Node[]]) => list.List<string>} */
const element3 = t => ([a, n]) => {
    const o = flat([[`<`, t], attributes(a), [`>`]])
    return isVoid(t) ? o : flat([o, nodes(n), ['</', t, '>']])
}

/** @type {(element: Element) => list.List<string>} */
export const element = e => {
    const [t, a, ...n] = e
    return element3(t)(a === undefined ? [{}, []]: typeof a === 'object' && !(a instanceof Array) ? [a, n] : [{}, [a, ...n]])
}

export const html = compose(element)(listConcat(['<!DOCTYPE html>']))

export const htmlToString = compose(html)(stringConcat)
