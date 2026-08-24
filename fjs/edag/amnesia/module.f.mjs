/**
 * A tree-walking evaluator for `exp`: `vm(context)(e)` returns a primitive
 * unchanged and dispatches a tagged tuple through one handler per tag.
 *
 * It remembers no node values — every incoming edge evaluates its target
 * again — so it is the Amnesia model of
 * [execution-models.md](../execution-models.md), for proving semantics and
 * not for running FunctionalScript. See [README.md](./README.md).
 *
 * @module
 *
 * @import { Exp, Op1, Properties } from '../types.ts'
 * @import { Context, Map, ExpOp, TagMap } from './types.ts'
 */

import { assert, todo } from '../../asserts/module.f.mjs'

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

/** @typedef {(c: Context, e: Op1) => unknown} _Func1 */

const o1 =
    (/**@type {(a: any) => unknown}*/o) =>
    /**@type {_Func1}*/
    (c, [, a]) => o(vm(c)(a))

/**
 * @typedef {|
 *  readonly[any] |
 *  { readonly obj: any, readonly prop: any }
 * } Property
 */

/**
 * @typedef {undefined | Property} Hcf
 */

/** @type {(hcf: Hcf) => Property} */
const property = hcf => hcf === undefined ? [undefined] : hcf

/**
 * Calls what `p` denotes: a bare value with no receiver, or `obj[prop]` with
 * `obj` as one.
 *
 * The temporary in the first branch is load-bearing. `p[0](...)` is a
 * *method* call on the one-element array, so the callee would run with `p`
 * itself as `this` — a receiver the chain does not have — and a detached
 * host method would then silently succeed on the wrapper instead of
 * throwing: `((a.at)(0))(0)` returned `Array.prototype.at`.
 *
 * @type {(p: Property, f: () => any) => unknown}
 */
const call = (p, f) => {
    if (p instanceof Array) {
        const x = p[0]
        return x(...f())
    }
    const { obj, prop } = p
    return obj[prop](...f())
}

/** @type {(p: Property) => unknown} */
const value = p => {
    if (p instanceof Array) {
        return p[0]
    }
    const { obj, prop } = p
    return obj[prop]
}

/**@type {Map}*/
const map = {
    '!': o1(a => !a),
    '!==': o2((a, b) => a !== b),
    '%': o2((a, b) => a % b),
    '&': o2((a, b) => a & b),
    '&&': o2lazy((a, b) => a && b()),
    '()': (x, [, b, c, d]) => {
        const i = vm(x)
        // An empty `c` needs no case of its own: `reduce` hands the seed
        // straight back, so `f(...args)` is the chain of no steps and takes
        // the same final `call` as every other one.
        /**@type {Hcf} */
        const hcf = c.reduce(
            (/**@type {Hcf}*/hcf, lambda) => {
                if (hcf === undefined) {
                    return undefined
                }
                const [o, e] = lambda
                /** @type {() => Hcf} */
                const lazyCall = () => [call(hcf, () => i(e))]
                const lazyDot = () => ({ obj: value(hcf), prop: i(e) })
                /** @type {(f: () => Hcf) => Hcf} */
                const option = (f) => {
                    const obj = value(hcf)
                    switch (obj) {
                        case undefined:
                        case null:
                            return undefined
                    }
                    return f()
                }
                switch (o) {
                    case '|()': return lazyCall()
                    case '|.': return lazyDot()
                    case '|?.': return option(lazyDot)
                    case '|?.()': return option(lazyCall)
                }
            },
            [i(b)])
        // One node evaluating to the *complete* argument array — `f(a, b)` is
        // `['()', f, [], ['[]', [a, b]]]` — and `=>` collects with
        // `(...args)`, so it is spread. Passed as a single argument instead,
        // the callee's `['args']` would be `[[a, b]]`.
        return call(property(hcf), () => i(d))
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
        // A spread operand is iterated, not spliced as one element: `[...'ab']`
        // is `['a', 'b']` and `[...1]` throws, per "array spread" in
        // `../README.md`. `flatMap` alone flattens only real arrays.
        /**@type {(e: Exp) => readonly unknown[]}*/
        const spread = e => [.../**@type {any}*/(f(e))]
        return a.flatMap(e =>
            (e instanceof Array) && e[0] === '...' ? spread(e[1]) : [f(e)])
    },
    '^': o2((a, b) => a ^ b),
    args: ({args}) => args,
    frame: ({frame}) => frame,
    neg: o1(a => -a),
    // The key must *evaluate* to a string — a runtime constraint the
    // shape-only schema cannot express, so the executor upholds it. Without
    // the check JS `ToPropertyKey` would coerce, and `['own', o, 1]` would
    // silently read `o['1']`.
    own: o2((a, b) => {
        assert(typeof b === 'string', ['own: key is not a string', b])
        return Object.getOwnPropertyDescriptor(a, b)?.value
    }),
    undefined: () => undefined,
    '{}': (x, [, a]) => {
        const f = vm(x)
        /**@type {(e: Properties) => readonly[unknown, unknown][]}*/
        const g = e => e[0] === ':'
            ? [[f(e[1]), f(e[2])]]
            // `Object(...)` is what makes a nullish operand contribute nothing
            // (`{...null}` is `{}`) while a string still contributes its
            // indices — `Object.entries` alone throws on `null`/`undefined`.
            : Object.entries(Object(f(e[1])))
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
         * @type {<K extends ExpOp[0]>(
         *  e: TagMap[K] & readonly [K, ...readonly unknown[]]
         * ) => unknown}
         */
        e => map[e[0]](context, e)
    return (/**@type{Exp}*/e) => e instanceof Array
        ? compute(e)
        : e
}
