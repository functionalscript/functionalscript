import {
    join,
    concat,
    logicalNot,
    strictEqual,
    addition,
    min,
    max,
    increment,
    foldToScan,
    reduceToScan,
} from './module.f.ts'

const joinTest = () => {
    const result = join(', ')('world')('hello')
    if (result !== 'hello, world') { throw result }
}

const concatTest = () => {
    const result = concat('world')('hello')
    if (result !== 'helloworld') { throw result }
}

const logicalNotTest = () => {
    if (logicalNot(true) !== false) { throw 'expected false' }
    if (logicalNot(false) !== true) { throw 'expected true' }
}

const strictEqualTest = () => {
    if (!strictEqual(1)(1)) { throw 'expected true' }
    if (strictEqual(1)(2)) { throw 'expected false' }
}

const additionTest = () => {
    const result = addition(3)(4)
    if (result !== 7) { throw result }
}

const minTest = () => {
    if (min(3)(5) !== 3) { throw 'min(3)(5)' }
    if (min(7)(2) !== 2) { throw 'min(7)(2)' }
}

const maxTest = () => {
    if (max(3)(5) !== 5) { throw 'max(3)(5)' }
    if (max(7)(2) !== 7) { throw 'max(7)(2)' }
}

const incrementTest = () => {
    if (increment(4) !== 5) { throw 'increment(4)' }
    if (increment(0) !== 1) { throw 'increment(0)' }
}

const foldToScanTest = () => {
    const scan = foldToScan(addition)(0)
    const [v1, scan2] = scan(3)
    if (v1 !== 3) { throw v1 }
    const [v2] = scan2(4)
    if (v2 !== 7) { throw v2 }
}

const reduceToScanTest = () => {
    const scan = reduceToScan(addition)
    const [v0, scan2] = scan(10)
    if (v0 !== 10) { throw v0 }
    const [v1] = scan2(5)
    if (v1 !== 15) { throw v1 }
}

export const proof = { joinTest, concatTest, logicalNotTest, strictEqualTest, additionTest, minTest, maxTest, incrementTest, foldToScanTest, reduceToScanTest }
