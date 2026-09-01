/**
 * @import { Base } from './types.ts'
 * @import { Type } from '../../../rtti/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.mjs'
import { array, number, or, string, unknown } from '../../../rtti/module.f.mjs'
import { none, option, range, repeat0Plus } from '../../module.f.mjs'
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
    sharedChild: () => {
        const parent = [digit, digit]
        /** @type {Base} */
        const info = {
            tag: 'sequence',
            ri: [ast, ast],
            ro: string,
            map: /** @type {any} */ (() => ['parent', undefined]),
        }
        assertEq(checkMap([[parent, info]]).size, 2)
    },
    lazyNonRepeats: () => {
        const lazyTerminal = () => digit
        const lazyString = () => 'x'
        const lazySequence = () => sequence
        const oneBranch = () => ({ digit })
        const branchA = [digit]
        const branchB = [digit]
        const noEmptyBranch = () => ({ a: branchA, b: branchB })
        const none = /** @type {const} */ ([])
        const badStep = () => ({ none, some: digit })
        const badTailStep = [digit, digit]
        const badTail = () => ({ none, some: badTailStep })
        /** @type {(tag: Base['tag'], ri: Type) => Base} */
        const info = (tag, ri) => ({
            tag,
            ri,
            ro: string,
            map: /** @type {any} */ (() => ['mapped', undefined]),
        })
        const result = checkMap([
            [lazyTerminal, info('terminal', number)],
            [lazyString, info('sequence', [number])],
            [lazySequence, info('sequence', [ast])],
            [oneBranch, info('variant', { digit: ast })],
            [noEmptyBranch, info('variant', { a: ast, b: ast })],
            [badStep, info('variant', { none: ast, some: ast })],
            [badTail, info('variant', { none: ast, some: ast })],
        ])
        assertEq(result.get(lazyTerminal)?.tag, 'terminal')
        assertEq(result.get(lazyString)?.tag, 'sequence')
        assertEq(result.get(lazySequence)?.tag, 'sequence')
        assertEq(result.get(oneBranch)?.tag, 'variant')
        assertEq(result.get(noEmptyBranch)?.tag, 'variant')
        assertEq(result.get(badStep)?.tag, 'variant')
        assertEq(result.get(badTail)?.tag, 'variant')
    },
    ambiguousNonRepeats: () => {
        const nullable = repeat0Plus(option('a'))
        const recursive = () => ({ none, some: [nested, recursive] })
        const nested = () => ({ leaf: digit, group: ['(', recursive, ')'] })
        /** @type {(ri: Type) => Base} */
        const info = ri => ({
            tag: 'variant',
            ri,
            ro: string,
            map: /** @type {any} */ (() => ['mapped', undefined]),
        })
        const result = checkMap([
            [nullable, info({ some: ast, none: ast })],
            [recursive, info({ none: ast, some: ast })],
        ])
        assertEq(result.get(nullable)?.tag, 'variant')
        assertEq(result.get(recursive)?.tag, 'variant')
    },
    throw: {
        duplicate: () => checkMap([[digit, terminalInfo], [digit, terminalInfo]]),
        kind: () => checkMap([[digit, sequenceInfo]]),
        input: () => checkMap([[digit, { ...terminalInfo, ri: string }]]),
    },
}
