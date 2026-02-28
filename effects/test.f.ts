/**
 * Tests for effects module
 */

import * as E from './module.f.ts'

// Test primitive effect constructors
const testReadFile = (): boolean => {
    const effect = E.readFile('/path/to/file')
    return effect[0] === E.readFileTag && effect[1] === '/path/to/file'
}

const testWriteFile = (): boolean => {
    const effect = E.writeFile('/path/to/file', 'content')
    return effect[0] === E.writeFileTag 
        && effect[1] === '/path/to/file' 
        && effect[2] === 'content'
}

const testReadDir = (): boolean => {
    const effect = E.readDir('/path/to/dir')
    return effect[0] === E.readDirTag && effect[1] === '/path/to/dir'
}

const testExit = (): boolean => {
    const effect = E.exit(1)
    return effect[0] === E.exitTag && effect[1] === 1
}

const testLog = (): boolean => {
    const effect = E.log('hello')
    return effect[0] === E.logTag && effect[1] === 'hello'
}

const testError = (): boolean => {
    const effect = E.error('oops')
    return effect[0] === E.errorTag && effect[1] === 'oops'
}

const testGetArgs = (): boolean => {
    const effect = E.getArgs
    return effect[0] === E.getArgsTag
}

const testGetEnv = (): boolean => {
    const effect = E.getEnv('PATH')
    return effect[0] === E.getEnvTag && effect[1] === 'PATH'
}

// Test pure
const testPure = (): boolean => {
    const effect = E.pure(42)
    return effect[0] === E.pureTag && effect[1] === 42
}

// Test flatMap
const testFlatMap = (): boolean => {
    const readEff = E.readFile('/test')
    const combined = E.flatMap(readEff, content => E.log(content ?? 'empty'))
    return combined[0] === E.flatMapTag
        && combined[1] === readEff
        && typeof combined[2] === 'function'
}

// Test map
const testMap = (): boolean => {
    const readEff = E.pure(10)
    const mapped = E.map(readEff, x => x * 2)
    // map creates a flatMap
    return mapped[0] === E.flatMapTag
}

// Test andThen
const testAndThen = (): boolean => {
    const first = E.log('first')
    const second = E.log('second')
    const combined = E.andThen(first, second)
    return combined[0] === E.flatMapTag && combined[1] === first
}

// Test before
const testBefore = (): boolean => {
    const first = E.pure(42)
    const second = E.log('done')
    const combined = E.before(first, second)
    return combined[0] === E.flatMapTag && combined[1] === first
}

// Test foldEffect with empty array
const testFoldEffectEmpty = (): boolean => {
    const result = E.foldEffect(
        [] as readonly number[],
        0,
        (acc, n) => E.pure(acc + n)
    )
    return E.isPure(result) && result[1] === 0
}

// Test foldEffect with values
const testFoldEffectValues = (): boolean => {
    const result = E.foldEffect(
        [1, 2, 3] as const,
        0,
        (acc, n) => E.pure(acc + n)
    )
    return result[0] === E.flatMapTag
}

// Test traverse
const testTraverse = (): boolean => {
    const result = E.traverse(
        [1, 2, 3] as const,
        n => E.pure(n * 2)
    )
    return result[0] === E.flatMapTag
}

// Test traverse empty
const testTraverseEmpty = (): boolean => {
    const result = E.traverse(
        [] as readonly number[],
        n => E.pure(n * 2)
    )
    return E.isPure(result) && JSON.stringify(result[1]) === '[]'
}

// Test sequence
const testSequence = (): boolean => {
    const effects = [E.pure(1), E.pure(2), E.pure(3)] as const
    const result = E.sequence(effects)
    return result[0] === E.flatMapTag
}

// Test forEach
const testForEach = (): boolean => {
    const result = E.forEach(
        [1, 2, 3] as const,
        n => E.log(String(n))
    )
    return result[0] === E.flatMapTag
}

// Test getTag
const testGetTag = (): boolean => {
    return E.getTag(E.pure(1)) === E.pureTag
        && E.getTag(E.readFile('/test')) === E.readFileTag
        && E.getTag(E.log('hi')) === E.logTag
}

// Test isPure
const testIsPure = (): boolean => {
    return E.isPure(E.pure(1)) === true
        && E.isPure(E.readFile('/test')) === false
        && E.isPure(E.flatMap(E.pure(1), x => E.pure(x))) === false
}

// Test isFlatMap
const testIsFlatMap = (): boolean => {
    const fm = E.flatMap(E.pure(1), x => E.pure(x))
    return E.isFlatMap(fm) === true
        && E.isFlatMap(E.pure(1)) === false
        && E.isFlatMap(E.readFile('/test')) === false
}

// Test isPrimitive
const testIsPrimitive = (): boolean => {
    return E.isPrimitive(E.readFile('/test')) === true
        && E.isPrimitive(E.writeFile('/test', 'x')) === true
        && E.isPrimitive(E.readDir('/test')) === true
        && E.isPrimitive(E.exit(0)) === true
        && E.isPrimitive(E.log('hi')) === true
        && E.isPrimitive(E.error('err')) === true
        && E.isPrimitive(E.getArgs) === true
        && E.isPrimitive(E.getEnv('X')) === true
        && E.isPrimitive(E.pure(1)) === false
        && E.isPrimitive(E.flatMap(E.pure(1), x => E.pure(x))) === false
}

// Test tag constants
const testTags = (): boolean => {
    return E.readFileTag === 'readFile'
        && E.writeFileTag === 'writeFile'
        && E.readDirTag === 'readDir'
        && E.exitTag === 'exit'
        && E.logTag === 'log'
        && E.errorTag === 'error'
        && E.getArgsTag === 'getArgs'
        && E.getEnvTag === 'getEnv'
        && E.pureTag === 'pure'
        && E.flatMapTag === 'flatMap'
}

// Run all tests
export const runTests = (): readonly [string, boolean][] => [
    ['readFile constructor', testReadFile()],
    ['writeFile constructor', testWriteFile()],
    ['readDir constructor', testReadDir()],
    ['exit constructor', testExit()],
    ['log constructor', testLog()],
    ['error constructor', testError()],
    ['getArgs constructor', testGetArgs()],
    ['getEnv constructor', testGetEnv()],
    ['pure constructor', testPure()],
    ['flatMap constructor', testFlatMap()],
    ['map combinator', testMap()],
    ['andThen combinator', testAndThen()],
    ['before combinator', testBefore()],
    ['foldEffect empty', testFoldEffectEmpty()],
    ['foldEffect values', testFoldEffectValues()],
    ['traverse', testTraverse()],
    ['traverse empty', testTraverseEmpty()],
    ['sequence', testSequence()],
    ['forEach', testForEach()],
    ['getTag', testGetTag()],
    ['isPure', testIsPure()],
    ['isFlatMap', testIsFlatMap()],
    ['isPrimitive', testIsPrimitive()],
    ['tag constants', testTags()],
]

// Export test results
export default runTests()
