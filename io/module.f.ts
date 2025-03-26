import type { Result } from '../types/result/module.f.ts'

/**
 * Standard Node.js buffer encoding type
 * @see https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings
 */
export type BufferEncoding = 'utf8'

/**
 * Represents a directory entry (file or directory) in the filesystem
 * @see https://nodejs.org/api/fs.html#class-fsdirent
 */
export type Dirent = {
   readonly name: string,
   readonly isDirectory: () => boolean,
   readonly isFile: () => boolean,
}

/**
 * File system operations interface
 * @see https://nodejs.org/api/fs.html
 */
export type Fs = {
   readonly writeFileSync: (file: string, data: string) => void
   readonly readFileSync: (path: string, options: BufferEncoding) => string | null
   readonly existsSync: (path: string) => boolean
   readonly promises: {
      readonly readFile: (path: string, options: BufferEncoding) => Promise<string>
      readonly writeFile: (path: string, data: string, options: BufferEncoding) => Promise<void>
      readonly readdir: (path: string, options: { withFileTypes: true }) => Promise<Dirent[]>
   }
}

/**
 * Console operations interface
 * @see https://nodejs.org/api/console.html
 */
export type Console = {
   readonly log: (...d: unknown[]) => void,
   readonly error: (...d: unknown[]) => void
}

/**
 * Represents an ES module with a default export
 */
export type Module = {
   readonly default: unknown
}

/**
 * High-resolution time measurement interface
 * @see https://nodejs.org/api/perf_hooks.html#performance-now
 */
export type Performance = {
   readonly now: () => number
}

/**
 * Core IO operations interface providing access to system resources
 */
export type Io = {
   readonly console: Console,
   readonly fs: Fs,
   readonly process: Process
   readonly asyncImport: (s: string) => Promise<Module>
   readonly performance: Performance
   readonly tryCatch: <T>(f: () => T) => Result<T, unknown>
   readonly asyncTryCatch: <T>(f: () => Promise<T>) => Promise<Result<T, unknown>>
}

/**
 * Node.js Process interface
 * @see https://nodejs.org/api/process.html
 */
export type Process = {
   readonly argv: string[]
   readonly env: Env
   readonly exit: (code: number) => never
}

/**
 * The environment variables.
 */
export type Env = {
   readonly [k: string]: string|undefined
}

/**
 * Runs a function and exits the process with the returned code
 * Handles errors by exiting with code 1
 */
export const run = async(io: Io, f: (io: Io) => Promise<number>) => {
   const r = await io.asyncTryCatch(() => f(io))
   io.process.exit(r[0] === 'error' ? 1 : r[1])
}
