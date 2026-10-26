/** Compatibility exports for shared FAST lazy cell planning. @module */

import { _hasReturn as sharedHasReturn, memoCells as sharedMemoCells, recipeCells as sharedRecipeCells } from '../../../../../js/ast/memo/cells/module.f.mjs'

/** @type {typeof sharedHasReturn} */
export const _hasReturn = sharedHasReturn
/** @type {typeof sharedMemoCells} */
export const memoCells = sharedMemoCells
/** @type {typeof sharedRecipeCells} */
export const recipeCells = sharedRecipeCells
