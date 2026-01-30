/**
 * Node.js specific effects
 * 
 * This module provides effect constructors for common Node.js operations.
 * These are pure data structures describing the operations.
 */

import type { Effect, Pure } from '../module.f.ts'
import { pure } from '../module.f.ts'

/**
 * File system effects
 */

/** Read a file as a string */
export type ReadFile = readonly ['readFile', path: string, continuation: (content: string) => Effect<unknown>]

export const readFile = (path: string): Effect<string> =>
    ['readFile', path, (content: unknown) => pure(content as string)] as const

/** Write a string to a file */
export type WriteFile = readonly ['writeFile', payload: { path: string, content: string }, continuation: (result: void) => Effect<unknown>]

export const writeFile = (path: string) => (content: string): Effect<void> =>
    ['writeFile', { path, content }, (result: unknown) => pure(result as void)] as const

/** Check if a file exists */
export type FileExists = readonly ['fileExists', path: string, continuation: (exists: boolean) => Effect<unknown>]

export const fileExists = (path: string): Effect<boolean> =>
    ['fileExists', path, (exists: unknown) => pure(exists as boolean)] as const

/** Read a directory */
export type ReadDir = readonly ['readDir', path: string, continuation: (entries: readonly string[]) => Effect<unknown>]

export const readDir = (path: string): Effect<readonly string[]> =>
    ['readDir', path, (entries: unknown) => pure(entries as readonly string[])] as const

/** Delete a file */
export type DeleteFile = readonly ['deleteFile', path: string, continuation: (result: void) => Effect<unknown>]

export const deleteFile = (path: string): Effect<void> =>
    ['deleteFile', path, (result: unknown) => pure(result as void)] as const

/** Create a directory */
export type MkDir = readonly ['mkDir', payload: { path: string, recursive: boolean }, continuation: (result: void) => Effect<unknown>]

export const mkDir = (path: string) => (recursive: boolean): Effect<void> =>
    ['mkDir', { path, recursive }, (result: unknown) => pure(result as void)] as const

/**
 * Process effects
 */

/** Get command line arguments */
export type GetArgs = readonly ['getArgs', null, continuation: (args: readonly string[]) => Effect<unknown>]

export const getArgs: Effect<readonly string[]> =
    ['getArgs', null, (args: unknown) => pure(args as readonly string[])] as const

/** Get environment variable */
export type GetEnv = readonly ['getEnv', name: string, continuation: (value: string | undefined) => Effect<unknown>]

export const getEnv = (name: string): Effect<string | undefined> =>
    ['getEnv', name, (value: unknown) => pure(value as string | undefined)] as const

/** Exit the process */
export type Exit = readonly ['exit', code: number, continuation: (result: never) => Effect<unknown>]

export const exit = (code: number): Effect<never> =>
    ['exit', code, (result: unknown) => pure(result as never)] as const

/**
 * Console effects
 */

/** Write to stdout */
export type StdOut = readonly ['stdOut', message: string, continuation: (result: void) => Effect<unknown>]

export const stdOut = (message: string): Effect<void> =>
    ['stdOut', message, (result: unknown) => pure(result as void)] as const

/** Write to stderr */
export type StdErr = readonly ['stdErr', message: string, continuation: (result: void) => Effect<unknown>]

export const stdErr = (message: string): Effect<void> =>
    ['stdErr', message, (result: unknown) => pure(result as void)] as const

/** Read from stdin */
export type StdIn = readonly ['stdIn', null, continuation: (input: string) => Effect<unknown>]

export const stdIn: Effect<string> =
    ['stdIn', null, (input: unknown) => pure(input as string)] as const

/**
 * Union type of all Node.js effects
 */
export type NodeEffect =
    | ReadFile
    | WriteFile
    | FileExists
    | ReadDir
    | DeleteFile
    | MkDir
    | GetArgs
    | GetEnv
    | Exit
    | StdOut
    | StdErr
    | StdIn
    | Pure<unknown>

/**
 * Extract the tag type from an effect
 */
export type EffectTag = NodeEffect[0]
