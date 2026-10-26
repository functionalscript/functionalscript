/** Compatibility exports for shared FAST lexical analysis. @module */

import { exitValues as sharedExitValues, freeBindings as sharedFreeBindings, freeLoopBindings as sharedFreeLoopBindings } from '../../../js/ast/control/module.f.mjs'

/** @type {typeof sharedExitValues} */
export const exitValues = sharedExitValues
/** @type {typeof sharedFreeBindings} */
export const freeBindings = sharedFreeBindings
/** @type {typeof sharedFreeLoopBindings} */
export const freeLoopBindings = sharedFreeLoopBindings
