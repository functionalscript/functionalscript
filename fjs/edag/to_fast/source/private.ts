/** Work items for source-output admission over normalized FAST. @module */

import type { Block, Value } from '../../../js/ast/types.ts'

export type Task = { readonly block: Block } | { readonly value: Value }
