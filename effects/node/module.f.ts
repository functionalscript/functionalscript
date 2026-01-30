/**
 * Node.js Effect Interpreter Types
 * 
 * This module provides the pure functional interface for the Node.js
 * effect interpreter. It defines the types for running effects in a
 * Node.js environment.
 */

import type { 
    AnyEffect,
    PrimitiveEffect,
    ReadFile,
    WriteFile,
    ReadDir,
    Exit,
    Log,
    Error,
    GetArgs,
    GetEnv,
    ReadFileResult,
    WriteFileResult,
    ReadDirResult,
    LogResult,
    ErrorResult,
    GetArgsResult,
    GetEnvResult,
} from '../module.f.ts'

// Interpreter for primitive effects (to be provided by impure runner)
export type PrimitiveHandler = {
    readonly readFile: (path: string) => Promise<ReadFileResult>
    readonly writeFile: (path: string, content: string) => Promise<WriteFileResult>
    readonly readDir: (path: string) => Promise<ReadDirResult>
    readonly exit: (code: number) => never
    readonly log: (message: string) => Promise<LogResult>
    readonly error: (message: string) => Promise<ErrorResult>
    readonly getArgs: () => GetArgsResult
    readonly getEnv: (name: string) => GetEnvResult
}

// Mock handler for testing - all operations are pure
export type MockFs = {
    readonly [path: string]: string | readonly string[]
}

export type MockEnv = {
    readonly [name: string]: string
}

export type MockState = {
    readonly fs: MockFs
    readonly env: MockEnv
    readonly args: readonly string[]
    readonly stdout: readonly string[]
    readonly stderr: readonly string[]
    readonly exitCode: number | null
}

// Create an empty mock state
export const emptyMockState = (
    args: readonly string[] = [],
    env: MockEnv = {},
    fs: MockFs = {}
): MockState => ({
    fs,
    env,
    args,
    stdout: [],
    stderr: [],
    exitCode: null,
})

// Mock state update functions (pure)
export const mockReadFile = (
    state: MockState,
    path: string
): [MockState, ReadFileResult] => {
    const content = state.fs[path]
    if (typeof content === 'string') {
        return [state, content]
    }
    return [state, null]
}

export const mockWriteFile = (
    state: MockState,
    path: string,
    content: string
): [MockState, WriteFileResult] => {
    const newFs = { ...state.fs, [path]: content }
    return [{ ...state, fs: newFs }, true]
}

export const mockReadDir = (
    state: MockState,
    path: string
): [MockState, ReadDirResult] => {
    const content = state.fs[path]
    if (Array.isArray(content)) {
        return [state, content as readonly string[]]
    }
    return [state, null]
}

export const mockLog = (
    state: MockState,
    message: string
): [MockState, LogResult] => {
    const newStdout = [...state.stdout, message]
    return [{ ...state, stdout: newStdout }, undefined]
}

export const mockError = (
    state: MockState,
    message: string
): [MockState, ErrorResult] => {
    const newStderr = [...state.stderr, message]
    return [{ ...state, stderr: newStderr }, undefined]
}

export const mockGetArgs = (
    state: MockState
): [MockState, GetArgsResult] => {
    return [state, state.args]
}

export const mockGetEnv = (
    state: MockState,
    name: string
): [MockState, GetEnvResult] => {
    return [state, state.env[name]]
}

export const mockExit = (
    state: MockState,
    code: number
): MockState => {
    return { ...state, exitCode: code }
}

// Pure interpreter for testing - runs effect against mock state
import {
    pureTag,
    flatMapTag,
    readFileTag,
    writeFileTag,
    readDirTag,
    exitTag,
    logTag,
    errorTag,
    getArgsTag,
    getEnvTag,
    isPure,
    isFlatMap,
} from '../module.f.ts'

export type InterpretResult<A> = readonly [MockState, A]

// Interpret a primitive effect against mock state
export const interpretPrimitive = (
    state: MockState,
    effect: PrimitiveEffect
): InterpretResult<unknown> => {
    const tag = effect[0]
    switch (tag) {
        case readFileTag:
            return mockReadFile(state, effect[1])
        case writeFileTag:
            return mockWriteFile(state, effect[1], effect[2])
        case readDirTag:
            return mockReadDir(state, effect[1])
        case logTag:
            return mockLog(state, effect[1])
        case errorTag:
            return mockError(state, effect[1])
        case getArgsTag:
            return mockGetArgs(state)
        case getEnvTag:
            return mockGetEnv(state, effect[1])
        case exitTag:
            // For mock, we just record the exit code
            return [mockExit(state, effect[1]), undefined]
    }
}

// Interpret any effect against mock state (recursive)
export const interpret = <A>(
    state: MockState,
    effect: AnyEffect<A>
): InterpretResult<A> => {
    if (isPure(effect)) {
        return [state, effect[1]]
    }
    
    if (isFlatMap(effect)) {
        const [newState, result] = interpret(state, effect[1] as AnyEffect<unknown>)
        const nextEffect = effect[2](result)
        return interpret(newState, nextEffect as AnyEffect<A>)
    }
    
    // Primitive effect
    return interpretPrimitive(state, effect) as InterpretResult<A>
}

// Helper to run an effect with initial mock state and return final state
export const runMock = <A>(
    effect: AnyEffect<A>,
    initialState: MockState = emptyMockState()
): InterpretResult<A> =>
    interpret(initialState, effect)
