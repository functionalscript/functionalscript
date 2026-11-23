/**
 * The scope of [the lowering](../module.f.js) and the helpers that read
 * it: a refusal named for the function being lowered, the names L1 is
 * linked under in a program, what a binding of FAST stands for, and the
 * binding of a term that does something to a local, in order, which the
 * arguments of a call and the parts of a literal are lowered by.
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { BindingId, Item, Value } from '../../../js/ast/types.ts'
 * @import { Param, Term } from '../../types.ts'
 * @import { Scope as IrScope } from '../../types.ts'
 */

/**
 * What these helpers read of the lowering's scope: the IR's scope and the
 * depth that names the next local `#k`. The lowering's own scope holds more,
 * which each helper keeps as it is.
 *
 * @typedef {{ readonly ir: IrScope, readonly depth: number }} Depth
 */

/** A part of a literal or of a call's arguments: whether it is a spread, and its term. @typedef {readonly [many: boolean, x: Term]} Part */

import { assertNotNullish } from '../../../asserts/module.f.js'
import { entry } from '../../../types/object/entry/module.f.js'
import { error, ok, okList } from '../../../types/result/module.f.js'
import { typeOf } from '../../check/module.f.js'
import { any, kinds } from '../../l0/module.f.js'
import { call, cast, equal, false_, get, let_, only, true_ } from '../../module.f.js'

/** @type {(scope: Depth) => (message: string) => Result<never, string>} */
export const refuse = scope => {
    const name = assertNotNullish(entry(scope.ir, 'name'))
    return message => error(`${name}: ${message}`)
}

/**
 * The name of L1's function `name` in a program that links L1
 * ([`link`](../link/module.f.js#link)), `l1.add` say, or `null` in a module that links none,
 * which lowers the operators of the IR alone.
 *
 * @type {(scope: Depth, name: string) => string | null}
 */
export const l1Of = (scope, name) => {
    const linked = `l1.${name}`
    return scope.ir.functions.some(([k]) => k === linked) ? linked : null
}

/** Whether the module being lowered is a program that links L1 ([`link`](../link/module.f.js#link)). @type {(scope: Depth) => boolean} */
export const linking = scope => scope.ir.functions.some(([k]) => k.startsWith('l1.'))

/**
 * The name of L1's `get`, which a member or index of sealed `any` calls:
 * `l1.get` in a program that links L1, or `get` where the module being
 * lowered, L1 itself, exports it, or `null`.
 *
 * @type {(scope: Depth) => string | null}
 */
export const getOf = scope => l1Of(scope, 'get') ?? (scope.ir.functions.some(([k]) => k === 'get') ? 'get' : null)

/**
 * The scope where `b` stands for `m`.
 *
 * @template {{ readonly bindings: readonly (readonly [BindingId, unknown])[] }} S
 * @param {S} scope
 * @param {BindingId} b
 * @param {S['bindings'][number][1]} m
 * @returns {S}
 */
export const standsFor = (scope, b, m) => ({ ...scope, bindings: [...scope.bindings, [b, m]] })

/** A term that does nothing but give its value: a local, a literal, a constant, `false` or `true`, a product of such terms, or a field of one. @type {(t: Term) => boolean} */
export const isPure = t => t[0] === 'get' || t[0] === 'lit' || t[0] === 'constant' || equal(t, false_) || equal(t, true_)
    || (t[0] === 'make' && t[1].every(([, x]) => isPure(x)))
    || (t[0] === 'field' && isPure(t[1]))

/**
 * A term in a `let` of a local named by its depth, around the rest of its
 * block, which reads the local by that name. A `let` whose body is only its
 * local is its value.
 *
 * @template {Depth} S
 * @param {S} scope
 * @param {Term} x
 * @param {(scope: S, name: string) => Result<Term, string>} rest
 * @returns {Result<Term, string>}
 */
export const bindTerm = (scope, x, rest) => {
    const { ir, depth } = scope
    const t = typeOf(ir)(x)
    if (t[0] === 'error') { return t }
    const name = `#${depth}`
    const body = rest({ ...scope, ir: { ...ir, locals: [...ir.locals, [name, t[1]]] }, depth: depth + 1 }, name)
    if (body[0] === 'error') { return body }
    const [, b] = body
    return ok(b[0] === 'get' && b[1] === name ? x : let_(name, x, b))
}

/**
 * Each value lowered where the scope is.
 *
 * @template S
 * @param {(scope: S, v: Value) => Result<Term, string>} lowerValue
 * @param {S} scope
 * @param {readonly Value[]} vs
 * @returns {Result<readonly Term[], string>}
 */
export const values = (lowerValue, scope, vs) => okList(vs.map(v => lowerValue(scope, v)))

/**
 * A term that does nothing as itself, and anything else bound to a local,
 * in whose scope `rest` reads it.
 *
 * @template {Depth} S
 * @param {S} scope
 * @param {Term} x
 * @param {(scope: S, y: Term) => Result<Term, string>} rest
 * @returns {Result<Term, string>}
 */
