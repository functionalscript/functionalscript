/** Function-local loop return normalization worklists. @module */

import type { Block } from '../../../../js/ast/types.ts'

export type _BlockResult = { readonly block: Block; readonly returns: boolean }
export type _Visit = { readonly block: Block; readonly children: readonly Block[] | null }
