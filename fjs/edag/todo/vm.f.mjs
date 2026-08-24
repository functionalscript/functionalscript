/**
 * @import { Exp, Op0Id, Op1Id, Op2Id } from '../types.ts'
 * @import { RequiredMap } from '../../types/object/types.ts'
 * @import { StaticMap } from './types.ts'
 */

import { todo } from '../../asserts/module.f.mjs'

/**@type{StaticMap}*/
const staticMap = {
    '!': a => !a,
    '!==': (a, b) => a !== b,
    '%': (a, b) => a % b,
    '&': (a, b) => a & b,
    '&&': (a, b) => todo(), // a ?? b
    '()': (a, b, c) => todo(),
    '*': (a, b) => a * b,
    '**': (a, b) => a ** b,
    '+': (a, b) => a + b,
    ',': (a) => a[a.length - 1],
    '-': (a, b) => a - b,
    '.': (a, b) => a[b],
    '/': (a, b) => a / b,
    '<': (a, b) => a < b,
    '<<': (a, b) => a << b,
    '<=': (a, b) => a <= b,
    '===': (a, b) => a === b,
    '=>': (frame, exp) => (/**@type{readonly unknown[]}*/args) => vm(frame)(args)(exp),
    '>': (a, b) => a > b,
    '>=': (a, b) => a >= b,
    '>>': (a, b) => a >> b,
    '>>>': (a, b) => a >>> b,
    '?.': (a, b, c) => todo(),
    '?.()': (a, b, c, d) => todo(),
    '??': (a, b) => a ?? b
    ''
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
