/**
 * Property lookup over evaluated EDAG values. Objects expose their stored
 * fields, arrays their elements and length, strings their UTF-16 code units
 * and length, and functions their declared length. Missing properties are
 * tagged undefined; nullish receivers fail with tagged undefined. Stored
 * values and receiver failures retain their identities.
 *
 * This is the lookup kernel for admitted property reads. The caller owns
 * operand evaluation order, key conversion to a string and source-name
 * admission. There is no prototype lookup or exposure of tuple fields.
 * Method dispatch and the raw EDAG `own` operation remain separate work.
 * Values satisfy the compiler/admission contract and are not revalidated.
 *
 * @module
 * @import { Values } from '../types.ts'
 * @import { ValueResult } from '../control/types.ts'
 */

import { arrayIndex } from '../../../js/array_index/module.f.mjs'
import { isArray } from '../../../types/array/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'

/** @type {(values: Values | string, key: string) => ValueResult} */
const indexed = (values, key) => {
    if (key === 'length') { return ok(values.length) }
    const index = arrayIndex(key)
    return ok(index === null || index >= values.length ? ['undefined'] : values[index])
}

/** Read a resolved property, preserving a failed receiver unchanged. @type {(receiver: ValueResult, key: string) => ValueResult} */
export const read = (receiver, key) => {
    const [kind, value] = receiver
    if (kind === 'error') { return receiver }
    if (value === null) { return error(['undefined']) }
    if (typeof value === 'string') { return indexed(value, key) }
    if (!isArray(value)) { return ok(['undefined']) }
    switch (value[0]) {
        case '[]': { return indexed(value[1], key) }
        case '{}': {
            const property = value[1].find(([, name]) => name === key)
            return ok(property === undefined ? ['undefined'] : property[2])
        }
        case '=>': { return ok(key === 'length' ? value[1] : ['undefined']) }
        default: { return error(['undefined']) }
    }
}
