/**
 * Terminal evaluation regions exposed by the invocation helper.
 *
 * @module
 */

import type { Block, Value } from '../../types.ts'

export type _TailRegion =
    | { readonly kind: 'block'; readonly block: Block }
    | { readonly kind: 'if'; readonly test: Value; readonly then: Block; readonly otherwise: Block }
    | { readonly kind: 'value'; readonly value: Value }
