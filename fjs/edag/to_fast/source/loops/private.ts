/** Source loop admission worklist. @module */

import type { Block, LoopTarget, Value } from '../../../../js/ast/types.ts'

export type _Scope =
    | { readonly kind: 'block'; readonly block: Block; readonly target: LoopTarget; readonly value: boolean }
    | { readonly kind: 'value'; readonly value: Value; readonly target: LoopTarget }
