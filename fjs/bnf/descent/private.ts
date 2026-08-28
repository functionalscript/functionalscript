/**
 * Implementation-private types for the recursive descent matcher backend.
 */

import type { TerminalRange } from '../types.ts'
import type { AstResult, Cursor } from '../matcher/types.ts'
import type { CodePointMeta, DescentFailure } from './types.ts'

/**
 * The furthest-failure record while matching, positioned by the complete
 * {@link Cursor}. {@link DescentFailure} is its public, physically-positioned
 * form.
 */
export type _Failure = {
    readonly pos: Cursor
    readonly expected: readonly TerminalRange[]
}

/**
 * The machine's own result: a `DescentMatchResult` positioned by the complete
 * cursor, and with no failure record — that one is tracked per match rather
 * than per frame. This backend always has a position, so it needs no `null`
 * case.
 */
export type _Result<T> = AstResult<CodePointMeta<T>, Cursor>
