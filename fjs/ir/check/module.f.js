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
 *   variants. A function may give one, which its caller owns, and `dup` /
 *   `drop` count it. The [owned-stage check](./owned/module.f.js) requires
 *   each owned value to be consumed once on every path; `checkPlain` stops
 *   before it, for the [lifetime pass](../lifetime/module.f.js), which
 *   writes the owned stage.
 * - **A string literal is its maker's.** A sealed type whose interface
 *   names the function that makes its literals has string literals of the
 *   one variant that the function makes, `any.only(string)` for `any`,
 *   and a module that has one imports the maker's interface.
 * - **A tag is its interface's too.** A `match` of a sealed type asks the
 *   function that the type names as its `kind`, so a type that names none,
 *   as Containers' builder, has no `match`.
 * - **A function of an interface may give back a parameter that it owns**,
 *   whose type is the function's result: Containers' `push` gives back its
 *   builder, which its import takes once and does not answer.
 * - **A call may fail, or it cannot**
 *   ([definition.md: One effect](../../../doc/sasha-gil/ir/definition.md#one-effect)).
 *   A function of an interface declares it, and one that answers `never`,
 *   as `Functions.throw`, declares it so. The checker infers it for each
 *   function of a module: one may fail where its body has a `trap` or a
 *   call of a function that may fail, of an interface or of the module,
 *   repeating over the module until no function changes. The module that
 *   it answers writes the bit beside each function.
 * - **An inline hint is one that the inline pass can keep.** A function
 *   hinted `always` reaches itself through no chain of calls of such
 *   functions, is read as no value, and is no `kind` of a type that the
 *   module defines, which the emitter calls in each `match` of it. A
 *   type's `dup` and `drop`, which the lifetime pass calls after the
 *   [inline pass](../inline/module.f.js) has run, are copied by the
 *   emitter instead.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { ArmOf, Checked, CheckedFn, Code, ConstantOf, FunctionOf, Int, Interface, Module, OpName, Param, Product, Scope, Sealed, SealedDef, Signature, Term, Type, Typed, TypedTerm } from '../types.ts'
 * @import { _CheckTerm, _Env, _Join, _Label } from './private.ts'
 */

import { error, ok, okList, unwrap } from '../../types/result/module.f.js'
import { assertNotNullish } from '../../asserts/module.f.js'
import { entry } from '../../types/object/entry/module.f.js'
import { at, empty, fromEntries, setReplace } from '../../types/ordered_map/module.f.js'
import { bool, compareIn, definedBy, equal, f64, f64c, fits, inside, int, interfacesOf, isCopy, isOwn, never, product, terms, u, unit } from '../module.f.js'
import { quote, show } from '../print/module.f.js'
import { checkOwned } from './owned/module.f.js'
import { memory, ref } from '../l0/module.f.js'

/** Locals of a function: names to types, without parameter modes. @type {(params: readonly Param[]) => OrderedMap<Type>} */
const localsOf = params => fromEntries(params.map(([name, type]) => /** @type {const} */ ([name, type])))

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

/**
 * Why a module may not write a literal of a sealed type, or `null` where it
 * may: a string, of the type of the variant that the type's string literals
 * hold, which a function of an interface that the module imports makes, an
 * import of a host, so of an interface that does not say `instructions`. A
 * type of that variant alone holds just its values, so the type may name it.
 *
 * @type {(env: _Env, t: Sealed, v: bigint | number | string) => string | null}
 */
const unmade = (env, t, v) => {
    const { literal } = unwrap(definition(env, t))
    const held = kinds(env, t)
    const maker = literal === undefined ? null : at(literal.module)(env.imports)
    return literal === undefined ? `${show(t)} has no literals`
        : typeof v !== 'string' ? `${v} is not a literal of ${show(t)}`
        : held.length !== 1 || held[0] !== literal.variant ? `a string literal is ${show(narrowed(env, t, [literal.variant]))}, not ${show(t)}`
        : maker === null ? `${literal.module} makes the literals of ${t[2]}, and the module does not import ${literal.module}`
        : maker.instructions === true ? `${literal.module} makes the literals of ${t[2]}, and it says instructions, so its functions are the target's, and none makes a literal`
        : null
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
 * Why a module may not write a code type, or `null` where it may: each
 * parameter's type and the result are types a module may write, an `own`
 * parameter only of a sealed type, and no parameter of type `never`.
 *
 * @type {(env: _Env, checkType: (env: _Env, t: Type) => string | null, t: Code) => string | null}
 */
const uncode = (env, checkType, [, params, result]) => {
    const resultOk = equal(result, unit) ? null : checkType(env, result)
    const why = [...params.map(([, x]) => checkType(env, x)), resultOk].find(x => x !== null)
    const unreachable = params.find(([, x]) => isNever(x))
    const unowned = params.find(([mode, x]) => mode === 'own' && x[0] !== 'sealed')
    return typeof why === 'string' ? why
        : unreachable !== undefined ? `a code parameter is never, so no call reaches the function`
        : unowned !== undefined ? `a code parameter is own, and ${show(unowned[1])} is not sealed, so there is nothing to own`
        : null
}

/**
 * Why a module may not write a type, or `null` where it may: a range holds
 * an integer and fits one word, the only sums are `bool` and `never`, a
 * sealed type is one that an imported interface names, and a code type's
 * parameters and result are types a module may write.
 *
 * @type {(env: _Env, t: Type) => string | null}
 */
const unsupported = (env, t) =>
    t[0] === 'int' ? (t[1] > t[2] ? `${show(t)} is empty` : fits(64)(t) ? null : `${show(t)} needs more than one word`)
    : t[0] === 'sealed' ? unsealed(env, t)
    : t[0] === 'code' ? uncode(env, unsupported, t)
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
        : a[0] === 'product' && b[0] === 'product' ? sameFields(a, b) && a[1].every(([, x], j) => sub(env, x, b[1][Number(j)][1]))
        : (a[0] === 'f64c' && b[0] === 'f64') || equal(a, b))

/** The product of the joins of two products' fields, or `null` where two fields have none. @type {(joinTypes: _Join, env: _Env, a: Product, b: Product) => Type | null} */
const joinFields = (joinTypes, env, a, b) => {
    const fields = a[1].flatMap(([k, x], j) => {
        const y = joinTypes(env, x, b[1][Number(j)][1])
        return y === null ? [] : [/** @type {const} */ ([k, y])]
    })
    return fields.length === a[1].length ? product(fields) : null
}

/** The narrowest type that holds both, or `null` where none does. @type {_Join} */
const join = (env, a, b) =>
    sub(env, a, b) ? b
    : sub(env, b, a) ? a
    : a[0] === 'int' && b[0] === 'int' ? int(a[1] < b[1] ? a[1] : b[1], a[2] > b[2] ? a[2] : b[2])
    : a[0] === 'sealed' && b[0] === 'sealed' && a[1] === b[1] && a[2] === b[2] ? narrowed(env, a, [...kinds(env, a), ...kinds(env, b)])
    : a[0] === 'product' && b[0] === 'product' && sameFields(a, b) ? joinFields(join, env, a, b)
    : null

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

/** The least `2^k - 1` at or above `n`, for `n >= 0`. @type {(n: bigint) => bigint} */
const ones = n => n === 0n ? 0n : (1n << BigInt(n.toString(2).length)) - 1n

/**
 * A bit operator's type, of two unsigned integers: `and` within the smaller
 * bound, `or` and `xor` within the ones of the larger, and a shift by a
 * count below 64 exact at both ends, as `mul` is.
 *
 * @type {(name: 'and' | 'or' | 'xor' | 'shl' | 'shr', a: Int, b: Int) => Result<Type, string>}
 */
const bitOp = (name, a, b) => {
    if (a[1] < 0n || b[1] < 0n) { return error(`${name} of ${show(a)} and ${show(b)}: a bit operator takes unsigned integers`) }
    /** @type {(hi: bigint) => Result<Type, string>} */
    const upTo = hi => fits(64)(int(0n, hi)) ? ok(int(0n, hi)) : error(`${name} of ${show(a)} and ${show(b)} is ${show(int(0n, hi))}, which needs more than one word`)
    switch (name) {
        case 'and': { return upTo(a[2] < b[2] ? a[2] : b[2]) }
        case 'or': case 'xor': { return upTo(ones(a[2] > b[2] ? a[2] : b[2])) }
        default: {
            if (b[2] >= 64n) { return error(`${name} of ${show(a)} by ${show(b)}: a shift count is below 64`) }
            if (name === 'shr') { return ok(int(a[1] >> b[2], a[2] >> b[1])) }
            const hi = upTo(a[2] << b[2])
            return hi[0] === 'error' ? hi : ok(int(a[1] << b[1], a[2] << b[2]))
        }
    }
}

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
        case 'and': case 'or': case 'xor': case 'shl': case 'shr': { return bitOp(name, a, b) }
        default: { return error(`${name} of two integers is not in this slice`) }
    }
}

