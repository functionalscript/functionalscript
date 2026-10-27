/** Continuations pending in the task evaluator. @module */

import type { Task } from './types.ts'

export type _Frame = { readonly next: (value: unknown) => Task<unknown>; readonly tail: _Frame | null }
