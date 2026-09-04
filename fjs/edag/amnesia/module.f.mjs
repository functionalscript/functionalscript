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
 * @import { OptionLambda, OptionPropertyLambda, PropertyLambda } from '../types.ts'
 * @import { Context, Map, ExpOp, TagMap } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'

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

const o1 =
    (/**@type {(a: any) => unknown}*/o) =>
    /**@type {(c: Context, e: Op1) => unknown}*/
    (c, [, a]) => o(vm(c)(a))

/** Both ways of being nullish, which is what every optional step guards. */
/** @type {(v: unknown) => boolean} */
const nullish = v => v === undefined || v === null

/**
 * The argument array of a call: one node evaluating to the *complete* array,
 * spread at the call site — `f(a, b)` is `['()', f, ['[]', [a, b]]]`, and `=>`
 * collects with `(...args)`. Passed as a single argument instead, the callee's
 * `['args']` would be `[[a, b]]`.
 *
 * @type {(f: (_: Exp) => unknown, e: Exp) => readonly any[]}
 */
const argsOf = (f, e) => /**@type {any}*/(f(e))

/**
 * Calls a bare value — no receiver.
 *
 * The temporary is load-bearing. Written as a property of whatever holds the
 * callee, this would be a *method* call, so the callee would run with that
 * holder as `this` — a receiver the chain does not have — and a detached host
 * method would then silently succeed on the wrapper instead of throwing:
 * `((a.at)(0))(0)` returned `Array.prototype.at`.
 *
 * @type {(f: (_: Exp) => unknown, v: unknown, e: Exp) => unknown}
 */
const callValue = (f, v, e) => /**@type {any}*/(v)(...argsOf(f, e))

/**
 * Calls `obj[prop]` *on* `obj`. That receiver is the whole reason a property
 * access owns its call rather than handing on a value: `[42].at(0)` is `42`
 * only because `at` is called on the array.
 *
 * **The argument node, not the argument array.** Both helpers take the operand
 * and evaluate it themselves, inside the call expression, so that JavaScript's
 * own order applies: the callee is read first, then the arguments. That order
 * is observable — `a.b(...c)` throws at the access when `a` is nullish with
 * `c` untouched, where `(a?.b)(...c)` reaches the call and so evaluates `c`
 * before throwing — and it is *not* provable here: both readings throw, this
 * language has no mutation for an operand to record itself with, and a `throw`
 * case is pass/fail rather than payload-inspecting (`fjs/AGENTS.md` §1.5). So
 * the structure carries what a proof cannot. Taking an evaluated array instead
 * would put every argument list ahead of the property read, and every test
 * here would still pass.
 *
 * @type {(f: (_: Exp) => unknown, obj: any, prop: any, e: Exp) => unknown}
 */
const callProperty = (f, obj, prop, e) => obj[prop](...argsOf(f, e))

/**
 * The short-circuit. A region whose guard failed produces `undefined` and
 * skips every step of its continuation, operands and all — except `|!()`,
 * which the parentheses put *outside* the region. That step runs anyway, on
 * the `undefined` the region produced, which is why `(u?.b)(...c)` throws
 * where `u?.b(...c)` is `undefined`; its arguments are evaluated first, as a
 * call's always are, and then `undefined` is called.
 *
 * The walk carries no state and does not care which lambda type it is in:
 * every step is `[tag, operand, continuation]`, and a `|!()` is reachable
 * through `|.` steps from either — `(a?.(...b).c)(...d)` is exactly that.
 *
 * Like the three walkers below it reads a step by **destructuring**, never by
 * index: destructuring goes through the array iterator, which stops at
 * `length`, so a short step's absent continuation reads as `undefined` and
 * never as whatever a prototype supplies at that index. An indexed `k[2]`
 * would, which is why none appears here. This is not a hardening claim —
 * under a hostile host an own `Symbol.iterator` can yield past `length` just
 * as an unchecked index reads the prototype; see "It trusts its host" in
 * `./README.md`.
 *
 * @type {(f: (_: Exp) => unknown, k: OptionLambda | OptionPropertyLambda | undefined) => unknown}
 */
const skip = (f, k) => {
    if (k === undefined) { return undefined }
    const [o, e, cont] = k
    return o === '|!()'
        ? callValue(f, undefined, e)
        : skip(f, cont)
}

/**
 * A plain value inside an open region — what `?.()` hands on, and what a call
 * step leaves. Nothing here can short-circuit: the two productions are a call
 * that stays in the region and a property access that hands on a receiver.
 *
 * @type {(f: (_: Exp) => unknown, v: unknown, k: OptionLambda | undefined) => unknown}
 */
const optionLambda = (f, v, k) => {
    if (k === undefined) { return v }
    const [o, e, cont] = k
    switch (o) {
        case '|()': return optionLambda(f, callValue(f, v, e), cont)
        case '|.': return optionPropertyLambda(f, v, f(e), cont)
    }
}