/** A float operator's type: `abs` keeps `f64c`, and every other result is an `f64`. @type {(name: OpName, a: Type) => Result<Type, string>} */
const floatOp = (name, a) => {
    switch (name) {
        case 'abs': { return ok(a) }
        case 'eq': case 'lt': case 'le': { return ok(bool) }
        case 'float': { return error(`float of ${show(a)}: float takes an integer`) }
        case 'canon': { return ok(f64c) }
        case 'to_bits': { return a[0] === 'f64c' ? ok(u(64)) : error(`to_bits of ${show(a)}: to_bits takes an f64c, whose one NaN has one bit pattern`) }
        case 'from_bits': { return error(`from_bits of ${show(a)}: from_bits takes an unsigned integer`) }
        case 'and': case 'or': case 'xor': case 'shl': case 'shr': { return error(`${name} of ${show(a)}: a bit operator takes unsigned integers`) }
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
    const unary = name === 'neg' || name === 'abs' || name === 'sqrt' || name === 'float' || name === 'canon' || name === 'to_bits' || name === 'from_bits'
    if (args.length !== (unary ? 1 : 2)) {
        return error(`${name} takes ${count(unary ? 1 : 2, 'operand')}, not ${args.length}`)
    }
    const ints = args.flatMap(t => t[0] === 'int' ? [t] : [])
    const [a, b] = ints
    if (ints.length === args.length) {
        return name === 'float'
            ? (-(1n << 53n) <= a[1] && a[2] <= 1n << 53n ? ok(f64c) : error(`float of ${show(a)}: a float holds the integers within ±2^53 only`))
            : name === 'from_bits' ? (0n <= a[1] && fits(64)(a) ? ok(f64) : error(`from_bits of ${show(a)}: from_bits takes an unsigned integer`))
            : name === 'to_bits' || name === 'canon' ? error(`${name} of ${show(a)}: ${name} takes a float`)
            : unary ? error(`${name} of an integer is not in this slice`)
            : intOp(name, a, b)
    }
    const texts = args.map(show).join(' and ')
    return args.every(isFloat) ? floatOp(name, args[0])
        : args.every(t => t[0] === 'int' || isFloat(t)) ? error(`${name} of ${texts}: the operands are integers or floats, not both`)
        : error(`${name} of ${texts}: an operator takes integers or floats`)
}

/** Why a module may not see the carrier of `t`, or `null` where it defines `t`. @type {(env: _Env, name: string, t: Sealed) => string | null} */
const unsealable = (env, name, t) => env.own === t[1] ? null : `${name} of ${show(t)}: only the module that defines ${t[1]} sees its carrier`

/** The bits that carry a sealed type's value. @type {(env: _Env, t: Sealed) => Int} */
const carrierBits = (env, t) => unwrap(definition(env, t)).carrier === 'i64' ? u(64) : u(32)

/**
 * The counted types that the module defines, each with its name and its
 * definition: the types whose `dup` and `drop` the lifetime pass calls.
 *
 * @type {(env: _Env) => readonly (readonly [string, SealedDef])[]}
 */
const hooked = env => {
    const i = env.own === null ? null : at(env.own)(env.imports)
    return i === null ? [] : i.types.filter(([, { dup }]) => dup !== undefined)
}

/**
 * The `dup` of `t` where the module defines `t`, `t` is counted and a value
 * of `t` may hold a counted variant, or `null`: the hook that a `seal` of
 * `t` takes its bits from.
 *
 * @type {(env: _Env, t: Sealed) => string | null}
 */
const dupHook = (env, t) => {
    if (t[1] !== env.own) { return null }
    const d = hooked(env).find(([k]) => k === t[2])?.[1]
    return d === undefined || isCopy(d, t) ? null : assertNotNullish(d.dup)
}

/**
 * `unseal`'s type: the bits of its carrier, of one value of a sealed type
 * that the module defines.
 *
 * @type {(env: _Env, args: readonly Type[]) => Result<Type, string>}
 */
const unsealType = (env, args) => {
    if (args.length !== 1) { return error(`unseal takes one operand, not ${args.length}`) }
    const [a] = args
    if (a[0] !== 'sealed') { return error(`unseal of ${show(a)}: unseal takes a value of a sealed type`) }
    const why = unsealable(env, 'unseal', a)
    return why !== null ? error(why) : ok(carrierBits(env, a))
}

/**
 * `seal`'s type: the sealed type that it makes, which a module may write
 * and that it defines, of one integer within its carrier's bits.
 *
 * @type {(env: _Env, target: Sealed | undefined, args: readonly Type[]) => Result<Type, string>}
 */
const sealType = (env, target, args) => {
    if (target === undefined) { return error('seal takes the sealed type that it makes') }
    const bad = unsealed(env, target)
    if (bad !== null) { return error(bad) }
    const why = unsealable(env, 'seal', target)
    if (why !== null) { return error(why) }
    if (args.length !== 1) { return error(`seal takes one operand, not ${args.length}`) }
    const [a] = args
    const bits = carrierBits(env, target)
    return a[0] === 'int' && sub(env, a, bits) ? ok(target) : error(`seal of ${show(a)}: ${show(target)} is made of ${show(bits)}`)
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
 * out, and the variants as it wrote them. Each arm names variants of the
 * operand, none is named twice, `else` comes last and takes some, and every
 * variant has an arm.
 *
 * @type {(variants: readonly string[], arms: readonly ArmOf<Term>[]) => Result<readonly (readonly [readonly string[], string | null, Term, readonly string[] | null])[], string>}
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
        : ok(arms.map(([vs, binder, body]) => /** @type {const} */ ([vs ?? rest, binder, body, vs])))
}

/**
 * What a term names, a function or a constant, or why there is none: one of
 * the module, `self`, from `own`, or of an interface that it imports, from
 * what `of` reads of the interface.
 *
 * @type {<T>(env: _Env, module: string, name: string, noun: string, own: OrderedMap<T>, of: (i: Interface) => readonly (readonly [string, T])[]) => Result<T, string>}
 */
const member = (env, module, name, noun, own, of) => {
    if (module === 'self') {
        const x = at(name)(own)
        return x === null ? error(`no ${noun} ${name}`) : ok(x)
    }
    if (module === env.own) { return error(`${module} is the module itself, which names its ${noun} self.${name}`) }
    const i = at(module)(env.imports)
    const x = i === null ? undefined : of(i).find(([k]) => k === name)
    return i === null ? error(`no interface ${module}`)
        : x === undefined ? error(`${module} has no ${noun} ${name}`)
        : ok(x[1])
}

/** The function that a `call` names, or why there is none. @type {(env: _Env, module: string, name: string) => Result<Signature, string>} */
const callee = (env, module, name) => member(env, module, name, 'function', env.functions, i => i.functions)

/** The type of the constant that a `constant` names, or why there is none. @type {(env: _Env, module: string, name: string) => Result<Type, string>} */
const constantOf = (env, module, name) => member(env, module, name, 'constant', env.constants, i => i.constants ?? [])

/** A term that gives a value, which a `never` does not. @type {(checkTerm: _CheckTerm, env: _Env, t: Term) => Result<Typed, string>} */
const value = (checkTerm, env, t) => {
    const r = checkTerm(env, t)
    return r[0] === 'ok' && isNever(r[1][0]) ? error(`${assertNotNullish(entry(env, 'name'))}: a ${t[0]} that gives no value stands where a value is used`) : r
}

/** @type {(checkTerm: _CheckTerm, env: _Env, ts: readonly Term[]) => Result<readonly Typed[], string>} */
const values = (checkTerm, env, ts) => okList(ts.map(t => value(checkTerm, env, t)))

/**
 * `seal(t, self.dup(unseal(e)))`, the copy of `e` that the lifetime pass
 * writes for a counted type `t` that the module defines, typed, or why the
 * module may not write the `seal`: only the owned stage has it, and only
 * in that form, where `e` is a value of `t`.
 *
 * @type {(checkTerm: _CheckTerm, env: _Env, target: Sealed, dup: string, xs: readonly Term[]) => Result<Typed, string>}
 */
const sealCopy = (checkTerm, env, target, dup, xs) => {
    /** @type {(message: string) => Result<Typed, string>} */
    const no = message => error(`${assertNotNullish(entry(env, 'name'))}: ${message}`)
    // The target is a sealed type that a module may write before the pass's form is looked for.
    const bad = unsealed(env, target)
    if (bad !== null) { return no(bad) }
    if (!env.owned) { return no(`seal of ${show(target)}: only the lifetime pass seals a counted ${show(target)}: seal its copy variants, or let the pass copy`) }
    const [x] = xs
    const inner = xs.length === 1 && x[0] === 'call' && x[1] === 'self' && x[2] === dup && x[3].length === 1 ? x[3][0] : undefined
    if (inner === undefined || inner[0] !== 'op' || inner[1] !== 'unseal' || inner[2].length !== 1) {
        return no(`seal of ${show(target)}: a counted value is sealed only from a copy of its bits, seal(t, self.${dup}(unseal(e)))`)
    }
    const v = value(checkTerm, env, inner[2][0])
    if (v[0] === 'error') { return v }
    const [of] = v[1]
    if (!sub(env, of, target)) { return no(`seal of ${show(target)}: the copy is of ${show(of)}, which ${show(target)} does not hold`) }
    const bits = carrierBits(env, target)
    return ok([target, ['op', 'seal', [[bits, ['call', 'self', dup, [[bits, ['op', 'unseal', [v[1]]]]]]]]]])
}

/**
 * `self.drop(release(x))`, the drop of an owned `x` that the lifetime pass
 * writes for a counted type that the module defines, typed, or why the
 * module may not write the call: only the owned stage has it, and only in
 * that form, where `x` is a value of the type whose `drop` it is.
 *
 * @type {(checkTerm: _CheckTerm, env: _Env, type: string, drop: string, xs: readonly Term[]) => Result<Typed, string>}
 */
const releaseDrop = (checkTerm, env, type, drop, xs) => {
    /** @type {(message: string) => Result<Typed, string>} */
    const no = message => error(`${assertNotNullish(entry(env, 'name'))}: ${message}`)
    const t = show(['sealed', assertNotNullish(env.own), type, null])
    if (!env.owned) { return no(`self.${drop}: only the lifetime pass calls ${t}'s drop`) }
    const [x] = xs
    if (xs.length !== 1 || x[0] !== 'op' || x[1] !== 'release' || x[2].length !== 1) {
        return no(`self.${drop}: ${t}'s drop takes release(x) of the value that it gives up`)
    }
    const v = value(checkTerm, env, x[2][0])
    if (v[0] === 'error') { return v }
    const [of] = v[1]
    if (of[0] !== 'sealed' || of[1] !== env.own || of[2] !== type) { return no(`self.${drop}: release of ${show(of)}, and the drop is ${t}'s`) }
    const bits = carrierBits(env, of)
    return ok([unit, ['call', 'self', drop, [[bits, ['op', 'release', [v[1]]]]]]])
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
 * @type {(checkTerm: _CheckTerm, env: _Env, label: string, params: readonly (readonly [string, Type, Term])[], body: Term) => Result<Typed, string>}
 */
const loopTerm = (checkTerm, env, label, params, body) => {
    const functionName = assertNotNullish(entry(env, 'name'))
    /** @type {(message: string) => Result<Typed, string>} */
    const no = message => error(`${functionName}: ${message}`)
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
    const firsts = values(checkTerm, env, params.map(([, , first]) => first))
    if (firsts[0] === 'error') { return firsts }
    const wrong = firsts[1].findIndex(([x], k) => !sub(env, x, params[Number(k)][1]))
    if (wrong >= 0) { return no(`${params[Number(wrong)][0]} of loop ${label} is ${show(params[Number(wrong)][1])}, not ${show(firsts[1][Number(wrong)][0])}`) }
    /** @type {readonly (readonly [string, Type])[]} */
    const parts = params.map(([k, x]) => /** @type {const} */ ([k, x]))
    const locals = parts.reduce((ls, [k, x]) => setReplace(k)(x)(ls), env.locals)
    const b = checkTerm({ ...env, locals, labels: label_(label, ['loop', parts])(env.labels) }, body)
    return b[0] === 'error' ? b : ok([b[1][0], ['loop', label, params.map(([k, x], j) => /** @type {const} */ ([k, x, firsts[1][Number(j)]])), b[1]]])
}

/**
 * A `br` that repeats a loop: a `make` of the loop's parameters, by their
 * names in their order, each of its parameter's type.
 *
 * @type {(checkTerm: _CheckTerm, env: _Env, label: string, params: readonly (readonly [string, Type])[], e: Term) => Result<Typed, string>}
 */
const repeat = (checkTerm, env, label, params, e) => {
    const functionName = assertNotNullish(entry(env, 'name'))
    /** @type {(message: string) => Result<Typed, string>} */
    const no = message => error(`${functionName}: ${message}`)
    const names = params.map(([k]) => k)
    if (e[0] !== 'make' || !equal(e[1].map(([k]) => k), names)) { return no(`br ${label} takes { ${names.join(', ')} }, the loop's parameters in their order`) }
    const fields = values(checkTerm, env, e[1].map(([, x]) => x))
    if (fields[0] === 'error') { return fields }
    const wrong = fields[1].findIndex(([x], k) => !sub(env, x, params[Number(k)][1]))
    return wrong >= 0 ? no(`${params[Number(wrong)][0]} of loop ${label} is ${show(params[Number(wrong)][1])}, not ${show(fields[1][Number(wrong)][0])}`)
        : ok([never, ['br', label, [product(params), ['make', e[1].map(([k], j) => /** @type {const} */ ([k, fields[1][Number(j)]]))]]]])
}

/** @type {_CheckTerm} */
const term = (env, t) => {
    const functionName = assertNotNullish(entry(env, 'name'))
    /** @type {(message: string) => Result<Typed, string>} */
    const no = message => error(`${functionName}: ${message}`)
    switch (t[0]) {
        case 'lit': {
            const [, type, v] = t
            const why = unsupported(env, type)
            if (why !== null) { return no(why) }
            if (type[0] === 'sealed') {
                const unknown = unmade(env, type, v)
                return unknown === null ? ok([type, t]) : no(unknown)
            }
            const fit = type[0] === 'int' ? typeof v === 'bigint' && type[1] <= v && v <= type[2] : isFloat(type) && typeof v === 'number'
            return fit ? ok([type, t]) : no(`${typeof v === 'string' ? quote(v) : v} is not a literal of ${show(type)}`)
        }
        case 'get': {
            const type = at(t[1])(env.locals)
            return type === null ? no(`no local ${t[1]}`) : ok([type, t])
        }
        case 'let': {
            const [, name, e, body] = t
            if (at(name)(env.locals) !== null) { return no(`${name} is bound twice`) }
            const v = value(term, env, e)
            if (v[0] === 'error') { return v }
            const b = term({ ...env, locals: setReplace(name)(v[1][0])(env.locals) }, body)
            return b[0] === 'error' ? b : ok([b[1][0], ['let', name, v[1], b[1]]])
        }
        case 'op': {
            const [, name, xs, target] = t
            // Only the lifetime pass releases a value, in the drop of a counted type that the module defines.
            if (name === 'release') { return no(`release: only the lifetime pass releases a value, as the argument of its type's drop`) }
            const dup = name === 'seal' && target?.[0] === 'sealed' ? dupHook(env, target) : null
            if (dup !== null) {
                return sealCopy(term, env, /** @type {Sealed} */ (target), dup, xs)
            }
            const args = values(term, env, xs)
            if (args[0] === 'error') { return args }
            const types = args[1].map(([x]) => x)
            const type = name === 'trunc_sat' ? truncType(env, target?.[0] === 'int' ? target : undefined, types)
                : name === 'seal' ? sealType(env, target?.[0] === 'sealed' ? target : undefined, types)
                : target !== undefined ? error(`${name} takes no range`)
                : name === 'unseal' ? unsealType(env, types)
                : opType(name, types)
            return type[0] === 'error' ? no(type[1]) : ok([type[1], ['op', name, args[1]]])
        }
        case 'call': {
            const [, module, name, xs] = t
            // Only the lifetime pass calls the dup and the drop of a counted type that the module defines.
            const hook = module === 'self' ? hooked(env).find(([, { dup, drop }]) => dup === name || drop === name) : undefined
            if (hook !== undefined) {
                const [type, { drop }] = hook
                return drop === name ? releaseDrop(term, env, type, name, xs)
                    : no(`self.${name}: only the lifetime pass calls ${show(['sealed', assertNotNullish(env.own), type, null])}'s dup, in seal(t, self.${name}(unseal(e)))`)
            }
            const f = callee(env, module, name)
            if (f[0] === 'error') { return no(f[1]) }
            const { params, result } = f[1]
            const full = module === 'self' ? name : `${module}.${name}`
            // A function that counts on bits is called only in the body of the hook of its name of a counted type that the module defines, not in a constant of the hook's name.
            const { counts } = f[1]
            if (counts !== undefined && !(env.body && hooked(env).some(([, d]) => (counts === 'dup' ? d.dup : d.drop) === functionName))) {
                return no(`${full} counts a value on its bits, so only the ${counts} of a counted type that the module defines calls it`)
            }
            if (xs.length !== params.length) { return no(`${full} takes ${count(params.length, 'argument')}, not ${xs.length}`) }
            const args = values(term, env, xs)
            if (args[0] === 'error') { return args }
            const wrong = args[1].findIndex(([x], k) => !sub(env, x, params[Number(k)][1]))
            if (wrong >= 0) {
                return no(`${full}'s ${params[Number(wrong)][0]} is ${show(params[Number(wrong)][1])}, not ${show(args[1][Number(wrong)][0])}`)
            }
            // a `dup` answers the type of its argument, so a refined value stays refined
            const iface = at(module === 'self' ? env.own ?? 'self' : module)(env.imports)
            const isDup = iface !== null && iface.types.some(([, d]) => d.dup === name)
            return ok([isDup ? args[1][0][0] : result, ['call', module, name, args[1]]])
        }
        case 'code': {
            // A hook is the lifetime pass's to call, so no code value names one.
            const hook = hooked(env).find(([, { dup, drop }]) => dup === t[1] || drop === t[1])
            if (hook !== undefined) { return no(`code of ${t[1]}: only the lifetime pass calls ${show(['sealed', assertNotNullish(env.own), hook[0], null])}'s ${hook[1].dup === t[1] ? 'dup' : 'drop'}`) }
            const f = callee(env, 'self', t[1])
            if (f[0] === 'error') { return no(f[1]) }
            const { params, result } = f[1]
            /** @type {import('../types.ts').Code} */
            const type = ['code', params.map(p => /** @type {const} */ ([isOwn(p) ? 'own' : 'borrow', p[1]])), result]
            return ok([type, t])
        }
        case 'call_ref': {
            const [, e, xs] = t
            const c = value(term, env, e)
            if (c[0] === 'error') { return c }
            const [of] = c[1]
            if (of[0] !== 'code') { return no(`call_ref of ${show(of)}, which is no code`) }
            const [, params, result] = of
            if (xs.length !== params.length) { return no(`call_ref takes ${count(params.length, 'argument')}, not ${xs.length}`) }
            const args = values(term, env, xs)
            if (args[0] === 'error') { return args }
            const wrong = args[1].findIndex(([x], k) => !sub(env, x, params[Number(k)][1]))
            if (wrong >= 0) {
                return no(`call_ref's argument ${wrong} is ${show(params[Number(wrong)][1])}, not ${show(args[1][Number(wrong)][0])}`)
            }
            return ok([result, ['call_ref', c[1], args[1]]])
        }
        case 'make': {
            const names = t[1].map(([k]) => k)
            const twice = names.find((k, j) => names.indexOf(k) !== j)
            if (twice !== undefined) { return no(`a product names ${twice} twice`) }
            const fields = values(term, env, t[1].map(([, x]) => x))
            if (fields[0] === 'error') { return fields }
            return ok([product(fields[1].map(([x], j) => [names[Number(j)], x])), ['make', fields[1].map((x, j) => /** @type {const} */ ([names[Number(j)], x]))]])
        }
        case 'field': {
            const [, e, name] = t
            const v = value(term, env, e)
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
            const p = value(term, env, payload)
            if (p[0] === 'error') { return p }
            return sub(env, p[1][0], part[1]) ? ok([bool, ['variant', bool, name, p[1]]])
                : no(`${name} holds ${show(part[1])}, not ${show(p[1][0])}`)
        }
        case 'match': {
            const [, e, arms] = t
            const operand = value(term, env, e)
            if (operand[0] === 'error') { return operand }
            const [of] = operand[1]
            /** An arm's body, where its name, if it has one, is the operand at the type of the arm's variants. @type {(arm: readonly [readonly string[], string | null, Term, readonly string[] | null]) => Result<Typed, string>} */
            const body = ([vs, binder, x]) => {
                if (binder === null || of[0] !== 'sealed') { return term(env, x) }
                if (at(binder)(env.locals) !== null) { return no(`${binder} is bound twice`) }
                /** @type {(t: Type) => (locals: OrderedMap<Type>) => OrderedMap<Type>} */
                const bind = setReplace(binder)
                return term({ ...env, locals: bind(narrowed(env, of, vs))(env.locals) }, x)
            }
            if (of[0] !== 'sealed' && !equal(of, bool)) { return no(`a match of ${show(of)} is not in this slice`) }
            if (of[0] === 'sealed' && unwrap(definition(env, of)).kind === undefined) { return no(`a match needs the tag of ${show(of)}, and ${of[1]} names no kind for it`) }
            if (of[0] !== 'sealed' && arms.some(([, binder]) => binder !== null)) { return no("a name for the operand of a bool's arm is not in this slice") }
            const resolved = resolveArms(of[0] === 'sealed' ? kinds(env, of) : ['false', 'true'], arms)
            if (resolved[0] === 'error') { return no(resolved[1]) }
            const bodies = okList(resolved[1].map(body))
            if (bodies[0] === 'error') { return bodies }
            const types = bodies[1].map(([x]) => x)
            const type = joinAll(env, types)
            const why = type === null ? `its arms are ${types.map(show).join(', ')}, which no one type holds` : unheld(env, type)
            return type === null || why !== null ? no(`match: ${why}`)
                : ok([type, ['match', operand[1], resolved[1].map(([vs, binder, , written], k) => /** @type {const} */ ([vs, binder, bodies[1][Number(k)], written]))]])
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
        case 'loop': { return loopTerm(term, env, t[1], t[2], t[3]) }
        case 'br': {
            const [, label, e] = t
            const target = at(label)(env.labels)
            if (target === null) { return no(`no label ${label}`) }
            if (target[0] === 'loop') { return repeat(term, env, label, target[1], e) }
            const v = value(term, env, e)
            if (v[0] === 'error') { return v }
            return sub(env, v[1][0], target[1]) ? ok([never, ['br', label, v[1]]])
                : no(`${label} takes ${show(target[1])}, not ${show(v[1][0])}`)
        }
        case 'constant': {
            const type = constantOf(env, t[1], t[2])
            return type[0] === 'error' ? no(type[1]) : ok([type[1], t])
        }
        default: { return ok([never, t]) }
    }
}

// functions and modules

/**
 * Why a module may not have a function of a signature, or `null` where it
 * may: parameters of distinct names, types that a module may write, no
 * parameter of type `never`, an `own` parameter only of a sealed type,
 * which is what a callee can own, and a result that is a type a module may
 * write, or `unit`, as `drop` answers. The caller owns a sealed result.
 *
 * @type {(env: _Env, s: Signature) => string | null}
 */
const unsigned = (env, { params, result }) => {
    const names = params.map(([k]) => k)
    const twice = names.find((k, j) => names.indexOf(k) !== j)
    const resultOk = equal(result, unit) ? null : unsupported(env, result)
    const why = [...params.map(([, t]) => t).map(t => unsupported(env, t)), resultOk].find(x => x !== null)
    const unreachable = params.find(([, t]) => isNever(t))
    const unowned = params.find(p => isOwn(p) && p[1][0] !== 'sealed')
    return twice !== undefined ? `two parameters are named ${twice}`
        : typeof why === 'string' ? why
        : unreachable !== undefined ? `${unreachable[0]} is never, so no call reaches the function`
        : unowned !== undefined ? `${unowned[0]} is own, and ${show(unowned[1])} is not sealed, so there is nothing to own`
        : null
}

/** A signature, as the messages show it. @type {(s: Signature) => string} */
const shown = ({ params, result }) => `(${params.map(p => `${isOwn(p) ? 'own ' : ''}${p[0]}: ${show(p[1])}`).join(', ')}) -> ${show(result)}`

/** Whether two signatures take the same parameters, each owned or borrowed alike, and answer the same result. @type {(a: Signature, b: Signature) => boolean} */
const sameShape = (a, b) => a.params.length === b.params.length
    && a.params.every((p, k) => equal(p[1], b.params[Number(k)][1]) && isOwn(p) === isOwn(b.params[Number(k)]))
    && equal(a.result, b.result)

/** A signature with its marks, as the messages show it: what it gives back, and whether it may fail and counts on bits. @type {(s: Signature) => string} */
const marked = s => [
    shown(s),
    ...(s.returns === undefined ? [] : [`gives back ${s.returns}`]),
    ...(s.fails === true ? ['may fail'] : []),
    ...(s.counts === undefined ? [] : [`counts ${s.counts}`]),
].join(', ')

/**
 * Why an interface that says `instructions` may not be one, or `null` where
 * it may: it is L0's `Memory`, or a part of it, since the target binds its
 * functions with instructions of its own, and the emitter knows no others.
 * So it is of `Memory`'s ABI, from which the memory is imported, it has no
 * types and no constants, which no host would make, and each of its
 * functions is one of `Memory`'s, with its signature and its marks.
 *
 * @type {(name: string, i: Interface) => string | null}
 */
const unbound = (name, { abi, types, constants = [], functions }) => {
    const [own, { abi: mine, functions: all }] = memory
    const stranger = functions.find(([f]) => all.every(([k]) => k !== f))
    const unlike = functions.flatMap(([f, s]) => {
        const m = all.find(([k]) => k === f)?.[1]
        return m === undefined || sameShape(s, m) && (s.fails === true) === (m.fails === true) && s.counts === m.counts && s.returns === m.returns ? []
            : [`${name}.${f} is L0's ${own}.${f}, which is ${marked(m)}, not ${marked(s)}`]
    })
    return abi !== mine ? `${name} says instructions, so it is L0's ${own}, of ${mine}, not of ${abi}`
        : types.length > 0 || constants.length > 0 ? `${name} says instructions, so it has no types and no constants, which the target would not make`
        : stranger !== undefined ? `${name} says instructions, and ${stranger[0]} is no function of L0's ${own}, which the target binds`
        : unlike[0] ?? null
}

/** The first name that a list holds twice, or `undefined`. @type {(names: readonly string[]) => string | undefined} */
const twiceIn = names => names.find((k, j) => names.indexOf(k) !== j)

/**
 * Why a module may not have a constant of a type, or `null` where it may:
 * a type that a module may write and that holds a value, since a constant
 * is one value, which one global holds.
 *
 * @type {(env: _Env, t: Type) => string | null}
 */
const unkept = (env, t) => isNever(t) ? 'a constant of never holds no value' : unsupported(env, t)

/**
 * Why a module may not import an interface, or `null` where it may: it
 * names each of its types, its constants and its functions once, since a
 * call, a constant and a sealed type find them by their names, each of its
 * sealed types names its variants once each, its constants and its
 * signatures have types that a module may write, the tag of each sealed
 * type that has one comes from a function of the interface that borrows a
 * value of the type and answers `int(0, n - 1)`, one tag for each of its
 * `n` variants, a counted type names both of its counting functions: a
 * `dup` that borrows a value and answers one of the type, and a `drop` that
 * owns one and answers `unit`, only a counted type names copy variants,
 * each a variant of it, once, and a function that gives back a parameter
 * owns it, and the parameter is of the type of its result, a function
 * that answers `never` may fail, and a function that counts on bits is
 * `dup` or `drop` over one word of bits, borrowed: `dup` as
 * `(b: u(64)) -> u(64)` and `drop` as `(b: u(64)) -> unit`, or the same
 * over `u(32)`, and may not fail, since the hooks that call it may not. An
 * interface that says `instructions` is a part of L0's `Memory`
 * ({@link unbound}).
 *
 * @type {(imports: OrderedMap<Interface>) => (entry: readonly [string, Interface]) => string | null}
 */
const checkInterface = imports => ([name, iface]) => {
    const { instructions, types, constants = [], functions } = iface
    /** @type {_Env} */
    const env = { name, locals: empty, labels: empty, functions: empty, imports, constants: empty, own: null, owned: false, body: false }
    const type = twiceIn(types.map(([k]) => k))
    const constant = twiceIn(constants.map(([k]) => k))
    const named = twiceIn(functions.map(([k]) => k))
    const twice = types.find(([, { variants }]) => variants.some((v, k) => variants.indexOf(v) !== k))
    const kept = constants.map(([k, t]) => {
        const why = unkept(env, t)
        return why === null ? null : `${k}: ${why}`
    }).find(x => x !== null)
    const why = functions.map(([, s]) => unsigned(env, s)).find(x => x !== null)
    /** Whether `f` names a function of the interface whose only parameter is a value of `type`, owned or not as `own` says, and whose result is `result`. @type {(f: string, type: string, own: boolean, result: Type) => boolean} */
    const takes = (f, type, own, result) => {
        const s = functions.find(([k]) => k === f)?.[1]
        return s !== undefined && s.params.length === 1 && equal(s.params[0][1], ['sealed', name, type, null]) && isOwn(s.params[0]) === own && equal(s.result, result)
    }
    const untagged = types.find(([type, { variants, kind }]) => kind !== undefined && !takes(kind, type, false, int(0n, BigInt(variants.length - 1))))
    const half = types.find(([, { dup, drop }]) => (dup === undefined) !== (drop === undefined))
    const unmaking = types.find(([, { variants, literal }]) => literal !== undefined && !variants.includes(literal.variant))
    const uncounted = types.find(([, { dup, copy }]) => dup === undefined && copy !== undefined)
    const miscopied = types.find(([, { variants, copy = [] }]) => copy.some((v, k) => !variants.includes(v) || copy.indexOf(v) !== k))
    const miscounted = types.find(([type, { dup, drop }]) => dup !== undefined && drop !== undefined && !(takes(dup, type, false, ['sealed', name, type, null]) && takes(drop, type, true, unit)))
    const unreturned = functions.find(([, { params, result, returns }]) => returns !== undefined && !params.some(p => p[0] === returns && isOwn(p) && equal(p[1], result)))
    const silent = functions.find(([, { result, fails }]) => isNever(result) && fails !== true)
    // A function that counts on bits takes one word of them, once, so that its hook gives each up at most once; bits are borrowed, since `unsigned` refuses to own them.
    const miscounting = functions.find(([, { params, result, fails, counts }]) => {
        if (counts === undefined) { return false }
        const bits = params[0]?.[1]
        const word = bits !== undefined && (equal(bits, u(64)) || equal(bits, u(32)))
        const answers = counts === 'dup' ? bits !== undefined && equal(result, bits) : counts === 'drop' ? equal(result, unit) : false
        return !(params.length === 1 && word && answers && fails !== true)
    })
    const target = instructions === true ? unbound(name, iface) : null
    return typeof target === 'string' ? target
        : type !== undefined ? `${name}: two types are named ${type}`
        : constant !== undefined ? `${name}: two constants are named ${constant}`
        : named !== undefined ? `${name}: two functions are named ${named}`
        : twice !== undefined ? `${name}: ${twice[0]} names a variant twice`
        : typeof kept === 'string' ? `${name}: ${kept}`
        : typeof why === 'string' ? `${name}: ${why}`
        : untagged !== undefined ? `${name}: ${untagged[1].kind} does not answer the tag of ${untagged[0]}, one for each of its variants`
        : half !== undefined ? `${name}: ${half[0]} names ${half[1].dup === undefined ? 'a drop and no dup' : 'a dup and no drop'}, and a counted type names both`
        : unmaking !== undefined ? `${name}: ${unmaking[0]}'s literals hold ${unmaking[1].literal?.variant}, which is none of its variants`
        : uncounted !== undefined ? `${name}: ${uncounted[0]} names copy variants, and only a counted type has them`
        : miscopied !== undefined ? `${name}: ${miscopied[0]}'s copy variants are its variants, each once`
        : miscounted !== undefined ? `${name}: ${miscounted[0]}'s dup borrows a value of the type and answers one, and its drop owns one and answers unit`
        : unreturned !== undefined ? `${name}: ${unreturned[0]} gives back ${unreturned[1].returns}, which is no parameter that it owns of the type of its result`
        : silent !== undefined ? `${name}: ${silent[0]} answers never, so it fails, and it does not say that it may`
        : miscounting !== undefined ? `${name}: ${miscounting[0]} counts on bits, so it is dup as (b: u(64)) -> u(64) or drop as (b: u(64)) -> unit, over u(64) or u(32), and does not fail`
        : null
}

/**
 * The WASM value of the global that holds a constant of `t`, as the emitter
 * writes it: a range's word, an `f64` for a float, an `i32` for a `bool`,
 * and a sealed type's carrier. `null` where `t` is a sealed type that no
 * interface of the module defines, which the interface's checks refuse.
 *
 * @type {(env: _Env, t: Type) => string | null}
 */
const globalOf = (env, t) => {
    if (t[0] !== 'sealed') { return t[0] === 'int' ? (fits(32)(t) ? 'i32' : 'i64') : isFloat(t) ? 'f64' : 'i32' }
    const d = definition(env, t)
    return d[0] === 'ok' ? d[1].carrier : null
}

/**
 * Why two imports of the interfaces that a module imports would be one
 * import of different values, or `null` where none would: a constant and a
 * function, or two constants whose globals hold different WASM values,
 * that are imported from one ABI by one name. A host gives one value for
 * each name of an ABI, so it could bind only one of them. Two constants
 * whose globals hold one WASM value share the host's global, whatever
 * their types, as `f64` and `f64c` do, and two functions of one name share
 * the host's function, as the four `length`s do. The function that makes a
 * type's literals is a function of its interface's ABI here too, and that
 * ABI's `memory` and `data_base` are the loader's, so no constant or
 * function of the ABI has either name. An interface that says
 * `instructions` imports no function, since the target binds it, but its
 * ABI's `memory` is the loader's too, and a module imports one memory, so
 * the literals of a module that touches the memory are made in that ABI's.
 * So are `table` and `table_base` of the first ABI of an interface that the
 * target does not bind, from which a module that holds code imports the
 * loader's table. The emitter imports a maker once
 * for its ABI and its name, and it answers one WASM value, so two types
 * whose literals it makes are carried by that value. Two functions of one
 * name count on bits alike, `dup`, `drop` or not at all, and as L0's `Ref`
 * says NaNVM's do, so that an alias without the marker, beside `Ref` or
 * alone, cannot call a counting host function outside a hook, and a
 * function that is one of `Ref`'s has `Ref`'s signature, which is how
 * NaNVM's host exports it.
 *
 * @type {(env: _Env, loaded: readonly (readonly [string, Interface])[]) => string | null}
 */
const shared = (env, loaded) => {
    // The target binds an interface that says instructions, so none of its functions is an import, and the memory that they touch is the loader's, from its ABI.
    const imports = loaded.filter(([, { instructions }]) => instructions !== true)
    const bound = loaded.filter(([, { instructions }]) => instructions === true)
    const reading = bound.length === 0 ? null : bound[0][1].abi
    const makers = imports.flatMap(([module, { types }]) => types.flatMap(([type, { literal, carrier }]) => {
        const i = literal === undefined ? null : at(literal.module)(env.imports)
        return literal === undefined || i === null ? [] : [/** @type {const} */ ([`${literal.module}.${literal.member}`, i.abi, literal.member, `${module}.${type}`, carrier])]
    }))
    const fns = [...imports.flatMap(([module, { abi, functions }]) => functions.map(([member]) => /** @type {const} */ ([`${module}.${member}`, abi, member]))), ...makers]
    /** How each function import counts on bits, by its name: L0's `Ref` first, which says how NaNVM's own functions count, and a maker not at all. @type {readonly (readonly [string, string, string, string])[]} */
    const marks = [
        ...ref[1].functions.map(([member, { counts }]) => /** @type {const} */ ([`L0's ${ref[0]}.${member}`, ref[1].abi, member, counts ?? 'nothing'])),
        ...imports.flatMap(([module, { abi, functions }]) => functions.map(([member, { counts }]) => /** @type {const} */ ([`${module}.${member}`, abi, member, counts ?? 'nothing']))),
        ...makers.map(([name, abi, member]) => /** @type {const} */ ([name, abi, member, 'nothing'])),
    ]
    // Every name of one host function says how it counts on bits alike, so that no unmarked alias calls a counting one outside a hook.
    const alias = marks.flatMap(([name, abi, member, c], j) => {
        const other = marks.find(([, a, m, x], k) => k < j && a === abi && m === member && x !== c)
        return other === undefined ? [] : [`the functions ${other[0]}, which counts ${other[3]}, and ${name}, which counts ${c}, are both the import ${member} of ${abi}, and its names count on bits alike`]
    })
    // A function that is one of NaNVM's own in L0's Ref has Ref's signature, as NaNVM's host exports it.
    const unlike = imports.flatMap(([module, { abi, functions }]) => abi !== ref[1].abi ? [] : functions.flatMap(([member, s]) => {
        const r = ref[1].functions.find(([k]) => k === member)?.[1]
        return r === undefined || sameShape(s, r) ? [] : [`${module}.${member} is the import ${member} of ${abi}, which L0's ${ref[0]}.${member} declares as ${shown(r)}, not ${shown(s)}`]
    }))
    const cs = imports.flatMap(([module, { abi, constants = [] }]) => constants.map(([member, t]) => /** @type {const} */ ([`${module}.${member}`, abi, member, globalOf(env, t)])))
    /** What a module does that the loader gives it the import `member` of `abi` for, or `null` where it gives none. @type {(abi: string, member: string) => string | null} */
    const given = (abi, member) => (member === 'memory' || member === 'data_base') && makers.some(([, a]) => a === abi) ? 'makes literals'
        : member === 'memory' && abi === reading ? 'touches the memory'
        : null
    const loader = [...fns.map(([name, abi, member]) => /** @type {const} */ ([`function ${name}`, abi, member])), ...cs.map(([name, abi, member]) => /** @type {const} */ ([`constant ${name}`, abi, member]))]
        .find(([, abi, member]) => given(abi, member) !== null)
    // A module imports one memory: its literals' segment and the instructions are on the same one.
    const memories = reading === null ? undefined : makers.find(([, a]) => a !== reading)
    const first = imports.length === 0 ? null : imports[0][1].abi
    const table = [...fns.map(([name, abi, member]) => /** @type {const} */ ([`function ${name}`, abi, member])), ...cs.map(([name, abi, member]) => /** @type {const} */ ([`constant ${name}`, abi, member]))]
        .find(([, abi, member]) => (member === 'table' || member === 'table_base') && abi === first)
    const clash = cs.flatMap(([name, abi, member, w], j) => {
        // L0's Ref functions are NaNVM's functions, imported or not, so no constant is one of them.
        const f = [...fns, ...ref[1].functions.map(([member]) => /** @type {const} */ ([`L0's ${ref[0]}.${member}`, ref[1].abi, member]))].find(([, a, m]) => a === abi && m === member)
        const c = cs.find(([, a, m, x], k) => k < j && a === abi && m === member && x !== null && w !== null && x !== w)
        return f !== undefined ? [`the constant ${name} and the function ${f[0]} are both the import ${member} of ${abi}`]
            : c !== undefined ? [`the constants ${c[0]}, a global of ${c[3]}, and ${name}, a global of ${w}, are both the import ${member} of ${abi}`]
            : []
    })
    const carried = makers.flatMap(([, abi, member, type, c], j) => {
        const other = makers.find(([, a, m, , x], k) => k < j && a === abi && m === member && x !== c)
        return other === undefined ? [] : [`the literals of ${other[3]}, carried by ${other[4]}, and of ${type}, carried by ${c}, are both made by the import ${member} of ${abi}, which answers one WASM value`]
    })
    return loader !== undefined ? `the ${loader[0]} is the import ${loader[2]} of ${loader[1]}, which the loader gives a module that ${given(loader[1], loader[2])}`
        : memories !== undefined ? `the literals of ${memories[3]} are made in the memory of ${memories[1]}, and ${bound[0][0]} touches the memory of ${reading}, but a module imports one memory`
        : table !== undefined ? `the ${table[0]} is the import ${table[2]} of ${table[1]}, which the loader gives a module that holds code`
        : clash[0] ?? carried[0] ?? alias[0] ?? unlike[0] ?? null
}

/**
 * Why the checker may not type a term in an environment, or `null` where
 * it may: the interfaces and the signatures that the environment sees are
 * ones a module may have, the types of its locals are ones a local may
 * hold, and `results`, those of its functions, ones a module may write.
 * The import checks read `loaded`, the interfaces that the loader links,
 * which leave out the one that a module defines. Every type that reaches
 * the rules of a term has passed this.
 *
 * @type {(env: _Env, imports: readonly (readonly [string, Interface])[], functions: readonly (readonly [string, Signature])[], locals: readonly Type[], results: readonly Type[], loaded?: readonly (readonly [string, Interface])[]) => string | null}
 */
const unscoped = (env, imports, functions, locals, results, loaded = imports) => {
    const interfaces = imports.map(([name]) => name)
    const imported = interfaces.find((k, j) => interfaces.indexOf(k) !== j || k === 'self')
    const names = functions.map(([name]) => name)
    const twice = names.find((k, j) => names.indexOf(k) !== j)
    const iface = imports.map(checkInterface(env.imports)).find(x => x !== null)
    const field = shared(env, loaded)
    const signature = functions.map(([name, s]) => {
        const why = unsigned(env, s)
        return why === null ? null : `${name}: ${why}`
    }).find(x => x !== null)
    const local = [...locals.map(t => unheld(env, t)), ...results.map(t => unsupported(env, t))].find(x => x !== null)
    return imported === 'self' ? 'self is the module itself, so no interface has that name'
        : imported !== undefined ? `${imported} is imported twice`
        : twice !== undefined ? `two functions are named ${twice}`
        : typeof iface === 'string' ? iface
        : typeof field === 'string' ? field
        : typeof signature === 'string' ? signature
        : typeof local === 'string' ? `${assertNotNullish(entry(env, 'name'))}: ${local}`
        : null
}

/** A function whose signature the checker took: a body of its result's type, with its inline hint, which the passes after the checker read. @type {(functions: OrderedMap<Signature>, imports: OrderedMap<Interface>, constants: OrderedMap<Type>, own: string | null, owned: boolean) => (entry: readonly [string, FunctionOf<Term>]) => Result<readonly [string, FunctionOf<Typed>], string>} */
const checkFn = (functions, imports, constants, own, owned) => ([name, { params, result, body, inline }]) => {
    /** @type {_Env} */
    const env = { name, locals: localsOf(params), labels: label_('return', ['block', result])(empty), functions, imports, constants, own, owned, body: true }
    const b = term(env, body)
    if (b[0] === 'error') { return b }
    return sub(env, b[1][0], result) ? ok([name, { params, result, body: b[1], ...(inline === undefined ? {} : { inline }) }])
        : error(`${name}: the body is ${show(b[1][0])}, not ${show(result)}`)
}

/**
 * A constant whose type the checker took: a term that gives a value of the
 * type, with no local and no label in scope, since it is no function's
 * body.
 *
 * @type {(functions: OrderedMap<Signature>, imports: OrderedMap<Interface>, constants: OrderedMap<Type>, own: string | null, owned: boolean) => (entry: readonly [string, ConstantOf<Term>]) => Result<readonly [string, ConstantOf<Typed>], string>}
 */
const checkConstant = (functions, imports, constants, own, owned) => ([name, { type, value: e }]) => {
    /** @type {_Env} */
    const env = { name, locals: empty, labels: empty, functions, imports, constants, own, owned, body: false }
    const v = value(term, env, e)
    if (v[0] === 'error') { return v }
    return sub(env, v[1][0], type) ? ok([name, { type, value: v[1] }])
        : error(`${name}: the value is ${show(v[1][0])}, not ${show(type)}`)
}

// the order of the constants

/** The names of `a`, then those of `b` that `a` does not have. @type {(a: readonly string[], b: readonly string[]) => readonly string[]} */
const union = (a, b) => [...a, ...b.filter(x => !a.includes(x))]

/**
 * The kind that a typed `match` calls, by its interface and its name, or
 * `null` where it calls none: a `match` of a sealed type tests a tag where
 * an arm before its last takes a variant, as the emitter writes it.
 *
 * @type {(imports: OrderedMap<Interface>, t: TypedTerm) => readonly [string, string] | null}
 */
const kindCall = (imports, t) => {
    if (t[0] !== 'match' || t[1][0][0] !== 'sealed' || t[2].slice(0, -1).every(([vs]) => vs.length === 0)) { return null }
    const [, module, name] = t[1][0]
    return [module, assertNotNullish(assertNotNullish(assertNotNullish(at(module)(imports)).types.find(([k]) => k === name))[1].kind)]
}

/**
 * The module's constants that a typed term reads itself, and the module's
 * functions that it calls, each once. A `call_ref` of a known `code(f)`
 * counts as a call of `f`; `code(f)` alone does not. A `match` of a type
 * that the module defines, `own`, calls its kind where it tests a tag.
 *
 * @type {(imports: OrderedMap<Interface>, own: string | null) => (x: Typed) => readonly [readonly string[], readonly string[]]}
 */
const uses = (imports, own) => ([, t]) => {
    const known = t[0] === 'call_ref' && t[1][1][0] === 'code' ? t[1][1][1] : null
    const kind = kindCall(imports, t)
    /** @type {readonly [readonly string[], readonly string[]]} */
    const start = t[0] === 'constant' && t[1] === 'self' ? [[t[2]], []]
        : t[0] === 'call' && t[1] === 'self' ? [[], [t[2]]]
        : known !== null ? [[], [known]]
        : kind !== null && kind[0] === own ? [[], [kind[1]]]
        : [[], []]
    return inside(t).reduce(([cs, fs], x) => {
        const [c, f] = uses(imports, own)(x)
        return [union(cs, c), union(fs, f)]
    }, start)
}

/** Whether a typed term has a `call_ref` whose callee is not a known `code(f)`. @type {(x: Typed) => boolean} */
const unresolvedCallRef = ([, t]) =>
    (t[0] === 'call_ref' && t[1][1][0] !== 'code') || inside(t).some(unresolvedCallRef)

/**
 * The module's constants that each function reads, itself or through the
 * functions that it calls: what its body reads, then what those read, again
 * until no function reads more.
 *
 * @type {(direct: readonly (readonly [string, readonly [readonly string[], readonly string[]]])[]) => OrderedMap<readonly string[]>}
 */
const readings = direct => {
    /** @type {(current: OrderedMap<readonly string[]>) => OrderedMap<readonly string[]>} */
    const grow = current => {
        /** @type {(f: string) => readonly string[]} */
        const of = f => assertNotNullish(at(f)(current))
        const next = fromEntries(direct.map(([f, [, fs]]) => /** @type {const} */ ([f, fs.reduce((r, g) => union(r, of(g)), of(f))])))
        return direct.every(([f]) => assertNotNullish(at(f)(next)).length === of(f).length) ? current : grow(next)
    }
    return grow(fromEntries(direct.map(([f, [cs]]) => /** @type {const} */ ([f, cs]))))
}

/**
 * Why `init` may not evaluate the constants in their order, or `null` where
 * it may: the term of each reads only the constants before it, itself or
 * through the functions that it calls.
 *
 * @type {(imports: OrderedMap<Interface>, own: string | null, constants: readonly (readonly [string, ConstantOf<Typed>])[], functions: readonly (readonly [string, FunctionOf<Typed>])[]) => string | null}
 */
const unordered = (imports, own, constants, functions) => {
    const all = functions.map(([f]) => f)
    // An unresolved code value may run any function: in an initializer and in
    // any function body, take every function as a callee so readings grow.
    /** @type {(x: Typed) => readonly [readonly string[], readonly string[]]} */
    const deps = x => {
        const [cs, fs] = uses(imports, own)(x)
        return [cs, unresolvedCallRef(x) ? all : fs]
    }
    const reading = readings(functions.map(([f, { body }]) => /** @type {const} */ ([f, deps(body)])))
    const names = constants.map(([k]) => k)
    return constants.map(([k, { value: e }], j) => {
        const [cs, fs] = deps(e)
        const late = fs.reduce((r, f) => union(r, assertNotNullish(at(f)(reading))), cs).find(c => names.indexOf(c) >= j)
        return late === undefined ? null : `${k}: ${late} is read before init evaluates it`
    }).find(x => x !== null) ?? null
}

// the effect

/** Whether a function of an interface that a module imports may fail, as the interface declares. @type {(imports: OrderedMap<Interface>, module: string, name: string) => boolean} */
const declared = (imports, module, name) => assertNotNullish(assertNotNullish(at(module)(imports)).functions.find(([k]) => k === name))[1].fails === true

/**
 * What a typed term does that may fail: whether it may fail itself, by a
 * `trap` or by a call of a function of an interface that may fail, and the
 * module's functions that it calls, each once.
 *
 * @type {(imports: OrderedMap<Interface>, own: string | null) => (x: Typed) => readonly [boolean, readonly string[]]}
 */
const failures = (imports, own) => ([, t]) => {
    // A `call_ref` of a known `code(f)` fails as `f` does; any other code value may fail.
    const known = t[0] === 'call_ref' && t[1][1][0] === 'code' ? t[1][1][1] : null
    // A `match` that tests a tag calls its kind: the module's own, for a type that it defines.
    const kind = kindCall(imports, t)
    const mine = kind !== null && kind[0] === own ? kind[1] : null
    const itself = t[0] === 'trap'
        || (t[0] === 'call' && t[1] !== 'self' && declared(imports, t[1], t[2]))
        || (t[0] === 'call_ref' && known === null)
        || (kind !== null && mine === null && declared(imports, kind[0], kind[1]))
    /** @type {readonly [boolean, readonly string[]]} */
    const start = [itself, t[0] === 'call' && t[1] === 'self' ? [t[2]] : known !== null ? [known] : mine !== null ? [mine] : []]
    return inside(t).reduce(([f, fs], x) => {
        const [g, gs] = failures(imports, own)(x)
        return [f || g, union(fs, gs)]
    }, start)
}

/**
 * The functions of a module that may fail: those that may fail by
 * themselves, then those that call one that may, again until no function
 * changes. A function that calls itself and nothing that may fail cannot.
 *
 * @type {(imports: OrderedMap<Interface>, own: string | null, functions: readonly (readonly [string, FunctionOf<Typed>])[]) => readonly string[]}
 */
const failing = (imports, own, functions) => {
    const direct = functions.map(([f, { body }]) => /** @type {const} */ ([f, failures(imports, own)(body)]))
    /** @type {(known: readonly string[]) => readonly string[]} */
    const grow = known => {
        const next = direct.flatMap(([f, [itself, calls]]) => itself || calls.some(g => known.includes(g)) ? [f] : [])
        return next.length === known.length ? known : grow(next)
    }
    return grow([])
}

/**
 * A call of a function that counts on bits, of the interfaces `imports`,
 * that a typed term makes where its value is not the term's own, or `null`:
 * such a call stands only as the last term of a hook, so that a `dup`
 * answers the bits that it gives and a `drop` gives one up at most once on
 * each path. The last term of a `let` is its body's, and of a `match` each
 * arm's.
 *
 * @type {(imports: OrderedMap<Interface>) => (x: Typed, last: boolean) => string | null}
 */
const misplaced = imports => {
    /** @type {(module: string, name: string) => boolean} */
    const counting = (module, name) => module !== 'self' && at(module)(imports)?.functions.find(([k]) => k === name)?.[1].counts !== undefined
    /** @type {(x: Typed, last: boolean) => string | null} */
    const walk = ([, t], last) => {
        switch (t[0]) {
            case 'call': {
                const inner = t[3].map(a => walk(a, false)).find(r => r !== null)
                return inner !== undefined ? inner : !last && counting(t[1], t[2]) ? `${t[1]}.${t[2]}` : null
            }
            case 'let': { return walk(t[2], false) ?? walk(t[3], last) }
            case 'op': case 'call_ref': {
                const xs = t[0] === 'op' ? t[2] : [t[1], ...t[2]]
                return xs.map(a => walk(a, false)).find(r => r !== null) ?? null
            }
            case 'make': { return t[1].map(([, a]) => walk(a, false)).find(r => r !== null) ?? null }
            case 'field': { return walk(t[1], false) }
            case 'variant': { return walk(t[3], false) }
            case 'match': { return walk(t[1], false) ?? t[2].map(([, , body]) => walk(body, last)).find(r => r !== null) ?? null }
            case 'block': { return walk(t[3], false) }
            case 'loop': { return t[2].map(([, , a]) => walk(a, false)).find(r => r !== null) ?? walk(t[3], false) }
            case 'br': { return walk(t[2], false) }
            default: { return null }
        }
    }
    return walk
}

/** A function's effect, written beside it. @type {(fails: readonly string[]) => (entry: readonly [string, FunctionOf<Typed>]) => readonly [string, CheckedFn]} */
const withEffect = fails => ([name, f]) => [name, { ...f, fails: fails.includes(name) }]

/**
 * Why a module may not define its sealed types as it does, or `null` where
 * it may: it does not import the interface that it defines, another module
 * makes their literals, and a counted type names both of its hooks, each a
 * function of the module over its carrier's bits, `dup` as
 * `(b: u(64)) -> u(64)` and `drop` as `(b: u(64)) -> unit` for an `i64`
 * carrier, with copy variants only where it is counted, each a variant of
 * it, once ([defined-hooks.md](../../../doc/sasha-gil/ir/defined-hooks.md)).
 *
 * @type {(m: Module, own: string) => string | null}
 */
const misdefined = (m, own) => {
    if (m.imports.some(([k]) => k === own)) { return `the module defines ${own}, so it does not import ${own}` }
    /** Whether the module's function `f` takes one borrowed parameter of `bits` and answers `result`. @type {(f: string, bits: Type, result: Type) => boolean} */
    const over = (f, bits, result) => {
        const s = m.functions.find(([k]) => k === f)?.[1]
        return s !== undefined && s.params.length === 1 && !isOwn(s.params[0]) && equal(s.params[0][1], bits) && equal(s.result, result)
    }
    // Each hook is one type's, so that a call of it names the type whose value it counts.
    const hooks = assertNotNullish(m.defines).types.flatMap(([type, { dup, drop }]) => [...(dup === undefined ? [] : [dup]), ...(drop === undefined ? [] : [drop])].map(f => /** @type {const} */ ([type, f])))
    const shared = hooks.find(([, f], k) => hooks.findIndex(([, g]) => g === f) !== k)
    if (shared !== undefined) { return `${own}.${shared[0]} names ${shared[1]}, which is a hook already: each hook counts one type` }
    return assertNotNullish(m.defines).types.map(([type, { variants, literal, carrier, dup, drop, copy }]) => {
        const t = `${own}.${type}`
        const bits = carrier === 'i64' ? u(64) : u(32)
        const b = show(bits)
        const copies = copy ?? []
        return literal?.module === own ? `${t}: the module that defines it does not make its literals`
            : (dup === undefined) !== (drop === undefined) ? `${t} names ${dup === undefined ? 'a drop and no dup' : 'a dup and no drop'}, and a counted type names both`
            : dup === undefined && copy !== undefined ? `${t} names copy variants, and only a counted type has them`
            : copies.some((v, k) => !variants.includes(v) || copies.indexOf(v) !== k) ? `${t}'s copy variants are its variants, each once`
            : dup !== undefined && !over(dup, bits, bits) ? `${t}'s dup is (b: ${b}) -> ${b}, over its carrier's bits`
            : drop !== undefined && !over(drop, bits, unit) ? `${t}'s drop is (b: ${b}) -> unit, over its carrier's bits`
            : null
    }).find(x => x !== null) ?? null
}

/** The names of the module's functions that a term reads as values. @type {(t: Term) => readonly string[]} */
const codes = t => [...(t[0] === 'code' ? [t[1]] : []), ...terms(t).flatMap(codes)]

/** The functions of the module that a term calls. @type {(t: Term) => readonly string[]} */
const callees = t => [...(t[0] === 'call' && t[1] === 'self' ? [t[2]] : []), ...terms(t).flatMap(callees)]

/**
 * Why a function's inline hint does not hold, or `null` where each does: a
 * hint is `always` or `never`, and a function hinted `always` reaches
 * itself through no chain of calls of such functions, since its copies
 * would never end, and is read as no value, since a value needs its code.
 * A type's `dup` and `drop` may be hinted too: the emitter copies them,
 * since the lifetime pass writes their calls after the inline pass has
 * run. Its `kind` may not, since the emitter writes a call of it in each
 * `match` of the type, which no pass sees.
 *
 * @type {(m: Module) => string | null}
 */
const misinlined = m => {
    const strange = m.functions.find(([, { inline }]) => inline !== undefined && inline !== 'always' && inline !== 'never')
    if (strange !== undefined) { return `${strange[0]}: an inline hint is always or never, not ${/** @type {unknown} */ (strange[1].inline)}` }
    const always = m.functions.flatMap(([k, f]) => f.inline === 'always' ? [/** @type {const} */ ([k, f])] : [])
    const kinds = (m.defines?.types ?? []).map(([, { kind }]) => kind)
    const values = [...m.functions.flatMap(([, f]) => codes(f.body)), ...(m.constants ?? []).flatMap(([, c]) => codes(c.value))]
    /** The functions hinted `always` that `f` calls. @type {(body: Term) => readonly string[]} */
    const next = body => callees(body).filter(g => always.some(([k]) => k === g))
    /** Whether `f` reaches itself through calls of functions hinted `always`. @type {(f: string, body: Term) => boolean} */
    const cycles = (f, body) => {
        let todo = next(body)
        /** @type {readonly string[]} */
        let seen = []
        let k = 0
        while (k < todo.length) {
            const g = todo[Number(k)]
            k = k + 1
            if (!seen.includes(g)) {
                seen = [...seen, g]
                todo = [...todo, ...next(assertNotNullish(always.find(([x]) => x === g))[1].body)]
            }
        }
        return seen.includes(f)
    }
    const value = always.find(([k]) => values.includes(k))
    const cycle = always.find(([k, f]) => cycles(k, f.body))
    const kind = always.find(([k]) => kinds.includes(k))
    return kind !== undefined ? `${kind[0]} is inline always and the kind of a type that the module defines, which the emitter calls in each match of it`
        : value !== undefined ? `${value[0]} is inline always and read as a value, which needs its code`
        : cycle !== undefined ? `${cycle[0]} is inline always and calls itself through functions inline always, so its copies would never end`
        : null
}

/**
 * A module's stage, checked: the plain stage, or the owned one, which the
 * lifetime pass writes and where alone the pass's forms for a counted type
 * that the module defines stand. See `checkPlain`.
 *
 * @type {(m: Module, owned: boolean) => Result<Checked, string>}
 */
const checkStage = (m, owned) => {
    const interfaces = interfacesOf(m)
    const imports = fromEntries(interfaces)
    const functions = fromEntries(m.functions)
    const declared = m.constants ?? []
    const constants = fromEntries(declared.map(([k, { type }]) => /** @type {const} */ ([k, type])))
    const own = definedBy(m)
    /** @type {_Env} */
    const env = { name: '', locals: empty, labels: empty, functions, imports, constants, own, owned, body: false }
    const mine = own === null ? null : misdefined(m, own)
    // The types that the module defines, as an interface's checks see them: their hooks are the module's own, over bits, which `misdefined` checks.
    const plainTypes = own === null ? [] : assertNotNullish(m.defines).types.map(([k, { variants, kind, carrier, literal }]) => /** @type {const} */ ([k, { variants, carrier, ...(kind === undefined ? {} : { kind }), ...(literal === undefined ? {} : { literal }) }]))
    const scoped = own === null ? interfaces : interfaces.map(([k, i]) => /** @type {const} */ ([k, k === own ? { ...i, types: plainTypes } : i]))
    // The loader links what the module imports, and the makers of the literals of the types that it defines, but none of its own functions.
    const loaded = own === null ? m.imports : [...m.imports, /** @type {const} */ ([own, { abi: own, types: plainTypes, functions: [] }])]
    const why = mine ?? unscoped(env, scoped, m.functions, [], [], loaded) ?? misinlined(m)
    const names = m.functions.map(([name]) => name)
    const missing = m.exports.find(k => !names.includes(k))
    const again = twiceIn(m.exports)
    const constant = twiceIn(declared.map(([k]) => k))
    const kept = declared.map(([k, { type }]) => {
        const reason = unkept(env, type)
        return reason === null ? null : `${k}: ${reason}`
    }).find(x => x !== null)
    if (why !== null) { return error(why) }
    if (missing !== undefined) { return error(`no function ${missing} to export`) }
    if (again !== undefined) { return error(`${again} is exported twice`) }
    if (names.includes('init')) { return error('init is the function that evaluates the constants, so no function has that name') }
    if (constant !== undefined) { return error(`two constants are named ${constant}`) }
    if (typeof kept === 'string') { return error(kept) }
    const typed = okList(m.functions.map(checkFn(functions, imports, constants, own, owned)))
    if (typed[0] === 'error') { return typed }
    const values = okList(declared.map(checkConstant(functions, imports, constants, own, owned)))
    if (values[0] === 'error') { return values }
    const late = unordered(imports, own, values[1], typed[1])
    if (late !== null) { return error(late) }
    const fails = failing(imports, own, typed[1])
    // The pass writes the hooks after the effects are inferred, so a hook that may fail would be a failure that no function declares.
    const failingHook = own === null ? undefined : assertNotNullish(m.defines).types
        .flatMap(([type, { dup, drop }]) => [['dup', type, dup], ['drop', type, drop]])
        .find(([, , f]) => f !== undefined && fails.includes(f))
    if (failingHook !== undefined) { return error(`${own}.${failingHook[1]}'s ${failingHook[0]} may fail, and the ${failingHook[0]}s that the lifetime pass writes cannot`) }
    // A hook calls a function that counts on bits only as its last term.
    const astray = own === null ? undefined : assertNotNullish(m.defines).types
        .flatMap(([type, { dup, drop }]) => [['dup', type, dup], ['drop', type, drop]])
        .flatMap(([which, type, f]) => {
            const body = typed[1].find(([k]) => k === f)?.[1].body
            const call = body === undefined ? null : misplaced(imports)(body, true)
            return call === null ? [] : [[which, type, call]]
        })[0]
    if (astray !== undefined) {
        const [which, type, call] = astray
        return error(which === 'dup' ? `${own}.${type}'s dup answers ${call}'s result, so it calls ${call} only as its last term`
            : `${own}.${type}'s drop calls ${call} only as its last term, so at most once on each path`)
    }
    return ok({ imports: m.imports, ...(m.defines === undefined ? {} : { defines: m.defines }), constants: values[1], functions: typed[1].map(withEffect(fails)), exports: m.exports })
}

/**
 * A module's plain stage, checked: the interfaces it imports, its constants
 * and its functions of distinct names, each typed, exports that name its
 * functions once each, and no function named `init`, which the module
 * exports to evaluate its constants in their order. The answer is the
 * module with every term typed and each function's effect, which is what
 * the [lifetime pass](../lifetime/module.f.js) reads to write the owned
 * stage.
 * Nothing here asks how often a value is used, and the forms that only
 * the pass writes, which copy, drop and seal a counted type that the
 * module defines, are refused.
 *
 * @type {(m: Module) => Result<Checked, string>}
 */
export const checkPlain = m => checkStage(m, false)

/**
 * A module, checked: its plain stage typed, and its owned stage checked,
 * each owned value consumed once on every path. The answer is the module
 * with every term typed, which is what the emitter reads.
 *
 * @type {(m: Module) => Result<Checked, string>}
 */
export const check = m => {
    const typed = checkStage(m, true)
    if (typed[0] === 'error') { return typed }
    const owned = checkOwned(typed[1])
    return owned[0] === 'error' ? owned : typed
}

/**
 * The type of a term where it stands in a function or a constant, or why
 * the checker refuses it there: for a producer that picks an operator by
 * the types of its operands, as the lowering from FAST does for `-` and
 * `===`. The label `return` takes the function's result, as in a body, and
 * a constant's term, which has no result, has no label.
 *
 * @type {(scope: Scope) => (t: Term) => Result<Type, string>}
 */
export const typeOf = scope => {
    const name = assertNotNullish(entry(scope, 'name'))
    const { locals, result, functions, imports, constants = [] } = scope
    const results = result === undefined ? [] : [result]
    /** @type {_Env} */
    const env = {
        name,
        locals: localsOf(locals),
        labels: result === undefined ? empty : label_('return', ['block', result])(empty),
        functions: fromEntries(functions),
        imports: fromEntries(imports),
        constants: fromEntries(constants),
        own: null,
        owned: false,
        body: false,
    }
    const why = unscoped(env, imports, functions, locals.map(([, x]) => x), [...results, ...constants.map(([, x]) => x)])
    return t => {
        if (why !== null) { return error(why) }
        const r = term(env, t)
        return r[0] === 'error' ? r : ok(r[1][0])
    }
}
