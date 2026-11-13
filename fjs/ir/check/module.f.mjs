/**
 * The checker: it types every term of a module and answers the module again
 * with each body typed, or refuses it with the function's name and the
 * reason. The [emitter](../wasm/module.f.js) reads only what this answers,
 * so what this takes is what the emitter has to get right, and nothing
 * else reaches it.
 *
 * It takes the first slice of [the task](../todo/slices.md), as the
 * [README](../README.md) lists it, and refuses everything else
 * ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 * The rules are [definition.md](../../../doc/sasha-gil/ir/definition.md)'s
 * and [type-system.md](../../../doc/sasha-gil/ir/type-system.md)'s:
 *
 * - **Integers are exact.** `add`, `sub` and `mul` have the range of their
 *   results as their type, and a range must fit one word of 64 bits.
 * - **Subtyping is the subset relation**: a range of a wider range, `f64c`
 *   of `f64`, and `never` of every type.
 * - **A local is bound once**: a `let` may not take a name that is in scope,
 *   and a `block` may not take a label that is.
 * - **`never` gives no value.** A term of type `never` may be the body of a
 *   function, a `block`, a `let` or an arm, and nothing else.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { ArmOf, Checked, Fn, FunctionOf, Int, Module, OpName, Term, Type, Typed, TypedArm } from '../types.ts'
 * @import { _Env } from './private.ts'
 */

import { error, ok, okList } from '../../types/result/module.f.js'
import { at, empty, fromEntries, setReplace } from '../../types/ordered_map/module.f.js'
import { bool, compareIn, equal, f64, f64c, fits, int, never, unit } from '../module.f.js'
import { show } from '../print/module.f.js'

// types

/** @type {(t: Type) => boolean} */
const isNever = t => equal(t, never)

/** @type {(t: Type) => boolean} */
const isFloat = t => t[0] === 'f64' || t[0] === 'f64c'

/**
 * Why a module may not write a type, or `null` where it may: a range holds
 * an integer and fits one word, and the only sums are `bool` and `never`.
 *
 * @type {(t: Type) => string | null}
 */
const unsupported = t =>
    t[0] === 'int' ? (t[1] > t[2] ? `${show(t)} is empty` : fits(64)(t) ? null : `${show(t)} needs more than one word`)
    : isFloat(t) || equal(t, bool) || isNever(t) ? null
    : `${show(t)} is not in this slice`

/** Whether every value of `a` is a value of `b`. @type {(a: Type, b: Type) => boolean} */
const sub = (a, b) => isNever(a)
    || (a[0] === 'int' && b[0] === 'int' ? b[1] <= a[1] && a[2] <= b[2] : (a[0] === 'f64c' && b[0] === 'f64') || equal(a, b))

/** The narrowest type that holds both, or `null` where none does. @type {(a: Type, b: Type) => Type | null} */
const join = (a, b) =>
    sub(a, b) ? b
    : sub(b, a) ? a
    : a[0] === 'int' && b[0] === 'int' ? int(a[1] < b[1] ? a[1] : b[1], a[2] > b[2] ? a[2] : b[2])
    : null

/** The narrowest type that holds every type of a list, or `null` where none does. @type {(types: readonly Type[]) => Type | null} */
const joinAll = ([a, ...rest]) => {
    if (rest.length === 0) { return a }
    const j = join(a, rest[0])
    return j === null ? null : joinAll([j, ...rest.slice(1)])
}

/** A count in a message: `one operand`, `2 arguments`. @type {(k: number, noun: string) => string} */
const count = (k, noun) => k === 1 ? `one ${noun}` : `${k} ${noun}s`

// operators

/** @type {(xs: readonly bigint[]) => bigint} */
const least = xs => xs.reduce((a, b) => a < b ? a : b)

/** @type {(xs: readonly bigint[]) => bigint} */
const greatest = xs => xs.reduce((a, b) => a > b ? a : b)

