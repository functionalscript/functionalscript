/** Private terminal evaluation results. @module */
import type { Block } from '../../../js/ast/types.ts'

export type _Result = { readonly block: Block; readonly changed: boolean }
