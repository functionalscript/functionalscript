/**
 * The checker: it types every term of a module and answers the module again
 * with each body typed, or refuses it with the function's name and the
 * reason. The [emitter](../wasm/module.f.js) reads only what this answers,
 * so what this takes is what the emitter has to get right, and nothing
 * else reaches it.
 *
 * It takes the slices of [the task](../todo/slices.md) so far, as the
 * [README](../README.md) lists them, and refuses everything else
 * ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 * The rules are [definition.md](../../../doc/sasha-gil/ir/definition.md)'s
 * and [type-system.md](../../../doc/sasha-gil/ir/type-system.md)'s:
 *
 * - **Integers are exact.** `add`, `sub` and `mul` have the range of their
 *   results as their type, and a range must fit one word of 64 bits.
 * - **Subtyping is the subset relation**: a range of a wider range, `f64c`
 *   of `f64`, `never` of every type, and a product of a product of the same
 *   fields in their order, field by field.
 * - **A local is bound once**: a `let` may not take a name that is in scope,
 *   and a `block` may not take a label that is.
 * - **`never` gives no value.** A term of type `never` may be the body of a
 *   function, a `block`, a `let` or an arm, and nothing else.
 * - **A product stays in its function.** A local, a loop's parameter and the
 *   value of a `match`, a `block` or a `loop` may be one, of fields of
 *   distinct names that each hold a value, and `field` reads a field of one.
 *   A signature names none, so no product crosses a call.
 * - **A sealed type is its interface's.** A module reads a value of `any`
 *   through the functions of the interfaces it imports, and narrows it with
 *   a `match` whose arms may name the operand at the type of their
 *   variants. Every such value is borrowed: no function gives one, so no
 *   term owns one, and nothing has to release it.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { ArmOf, Checked, FunctionOf, Int, Interface, Module, OpName, Param, Product, Scope, Sealed, SealedDef, Signature, Term, Type, Typed } from '../types.ts'
 * @import { _Env, _Label } from './private.ts'
 */

import { error, ok, okList, unwrap } from '../../types/result/module.f.js'
import { at, empty, fromEntries, setReplace } from '../../types/ordered_map/module.f.js'
import { bool, compareIn, equal, f64, f64c, fits, int, never, product, unit } from '../module.f.js'
import { show } from '../print/module.f.js'

// types

/** @type {(t: Type) => boolean} */
const isNever = t => equal(t, never)

/** @type {(t: Type) => boolean} */
const isFloat = t => t[0] === 'f64' || t[0] === 'f64c'

/** A sealed type's definition in the interface that names it, or why there is none. @type {(env: _Env, t: Sealed) => Result<SealedDef, string>} */
const definition = (env, [, module, name]) => {
    const i = at(module)(env.imports)
    const d = i?.types.find(([k]) => k === name)
    return i === null ? error(`no interface ${module}`)
        : d === undefined ? error(`${module} has no type ${name}`)
        : ok(d[1])
}

/** The variants that a value of a sealed type that the checker took may hold, in the order of their tags. @type {(env: _Env, t: Sealed) => readonly string[]} */
const kinds = (env, t) => {
    const { variants } = unwrap(definition(env, t))
    const only = t[3]
    return only === null ? variants : variants.filter(v => only.includes(v))
}

/** The sealed type of some of `t`'s variants, `null` standing for all of them. @type {(env: _Env, t: Sealed, held: readonly string[]) => Sealed} */
const narrowed = (env, t, held) => {
    const { variants } = unwrap(definition(env, t))
    const only = variants.filter(v => held.includes(v))
    return ['sealed', t[1], t[2], only.length === variants.length ? null : only]
}

