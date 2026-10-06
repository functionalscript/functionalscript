/** The target-runtime boundary for callable value construction. @module */

import type { IoResult } from '../../../effects/types.ts'

/**
 * Load a trusted generated JavaScript module whose default export constructs
 * the ordinary value. Invoke that factory once per request, retaining fresh
 * value identities even when the target caches the loaded module. Wrap the
 * constructed value in the Result before returning across an async boundary,
 * so an ordinary `then` property is never treated as a Promise continuation.
 *
 * This is outbound runtime compilation, not admission of arbitrary EDAG data.
 */
export type CompileValue = readonly ['compileValue', (source: string) => IoResult<unknown>]
