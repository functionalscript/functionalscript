/**
 * Tests for Node.js effects module
 */

import * as E from '../module.f.ts'
import * as N from './module.f.ts'

// Test emptyMockState
const testEmptyMockState = (): boolean => {
    const state = N.emptyMockState()
    return JSON.stringify(state.fs) === '{}'
        && JSON.stringify(state.env) === '{}'
        && JSON.stringify(state.args) === '[]'
        && JSON.stringify(state.stdout) === '[]'
        && JSON.stringify(state.stderr) === '[]'
        && state.exitCode === null
}

const testEmptyMockStateWithArgs = (): boolean => {
    const state = N.emptyMockState(['a', 'b'], { X: 'Y' }, { '/f': 'c' })
    return JSON.stringify(state.args) === '["a","b"]'
        && state.env.X === 'Y'
        && state.fs['/f'] === 'c'
}

// Test mockReadFile
const testMockReadFileExists = (): boolean => {
    const state = N.emptyMockState([], {}, { '/test.txt': 'hello' })
    const [newState, result] = N.mockReadFile(state, '/test.txt')
    return result === 'hello' && newState === state
}

const testMockReadFileNotExists = (): boolean => {
    const state = N.emptyMockState()
    const [newState, result] = N.mockReadFile(state, '/missing.txt')
    return result === null && newState === state
}

const testMockReadFileDir = (): boolean => {
    const state = N.emptyMockState([], {}, { '/dir': ['a', 'b'] })
    const [newState, result] = N.mockReadFile(state, '/dir')
    return result === null && newState === state
}

// Test mockWriteFile
const testMockWriteFile = (): boolean => {
    const state = N.emptyMockState()
    const [newState, result] = N.mockWriteFile(state, '/new.txt', 'content')
    return result === true && newState.fs['/new.txt'] === 'content'
}

const testMockWriteFileOverwrite = (): boolean => {
    const state = N.emptyMockState([], {}, { '/file.txt': 'old' })
    const [newState, result] = N.mockWriteFile(state, '/file.txt', 'new')
    return result === true && newState.fs['/file.txt'] === 'new'
}

// Test mockReadDir
const testMockReadDirExists = (): boolean => {
    const state = N.emptyMockState([], {}, { '/dir': ['a.txt', 'b.txt'] })
    const [newState, result] = N.mockReadDir(state, '/dir')
    return result !== null 
        && JSON.stringify(result) === '["a.txt","b.txt"]'
        && newState === state
}

const testMockReadDirNotExists = (): boolean => {
    const state = N.emptyMockState()
    const [newState, result] = N.mockReadDir(state, '/missing')
    return result === null && newState === state
}

const testMockReadDirFile = (): boolean => {
    const state = N.emptyMockState([], {}, { '/file': 'content' })
    const [newState, result] = N.mockReadDir(state, '/file')
    return result === null && newState === state
}

// Test mockLog
const testMockLog = (): boolean => {
    const state = N.emptyMockState()
    const [newState, result] = N.mockLog(state, 'hello')
    return result === undefined 
        && JSON.stringify(newState.stdout) === '["hello"]'
}

const testMockLogMultiple = (): boolean => {
    const state = N.emptyMockState()
    const [state1, _r1] = N.mockLog(state, 'a')
    const [state2, _r2] = N.mockLog(state1, 'b')
    return JSON.stringify(state2.stdout) === '["a","b"]'
}

// Test mockError
const testMockError = (): boolean => {
    const state = N.emptyMockState()
    const [newState, result] = N.mockError(state, 'oops')
    return result === undefined 
        && JSON.stringify(newState.stderr) === '["oops"]'
}

// Test mockGetArgs
const testMockGetArgs = (): boolean => {
    const state = N.emptyMockState(['node', 'script.js', 'arg1'])
    const [newState, result] = N.mockGetArgs(state)
    return JSON.stringify(result) === '["node","script.js","arg1"]'
        && newState === state
}

