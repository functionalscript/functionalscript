export type RmOptions = {
   force?: boolean
   recursive?: boolean
}

export type MakeDirectoryOptions = {
   recursive?: boolean
}

export type BufferEncoding = 'utf8'

export type Promises = {
   readonly readdir: (path: string) => Promise<string[]>
   readonly rm: (path: string, options?: RmOptions) => Promise<void>
   readonly mkdir: (path: string, options?: MakeDirectoryOptions) => Promise<string|undefined>
   readonly copyFile: (src: string, dest: string) => Promise<void>
   readonly writeFile: (file: string, data: string) => Promise<void>
   readonly readFile: (path: string, options: BufferEncoding) => Promise<string>
}

export type Fs = {
   readonly promises: Promises
}

export type Console = {
   readonly log: (...d: unknown[]) => void
}

export type Io = {
   readonly console: Console,
   readonly fs: Fs
}