export const pure = (scope, x, rest) => isPure(x) ? rest(scope, x) : bindTerm(scope, x, (s, name) => rest(s, get(name)))

/**
 * The arguments of a call that reads each of them once it has read them
 * all: each lowered where it stands, in its order, a term that does nothing
 * as itself and anything else bound to a local, in whose scope those after
 * it are lowered. `rest` reads them all, as terms that do nothing.
 *
 * @template {Depth} S
 * @param {(scope: S, v: Value) => Result<Term, string>} lowerValue
 * @param {S} scope
 * @param {readonly Value[]} vs
 * @param {(scope: S, xs: readonly Term[]) => Result<Term, string>} rest
 * @returns {Result<Term, string>}
 */
export const settled = (lowerValue, scope, vs, rest) => {
    /** @type {(s: S, done: readonly Term[]) => Result<Term, string>} */
    const from = (s, done) => {
        if (done.length === vs.length) { return rest(s, done) }
        const x = lowerValue(s, vs[Number(done.length)])
        return x[0] === 'error' ? x : pure(s, x[1], (t, y) => from(t, [...done, y]))
    }
    return from(scope, [])
}

/** @type {(item: Item<Value>) => item is readonly ['...', Value]} */
export const isSpread = item => item instanceof Array && item[0] === '...'

/**
 * The parts of a literal or of the arguments of a call that holds a
 * spread, each lowered where it stands, in its order, as `settled` lowers
 * values: a spread is `spread` of the value it spreads, which L1 makes the
 * array or the object to copy, and so throws where JavaScript does, before
 * anything after it is read. `rest` reads them all, as terms that do
 * nothing.
 *
 * @template {Depth} S
 * @param {(scope: S, v: Value) => Result<Term, string>} lowerValue
 * @param {S} scope
 * @param {readonly Item<Value>[]} items
 * @param {(s: S, x: Term) => Result<Term, string>} spread
 * @param {(scope: S, parts: readonly Part[]) => Result<Term, string>} rest
 * @returns {Result<Term, string>}
 */
export const settledParts = (lowerValue, scope, items, spread, rest) => {
    /** @type {(s: S, done: readonly Part[]) => Result<Term, string>} */
    const from = (s, done) => {
        if (done.length === items.length) { return rest(s, done) }
        const item = items[Number(done.length)]
        const many = isSpread(item)
        const x = lowerValue(s, isSpread(item) ? item[1] : item)
        const y = x[0] === 'error' || !many ? x : spread(s, x[1])
        return y[0] === 'error' ? y : pure(s, y[1], (t, z) => from(t, [...done, [many, z]]))
    }
    return from(scope, [])
}

/** The casts of the L0 view, each with the kind that it narrows to. @type {readonly (readonly [string, string])[]} */
export const casts = [['asBoolean', 'boolean'], ['asNumber', 'number'], ['asString', 'string'], ['asArray', 'array'], ['asObject', 'object'], ['asFunction', 'function']]

/**
 * A call of a function of an interface whose parameters take some kinds of
 * `any`: each argument that is a local holding those kinds and others too
 * is cast to those, named for the local and the kind, `a.bigint`, or for
 * the function where it keeps several, `a.same`. JavaScript reads every
 * argument before the function checks any, so an argument that does
 * something is bound to a local first, in their order, and a local that
 * two arguments read is cast once. The checker refuses an argument that
 * holds none of the kinds.
 *
 * @template {Depth} S
 * @param {(scope: S, v: Value) => Result<Term, string>} lowerValue
 * @param {S} scope
 * @param {string} module
 * @param {string} name
 * @param {readonly Param[]} params
 * @param {readonly Value[]} vs
 * @returns {Result<Term, string>}
 */
export const castCall = (lowerValue, scope, module, name, params, vs) => settled(lowerValue, scope, vs, ({ ir }, args) => {
    const needs = args.flatMap((x, k) => {
        const p = params[Number(k)][1]
        const t = x[0] === 'get' ? ir.locals.find(([v]) => v === x[1])?.[1] : undefined
        if (p[0] !== 'sealed' || p[3] === null || t === undefined || t[0] !== 'sealed' || x[0] !== 'get') { return [] }
        const held = t[3] ?? kinds
        const takes = p[3]
        const ks = held.filter(h => takes.includes(h))
        return ks.length === 0 || ks.length === held.length ? [] : [/** @type {const} */ ([x[1], ks])]
    })
    const casts = needs.filter(([v], k) => needs.findIndex(([w]) => w === v) === k)
    /** @type {(v: string, ks: readonly string[]) => string} */
    const binder = (v, ks) => `${v}.${ks.length === 1 ? ks[0] : name}`
    const body = call(module, name, args.map(x => {
        const c = x[0] === 'get' ? casts.find(([v]) => v === x[1]) : undefined
        return c === undefined ? x : get(binder(...c))
    }))
    return ok(casts.reduceRight((b, [v, ks]) => cast(only(any, ...ks), get(v), binder(v, ks), b), body))
})