/** @type {(name: OpName, a: Int, b: Int) => Result<Type, string>} */
const intOp = (name, a, b) => {
    /** @type {(lo: bigint, hi: bigint) => Result<Type, string>} */
    const range = (lo, hi) => {
        const t = int(lo, hi)
        return fits(64)(t) ? ok(t) : error(`${name} of ${show(a)} and ${show(b)} is ${show(t)}, which needs more than one word`)
    }
    switch (name) {
        case 'add': { return range(a[1] + b[1], a[2] + b[2]) }
        case 'sub': { return range(a[1] - b[2], a[2] - b[1]) }
        case 'mul': {
            const ends = [a[1] * b[1], a[1] * b[2], a[2] * b[1], a[2] * b[2]]
            return range(least(ends), greatest(ends))
        }
        case 'eq': case 'lt': case 'le': {
            return compareIn(a, b) === null ? error(`${name} of ${show(a)} and ${show(b)} needs more than one word`) : ok(bool)
        }
        default: { return error(`${name} of two integers is not in this slice`) }
    }
}

/** A float operator's type: `abs` keeps `f64c`, and every other result is an `f64`. @type {(name: OpName, a: Type) => Result<Type, string>} */
const floatOp = (name, a) => {
    switch (name) {
        case 'abs': { return ok(a) }
        case 'eq': case 'lt': case 'le': { return ok(bool) }
        case 'float': { return error(`float of ${show(a)}: float takes an integer`) }
        default: { return ok(f64) }
    }
}

/**
 * An operator's type, from its operands' types: two integers or two
 * floats, or one for `neg`, `abs`, `sqrt` and `float`.
 *
 * @type {(name: OpName, args: readonly Type[]) => Result<Type, string>}
 */
const opType = (name, args) => {
    const unary = name === 'neg' || name === 'abs' || name === 'sqrt' || name === 'float'
    if (args.length !== (unary ? 1 : 2)) {
        return error(`${name} takes ${count(unary ? 1 : 2, 'operand')}, not ${args.length}`)
    }
    const ints = args.flatMap(t => t[0] === 'int' ? [t] : [])
    const [a, b] = ints
    if (ints.length === args.length) {
        return name === 'float'
            ? (-(1n << 53n) <= a[1] && a[2] <= 1n << 53n ? ok(f64c) : error(`float of ${show(a)}: a float holds the integers within ±2^53 only`))
            : unary ? error(`${name} of an integer is not in this slice`)
            : intOp(name, a, b)
    }
    return args.every(isFloat) ? floatOp(name, args[0])
        : error(`${name} of ${args.map(show).join(' and ')}: the operands are integers or floats, not both`)
}

// terms

/**
 * The arms of a `match`, each with the variants it takes, `else` written
 * out. Each arm names variants of the operand, none is named twice, `else`
 * comes last and takes some, every variant has an arm, and no arm names the
 * operand.
 *
 * @type {(variants: readonly string[], arms: readonly ArmOf<Term>[]) => Result<readonly (readonly [readonly string[], Term])[], string>}
 */
const resolveArms = (variants, arms) => {
    const named = arms.flatMap(([vs]) => vs ?? [])
    const stranger = named.find(v => !variants.includes(v))
    const twice = named.find((v, k) => named.indexOf(v) !== k)
    const rest = variants.filter(v => !named.includes(v))
    const otherwise = arms.findIndex(([vs]) => vs === null)
    return stranger !== undefined ? error(`no variant ${stranger}`)
        : twice !== undefined ? error(`${twice} has two arms`)
        : arms.some(([vs]) => vs !== null && vs.length === 0) ? error('an arm names no variant')
        : arms.some(([, binder]) => binder !== null) ? error('a name for the operand of an arm is not in this slice')
        : otherwise >= 0 && otherwise !== arms.length - 1 ? error('else is not the last arm')
        : otherwise >= 0 && rest.length === 0 ? error('else takes no variant')
        : otherwise < 0 && rest.length > 0 ? error(`no arm for ${rest.join(' or ')}`)
        : ok(arms.map(([vs, , body]) => /** @type {const} */ ([vs ?? rest, body])))
}

