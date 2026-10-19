/** Evaluated outer entries in a value's analysis table. @module */

import type { Node, Operand } from '../../../edag/analysis/types.ts'
import type { IntrinsicId, StaticId } from '../../../edag/types.ts'

/** Analysis preserves the value subset outside function bodies. */
export type _ValueNode =
    | readonly ['undefined']
    | readonly ['[]', readonly Operand[]]
    | readonly ['{}', readonly (readonly [':', string, Operand])[]]
    | readonly ['entry']
    | readonly ['hasEntry']
    | readonly [IntrinsicId]
    | readonly [StaticId]
    | Extract<Node, readonly ['=>', ...readonly unknown[]]>
