/**
 * The operations of the EDAG's nodes, one per tag, parameterized by how an
 * operand is evaluated. [amnesia](../amnesia/README.md) runs them by
 * recursion over the EDAG's own nodes; an executor over the
 * [analysis](../analysis/module.f.mjs) table runs the same table by looking
 * its operands up, so the two agree on every value that sharing does not
 * decide. This module owns the meaning of each node — the JavaScript each
 * one is built around — and no executor restates it.
 *
 * Every operation reads its node by **destructuring**, never by index:
 * destructuring goes through the array iterator, which stops at `length`,
 * so a short chain step's absent continuation reads as `undefined` and
 * never as whatever a prototype supplies at that index. That is not a
 * hardening claim; see "It trusts its host" in amnesia's README.
 *
 * @module
 *
 * A function is **data here, not a host function**: `=>` evaluates to a
 * closure record — the captured frame, the body graph in the executor's own
 * operand form, and `length` — and a call of one is the executor's `invoke`
 * over that record, never a JavaScript call. The record is told from an
 * object a program built by identity with `mark`, which no graph can name,
 * and the operations that look inside a value — a property read, `typeof`,
 * `own`, an object spread — answer for a closure what JavaScript answers for
 * a function: `length` and nothing else. A host method handed a closure
 * receives the record as a value; one that would *call* it throws the
 * host's `TypeError`, since the host cannot, and the callback-taking
 * built-ins are the executor's to implement, not the host's
 * (`./todo/host-callbacks.md`).
 *
 * @import { ExpOp, Op1, Op2, Op12, Over, StepOver, TagMap } from '../types.ts'
 * @import { Closure, Evaluator, Mark, Operations } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'

/**
 * What tells a closure from an object a program built: identity with this
 * one object, which the module holds and no graph evaluates to. A program's
 * `{ mark: …, length: 0, frame: …, body: … }` has every field of a closure
 * and is not one.
 *
 * @type {Mark}
 */
const mark = { closure: true }

/**
 * @param {unknown} v
 * @returns {v is Closure<never>}
 */
export const isClosure = v => typeof v === 'object' && v !== null && /**@type {{ readonly mark?: unknown }}*/(v).mark === mark

/**
 * A property read, `obj[prop]` — except on a closure, whose one readable
 * property is `length`: its frame and body are the executor's, as a
 * JavaScript function's are the engine's, so any other key reads as
 * `undefined` there rather than as the record's field.
 *
 * @type {(obj: any, prop: any) => unknown}
 */
const read = (obj, prop) => isClosure(obj)
    ? (prop === 'length' ? obj.length : undefined)
    : obj[prop]

/**
 * A call of a value: a closure is invoked by the executor over its frame
 * and body; anything else is called as the host calls it, which is the
 * host's `TypeError` for a non-function. The arguments are evaluated before
 * either, as JavaScript evaluates them before it finds the callee is no
 * function.
 *
 * @type {<E>(x: Evaluator<E>, v: unknown, args: readonly unknown[]) => unknown}
 */
const apply = (x, v, args) => isClosure(v) ? x.invoke(v.frame, args, v.body) : /**@type {any}*/(v)(...args)

/**
 * A binary operation whose right operand is a thunk, forced by the
 * operation or not at all: the three short-circuiting operators.
 *
 * @type {(o: (a: any, b: () => any) => unknown) => <E>(x: Evaluator<E>) => (e: Over<Op2, E>) => unknown}
 */
const o2lazy = o => ({ operand }) => ([, a, b]) => o(operand(a), () => operand(b))

/**
 * Eager pair: `o2lazy` already *is* the operation, so this forces `b` and
 * hands it on.
 *
 * @type {(o: (a: any, b: any) => unknown) => <E>(x: Evaluator<E>) => (e: Over<Op2, E>) => unknown}
 */
const o2 = o => o2lazy((a, b) => o(a, b()))

/** @type {(o: (a: any) => unknown) => <E>(x: Evaluator<E>) => (e: Over<Op1, E>) => unknown} */
const o1 = o => ({ operand }) => ([, a]) => o(operand(a))

