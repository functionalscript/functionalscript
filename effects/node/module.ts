/**
 * Node.js Effect Runner (Impure)
 * 
 * This module provides the actual impure implementation for running
 * effects in a Node.js environment. It bridges the pure effect
 * descriptions to actual I/O operations.
 */

import * as fs from 'node:fs/promises'
import * as process from 'node:process'
import type { AnyEffect, PrimitiveEffect } from '../module.f.ts'
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
import type { PrimitiveHandler } from './module.f.ts'

// Create actual Node.js handler
const createNodeHandler = (): PrimitiveHandler => ({
    readFile: async (path: string) => {
        try {
            return await fs.readFile(path, 'utf-8')
        } catch {
            return null
        }
    },
    writeFile: async (path: string, content: string) => {
        try {
            await fs.writeFile(path, content, 'utf-8')
            return true
        } catch {
            return false
        }
    },
    readDir: async (path: string) => {
        try {
            const entries = await fs.readdir(path)
            return entries
        } catch {
            return null
        }
    },
    exit: (code: number): never => {
        process.exit(code)
    },
    log: async (message: string) => {
        console.log(message)
    },
    error: async (message: string) => {
        console.error(message)
    },
    getArgs: () => process.argv,
    getEnv: (name: string) => process.env[name],
})

// Run a primitive effect with a handler
const runPrimitive = async (
    handler: PrimitiveHandler,
    effect: PrimitiveEffect
): Promise<unknown> => {
    const tag = effect[0]
    switch (tag) {
        case readFileTag:
            return handler.readFile(effect[1])
        case writeFileTag:
            return handler.writeFile(effect[1], effect[2])
        case readDirTag:
            return handler.readDir(effect[1])
        case exitTag:
            handler.exit(effect[1])
        case logTag:
            return handler.log(effect[1])
        case errorTag:
            return handler.error(effect[1])
        case getArgsTag:
            return handler.getArgs()
        case getEnvTag:
            return handler.getEnv(effect[1])
    }
}

// Run any effect with a handler
const runWithHandler = async <A>(
    handler: PrimitiveHandler,
    effect: AnyEffect<A>
): Promise<A> => {
    if (isPure(effect)) {
        return effect[1]
    }
    
    if (isFlatMap(effect)) {
        const result = await runWithHandler(handler, effect[1] as AnyEffect<unknown>)
        const nextEffect = effect[2](result)
        return runWithHandler(handler, nextEffect as AnyEffect<A>)
    }
    
    // Primitive effect
    return runPrimitive(handler, effect) as Promise<A>
}

// Default handler for Node.js
const nodeHandler = createNodeHandler()

// Run an effect in Node.js
export const run = <A>(effect: AnyEffect<A>): Promise<A> =>
    runWithHandler(nodeHandler, effect)

// Run with custom handler (for testing or other environments)
export const runWith = <A>(
    handler: PrimitiveHandler,
    effect: AnyEffect<A>
): Promise<A> =>
    runWithHandler(handler, effect)

// Export handler factory for custom configurations
export { createNodeHandler }
