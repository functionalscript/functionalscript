const list = require('../types/list/module.f.cjs')
const { map, flatMap, flat, concat: listConcat } = list
const { concat: stringConcat } = require('../types/string/module.f.cjs')
const object = require('../types/object/module.f.cjs')
const { compose } = require('../types/function/module.f.cjs')
const { stringToList } = require('../text/utf16/module.f.cjs')
const { fromCharCode } = String
const { entries } = Object

/**
 * @typedef {|
 *  'a' |
 *  'b' |
 *  'body' |
 *  'canvas' |
 *  'div' |
 *  'h1' |
 *  'h2' |
 *  'h3' |
 *  'h4' |
 *  'h5' |
 *  'h6' |
 *  'head' |
 *  'html' |
 *  'label' |
 *  'p' |
 *  'pre' |
 *  'script' |
 *  'table' |
 *  'td' |
 *  'th' |
 *  'title' |
 *  'tr'
 * } Tag
 */

/**
 * https://developer.mozilla.org/en-US/docs/Glossary/Void_element
 *
 * @typedef {
 *  | 'area'
 *  | 'base'
 *  | 'br'
 *  | 'col'
 *  | 'embed'
 *  | 'hr'
 *  | 'img'
 *  | 'input'
 *  | 'link'
 *  | 'meta'
 *  | 'param'
 *  | 'source'
 *  | 'track'
 *  | 'wbr'
 * } VoidTag
 */

/** @typedef {readonly[VoidTag]} VoidElement1*/

/** @typedef {readonly[VoidTag, Attributes]} VoidElement2 */

/** @typedef {readonly[Tag, readonly Node[]]} Element2 */

/** @typedef {readonly[Tag, Attributes, Nodes]} Element3*/

/** @typedef {VoidElement1 | VoidElement2 | Element2 | Element3} Element */

/**
 * @typedef {{
 *  readonly[k in string]: string
 * }} Attributes
 */

/** @typedef {list.List<Node>} Nodes */

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

/** @type {(a: object.Entry<string>) => list.List<string>} */
const attribute = ([name, value]) => flat([[' ', name, '="'], escape(value), ['"']])

/** @type {(a: Attributes) => list.List<string>} */
const attributes = compose(entries)(flatMap(attribute))

/** @type {(element: Element) => list.List<string>} */
const element = e => {
    const f = () => {
        switch (e.length) {
            case 1: { return [[`<`, e[0], '/>']] }
            case 2: {
                const [tag, a] = e
                return a instanceof Array ?
                    [['<', tag, '>'], nodes(a), ['</', tag, '>']] :
                    [[`<`, tag], attributes(a), [`/>`]]
            }
            default: {
                const [tag, a, ns] = e
                return [['<', tag], attributes(a), ['>'], nodes(ns), ['</', tag, '>']]
            }
        }
    }
    return flat(f())
}

const html = compose(element)(listConcat(['<!DOCTYPE html>']))

const htmlToString =  compose(html)(stringConcat)

module.exports = {
    /** @readonly */
    element,
    /** @readonly */
    html,
    /** @readonly */
    htmlToString,
}
