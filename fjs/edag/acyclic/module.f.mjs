/**
 * Acyclicity preflight for EDAG data, before recursive shape validation.
 * Walk every array position, including structural lists, evaluated captures
 * and unevaluated function bodies. Non-array values are opaque; this check
 * establishes no shape, metadata or closure validity.
 *
 * An array reached on its own ancestry is a cycle. An array whose descendants
 * already passed is shared data and need not be checked again. Both sets are
 * immutable, and success returns the original input with its sharing intact.
 * Diagnostics identify the array position that closes the cycle.
 *
 * This preflight does not compose the complete admission boundary, change
 * RTTI's traversal of shared graphs, or add resource limits.
 *
 * The recursive walk consumes the host stack once per array level. With
 * Node 24.14.0's default stack, a 1,000-level chain passes and a 10,000-level
 * chain throws RangeError. The threshold depends on the runtime and stack
 * size; deep input can overflow before a diagnostic is returned. Host-stack
 * independence remains in `../todo/stack-safety.md`.
 *
 * @module
 * @import { Result } from '../../types/result/types.ts'
 * @import { ValidationError } from '../../rtti/common/types.ts'
 * @import { _Visited } from './private.ts'
 */

import { add, empty, has } from '../../types/set/module.f.mjs'
import { isArray } from '../../types/array/module.f.mjs'
import { mapOk, ok } from '../../types/result/module.f.mjs'
import { prependPath, verror } from '../../rtti/common/module.f.mjs'

/** @type {(value: unknown, ancestors: _Visited, completed: _Visited) => Result<_Visited, ValidationError>} */
const walk = (value, ancestors, completed) => {
    if (!isArray(value) || has(value)(completed)) { return ok(completed) }
    if (has(value)(ancestors)) { return verror('cyclic array graph') }
    const nextAncestors = add(value)(ancestors)
    for (let i = 0; i < value.length; i += 1) {
        const r = walk(value[i], nextAncestors, completed)
        const [kind, next] = r
        if (kind === 'error') { return prependPath(String(i), r) }
        completed = next
    }
    return ok(add(value)(completed))
}

/** Checks array-position cycles only, retaining the input's type and identity. @type {<const T>(value: T) => Result<T, ValidationError>} */
export const validateAcyclic = value => mapOk(() => value)(walk(value, empty, empty))
