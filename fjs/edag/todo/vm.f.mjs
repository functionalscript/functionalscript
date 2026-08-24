/**
 * @import { Exp, Op0Id, Op1Id, Op2Id } from '../types.ts'
 * @import { RequiredMap } from '../../types/object/types.ts'
 * @import { Context, Map, ExpOp, Get } from './types.ts'
 */

import { todo } from '../../asserts/module.f.mjs'

const o2lazy =
    (/**@type {(a: any, b: () => any) => unknown}*/o) =>
    /**
     * @template {Exp} A
     * @param {Context} c
     * @param {readonly[unknown, A, A]} _2
     */
    (c, [, a, b]) => {
        const f = vm(c)
        return o(f(a), () => f(b))
    }

/** @typedef {<A extends Exp>(c: Context, ) => unknown} Func */

const o2 =
    (/**@type {(a: any, b: any) => unknown}*/o) =>
    /**@type {Func}*/
    (c, [, a, b]) => o2lazy((a, b) => o(a, b()))

const o1 =
    (/**@type {(a: any) => unknown}*/o) =>
    /**@type {Func}*/
    (c, [, a]) => o(vm(c)(a))

/**@type {Map}*/
const map = {
    '!': o1(a => !a),
    '!==': o2((a, b) => a !== b),
    '%': o2((a, b) => a % b),
    '&': o2((a, b) => a & b),
    '&&': o2lazy((a, b) => a && b()),
    '()': todo,
    '*': o2((a, b) => a * b),
    '**': o2((a, b) => a ** b),
    '+': o2((a, b) => a + b),
    ',': (x, [, a]) => {
        const f = vm(x)
        return a.reduce((_, c) => f(c))
    },
    '-': o2((a, b) => a - b),
    '.': o2((a, b) => a[b]),
    '/': o2((a, b) => a / b),
    '<': o2((a, b) => a < b),
    '<<': o2((a, b) => a << b),
    '<=': o2((a, b) => a <= b),
    '===': o2((a, b) => a === b),
    '=>': todo,
    '>': o2((a, b) => a > b),
    '>=': o2((a, b) => a >= b),
    '>>': o2((a, b) => a >> b),
    '>>>': o2((a, b) => a >>> b),
    '?.': todo,
    '?.()': todo,
    '??': o2lazy((a, b) => a ?? b()),
    Number: o1(Number),
    String: o1(String),
    '[]': (x, [, a]) => {
        const f = vm(x)
        return a.flatMap(e => (e instanceof Array) && e[0] === '...' ? f(e[1]) : [f(e)])
    },
    '^': o2((a, b) => a ^ b),
    args: ({args}) => args,
    frame: ({frame}) => frame,
    neg: o1(a => -a),
    own: o2((a, b) => Object.getOwnPropertyDescriptor(a, b)?.value),
    undefined: () => undefined,
    '{}': (x, [, a]) => {
        const f = vm(x)
        const kv = a.flatMap(
            /**@return {readonly readonly[unknown, unknown][]}*/
            e => e[0] === ':' ? [[f(e[1]), f(e[2])]] : Object.entries(f(e[1])))
        return Object.fromEntries(kv)
    },
    '|': o2((a, b) => a | b),
    '||': o2lazy((a, b) => a || b()),
    '~': o1(a => ~a),
}

const m =
    (/**@type {Context}*/x) =>
    /**
     * @template {ExpOp[0]} K
     * @param {K} k
     * @param {Get<K>} e
     */
    (k, e) => {
        const m = map[k](x, e)
    }

const vm = (/**@type {Context}*/context) => {
    const g = (/**@type{Exp}*/e) => {
        if (e instanceof Array) {
        }
        return todo()
    }
    return g
}
