/**
 * @import { Exp, Op1, Properties } from '../types.ts'
 * @import { Context, Map, ExpOp, TagMap } from './types.ts'
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

/**
 * Eager pair: `o2lazy` already *is* the handler, so this forces `b` and
 * hands it on — it must not wrap another `(c, e) =>` around it, or every
 * binary op would evaluate to that inner handler instead of to a value.
 */
const o2 =
    (/**@type {(a: any, b: any) => unknown}*/o) =>
    o2lazy((a, b) => o(a, b()))

/** @typedef {<A extends Exp>(c: Context, e: Op1) => unknown} Func1 */

const o1 =
    (/**@type {(a: any) => unknown}*/o) =>
    /**@type {Func1}*/
    (c, [, a]) => o(vm(c)(a))

/**@type {Map}*/
const map = {
    '!': o1(a => !a),
    '!==': o2((a, b) => a !== b),
    '%': o2((a, b) => a % b),
    '&': o2((a, b) => a & b),
    '&&': o2lazy((a, b) => a && b()),
    '()': (x, [, b, c, d]) => {
        if (c.length !== 0) {
            todo()
        }
        const i = vm(x)
        /**@type {any}*/
        const f = i(b)
        return f(i(d))
    },
    '*': o2((a, b) => a * b),
    '**': o2((a, b) => a ** b),
    '+': o2((a, b) => a + b),
    ',': (x, [, a]) => {
        const f = vm(x)
        return a.reduce((/**@type {unknown}*/_, c) => f(c), undefined)
    },
    '-': o2((a, b) => a - b),
    '.': o2((a, b) => a[b]),
    '/': o2((a, b) => a / b),
    '<': o2((a, b) => a < b),
    '<<': o2((a, b) => a << b),
    '<=': o2((a, b) => a <= b),
    '===': o2((a, b) => a === b),
    '=>': (x, [, frameExp, body]) => {
        const frame = vm(x)(frameExp)
        /**@type {(...arg: readonly unknown[]) => unknown}*/
        return (...args) =>vm({ frame, args })(body)
    },
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
        /**@type {(e: Properties) => readonly[unknown, unknown][]}*/
        const g = e => e[0] === ':'
            ? [[f(e[1]), f(e[2])]]
            : Object.entries(/**@type {any}*/(f(e[1])))
        const kv = a.flatMap(g)
        return Object.fromEntries(kv)
    },
    '|': o2((a, b) => a | b),
    '||': o2lazy((a, b) => a || b()),
    '~': o1(a => ~a),
}

export const vm = (/**@type {Context}*/context) => {
    const compute =
        /**
         * Generic over the tag, not `(e: ExpOp) =>`: with a union-typed `e`,
         * `map[e[0]]` is a union of every handler signature, callable only with
         * the intersection of their tuples — `never`. Through `K` it stays the
         * one signature `(c, r: TagMap[K])` — see `TagMap` in `./types.ts`.
         *
         * @type {<K extends ExpOp[0]>(e: TagMap[K] & readonly [K, ...readonly unknown[]]) => unknown}
         */
        e => map[e[0]](context, e)
    return (/**@type{Exp}*/e) => e instanceof Array
        ? compute(e)
        : e
}