// Test mockGetEnv
const testMockGetEnvExists = (): boolean => {
    const state = N.emptyMockState([], { PATH: '/usr/bin' })
    const [newState, result] = N.mockGetEnv(state, 'PATH')
    return result === '/usr/bin' && newState === state
}

const testMockGetEnvNotExists = (): boolean => {
    const state = N.emptyMockState()
    const [newState, result] = N.mockGetEnv(state, 'MISSING')
    return result === undefined && newState === state
}

// Test mockExit
const testMockExit = (): boolean => {
    const state = N.emptyMockState()
    const newState = N.mockExit(state, 42)
    return newState.exitCode === 42
}

// Test interpretPrimitive
const testInterpretPrimitiveReadFile = (): boolean => {
    const state = N.emptyMockState([], {}, { '/f': 'x' })
    const [_, result] = N.interpretPrimitive(state, E.readFile('/f'))
    return result === 'x'
}

const testInterpretPrimitiveWriteFile = (): boolean => {
    const state = N.emptyMockState()
    const [newState, result] = N.interpretPrimitive(state, E.writeFile('/f', 'y'))
    return result === true && newState.fs['/f'] === 'y'
}

const testInterpretPrimitiveReadDir = (): boolean => {
    const state = N.emptyMockState([], {}, { '/d': ['a'] })
    const [_, result] = N.interpretPrimitive(state, E.readDir('/d'))
    return JSON.stringify(result) === '["a"]'
}

const testInterpretPrimitiveLog = (): boolean => {
    const state = N.emptyMockState()
    const [newState, result] = N.interpretPrimitive(state, E.log('hi'))
    return result === undefined && newState.stdout[0] === 'hi'
}

const testInterpretPrimitiveError = (): boolean => {
    const state = N.emptyMockState()
    const [newState, result] = N.interpretPrimitive(state, E.error('err'))
    return result === undefined && newState.stderr[0] === 'err'
}

const testInterpretPrimitiveGetArgs = (): boolean => {
    const state = N.emptyMockState(['a', 'b'])
    const [_, result] = N.interpretPrimitive(state, E.getArgs)
    return JSON.stringify(result) === '["a","b"]'
}

const testInterpretPrimitiveGetEnv = (): boolean => {
    const state = N.emptyMockState([], { X: 'val' })
    const [_, result] = N.interpretPrimitive(state, E.getEnv('X'))
    return result === 'val'
}

const testInterpretPrimitiveExit = (): boolean => {
    const state = N.emptyMockState()
    const [newState, _] = N.interpretPrimitive(state, E.exit(99))
    return newState.exitCode === 99
}

// Test interpret
const testInterpretPure = (): boolean => {
    const state = N.emptyMockState()
    const [_, result] = N.interpret(state, E.pure(42))
    return result === 42
}

const testInterpretFlatMap = (): boolean => {
    const state = N.emptyMockState([], {}, { '/f': 'content' })
    const effect = E.flatMap(
        E.readFile('/f'),
        content => E.pure(content?.length ?? 0)
    )
    const [_, result] = N.interpret(state, effect)
    return result === 7
}

const testInterpretChain = (): boolean => {
    const state = N.emptyMockState()
    const effect = E.flatMap(
        E.writeFile('/f', 'hello'),
        _ok => E.flatMap(
            E.readFile('/f'),
            content => E.pure(content)
        )
    )
    const [_, result] = N.interpret(state, effect)
    return result === 'hello'
}

const testInterpretMap = (): boolean => {
    const state = N.emptyMockState()
    const effect = E.map(E.pure(10), x => x * 2)
    const [_, result] = N.interpret(state, effect)
    return result === 20
}

const testInterpretAndThen = (): boolean => {
    const state = N.emptyMockState()
    const effect = E.andThen(E.log('first'), E.pure(42))
    const [newState, result] = N.interpret(state, effect)
    return result === 42 && newState.stdout[0] === 'first'
}