/** Why a module may not write a sealed type, or `null` where it may: an imported type, with some of its variants, each once. @type {(env: _Env, t: Sealed) => string | null} */
const unsealed = (env, t) => {
    const d = definition(env, t)
    if (d[0] === 'error') { return d[1] }
    const only = t[3] ?? d[1].variants
    const stranger = only.find(v => !d[1].variants.includes(v))
    const twice = only.find((v, k) => only.indexOf(v) !== k)
    return only.length === 0 ? `${show(t)} holds no value`
        : stranger !== undefined ? `${t[2]} has no variant ${stranger}`
        : twice !== undefined ? `${show(t)} names ${twice} twice`
        : null
}

/**
 * Why a module may not write a type, or `null` where it may: a range holds
 * an integer and fits one word, the only sums are `bool` and `never`, and a
 * sealed type is one that an imported interface names.
 *
 * @type {(env: _Env, t: Type) => string | null}
 */
const unsupported = (env, t) =>
    t[0] === 'int' ? (t[1] > t[2] ? `${show(t)} is empty` : fits(64)(t) ? null : `${show(t)} needs more than one word`)
    : t[0] === 'sealed' ? unsealed(env, t)
    : isFloat(t) || equal(t, bool) || isNever(t) ? null
    : `${show(t)} is not in this slice`

/**
 * Why a local, a loop or a label may not hold a value of a type, or `null`
 * where it may: a type that a module may write, or a product whose fields
 * have distinct names and types that a local may hold, and hold a value.
 *
 * @type {(env: _Env, t: Type) => string | null}
 */
const unheld = (env, t) => {
    if (t[0] !== 'product') { return unsupported(env, t) }
    const names = t[1].map(([k]) => k)
    const twice = names.find((k, j) => names.indexOf(k) !== j)
    const empty = t[1].find(([, x]) => isNever(x))
    const why = t[1].map(([, x]) => unheld(env, x)).find(x => x !== null)
    return twice !== undefined ? `${show(t)} has two fields named ${twice}`
        : empty !== undefined ? `${show(t)} holds no value, since its field ${empty[0]} is never`
        : typeof why === 'string' ? why
        : null
}

/** Whether two products have the same fields in their order. @type {(a: Product, b: Product) => boolean} */
const sameFields = (a, b) => equal(a[1].map(([k]) => k), b[1].map(([k]) => k))

/** Whether every value of `a` is a value of `b`. @type {(env: _Env, a: Type, b: Type) => boolean} */
const sub = (env, a, b) => isNever(a)
    || (a[0] === 'int' && b[0] === 'int' ? b[1] <= a[1] && a[2] <= b[2]
        : a[0] === 'sealed' && b[0] === 'sealed' ? a[1] === b[1] && a[2] === b[2] && kinds(env, a).every(v => kinds(env, b).includes(v))
        : a[0] === 'product' && b[0] === 'product' ? sameFields(a, b) && a[1].every(([, x], j) => sub(env, x, b[1][j][1]))
        : (a[0] === 'f64c' && b[0] === 'f64') || equal(a, b))

/** The narrowest type that holds both, or `null` where none does. @type {(env: _Env, a: Type, b: Type) => Type | null} */
const join = (env, a, b) =>
    sub(env, a, b) ? b
    : sub(env, b, a) ? a
    : a[0] === 'int' && b[0] === 'int' ? int(a[1] < b[1] ? a[1] : b[1], a[2] > b[2] ? a[2] : b[2])
    : a[0] === 'sealed' && b[0] === 'sealed' && a[1] === b[1] && a[2] === b[2] ? narrowed(env, a, [...kinds(env, a), ...kinds(env, b)])
    : a[0] === 'product' && b[0] === 'product' && sameFields(a, b) ? joinFields(env, a, b)
    : null

/** The product of the joins of two products' fields, or `null` where two fields have none. @type {(env: _Env, a: Product, b: Product) => Type | null} */
const joinFields = (env, a, b) => {
    const fields = a[1].flatMap(([k, x], j) => {
        const y = join(env, x, b[1][j][1])
        return y === null ? [] : [/** @type {const} */ ([k, y])]
    })
    return fields.length === a[1].length ? product(fields) : null
}