/**
 * One tag at two arities: the node's length picks the operation, which is
 * what an `op12` is. Both operands are eager, as in `o2`.
 *
 * @type {(u: (a: any) => unknown, o: (a: any, b: any) => unknown) => <E>(x: Evaluator<E>) => (e: Over<Op12, E>) => unknown}
 */
const o12 = (u, o) => ({ operand }) => e =>
    e.length === 2 ? u(operand(e[1])) : o(operand(e[1]), operand(e[2]))

/** The own enumerable entries an object spread copies: none of a closure's. @type {(v: unknown) => readonly (readonly [string, unknown])[]} */
const entriesOf = v => isClosure(v) ? [] : Object.entries(Object(v))

/** Both ways of being nullish, which is what every optional step guards. */
/** @type {(v: unknown) => boolean} */
const nullish = v => v === undefined || v === null

/**
 * The argument array of a call: one operand evaluating to the *complete*
 * array, spread at the call site — `f(a, b)` is `['()', f, ['[]', [a, b]]]`,
 * and `=>` collects with `(...args)`. Passed as a single argument instead,
 * the callee's `['args']` would be `[[a, b]]`.
 *
 * @type {<E>(x: Evaluator<E>, e: E) => readonly any[]}
 */
const argsOf = (x, e) => /**@type {any}*/(x.operand(e))

/**
 * Calls a bare value — no receiver.
 *
 * The temporary is load-bearing. Written as a property of whatever holds the
 * callee, this would be a *method* call, so the callee would run with that
 * holder as `this` — a receiver the chain does not have — and a detached host
 * method would then silently succeed on the wrapper instead of throwing:
 * `((a.at)(0))(0)` returned `Array.prototype.at`.
 *
 * @type {<E>(x: Evaluator<E>, v: unknown, e: E) => unknown}
 */
const callValue = (x, v, e) => apply(x, v, argsOf(x, e))

/**
 * Calls `obj[prop]` *on* `obj`. That receiver is the whole reason a property
 * access owns its call rather than handing on a value: `[42].at(0)` is `42`
 * only because `at` is called on the array.
 *
 * **The argument operand, not the argument array.** Both helpers take the
 * operand and evaluate it themselves, inside the call expression, so that
 * JavaScript's own order applies: the callee is read first, then the
 * arguments. That order is observable — `a.b(...c)` throws at the access
 * when `a` is nullish with `c` untouched, where `(a?.b)(...c)` reaches the
 * call and so evaluates `c` before throwing — and it is *not* provable
 * here: both readings throw, this language has no mutation for an operand
 * to record itself with, and a `throw` case is pass/fail rather than
 * payload-inspecting (`fjs/AGENTS.md` §1.5). So the structure carries what
 * a proof cannot. Taking an evaluated array instead would put every
 * argument list ahead of the property read, and every test would still
 * pass.
 *
 * A closure held in a property is invoked, its receiver dropped — the
 * language has no `this`, and a graph closure ignores one. A closure *as*
 * the receiver has no method a program can name, so its read is
 * `undefined` and the call is the host's `TypeError`, as `f.length()` is.
 *
 * @type {<E>(x: Evaluator<E>, obj: any, prop: any, e: E) => unknown}
 */
const callProperty = (x, obj, prop, e) => {
    const m = read(obj, prop)
    return isClosure(m) || isClosure(obj)
        ? apply(x, m, argsOf(x, e))
        : obj[prop](...argsOf(x, e))
}

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
 * @type {<E>(x: Evaluator<E>, k: StepOver<E> | undefined) => unknown}
 */
const skip = (x, k) => {
    if (k === undefined) { return undefined }
    const [o, e, cont] = k
    return o === '|!()'
        ? callValue(x, undefined, e)
        : skip(x, cont)
}

/**
 * A plain value inside an open region — what `?.()` hands on, and what a call
 * step leaves. Nothing here can short-circuit: the two productions are a call
 * that stays in the region and a property access that hands on a receiver.
 * `|?.()` and `|!()` are not productions of this state, and the schema keeps
 * them out; the walk carries no state, so it reads whatever step it is given.
 *
 * @type {<E>(x: Evaluator<E>, v: unknown, k: StepOver<E> | undefined) => unknown}
 */