/** @type {(variants: readonly string[], body: Typed) => TypedArm} */
const arm = (variants, body) => [variants, body]

/** @type {(env: _Env, t: Term) => Result<Typed, string>} */
const term = (env, t) => {
    /** @type {(message: string) => Result<Typed, string>} */
    const no = message => error(`${env.name}: ${message}`)
    switch (t[0]) {
        case 'lit': {
            const [, type, v] = t
            const why = unsupported(type)
            const fit = type[0] === 'int' ? typeof v === 'bigint' && type[1] <= v && v <= type[2] : isFloat(type) && typeof v === 'number'
            return why !== null ? no(why) : fit ? ok([type, t]) : no(`${v} is not a literal of ${show(type)}`)
        }
        case 'get': {
            const type = at(t[1])(env.locals)
            return type === null ? no(`no local ${t[1]}`) : ok([type, t])
        }
        case 'let': {
            const [, name, e, body] = t
            if (at(name)(env.locals) !== null) { return no(`${name} is bound twice`) }
            const v = value(env, e)
            if (v[0] === 'error') { return v }
            const b = term({ ...env, locals: setReplace(name)(v[1][0])(env.locals) }, body)
            return b[0] === 'error' ? b : ok([b[1][0], ['let', name, v[1], b[1]]])
        }
        case 'op': {
            const args = values(env, t[2])
            if (args[0] === 'error') { return args }
            const type = opType(t[1], args[1].map(([x]) => x))
            return type[0] === 'error' ? no(type[1]) : ok([type[1], ['op', t[1], args[1]]])
        }
        case 'call': {
            const [, module, name, xs] = t
            if (module !== 'self') { return no(`${module}.${name}: a call of another module is not in this slice`) }
            const f = at(name)(env.functions)
            if (f === null) { return no(`no function ${name}`) }
            if (xs.length !== f.params.length) { return no(`${name} takes ${count(f.params.length, 'argument')}, not ${xs.length}`) }
            const args = values(env, xs)
            if (args[0] === 'error') { return args }
            const wrong = args[1].findIndex(([x], k) => !sub(x, f.params[k][1]))
            return wrong < 0 ? ok([f.result, ['call', module, name, args[1]]])
                : no(`${name}'s ${f.params[wrong][0]} is ${show(f.params[wrong][1])}, not ${show(args[1][wrong][0])}`)
        }
        case 'make': {
            return t[1].length === 0 ? ok([unit, ['make', []]]) : no('a product with fields is not in this slice')
        }
        case 'variant': {
            const [, type, name, payload] = t
            if (!equal(type, bool)) { return no(`a variant of ${show(type)}: the one sum of this slice is bool`) }
            const part = bool[1].find(([k]) => k === name)
            if (part === undefined) { return no(`bool has no variant ${name}`) }
            const p = value(env, payload)
            if (p[0] === 'error') { return p }
            return sub(p[1][0], part[1]) ? ok([bool, ['variant', bool, name, p[1]]])
                : no(`${name} holds ${show(part[1])}, not ${show(p[1][0])}`)
        }
        case 'match': {
            const [, e, arms] = t
            const operand = value(env, e)
            if (operand[0] === 'error') { return operand }
            if (!equal(operand[1][0], bool)) { return no(`a match of ${show(operand[1][0])} is not in this slice`) }
            const resolved = resolveArms(['false', 'true'], arms)
            if (resolved[0] === 'error') { return no(resolved[1]) }
            const bodies = okList(resolved[1].map(([, body]) => term(env, body)))
            if (bodies[0] === 'error') { return bodies }
            const types = bodies[1].map(([x]) => x)
            const type = joinAll(types)
            const why = type === null ? `its arms are ${types.map(show).join(', ')}, which no one type holds` : unsupported(type)
            return type === null || why !== null ? no(`match: ${why}`)
                : ok([type, ['match', operand[1], resolved[1].map(([vs], k) => arm(vs, bodies[1][k]))]])
        }
        case 'block': {
            const [, label, type, body] = t
            if (at(label)(env.labels) !== null) { return no(`the label ${label} is in scope already`) }
            const why = unsupported(type)
            if (why !== null) { return no(why) }
            const b = term({ ...env, labels: setReplace(label)(type)(env.labels) }, body)
            if (b[0] === 'error') { return b }
            return sub(b[1][0], type) ? ok([type, ['block', label, type, b[1]]])
                : no(`block ${label} is ${show(type)}, and its body is ${show(b[1][0])}`)
        }
        default: {
            const [, label, e] = t
            const target = at(label)(env.labels)
            if (target === null) { return no(`no label ${label}`) }
            const v = value(env, e)
            if (v[0] === 'error') { return v }
            return sub(v[1][0], target) ? ok([never, ['br', label, v[1]]])
                : no(`${label} takes ${show(target)}, not ${show(v[1][0])}`)
        }
    }
}