/** The narrowest type that holds every type of a list, or `null` where none does. @type {(env: _Env, types: readonly Type[]) => Type | null} */
const joinAll = (env, [a, ...rest]) => {
    if (rest.length === 0) { return a }
    const j = join(env, a, rest[0])
    return j === null ? null : joinAll(env, [j, ...rest.slice(1)])
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
    const texts = args.map(show).join(' and ')
    return args.every(isFloat) ? floatOp(name, args[0])
        : args.every(t => t[0] === 'int' || isFloat(t)) ? error(`${name} of ${texts}: the operands are integers or floats, not both`)
        : error(`${name} of ${texts}: an operator takes integers or floats`)
}

/**
 * `trunc_sat`'s type: the range that it saturates to, which a module may
 * write, of one float.
 *
 * @type {(env: _Env, target: Int | undefined, args: readonly Type[]) => Result<Type, string>}
 */
const truncType = (env, target, args) => {
    if (target === undefined) { return error('trunc_sat takes the range that it saturates to') }
    const why = unsupported(env, target)
    return why !== null ? error(why)
        : args.length !== 1 ? error(`trunc_sat takes one operand, not ${args.length}`)
        : !isFloat(args[0]) ? error(`trunc_sat of ${show(args[0])}: trunc_sat takes a float`)
        : ok(target)
}

// terms

/**
 * The arms of a `match`, each with the variants it takes, `else` written
 * out. Each arm names variants of the operand, none is named twice, `else`
 * comes last and takes some, and every variant has an arm.
 *
 * @type {(variants: readonly string[], arms: readonly ArmOf<Term>[]) => Result<readonly (readonly [readonly string[], string | null, Term])[], string>}
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
        : otherwise >= 0 && otherwise !== arms.length - 1 ? error('else is not the last arm')
        : otherwise >= 0 && rest.length === 0 ? error('else takes no variant')
        : otherwise < 0 && rest.length > 0 ? error(`no arm for ${rest.join(' or ')}`)
        : ok(arms.map(([vs, binder, body]) => /** @type {const} */ ([vs ?? rest, binder, body])))
}

/**
 * The function that a `call` names, or why there is none: one of the
 * module, or of an interface that it imports.
 *
 * @type {(env: _Env, module: string, name: string) => Result<Signature, string>}
 */
const callee = (env, module, name) => {
    if (module === 'self') {
        const f = at(name)(env.functions)
        return f === null ? error(`no function ${name}`) : ok(f)
    }
    const i = at(module)(env.imports)
    const f = i?.functions.find(([k]) => k === name)
    return i === null ? error(`no interface ${module}`)
        : f === undefined ? error(`${module} has no function ${name}`)
        : ok(f[1])
}

