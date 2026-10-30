/**
 * @import { Monoid } from '../types.ts'
 */

import { repeat } from './module.f.js'
import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'

/** @type {Pick<Monoid<number>, 'identity' | 'operation'>} */
const addition = { identity: 0, operation: a => b => a + b }

/** @type {Pick<Monoid<readonly string[]>, 'identity' | 'operation'>} */
const concatenation = { identity: [], operation: a => b => [...a, ...b] }

export const proof = {
    zero: () => assertEq(repeat(addition)(0n)(42), 0),
    one: () => assertEq(repeat(addition)(1n)(42), 42),
    even: () => assertEq(repeat(addition)(10n)(2), 20),
    odd: () => assertEq(repeat(addition)(13n)(3), 39),
    array: () => assertStructurallySame(
        repeat(concatenation)(3n)(['a', 'b']),
        ['a', 'b', 'a', 'b', 'a', 'b']),
}
