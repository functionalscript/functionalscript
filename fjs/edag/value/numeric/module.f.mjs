/**
 * Unary numeric operations on evaluated primitives. Unary plus applies
 * ToNumber and fails on bigint; negation and complement apply ToNumeric
 * and preserve bigint. Explicit Number converts either numeric type.
 *
 * Callers evaluate the operand, propagate its failure and convert any
 * container/function to a primitive before selecting the operation.
 * Implicit failures return tagged undefined; no host exception is needed.
 *
 * @module
 * @import { Primitive, EdagValue } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { ok } from '../../../types/result/module.f.mjs'
import { primitiveToNumber, primitiveToNumeric } from '../coercion/module.f.mjs'

/** @type {Readonly<Record<'+' | '-' | '~' | 'Number', (value: Primitive) => Result<number | bigint, EdagValue>>>} */
export const unary = {
    '+': primitiveToNumber,
    '-': value => ok(-primitiveToNumeric(value)),
    '~': value => ok(~primitiveToNumeric(value)),
    Number: value => ok(Number(primitiveToNumeric(value))),
}