/** @type {(env: _Env, t: Term) => Result<Typed, string>} */
const term = (env, t) => {
    /** @type {(message: string) => Result<Typed, string>} */
    const no = message => error(`${env.name}: ${message}`)
    switch (t[0]) {
        case 'lit': {
            const [, type, v] = t
            const why = unsupported(env, type)
            const fit = type[0] === 'int' ? typeof v === 'bigint' && type[1] <= v && v <= type[2] : isFloat(type) && typeof v === 'number'
            return why !== null ? no(why)
                : type[0] === 'sealed' ? no(`a literal of ${show(type)} is a constant, which is not in this slice`)
                : fit ? ok([type, t])
                : no(`${v} is not a literal of ${show(type)}`)
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
            const [, name, xs, target] = t
            const args = values(env, xs)
            if (args[0] === 'error') { return args }
            const types = args[1].map(([x]) => x)
            const type = name === 'trunc_sat' ? truncType(env, target, types)
                : target !== undefined ? error(`${name} takes no range`)
                : opType(name, types)
            return type[0] === 'error' ? no(type[1]) : ok([type[1], ['op', name, args[1]]])
        }
        case 'call': {
            const [, module, name, xs] = t
            const f = callee(env, module, name)
            if (f[0] === 'error') { return no(f[1]) }
            const { params, result } = f[1]
            const full = module === 'self' ? name : `${module}.${name}`
            if (result[0] === 'sealed') { return no(`${full} gives ${show(result)}, which its caller would own: not in this slice`) }
            if (xs.length !== params.length) { return no(`${full} takes ${count(params.length, 'argument')}, not ${xs.length}`) }
            const args = values(env, xs)
            if (args[0] === 'error') { return args }
            const wrong = args[1].findIndex(([x], k) => !sub(env, x, params[k][1]))
            return wrong < 0 ? ok([result, ['call', module, name, args[1]]])
                : no(`${full}'s ${params[wrong][0]} is ${show(params[wrong][1])}, not ${show(args[1][wrong][0])}`)
        }
        case 'make': {
            const names = t[1].map(([k]) => k)
            const twice = names.find((k, j) => names.indexOf(k) !== j)
            if (twice !== undefined) { return no(`a product names ${twice} twice`) }
            const fields = values(env, t[1].map(([, x]) => x))
            if (fields[0] === 'error') { return fields }
            return ok([product(fields[1].map(([x], j) => [names[j], x])), ['make', fields[1].map((x, j) => /** @type {const} */ ([names[j], x]))]])
        }
        case 'field': {
            const [, e, name] = t
            const v = value(env, e)
            if (v[0] === 'error') { return v }
            const [of] = v[1]
            const part = of[0] === 'product' ? of[1].find(([k]) => k === name) : undefined
            return part !== undefined ? ok([part[1], ['field', v[1], name]])
                : of[0] === 'product' ? no(`${show(of)} has no field ${name}`)
                : no(`field ${name} of ${show(of)}, which is no product`)
        }
        case 'variant': {
            const [, type, name, payload] = t
            if (!equal(type, bool)) { return no(`a variant of ${show(type)}: the one sum of this slice is bool`) }
            const part = bool[1].find(([k]) => k === name)
            if (part === undefined) { return no(`bool has no variant ${name}`) }
            const p = value(env, payload)
            if (p[0] === 'error') { return p }
            return sub(env, p[1][0], part[1]) ? ok([bool, ['variant', bool, name, p[1]]])
                : no(`${name} holds ${show(part[1])}, not ${show(p[1][0])}`)
        }
        case 'match': {
            const [, e, arms] = t
            const operand = value(env, e)
            if (operand[0] === 'error') { return operand }
            const [of] = operand[1]
            /** An arm's body, where its name, if it has one, is the operand at the type of the arm's variants. @type {(arm: readonly [readonly string[], string | null, Term]) => Result<Typed, string>} */
            const body = ([vs, binder, x]) => {
                if (binder === null || of[0] !== 'sealed') { return term(env, x) }
                if (at(binder)(env.locals) !== null) { return no(`${binder} is bound twice`) }
                /** @type {(t: Type) => (locals: OrderedMap<Type>) => OrderedMap<Type>} */
                const bind = setReplace(binder)
                return term({ ...env, locals: bind(narrowed(env, of, vs))(env.locals) }, x)
            }
            if (of[0] !== 'sealed' && !equal(of, bool)) { return no(`a match of ${show(of)} is not in this slice`) }
            if (of[0] !== 'sealed' && arms.some(([, binder]) => binder !== null)) { return no("a name for the operand of a bool's arm is not in this slice") }
            const resolved = resolveArms(of[0] === 'sealed' ? kinds(env, of) : ['false', 'true'], arms)
            if (resolved[0] === 'error') { return no(resolved[1]) }
            const bodies = okList(resolved[1].map(body))
            if (bodies[0] === 'error') { return bodies }
            const types = bodies[1].map(([x]) => x)
            const type = joinAll(env, types)
            const why = type === null ? `its arms are ${types.map(show).join(', ')}, which no one type holds` : unheld(env, type)
            return type === null || why !== null ? no(`match: ${why}`)
                : ok([type, ['match', operand[1], resolved[1].map(([vs, binder], k) => /** @type {const} */ ([vs, binder, bodies[1][k]]))]])
        }
        case 'block': {
            const [, label, type, body] = t
            if (at(label)(env.labels) !== null) { return no(`the label ${label} is in scope already`) }
            const why = unheld(env, type)
            if (why !== null) { return no(why) }
            const b = term({ ...env, labels: label_(label, ['block', type])(env.labels) }, body)
            if (b[0] === 'error') { return b }
            return sub(env, b[1][0], type) ? ok([type, ['block', label, type, b[1]]])
                : no(`block ${label} is ${show(type)}, and its body is ${show(b[1][0])}`)
        }
        case 'loop': { return loopTerm(env, t[1], t[2], t[3]) }
        case 'br': {
            const [, label, e] = t
            const target = at(label)(env.labels)
            if (target === null) { return no(`no label ${label}`) }
            if (target[0] === 'loop') { return repeat(env, label, target[1], e) }
            const v = value(env, e)
            if (v[0] === 'error') { return v }
            return sub(env, v[1][0], target[1]) ? ok([never, ['br', label, v[1]]])
                : no(`${label} takes ${show(target[1])}, not ${show(v[1][0])}`)
        }
        default: { return ok([never, t]) }
    }
}

