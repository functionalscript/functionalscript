// @ts-self-types="./module.f.d.mts"
import list, * as List from '../types/list/module.f.mjs'
const { map, flatMap, flat, concat: listConcat } = list
import s from '../types/string/module.f.mjs'
const { concat: stringConcat } = s
import * as O from '../types/object/module.f.mjs'
import f from '../types/function/module.f.mjs'
const { compose } = f
import utf16 from '../text/utf16/module.f.mjs'
const { stringToList } = utf16
const { fromCharCode } = String
const { entries } = Object

/** @typedef {string} Tag */

// https://developer.mozilla.org/en-US/docs/Glossary/Void_element
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
]

/** @type {(tag: string) => boolean} */
const isVoid = tag => voidTagList.includes(tag)

/** @typedef {readonly[Tag]} Element1*/

/** @typedef {readonly[Tag, Attributes]} Element2A */

/** @typedef {readonly[Tag, readonly Node[]]} Element2N */

/** @typedef {readonly[Tag, Attributes, Nodes]} Element3*/

/** @typedef {Element1 | Element2A | Element2N | Element3} Element */

/**
 * @typedef {{
 *  readonly[k in string]: string
 * }} Attributes
 */

/** @typedef {List.List<Node>} Nodes */

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

/** @type {(n: Node) => List.List<string>} */
const node = n => typeof n === 'string' ? escape(n) : element(n)

const nodes = flatMap(node)

/** @type {(a: O.Entry<string>) => List.List<string>} */
const attribute = ([name, value]) => flat([[' ', name, '="'], escape(value), ['"']])

/** @type {(a: Attributes) => List.List<string>} */
const attributes = compose(entries)(flatMap(attribute))

const open = (/** @type {Element2A} */[tag, a]) => flat([[`<`, tag], attributes(a), [`>`]])

const close = (/** @type {string}*/tag) => ['</', tag, '>']

/** @type {(_: Element3) => List.List<string>} */
const element3 = ([tag, a, ns]) =>
    flat([open([tag, a]), nodes(ns), close(tag)])

/** @type {(_: Element2A) => List.List<string>} */
const element2a = e => {
    const [tag] = e
    return flat([open(e), isVoid(tag) ? [] : close(tag)])
}

/** @type {(element: Element) => List.List<string>} */
export const element = e => {
    switch (e.length) {
        case 1: { return element2a([e[0], {}]) }
        case 2: {
            const [tag, a] = e
            return a instanceof Array ?
                element3([tag, {}, a]) :
                element2a([tag, a])
        }
        default: {
            return element3(e)
        }
    }
}

export const html = compose(element)(listConcat(['<!DOCTYPE html>']))

export const htmlToString = compose(html)(stringConcat)