const testInterpretBefore = (): boolean => {
    const state = N.emptyMockState()
    const effect = E.before(E.pure(42), E.log('after'))
    const [newState, result] = N.interpret(state, effect)
    return result === 42 && newState.stdout[0] === 'after'
}

const testInterpretTraverse = (): boolean => {
    const state = N.emptyMockState()
    const effect = E.traverse([1, 2, 3], n => E.pure(n * 2))
    const [_, result] = N.interpret(state, effect)
    return JSON.stringify(result) === '[2,4,6]'
}

const testInterpretForEach = (): boolean => {
    const state = N.emptyMockState()
    const effect = E.forEach(['a', 'b', 'c'], s => E.log(s))
    const [newState, _] = N.interpret(state, effect)
    return JSON.stringify(newState.stdout) === '["a","b","c"]'
}

// Test runMock
const testRunMock = (): boolean => {
    const [state, result] = N.runMock(E.pure(123))
    return result === 123 && state.exitCode === null
}

const testRunMockWithState = (): boolean => {
    const initial = N.emptyMockState(['arg'], { K: 'V' }, { '/x': 'y' })
    const effect = E.flatMap(
        E.getArgs,
        args => E.flatMap(
            E.getEnv('K'),
            env => E.flatMap(
                E.readFile('/x'),
                file => E.pure({ args, env, file })
            )
        )
    )
    const [_, result] = N.runMock(effect, initial)
    return JSON.stringify(result) === '{"args":["arg"],"env":"V","file":"y"}'
}

// Run all tests
export const runTests = (): readonly [string, boolean][] => [
    ['emptyMockState default', testEmptyMockState()],
    ['emptyMockState with args', testEmptyMockStateWithArgs()],
    ['mockReadFile exists', testMockReadFileExists()],
    ['mockReadFile not exists', testMockReadFileNotExists()],
    ['mockReadFile dir', testMockReadFileDir()],
    ['mockWriteFile', testMockWriteFile()],
    ['mockWriteFile overwrite', testMockWriteFileOverwrite()],
    ['mockReadDir exists', testMockReadDirExists()],
    ['mockReadDir not exists', testMockReadDirNotExists()],
    ['mockReadDir file', testMockReadDirFile()],
    ['mockLog', testMockLog()],
    ['mockLog multiple', testMockLogMultiple()],
    ['mockError', testMockError()],
    ['mockGetArgs', testMockGetArgs()],
    ['mockGetEnv exists', testMockGetEnvExists()],
    ['mockGetEnv not exists', testMockGetEnvNotExists()],
    ['mockExit', testMockExit()],
    ['interpretPrimitive readFile', testInterpretPrimitiveReadFile()],
    ['interpretPrimitive writeFile', testInterpretPrimitiveWriteFile()],
    ['interpretPrimitive readDir', testInterpretPrimitiveReadDir()],
    ['interpretPrimitive log', testInterpretPrimitiveLog()],
    ['interpretPrimitive error', testInterpretPrimitiveError()],
    ['interpretPrimitive getArgs', testInterpretPrimitiveGetArgs()],
    ['interpretPrimitive getEnv', testInterpretPrimitiveGetEnv()],
    ['interpretPrimitive exit', testInterpretPrimitiveExit()],
    ['interpret pure', testInterpretPure()],
    ['interpret flatMap', testInterpretFlatMap()],
    ['interpret chain', testInterpretChain()],
    ['interpret map', testInterpretMap()],
    ['interpret andThen', testInterpretAndThen()],
    ['interpret before', testInterpretBefore()],
    ['interpret traverse', testInterpretTraverse()],
    ['interpret forEach', testInterpretForEach()],
    ['runMock', testRunMock()],
    ['runMock with state', testRunMockWithState()],
]

// Export test results
export default runTests()