/** A term that gives a value, which a `never` does not. @type {(env: _Env, t: Term) => Result<Typed, string>} */
const value = (env, t) => {
    const r = term(env, t)
    return r[0] === 'ok' && isNever(r[1][0]) ? error(`${env.name}: a ${t[0]} that gives no value stands where a value is used`) : r
}

/** @type {(env: _Env, ts: readonly Term[]) => Result<readonly Typed[], string>} */
const values = (env, ts) => okList(ts.map(t => value(env, t)))

// functions and modules

/**
 * A function: parameters of distinct names, types that a module may write,
 * no parameter of type `never`, and a body of its result's type.
 *
 * @type {(functions: OrderedMap<Fn>) => (entry: readonly [string, Fn]) => Result<readonly [string, FunctionOf<Typed>], string>}
 */
const checkFn = functions => ([name, { params, result, body }]) => {
    /** @type {(message: string) => Result<readonly [string, FunctionOf<Typed>], string>} */
    const no = message => error(`${name}: ${message}`)
    const names = params.map(([k]) => k)
    const twice = names.find((k, j) => names.indexOf(k) !== j)
    const why = [...params.map(([, t]) => t), result].map(unsupported).find(x => x !== null) ?? null
    const unreachable = params.find(([, t]) => isNever(t))
    if (twice !== undefined) { return no(`two parameters are named ${twice}`) }
    if (why !== null) { return no(why) }
    if (unreachable !== undefined) { return no(`${unreachable[0]} is never, so no call reaches the function`) }
    const b = term({ name, locals: fromEntries(params), labels: setReplace('return')(result)(empty), functions }, body)
    if (b[0] === 'error') { return b }
    return sub(b[1][0], result) ? ok([name, { params, result, body: b[1] }])
        : no(`the body is ${show(b[1][0])}, not ${show(result)}`)
}

/**
 * A module, checked: its functions of distinct names, each checked, and
 * exports that name them once each. The answer is the module with every
 * body typed, which is what the emitter reads.
 *
 * @type {(m: Module) => Result<Checked, string>}
 */
export const check = m => {
    const names = m.functions.map(([name]) => name)
    const twice = names.find((k, j) => names.indexOf(k) !== j)
    const missing = m.exports.find(k => !names.includes(k))
    const again = m.exports.find((k, j) => m.exports.indexOf(k) !== j)
    if (twice !== undefined) { return error(`two functions are named ${twice}`) }
    if (missing !== undefined) { return error(`no function ${missing} to export`) }
    if (again !== undefined) { return error(`${again} is exported twice`) }
    const functions = okList(m.functions.map(checkFn(fromEntries(m.functions))))
    return functions[0] === 'error' ? functions : ok({ functions: functions[1], exports: m.exports })
}
