/**
 * @import { Assert } from '../../../asserts/types.ts'
 * @import { Equal } from '../../ts/types.ts'
 * @import { StateScan } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import {
    join,
    concat,
    logicalNot,
    strictEqual,
    addition,
    increment,
    counter,
    stateScanToScan,
    foldToScan,
    reduceToScan,
    cascade,
} from './module.f.mjs'

const joinTest = () => {
    const result = join(', ')('world')('hello')
    assertEq(result, 'hello, world')
}

const concatTest = () => {
    const result = concat('world')('hello')
    assertEq(result, 'helloworld')
}

const logicalNotTest = () => {
    assertEq(logicalNot(true), false, 'expected false')
    assertEq(logicalNot(false), true, 'expected true')
}

const strictEqualTest = () => {
    assert(strictEqual(1)(1), 'expected true')
    assert(!(strictEqual(1)(2)), 'expected false')
}

const additionTest = () => {
    const numberResult = addition(3)(4)
    assertEq(numberResult, 7)

    const bigintResult = addition(3n)(4n)
    assertEq(bigintResult, 7n)

    const stringResult = addition('a')('b')
    assertEq(stringResult, 'ab')
}

const incrementTest = () => {
    assertEq(increment(4), 5, 'increment(4)')
    assertEq(increment(0), 1, 'increment(0)')
}

const foldToScanTest = () => {
    const scan = foldToScan(addition)(0)
    const [v1, scan2] = scan(3)
    assertEq(v1, 3)
    const [v2] = scan2(4)
    assertEq(v2, 7)
}

const reduceToScanTest = () => {
    const scan = reduceToScan(addition)
    const [v0, scan2] = scan(10)
    assertEq(v0, 10)
    const [v1] = scan2(5)
    assertEq(v1, 15)
}

const counterTest = () => {
    const fn = counter()
    assertEq(fn(4), 5, 'counter() returned wrong function')
}

const stateScanToScanTest = () => {
    const op = (/** @type {number} */ input, /** @type {number} */ state) =>
        /** @type {const} */ ([input + state, input + state])
    const scan = stateScanToScan(op)(0)
    const [v1, scan2] = scan(3)
    assertEq(v1, 3)
    const [v2] = scan2(4)
    assertEq(v2, 7)
}

/**
 * Records the input it sees and passes on one less, stopping at `0`: a chain
 * of them fed `n` stops at position `n`.
 *
 * @type {StateScan<number, string, number | undefined>}
 */
const countDown = (input, log) =>
    [input === 0 ? undefined : input - 1, `${log}${input}`]

/** @type {StateScan<number, number, number | undefined>} */
const count = (input, n) => [input, n + 1]

const cascadeTest = {
    stopsAtEachPosition: () => {
        const c = cascade(/** @type {const} */ ([countDown, countDown, countDown]))
        /** @type {readonly [string, string, string]} */
        const prior = ['a', 'b', 'c']
        assertStructurallySame(c(0, prior), [undefined, ['a0', 'b', 'c']])
        assertStructurallySame(c(1, prior), [undefined, ['a1', 'b0', 'c']])
        assertStructurallySame(c(2, prior), [undefined, ['a2', 'b1', 'c0']])
        assertStructurallySame(c(3, prior), [0, ['a3', 'b2', 'c1']])
    },
    eachStepKeepsItsStateType: () => {
        const c = cascade(/** @type {const} */ ([countDown, count]))
        /** @typedef {Assert<Equal<typeof c, StateScan<number, readonly [string, number], number | undefined>>>} _Inferred */
        assertStructurallySame(c(1, ['', 0]), [0, ['1', 1]])
        assertStructurallySame(c(0, ['', 0]), [undefined, ['0', 0]])
    },
    noSteps: () => {
        assertStructurallySame(cascade([])(5, []), [5, []])
    },
}

export const proof = { cascadeTest, joinTest, concatTest, logicalNotTest, strictEqualTest, additionTest, incrementTest, counterTest, stateScanToScanTest, foldToScanTest, reduceToScanTest }
