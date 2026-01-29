export type Effect<R> =
  | Pure<R>
  | Do<R>

export type Pure<R> = readonly['pure', R]
export type Do<R, N extends string = string, P = unknown, T = unknown> = readonly['do', N, P, (_: T) => Effect<R>]

export type NDo<R, N extends string = string, P = unknown, T = unknown> = readonly['do', N, P, (_: T) => NodeEffect<R>]

export type NodeDo<R> =
  | NDo<R, 'readFile', readonly[string], Uint8Array>
  | NDo<R, 'writeFile', readonly[string, Uint8Array], void>
  | NDo<R, 'readdir', readonly[string], readonly { name: string; isFile: () => boolean; isDirectory: () => boolean }[]>
  | NDo<R, 'mkdir', readonly[string, { recursive: boolean }], void>

export type NodeEffect<R> = Pure<R> | NodeDo<R>
