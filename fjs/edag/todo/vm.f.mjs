/**
 * @import { Exp, Op0Id, Op1Id, Op2Id } from '../types.ts'
 * @import { RequiredMap } from '../../types/object/types.ts'
 */

import { todo } from '../../asserts/module.f.mjs'

/** @type {RequiredMap<Op1Id, (v: any) => unknown>} */
const op1Map = {
    '!': v => !v,
    Number,
    String,
    neg: v => -v,
    '~': v => ~v,
}

/** @type {RequiredMap<Op2Id, (a: any, b: any) => unknown>} */
const op2Map = {
    '!==': (a, b) => a !== b,
    '%': (a, b) => a % b,
    '&': (a, b) => a & b,
    '&&': (a, b) => a && b,
    '*': (a, b) => a * b,
    '**': (a, b) => a ** b,
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '/': (a, b) => a / b,
    '<': (a, b) => a < b,
    '<<': (a, b) => a << b,
    '<=': (a, b) => a <= b,
    '===': (a, b) => a === b,
    '=>': (a, b) => (/**@type{readonly unknown[]}*/args) => vm(a)(args)(b),
    '>': (a, b) => a > b,
    '>=': (a, b) => a >= b,
    '>>': (a, b) => a >> b,
    '>>>': (a, b) => a >>> b,
    '??': (a, b) => a ?? b,
    '^': (a, b) => a ^ b,
    'own': (a, b) => Object.getOwnPropertyDescriptor(a, b)?.value,
    '|': (a, b) => a | b,
    '||': (a, b) => a || b,
}

const vm = (/**@type{unknown}*/frame) => (/**@type{readonly unknown[]}*/args) => {
    /**@type{RequiredMap<Op0Id, unknown}*/
    const op0Map = {
        args,
        frame,
        undefined
    }
    const g = (/**@type{Exp}*/e) => {
        if (e instanceof Array) {
            const k = e[0]
        }
        return todo()
    }
    return g
}
