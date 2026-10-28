/**
 * Implementation-private types for `fjs/compiler/edag/module.f.mjs`.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'

/**
 * A module's full result and its export bindings. Select once so repeated
 * imports share the same computation, including its evaluation anchors.
 */
export type _Resolved = {
    readonly exports: Exp
    readonly bindings: readonly (readonly [string, Exp])[]
}
