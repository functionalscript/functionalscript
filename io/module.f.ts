export type BufferEncoding = 'utf8'

export type Dirent = {
   readonly name: string,
   readonly isDirectory: () => boolean,
   readonly isFile: () => boolean,
}

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

export type Console = {
   readonly log: (...d: unknown[]) => void,
   readonly error: (...d: unknown[]) => void
}

export type Module = {
   readonly default: unknown
}

export type Io = {
   readonly console: Console,
   readonly fs: Fs,
   readonly process: Process
   readonly asyncImport: (s: string) => Promise<Module>
}

export type Process = {
   readonly argv: string[]
   readonly env: Env
}

export type Env = {
   readonly [k: string]: string|undefined
}
