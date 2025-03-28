export type BufferEncoding = 'utf8'

export type Fs = {
   readonly writeFileSync: (file: string, data: string) => void
   readonly readFileSync: (path: string, options: BufferEncoding) => string | null
}

export type Console = {
   readonly log: (...d: unknown[]) => void,
   readonly error: (...d: unknown[]) => void
}

export type Io = {
   readonly console: Console,
   readonly fs: Fs,
   readonly process: Process
}

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

export type Run = (f: (io: Io) => Promise<number>) => Promise<never>

/**
 * Runs a function and exits the process with the returned code
 * Handles errors by exiting with code 1
 */
export const run = (io: Io): Run => {
   const { process: { exit }, console: { error } } = io
   const code = ([x, b]: Result<number, unknown>) => {
      if (x === 'error') {
         error(x[1])
         return 1
      } else {
         return b
      }
   }
   return async f => exit(code(await io.asyncTryCatch(() => f(io))))
}