const optionLambda = (x, v, k) => {
    if (k === undefined) { return v }
    const [o, e, cont] = k
    switch (o) {
        case '|.': { return optionPropertyLambda(x, v, x.operand(e), cont) }
        default: { return optionLambda(x, callValue(x, v, e), cont) }
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
 * @type {<E>(x: Evaluator<E>, obj: any, prop: any, k: StepOver<E> | undefined) => unknown}
 */
const optionPropertyLambda = (x, obj, prop, k) => {
    if (k === undefined) { return read(obj, prop) }
    const [o, e, cont] = k
    switch (o) {
        case '|.': { return optionPropertyLambda(x, read(obj, prop), x.operand(e), cont) }
        case '|()': { return optionLambda(x, callProperty(x, obj, prop, e), cont) }
        case '|!()': { return callProperty(x, obj, prop, e) }
        case '|?.()': {
            return nullish(read(obj, prop))
                ? skip(x, cont)
                : optionLambda(x, callProperty(x, obj, prop, e), cont)
        }
    }
}

/** @type {Operations} */
export const operations = {
    '!': o1(a => !a),
    '!==': o2((a, b) => a !== b),
    '%': o2((a, b) => a % b),
    '&': o2((a, b) => a & b),
    '&&': o2lazy((a, b) => a && b()),
    // The call with no receiver and no region: the callee is an ordinary
    // expression, so `(0, a.b)(...c)` is this node over a complete `.` while
    // `a.b(...c)` is that `.` node owning its call. The two differ, and
    // amnesia's `throw.detachedReceiver` is the difference.
    '()': x => ([, a, b]) => callValue(x, x.operand(a), b),
    '*': o2((a, b) => a * b),
    '**': o2((a, b) => a ** b),
    // Unary plus is JS's: `ToNumber`, which throws on a bigint where
    // `Number` converts — see `op12Id` in `../module.f.mjs`.
    '+': o12(a => +a, (a, b) => a + b),
    ',': ({ operand }) => ([, a]) => a.reduce((/**@type {unknown}*/_, c) => operand(c), undefined),
    '-': o12(a => -a, (a, b) => a - b),
    // Property access, owning whatever its receiver is used for: with no
    // continuation operand the receiver is dropped, as reading `a.b` for its
    // value does, and the two call steps are the only things that can spend
    // it. The node is destructured, so a three-element `['.', a, k]` reads
    // its absent fourth as `undefined` without touching the prototype.
    //
    // Only a call can be in that continuation, because only a call uses the
    // receiver: `|()` spends it and exits, `|?.()` spends it and opens a
    // region that owns the rest of the chain. With no region open, that
    // guard failing is simply the node's value, since `optionLambda` has no
    // `|!()` of its own — but the walk still goes through `skip`, which
    // reaches one through a `|.`.
    //
    // That is `PropertyLambda`, and every one of its arms is an arm of
    // `OptionPropertyLambda`, so the walker above is this walk on a wider
    // input rather than a different one. `|?.()` is the same arm verbatim;
    // `|()` is terminal here, so its continuation is `undefined` and the
    // wider walker's `optionLambda(f, v, undefined)` hands back the call's
    // value unchanged. Its `|.` and `|!()` arms are unreachable from here.
    '.': x => ([, a, k, p]) => optionPropertyLambda(x, x.operand(a), x.operand(k), p),
    '/': o2((a, b) => a / b),
    '<': o2((a, b) => a < b),
    '<<': o2((a, b) => a << b),
    '<=': o2((a, b) => a <= b),
    '===': o2((a, b) => a === b),
    // The frame operand is evaluated here, in the enclosing invocation, and
    // the body is not: the value is the closure record — the captured frame
    // and the body graph, as data — and each call of it is a new
    // invocation, which is the executor's to start: the enclosing
    // invocation's values do not cross, the captured frame is a value and
    // crosses as one. No host function is made: the language's function is
    // the graph's, and `length` is the record's field.
    '=>': ({ operand }) => ([, frameExp, body]) => /**@type {Closure<typeof body>}*/({ mark, length: 0, frame: operand(frameExp), body }),
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
    '?.': x => ([, a, k, p]) => {
        const obj = x.operand(a)
        return nullish(obj) ? skip(x, p) : optionPropertyLambda(x, obj, x.operand(k), p)
    },
    // Optional call, the region-opening counterpart of `?.`. The callee is an
    // ordinary expression, so this node never carries a receiver — `a.b?.(c)`
    // is a `.` node with a `|?.()` continuation, not this one — and a nullish
    // callee leaves the arguments unevaluated.
    '?.()': x => ([, a, b, k]) => {
        const f = x.operand(a)
        return nullish(f) ? skip(x, k) : optionLambda(x, callValue(x, f, b), k)
    },
    // The conditional: the condition, then exactly one arm. The other is
    // never established, which amnesia's `lazy` and
    // `throw.forcedConsequent`/`forcedAlternate` pin from both sides.
    '?:': ({ operand }) => ([, c, t, e]) => operand(c) ? operand(t) : operand(e),
    '??': o2lazy((a, b) => a ?? b()),
    Number: o1(Number),
    String: o1(String),
    // The equality the language's guarantees are stated in: `NaN` is `NaN`
    // and `0` is not `-0`, where `===` answers the other way on both.
    is: o2(Object.is),
    '[]': ({ operand }) => ([, a]) => {
        // A spread operand is iterated, not spliced as one element: `[...'ab']`
        // is `['a', 'b']` and `[...1]` throws, per "array spread" in
        // `../README.md`. `flatMap` alone flattens only real arrays.
        // The cast: `E` is any operand type, so the item that is not a
        // spread is `E` by exclusion, which a generic cannot narrow to.
        return a.flatMap(e =>
            (e instanceof Array) && e[0] === '...' ? [.../**@type {any}*/(operand(e[1]))] : [operand(/**@type {any}*/(e))])
    },
    '^': o2((a, b) => a ^ b),
    args: ({ args }) => () => args,
    frame: ({ frame }) => () => frame,
    // The key must *evaluate* to a string — a runtime constraint the
    // shape-only schema cannot express, so the executor upholds it. Without
    // the check JS `ToPropertyKey` would coerce, and `['own', o, 1]` would
    // silently read `o['1']`. Checked after the receiver: real `ToObject`
    // runs before `ToPropertyKey`, so a nullish receiver must reach that
    // throw first, the same order `fjs/nanvm/proof.f.mjs`'s `own` uses.
    own: o2((a, b) => {
        // No `?.value` here: a nullish `a` always throws on this call, so
        // the "call returned, `?.value` reads it" branch a real read would
        // need can never be taken — only the throw matters on this path.
        if (nullish(a)) { Object.getOwnPropertyDescriptor(a, b) }
        assert(typeof b === 'string', ['own: key is not a string', b])
        // a closure owns `length` as a function does, and nothing a program
        // can name besides
        return isClosure(a) ? read(a, b) : Object.getOwnPropertyDescriptor(a, b)?.value
    }),
    // a closure is the language's function, whatever the host says of the record
    typeof: o1(a => isClosure(a) ? 'function' : typeof a),
    undefined: () => () => undefined,
    '{}': ({ operand }) => ([, a]) => {
        /**@type {(p: (typeof a)[number]) => readonly (readonly [unknown, unknown])[]}*/
        const g = p => p[0] === ':'
            ? [[operand(p[1]), operand(p[2])]]
            // `Object(...)` is what makes a nullish operand contribute nothing
            // (`{...null}` is `{}`) while a string still contributes its
            // indices — `Object.entries` alone throws on `null`/`undefined`.
            // A closure contributes nothing, as `{...f}` is `{}` for a
            // function: its fields are not a program's to copy.
            : entriesOf(operand(p[1]))
        return Object.fromEntries(a.flatMap(g))
    },
    '|': o2((a, b) => a | b),
    '||': o2lazy((a, b) => a || b()),
    '~': o1(a => ~a),
}

/**
 * One node run through its operation. Generic over the tag, so that
 * `operations[e[0]]` is the one signature for `e`'s tuple rather than the
 * union of every operation's — see `TagMap` in `../types.ts`.
 *
 * @type {<E>(x: Evaluator<E>) => <K extends ExpOp[0]>(
 *  e: Over<TagMap[K], E> & readonly [K, ...readonly unknown[]]
 * ) => unknown}
 */
export const operation = x => e => operations[e[0]](x)(e)
