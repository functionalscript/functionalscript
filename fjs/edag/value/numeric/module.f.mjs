/**
 * Numeric operations on evaluated primitives. Unary plus applies
 * ToNumber and fails on bigint; negation and complement apply ToNumeric
 * and preserve bigint. Explicit Number converts either numeric type.
 *
 * Binary addition concatenates if either primitive is a string. Otherwise
 * binary arithmetic applies ToNumeric to both operands: numbers and bigints
 * cannot mix. Bigint division/remainder by zero and exponentiation with a
 * negative exponent fail with tagged undefined.
 * Binary &, | and ^ use signed 32-bit numbers or exact bigints after
 * the same primitive conversion and numeric-type check.
 *
 * Callers evaluate operands, propagate failures and convert containers or
 * functions to primitives in language order. For ordinary objects, pass
 * 'number' to objectToPrimitive for all these operations, including
 * addition's default conversion. This module consumes those results.
 *
 * @module
 * @import { Primitive, EdagValue } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { ok, error } from '../../../types/result/module.f.mjs'
import { primitiveToString, primitiveToNumber, primitiveToNumeric } from '../coercion/module.f.mjs'

/** @type {Readonly<Record<'+' | '-' | '~' | 'Number', (value: Primitive) => Result<number | bigint, EdagValue>>>} */
export const unary = {
    '+': primitiveToNumber,
    '-': value => ok(-primitiveToNumeric(value)),
    '~': value => ok(~primitiveToNumeric(value)),
    Number: value => ok(Number(primitiveToNumeric(value))),
}

/**
 * Convert primitive operands and select an operation on matching numeric types.
 * @type {(
 *   number: (a: number, b: number) => number,
 *   bigint: (a: bigint, b: bigint) => Result<bigint, EdagValue>
 * ) => (a: Primitive, b: Primitive) => Result<number | bigint, EdagValue>}
 */
const numeric = (number, bigint) => (a, b) => {
    const left = primitiveToNumeric(a)
    const right = primitiveToNumeric(b)
    if (typeof left === 'number' && typeof right === 'number') {
        return ok(number(left, right))
    }
    if (typeof left === 'bigint' && typeof right === 'bigint') {
        return bigint(left, right)
    }
    return error(['undefined'])
}

const add = numeric((a, b) => a + b, (a, b) => ok(a + b))

/** @type {Readonly<Record<'+' | '-' | '*' | '/' | '%' | '**' | '&' | '|' | '^', (a: Primitive, b: Primitive) => Result<string | number | bigint, EdagValue>>>} */
export const binary = {
    '+': (a, b) => typeof a === 'string' || typeof b === 'string'
        ? ok(primitiveToString(a) + primitiveToString(b))
        : add(a, b),
    '-': numeric((a, b) => a - b, (a, b) => ok(a - b)),
    '*': numeric((a, b) => a * b, (a, b) => ok(a * b)),
    '/': numeric((a, b) => a / b, (a, b) => b === 0n ? error(['undefined']) : ok(a / b)),
    '%': numeric((a, b) => a % b, (a, b) => b === 0n ? error(['undefined']) : ok(a % b)),
    '**': numeric((a, b) => a ** b, (a, b) => b < 0n ? error(['undefined']) : ok(a ** b)),
    '&': numeric((a, b) => a & b, (a, b) => ok(a & b)),
    '|': numeric((a, b) => a | b, (a, b) => ok(a | b)),
    '^': numeric((a, b) => a ^ b, (a, b) => ok(a ^ b)),
}
