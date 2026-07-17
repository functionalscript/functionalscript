import { assert } from '../../../asserts/module.f.ts'
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
    assert(result === 'hello, world', result)
}

const concatTest = () => {
    const result = concat('world')('hello')
    assert(result === 'helloworld', result)
}

const logicalNotTest = () => {
    assert(logicalNot(true) === false, 'expected false')
    assert(logicalNot(false) === true, 'expected true')
}

const strictEqualTest = () => {
    assert(strictEqual(1)(1), 'expected true')
    assert(!(strictEqual(1)(2)), 'expected false')
}

const additionTest = () => {
    const result = addition(3)(4)
    assert(result === 7, result)
}

const incrementTest = () => {
    assert(increment(4) === 5, 'increment(4)')
    assert(increment(0) === 1, 'increment(0)')
}

const foldToScanTest = () => {
    const scan = foldToScan(addition)(0)
    const [v1, scan2] = scan(3)
    assert(v1 === 3, v1)
    const [v2] = scan2(4)
    assert(v2 === 7, v2)
}

const reduceToScanTest = () => {
    const scan = reduceToScan(addition)
    const [v0, scan2] = scan(10)
    assert(v0 === 10, v0)
    const [v1] = scan2(5)
    assert(v1 === 15, v1)
}

const counterTest = () => {
    const fn = counter()
    assert(fn(4) === 5, 'counter() returned wrong function')
}

const stateScanToScanTest = () => {
    const op = (input: number, state: number) => [input + state, input + state] as const
    const scan = stateScanToScan(op)(0)
    const [v1, scan2] = scan(3)
    assert(v1 === 3, v1)
    const [v2] = scan2(4)
    assert(v2 === 7, v2)
}

export const proof = { joinTest, concatTest, logicalNotTest, strictEqualTest, additionTest, incrementTest, counterTest, stateScanToScanTest, foldToScanTest, reduceToScanTest }
