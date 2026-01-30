/**
 * Impure Node.js effect runner
 * 
 * This module interprets effect data structures and performs actual I/O.
 * This is the only impure part of the effects system.
 */

import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as readline from 'readline'
import type { Effect } from '../module.f.ts'
import type { NodeEffect } from './module.f.ts'

/**
 * Run a Node.js effect and return a Promise of the result
 */
export const runEffect = async <T>(effect: Effect<T>): Promise<T> => {
    const [tag, payload, cont] = effect as NodeEffect

    if (tag === 'pure') {
        return payload as T
    }

    switch (tag) {
        case 'readFile': {
            const content = await fs.readFile(payload as string, 'utf-8')
            return runEffect(cont(content))
        }

        case 'writeFile': {
            const { path, content } = payload as { path: string, content: string }
            await fs.writeFile(path, content, 'utf-8')
            return runEffect(cont(undefined))
        }

        case 'fileExists': {
            try {
                await fs.access(payload as string)
                return runEffect(cont(true))
            } catch {
                return runEffect(cont(false))
            }
        }

        case 'readDir': {
            const entries = await fs.readdir(payload as string)
            return runEffect(cont(entries))
        }

        case 'deleteFile': {
            await fs.unlink(payload as string)
            return runEffect(cont(undefined))
        }

        case 'mkDir': {
            const { path, recursive } = payload as { path: string, recursive: boolean }
            await fs.mkdir(path, { recursive })
            return runEffect(cont(undefined))
        }

        case 'getArgs': {
            const args = process.argv.slice(2)
            return runEffect(cont(args))
        }

        case 'getEnv': {
            const value = process.env[payload as string]
            return runEffect(cont(value))
        }

        case 'exit': {
            process.exit(payload as number)
            // This line never executes, but TypeScript needs it
            return runEffect(cont(undefined as never))
        }

        case 'stdOut': {
            process.stdout.write(payload as string)
            return runEffect(cont(undefined))
        }

        case 'stdErr': {
            process.stderr.write(payload as string)
            return runEffect(cont(undefined))
        }

        case 'stdIn': {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            })
            
            const input = await new Promise<string>((resolve) => {
                let data = ''
                rl.on('line', (line) => {
                    data += line + '\n'
                })
                rl.on('close', () => {
                    resolve(data)
                })
            })
            
            return runEffect(cont(input))
        }

        default: {
            const exhaustive: never = tag
            throw new Error(`Unknown effect tag: ${exhaustive}`)
        }
    }
}

/**
 * Synchronous runner for pure effects only (useful for testing)
 */
export const runPureSync = <T>(effect: Effect<T>): T => {
    const [tag, payload] = effect as NodeEffect

    if (tag !== 'pure') {
        throw new Error(`Cannot run impure effect synchronously: ${tag}`)
    }

    return payload as T
}

/**
 * Mock runner for testing
 * Takes a map of effect handlers and runs the effect
 */
export type EffectHandler = (tag: string, payload: unknown) => unknown

export const runMock = async <T>(
    handlers: Record<string, EffectHandler>,
    effect: Effect<T>
): Promise<T> => {
    const [tag, payload, cont] = effect as NodeEffect

    if (tag === 'pure') {
        return payload as T
    }

    const handler = handlers[tag]
    if (!handler) {
        throw new Error(`No mock handler for effect: ${tag}`)
    }

    const result = handler(tag, payload)
    return runMock(handlers, cont(result))
}
