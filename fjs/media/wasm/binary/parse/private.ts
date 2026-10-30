/**
 * The parser's own types.
 *
 * @module
 */

import type { Result } from '../../../../types/result/types.ts'
import type { Bytes, Func, Module } from '../../types.ts'

/**
 * A reader: what it reads at offset `i` of `b`, with the offset after it, or
 * why it cannot.
 */
export type _Read<T> = (b: Bytes, i: number) => Result<readonly [T, number], string>

/** A function's code, before the function section's type is joined to it. */
export type _Code = Omit<Func, 'type'>

/**
 * What the known sections read: the module's fields, with the function
 * section's type indices and the code section's bodies apart until the end.
 */
export type _Sections = Omit<Module, 'functions' | 'customs'> & {
    readonly funcs: readonly number[]
    readonly code: readonly _Code[]
}
