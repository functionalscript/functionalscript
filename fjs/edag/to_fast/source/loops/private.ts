/** Source loop admission worklist. @module */

import type { Block, LoopTarget, Value } from '../../../../js/ast/types.ts'
import type { Result } from '../../../../types/result/types.ts'
import type { Task } from '../../../../js/ast/task/types.ts'

export type _SourceTask<T> = Task<Result<T, string>>

export type _Scope =
    | { readonly kind: 'block'; readonly block: Block; readonly target: LoopTarget; readonly value: boolean }
    | { readonly kind: 'value'; readonly value: Value; readonly target: LoopTarget }