/** A label bound to what it names. @type {(label: string, l: _Label) => (labels: OrderedMap<_Label>) => OrderedMap<_Label>} */
const label_ = (label, l) => setReplace(label)(l)

/**
 * A `loop`: parameters of distinct names, none in scope, of types that a
 * local may hold and that hold a value, each first value of its
 * parameter's type, typed where the loop stands; then the body, which sees
 * the parameters and the label. The loop's type is its body's, which a
 * local may hold, as the type of every term may.
 *
 * @type {(env: _Env, label: string, params: readonly (readonly [string, Type, Term])[], body: Term) => Result<Typed, string>}
 */
const loopTerm = (env, label, params, body) => {
    /** @type {(message: string) => Result<Typed, string>} */
    const no = message => error(`${env.name}: ${message}`)
    const names = params.map(([k]) => k)
    const twice = names.find((k, j) => names.indexOf(k) !== j)
    const bound = names.find(k => at(k)(env.locals) !== null)
    const why = params.map(([, x]) => unheld(env, x)).find(x => x !== null)
    const empty = params.find(([, x]) => isNever(x))
    if (at(label)(env.labels) !== null) { return no(`the label ${label} is in scope already`) }
    if (twice !== undefined) { return no(`loop ${label} has two parameters named ${twice}`) }
    if (bound !== undefined) { return no(`${bound} is bound twice`) }
    if (typeof why === 'string') { return no(why) }
    if (empty !== undefined) { return no(`${empty[0]} is never, so loop ${label} never starts`) }
    const firsts = values(env, params.map(([, , first]) => first))
    if (firsts[0] === 'error') { return firsts }
    const wrong = firsts[1].findIndex(([x], k) => !sub(env, x, params[k][1]))
    if (wrong >= 0) { return no(`${params[wrong][0]} of loop ${label} is ${show(params[wrong][1])}, not ${show(firsts[1][wrong][0])}`) }
    /** @type {readonly Param[]} */
    const parts = params.map(([k, x]) => [k, x])
    const locals = parts.reduce((ls, [k, x]) => setReplace(k)(x)(ls), env.locals)
    const b = term({ ...env, locals, labels: label_(label, ['loop', parts])(env.labels) }, body)
    return b[0] === 'error' ? b : ok([b[1][0], ['loop', label, params.map(([k, x], j) => /** @type {const} */ ([k, x, firsts[1][j]])), b[1]]])
}

/**
 * A `br` that repeats a loop: a `make` of the loop's parameters, by their
 * names in their order, each of its parameter's type.
 *
 * @type {(env: _Env, label: string, params: readonly Param[], e: Term) => Result<Typed, string>}
 */