/**
 * A property access inside an open region — both bits live, so this is the
 * state every step is available in. `|()` inherits the region's guard,
 * `|?.()` adds its own, `|!()` escapes it, and `|.` hands the receiver on
 * within the region, which is the one production that exists to protect a bit
 * other than the one it consumes.
 *
 * `obj[prop]` is read once per step, twice only where the guard has to see
 * the value before the call is made.
 *
 * @type {(f: (_: Exp) => unknown, obj: any, prop: any, k: OptionPropertyLambda | undefined) => unknown}
 */
const optionPropertyLambda = (f, obj, prop, k) => {
    if (k === undefined) { return obj[prop] }
    const [o, e, cont] = k
    switch (o) {
        case '|.': return optionPropertyLambda(f, obj[prop], f(e), cont)
        case '|()': return optionLambda(f, callProperty(f, obj, prop, e), cont)
        case '|!()': return callProperty(f, obj, prop, e)
        case '|?.()': return nullish(obj[prop])
            ? skip(f, cont)
            : optionLambda(f, callProperty(f, obj, prop, e), cont)
    }
}

/**
 * A property access with **no** region around it — the continuation of a `.`
 * node. Only a call can be here, because only a call uses the receiver: `|()`
 * spends it and exits, `|?.()` spends it and opens a region that owns the
 * rest of the chain. With no region open, that guard failing is simply the
 * node's value, since `optionLambda` has no `|!()` of its own — but the walk
 * still goes through `skip`, which reaches one through a `|.`.
 *
 * @type {(f: (_: Exp) => unknown, obj: any, prop: any, k: PropertyLambda | undefined) => unknown}
 */
const propertyLambda = (f, obj, prop, k) => {
    if (k === undefined) { return obj[prop] }
    const [o, e, cont] = k
    switch (o) {
        case '|()': return callProperty(f, obj, prop, e)
        case '|?.()': return nullish(obj[prop])
            ? skip(f, cont)
            : optionLambda(f, callProperty(f, obj, prop, e), cont)
    }
}

/**@type {Map}*/
const map = {
    '!': o1(a => !a),
    '!==': o2((a, b) => a !== b),
    '%': o2((a, b) => a % b),
    '&': o2((a, b) => a & b),
    '&&': o2lazy((a, b) => a && b()),
    // The call with no receiver and no region: the callee is an ordinary
    // expression, so `(0, a.b)(...c)` is this node over a complete `.` while
    // `a.b(...c)` is that `.` node owning its call. The two differ, and
    // `throw.detachedReceiver` is the difference.
    '()': (x, [, a, b]) => {
        const i = vm(x)
        return callValue(i, i(a), b)
    },
    '*': o2((a, b) => a * b),
    '**': o2((a, b) => a ** b),
    '+': o2((a, b) => a + b),
    ',': (x, [, a]) => {
        const f = vm(x)
        return a.reduce((/**@type {unknown}*/_, c) => f(c), undefined)
    },
    '-': o2((a, b) => a - b),
    // Property access, owning whatever its receiver is used for: with no
    // continuation operand the receiver is dropped, as reading `a.b` for its
    // value does, and the two call steps are the only things that can spend
    // it. The node is destructured, so a three-element `['.', a, k]` reads
    // its absent fourth as `undefined` without touching the prototype.
    '.': (x, [, a, k, p]) => {
        const i = vm(x)
        return propertyLambda(i, i(a), i(k), p)
    },
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
    // Optional property access, owning the rest of its optional region. On a
    // nullish input the region short-circuits: the node's own `index` is not
    // evaluated — which is why `a?.[k]` does not evaluate `k` — and neither is
    // any step of the continuation, `|!()` excepted. `skip` is what carries
    // that exception, and it is why `u?.b` and `(u?.b)(d)` part company:
    // the first is `undefined`, the second calls it.
    '?.': (x, [, a, k, p]) => {
        const i = vm(x)
        const obj = i(a)
        return nullish(obj) ? skip(i, p) : optionPropertyLambda(i, obj, i(k), p)
    },
    // Optional call, the region-opening counterpart of `?.`. The callee is an
    // ordinary expression, so this node never carries a receiver — `a.b?.(c)`
    // is a `.` node with a `|?.()` continuation, not this one — and a nullish
    // callee leaves the arguments unevaluated.
    '?.()': (x, [, a, b, k]) => {
        const i = vm(x)
        const f = i(a)
        return nullish(f) ? skip(i, k) : optionLambda(i, callValue(i, f, b), k)
    },
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
    // silently read `o['1']`. Checked after the receiver: real `ToObject`
    // runs before `ToPropertyKey`, so a nullish receiver must reach that
    // throw first, the same order `fjs/nanvm/proof.f.mjs`'s `own` uses.
    own: o2((a, b) => {
        if (nullish(a)) { return Object.getOwnPropertyDescriptor(a, b)?.value }
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
