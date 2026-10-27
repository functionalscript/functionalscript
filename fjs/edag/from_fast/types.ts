/** Normalized FAST graph construction. @module */

import type { Exp } from '../types.ts'
import type { BindingId, Exit } from '../../js/ast/types.ts'

/**
 * Values supplied by the enclosing scope. The optional marker records a
 * constructor-local deferred definition; external established values use pairs.
 */
export type Environment = readonly (readonly [BindingId, Exp, 'lazy'?])[]

/** Requirements float only across proven demand prefixes; other operands retain local sequences. */
export type Lowered = { readonly exp: Exp; readonly anchors: readonly Exp[] }

/** A resolved structured transfer, supplied by its owning loop conversion. */
export type Transfer = (exit: Exit, environment: Environment) => Lowered