const repeat = (env, label, params, e) => {
    /** @type {(message: string) => Result<Typed, string>} */
    const no = message => error(`${env.name}: ${message}`)
    const names = params.map(([k]) => k)
    if (e[0] !== 'make' || !equal(e[1].map(([k]) => k), names)) { return no(`br ${label} takes { ${names.join(', ')} }, the loop's parameters in their order`) }
    const fields = values(env, e[1].map(([, x]) => x))
    if (fields[0] === 'error') { return fields }
    const wrong = fields[1].findIndex(([x], k) => !sub(env, x, params[k][1]))
    return wrong >= 0 ? no(`${params[wrong][0]} of loop ${label} is ${show(params[wrong][1])}, not ${show(fields[1][wrong][0])}`)
        : ok([never, ['br', label, [['product', params], ['make', e[1].map(([k], j) => /** @type {const} */ ([k, fields[1][j]]))]]]])
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
 * Why a module may not have a function of a signature, or `null` where it
 * may: parameters of distinct names, types that a module may write, no
 * parameter of type `never`, and a result that no one has to own.
 *
 * @type {(env: _Env, s: Signature) => string | null}
 */
const unsigned = (env, { params, result }) => {
    const names = params.map(([k]) => k)
    const twice = names.find((k, j) => names.indexOf(k) !== j)
    const why = [...params.map(([, t]) => t), result].map(t => unsupported(env, t)).find(x => x !== null)
    const unreachable = params.find(([, t]) => isNever(t))
    return twice !== undefined ? `two parameters are named ${twice}`
        : typeof why === 'string' ? why
        : unreachable !== undefined ? `${unreachable[0]} is never, so no call reaches the function`
        : result[0] === 'sealed' ? `the result is ${show(result)}, which the caller would own: not in this slice`
        : null
}

/**
 * Why a module may not import an interface, or `null` where it may: it
 * names each of its types and its functions once, since a call and a sealed
 * type find them by their names, each of its sealed types names its
 * variants once each, its signatures have types that a module may write,
 * and the tag of each sealed type comes from a function of the interface
 * that takes the type and answers `int(0, n - 1)`, one tag for each of its
 * `n` variants.
 *
 * @type {(imports: OrderedMap<Interface>) => (entry: readonly [string, Interface]) => string | null}
 */
const checkInterface = imports => ([name, { types, functions }]) => {
    /** @type {_Env} */
    const env = { name, locals: empty, labels: empty, functions: empty, imports }
    const typeNames = types.map(([k]) => k)
    const type = typeNames.find((k, j) => typeNames.indexOf(k) !== j)
    const functionNames = functions.map(([k]) => k)
    const named = functionNames.find((k, j) => functionNames.indexOf(k) !== j)
    const twice = types.find(([, { variants }]) => variants.some((v, k) => variants.indexOf(v) !== k))
    const why = functions.flatMap(([, { params, result }]) => [...params.map(([, t]) => t), result]).map(t => unsupported(env, t)).find(x => x !== null)
    /** @type {(entry: readonly [string, SealedDef]) => boolean} */
    const tagged = ([type, { variants, kind }]) => {
        const f = functions.find(([k]) => k === kind)?.[1]
        return f !== undefined && equal(f.params.map(([, t]) => t), [['sealed', name, type, null]]) && equal(f.result, int(0n, BigInt(variants.length - 1)))
    }
    const untagged = types.find(entry => !tagged(entry))
    return type !== undefined ? `${name}: two types are named ${type}`
        : named !== undefined ? `${name}: two functions are named ${named}`
        : twice !== undefined ? `${name}: ${twice[0]} names a variant twice`
        : typeof why === 'string' ? `${name}: ${why}`
        : untagged !== undefined ? `${name}: ${untagged[1].kind} does not answer the tag of ${untagged[0]}, one for each of its variants`
        : null
}

/**
 * Why the checker may not type a term in an environment, or `null` where
 * it may: the interfaces and the signatures that the environment sees are
 * ones a module may have, the types of its locals are ones a local may
 * hold, and `results`, those of its functions, ones a module may write.
 * Every type that reaches the rules of a term has passed this.
 *
 * @type {(env: _Env, imports: readonly (readonly [string, Interface])[], functions: readonly (readonly [string, Signature])[], locals: readonly Type[], results: readonly Type[]) => string | null}
 */
const unscoped = (env, imports, functions, locals, results) => {
    const interfaces = imports.map(([name]) => name)
    const imported = interfaces.find((k, j) => interfaces.indexOf(k) !== j || k === 'self')
    const names = functions.map(([name]) => name)
    const twice = names.find((k, j) => names.indexOf(k) !== j)
    const iface = imports.map(checkInterface(env.imports)).find(x => x !== null)
    const signature = functions.map(([name, s]) => {
        const why = unsigned(env, s)
        return why === null ? null : `${name}: ${why}`
    }).find(x => x !== null)
    const local = [...locals.map(t => unheld(env, t)), ...results.map(t => unsupported(env, t))].find(x => x !== null)
    return imported === 'self' ? 'self is the module itself, so no interface has that name'
        : imported !== undefined ? `${imported} is imported twice`
        : twice !== undefined ? `two functions are named ${twice}`
        : typeof iface === 'string' ? iface
        : typeof signature === 'string' ? signature
        : typeof local === 'string' ? `${env.name}: ${local}`
        : null
}

/** A function whose signature the checker took: a body of its result's type. @type {(functions: OrderedMap<Signature>, imports: OrderedMap<Interface>) => (entry: readonly [string, FunctionOf<Term>]) => Result<readonly [string, FunctionOf<Typed>], string>} */
const checkFn = (functions, imports) => ([name, { params, result, body }]) => {
    const b = term({ name, locals: fromEntries(params), labels: label_('return', ['block', result])(empty), functions, imports }, body)
    if (b[0] === 'error') { return b }
    return sub({ name, locals: empty, labels: empty, functions, imports }, b[1][0], result) ? ok([name, { params, result, body: b[1] }])
        : error(`${name}: the body is ${show(b[1][0])}, not ${show(result)}`)
}

/**
 * A module, checked: the interfaces it imports, its functions of distinct
 * names, each checked, and exports that name them once each. The answer is
 * the module with every body typed, which is what the emitter reads.
 *
 * @type {(m: Module) => Result<Checked, string>}
 */
export const check = m => {
    const imports = fromEntries(m.imports)
    const functions = fromEntries(m.functions)
    const why = unscoped({ name: '', locals: empty, labels: empty, functions, imports }, m.imports, m.functions, [], [])
    const names = m.functions.map(([name]) => name)
    const missing = m.exports.find(k => !names.includes(k))
    const again = m.exports.find((k, j) => m.exports.indexOf(k) !== j)
    if (why !== null) { return error(why) }
    if (missing !== undefined) { return error(`no function ${missing} to export`) }
    if (again !== undefined) { return error(`${again} is exported twice`) }
    const typed = okList(m.functions.map(checkFn(functions, imports)))
    return typed[0] === 'error' ? typed : ok({ imports: m.imports, functions: typed[1], exports: m.exports })
}

/**
 * The type of a term where it stands in a function, or why the checker
 * refuses it there: for a producer that picks an operator by the types of
 * its operands, as the lowering from FAST does for `-` and `===`. The label
 * `return` takes the function's result, as in a body.
 *
 * @type {(scope: Scope) => (t: Term) => Result<Type, string>}
 */
export const typeOf = ({ name, locals, result, functions, imports }) => t => {
    /** @type {_Env} */
    const env = {
        name, locals: fromEntries(locals), labels: label_('return', ['block', result])(empty), functions: fromEntries(functions), imports: fromEntries(imports),
    }
    const why = unscoped(env, imports, functions, locals.map(([, x]) => x), [result])
    if (why !== null) { return error(why) }
    const r = term(env, t)
    return r[0] === 'error' ? r : ok(r[1][0])
}
