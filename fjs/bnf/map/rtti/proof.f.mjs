/**
 * @import { Base } from './types.ts'
 * @import { Type } from '../../../rtti/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.mjs'
import { array, number, or, string, unknown } from '../../../rtti/module.f.mjs'
import { range, repeat0Plus } from '../../module.f.mjs'
import { checkMap } from './module.f.mjs'

const digit = range('09')
const sequence = [digit]
const variant = { digit }
const repeated = repeat0Plus(digit)

/** @type {Type} */
const ast = () => ['const', {
    tag: or(string, true, undefined),
    sequence: array(or(ast, [number, unknown])),
}]

/** @type {Base} */
const terminalInfo = {
    tag: 'terminal',
    ri: number,
    ro: string,
    map: /** @type {any} */ (() => ['digit', undefined]),
}

/** @type {Base} */
const sequenceInfo = {
    tag: 'sequence',
    ri: [string],
    ro: string,
    map: /** @type {any} */ (() => ['sequence', undefined]),
}

/** @type {Base} */
const variantInfo = {
    tag: 'variant',
    ri: { digit: string },
    ro: string,
    map: /** @type {any} */ (() => ['variant', undefined]),
}

/** @type {Base} */
const repeatInfo = {
    tag: 'repeat',
    ri: string,
    ro: string,
    map: /** @type {any} */ ({ init: null, update: () => null, end: () => ['repeat', undefined] }),
}

export const proof = {
    kinds: () => {
        const result = checkMap([
            [digit, terminalInfo],
            [sequence, sequenceInfo],
            [variant, variantInfo],
            [repeated, repeatInfo],
        ])
        assertEq(result.size, 4)
        assertEq(result.get(digit), terminalInfo)
        assertEq(result.get(sequence), sequenceInfo)
        assertEq(result.get(variant), variantInfo)
        assertEq(result.get(repeated), repeatInfo)
    },
    stringSequence: () => {
        /** @type {Base} */
        const info = {
            tag: 'sequence',
            ri: [number, number],
            ro: string,
            map: /** @type {any} */ (() => ['hi', undefined]),
        }
        assertEq(checkMap([['hi', info]]).get('hi'), info)
    },
    implicitAst: () => {
        const parent = [digit]
        /** @type {Base} */
        const info = {
            tag: 'sequence',
            ri: [ast],
            ro: string,
            map: /** @type {any} */ (() => ['parent', undefined]),
        }
        const result = checkMap([[parent, info]])
        assertEq(result.size, 2)
        assertEq(result.get(digit)?.map, null)
    },
    throw: {
        duplicate: () => checkMap([[digit, terminalInfo], [digit, terminalInfo]]),
        kind: () => checkMap([[digit, sequenceInfo]]),
        input: () => checkMap([[digit, { ...terminalInfo, ri: string }]]),
    },
}
