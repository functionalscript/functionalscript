/** Normalized FAST graph construction. @module */

import type { Exp } from '../types.ts'
import type { BindingId, Exit } from '../../js/ast/types.ts'

/** Established values supplied by the enclosing scope. */
export type Environment = readonly (readonly [BindingId, Exp])[]

/** Required evaluations float through eager positions and stop at region roots. */
export type Lowered = { readonly exp: Exp; readonly anchors: readonly Exp[] }

/** A resolved structured transfer, supplied by its owning loop conversion. */
export type Transfer = (exit: Exit, environment: Environment) => Lowered
