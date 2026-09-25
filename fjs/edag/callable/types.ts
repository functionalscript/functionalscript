/** @module */
export type Callable = (...args: readonly unknown[]) => unknown
export type Body = (fixed: readonly unknown[], rest: readonly unknown[]) => unknown
export type Factory = (body: Body) => Callable
