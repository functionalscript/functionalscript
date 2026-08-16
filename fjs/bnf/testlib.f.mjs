/**
 * @module
 *
 * @import { Rule } from './types.ts'
 */

import { codePointToString } from '../text/utf16/module.f.mjs'
import {
    commaJoin0Plus,
    none,
    option,
    range,
    remove,
    repeat,
    repeat0Plus,
    set,
    unicodeMax,
} from './module.f.mjs'

/** @type {() => Rule} */
export const classic = () => {

    // https://www.json.org/json-en.html

    const json = () => [element]

    const value = () => ({
        object,
        array,
        string,
        number,
        true: 'true',
        false: 'false',
        null: 'null'
    })

    const object = () => ({
        ws: ['{', ws, '}'],
        members: ['{', members, '}'],
    })

    const members = () => ({
        member,
        members: [member, ',', members],
    })

    const member = () => [ws, string, ws, ':', element]

    const array = () => ({
        ws: ['[', ws, ']'],
        elements: ['[', elements, ']'],
    })

    const elements = () => ({
        element,
        elements: [element, ',', elements],
    })

    const element = () => [ws, value, ws]

    const string = () => ['"', characters, '"']

    const characters = () => ({
        none,
        characters: [character, characters],
    })

    /** @type {Rule} */
    const character = () => ({
        0: 0x20_000021,
        1: 0x23_00005B,
        2: 0x5D_10FFFF,
        escape: ['\\', escape],
    })

    const escape = () => ({
        ...set('"\\/bfnrt'),
        u: ['u', hex, hex, hex, hex],
    })

    const hex = () => ({
        digit,
        AF: range('AF'),
        af: range('af'),
    })

    const number = () => [integer, fraction, exponent]

    const integer = () => ({
        digit,
        onenine: [onenine, digits],
        negDigit: ['-', digit],
        negOnenine: ['-', onenine, digits],
    })

    const digits = () => ({
        digit,
        digits: [digit, digits],
    })

    /** @type {Rule} */
    const digit = () => ({
        '0': '0',
        onenine,
    })

    const onenine = range('19')

    const fraction = () => ({
        none,
        digits: ['.', digits],
    })

    const exponent = () => ({
        none,
        E: ['E', sign, digits],
        e: ['e', sign, digits],
    })

    const sign = {
        none,
        ...set('+-'),
    }

    const ws = () => ({
        none,
        ' ': [' ', ws],
        '\n': ['\n', ws],
        '\r': ['\r', ws],
        '\t': ['\t', ws],
    })

    return json
}

/** @type {() => Rule} */
export const deterministic = () => {

    const onenine = range('19')

    /** @type {Rule} */
    const digit = range('09')

    const string = [
        '"',
        repeat0Plus({
            ...remove(range(` ${unicodeMax}`), set('"\\')),
            escape: [
                '\\',
                {
                    ...set('"\\/bfnrt'),
                    u: [
                        'u',
                        ...repeat(4)({
                            digit,
                            AF: range('AF'),
                            af: range('af'),
                        })
                    ],
                }
            ],
        }),
        '"'
    ]

    const digits0 = repeat0Plus(digit)

    const digits = [digit, digits0]

    const number = [
        option('-'),
        {
            0: '0',
            onenine: [onenine, digits0],
        },
        option(['.', digits]),
        option([set('Ee'), option(set('+-')), digits])
    ]

    const ws = repeat0Plus(set(' \n\r\t'))

    const cj = commaJoin0Plus(ws)

    const value = () => ({
        array: cj('[]', value),
        object: cj('{}', [string, ws, ':', ws, value]),
        string,
        number,
        true: 'true',
        false: 'false',
        null: 'null'
    })

    const json = [ws, value, ws]

    return json
}

//

/**
 * The AST shape both matcher backends produce. `bnf/descent` pairs each
 * consumed code point with its metadata and `bnf/ll1` does not, so a leaf is
 * either form; the nodes themselves are the same `{ tag, sequence }`.
 *
 * @typedef {{
 *     readonly tag: string | true | undefined
 *     readonly sequence: readonly _AstChild[]
 * }} _AstNode
 */

/** @typedef {_AstNode | number | readonly [number, unknown]} _AstChild */

/**
 * @param {_AstChild} child
 * @returns {child is _AstNode}
 */
const isAstNode = child => typeof child !== 'number' && !(child instanceof Array)

/** @type {(child: number | readonly [number, unknown]) => number} */
const codePointOf = child => typeof child === 'number' ? child : child[0]

/**
 * A tag as `showAst` writes it: a quoted string, `*` for the tagless empty
 * match, and nothing at all for an untagged node. `*` rather than `true`
 * because a branch may itself be named `true` — the JSON grammars have one.
 *
 * @type {(tag: string | true | undefined) => string}
 */
const showTag = tag =>
    tag === undefined ? '' : tag === true ? '*' : JSON.stringify(tag)

/** @typedef {{ readonly parts: readonly string[], readonly text: string }} _Parts */

/**
 * Ends the run of consumed code points being accumulated, if there is one, so
 * that a node's text appears as one quoted string rather than one part per
 * symbol.
 *
 * @type {(acc: _Parts) => readonly string[]}
 */
const flushText = acc =>
    acc.text === '' ? acc.parts : [...acc.parts, JSON.stringify(acc.text)]

/** @type {(acc: _Parts, child: _AstChild) => _Parts} */
const addChild = (acc, child) =>
    isAstNode(child)
        ? { parts: [...flushText(acc), showAst(child)], text: '' }
        : { parts: acc.parts, text: acc.text + codePointToString(codePointOf(child)) }

/** @type {_Parts} */
const noParts = { parts: [], text: '' }

/**
 * Renders a matcher AST as one line of `tag(children)`, with the code points a
 * node consumed directly written as one quoted string.
 *
 * A proof that pins a whole AST is checking its *shape*, and raw JSON buries
 * that under `{"tag":…,"sequence":[…]}` and a `[32,null]` per space — several
 * kilobytes for an input a reader can hold in their head. This keeps the two
 * things a repetition changes legible: how deep the nesting goes, and which
 * tags survive. Repeated items are siblings under one node, whereas the
 * right-recursive encoding puts each item one level deeper than the last.
 *
 * @type {(node: _AstNode) => string}
 *
 * @example
 *
 * ```ts
 * // three spaces matched by a flat `repeat`, then by right-recursion
 * '(" "(" ") " "(" ") " "(" "))'
 * '" "(" " " "(" " " "(" " *())'
 * ```
 */
export const showAst = node =>
    `${showTag(node.tag)}(${flushText(node.sequence.reduce(addChild, noParts)).join(' ')})`
