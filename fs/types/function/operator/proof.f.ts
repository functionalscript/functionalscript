import { assert, assertEq } from '../../../asserts/module.f.ts'
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
} from './module.f.ts'

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
    const result = addition(3)(4)
    assertEq(result, 7)
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
    const op = (input: number, state: number) => [input + state, input + state] as const
    const scan = stateScanToScan(op)(0)
    const [v1, scan2] = scan(3)
    assertEq(v1, 3)
    const [v2] = scan2(4)
    assertEq(v2, 7)
}

export const proof = { joinTest, concatTest, logicalNotTest, strictEqualTest, additionTest, incrementTest, counterTest, stateScanToScanTest, foldToScanTest, reduceToScanTest }
