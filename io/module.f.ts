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
}