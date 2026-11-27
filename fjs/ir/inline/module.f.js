/**
 * The inline pass: a function's body in place of each call of it that the
 * function's hint asks for, `inline: 'always'`, in the plain stage, after
 * the runtime modules are linked and before the
 * [lifetime pass](../lifetime/module.f.js), which then counts the copies
 * as it counts any other term, and whose answer the checker checks again.
 *
 * - **A copy is its body, bound to the arguments.** A call `self.f(a, b)`
 *   becomes `let #i0.a = a in let #i0.b = b in body`, every local and
 *   label of the body with the call's own prefix, `#i0.`, which no name
 *   of the function starts with, so nothing that the copy binds is bound
 *   twice. Where the body has a `br return`, or is narrower than `f`'s
 *   result `R`, the copy is `block #i0.return: R (...)`, which the `br`
 *   leaves, with the arguments bound inside it, in their order, so that
 *   the body consumes what it owns there.
 * - **A borrow of a value already made is passed in place.** A parameter
 *   that the function borrows, given a local, a literal, a constant, a
 *   function's code, or a field of one of those, of its own type, reads that term itself, so the copy
 *   lends it as the call did, and the lifetime pass writes no `dup` of it.
 * - **An argument narrower than its parameter is widened** by a `block` of
 *   the parameter's type, since the body was checked at that type, and a
 *   `match` of it may name variants that the argument does not hold.
 *   A linear value is no such argument, since the `let` of the copy would
 *   own what the call only lent, and nothing may copy it: the pass refuses
 *   such a call.
 * - **A repeat of a loop of the body names the loop's parameters** with
 *   the prefix too.
 * - **A copy holds the copies of its own calls.** The pass writes the body
 *   of each function that it inlines with its calls inlined too, which ends
 *   since the checker refuses a hint that reaches itself.
 * - **A function inlined everywhere goes.** One hinted `always` that the
 *   module does not export has no call left, and the module has no use
 *   for it. One that it exports stays, for its importers.
 *
 * - **A hook is copied by the emitter.** A `kind`, `dup` or `drop` of a
 *   type that the module defines keeps its calls here, since the lifetime
 *   pass writes more of them later: {@link inlineHooks}, which the emitter
 *   runs on the checked module, copies a hook hinted `always` into each.
 *
 * Which calls are inlined is one function's answer, `inlined`, which reads
 * the hints alone. A function hinted `never`, or not at all, keeps its
 * calls, until a later source of decisions, as a profile, answers for the
 * functions with no hint.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Checked, CheckedFn, ConstantOf, Fn, Int, Module, Sealed, Term, Type, Typed } from '../types.ts'
 * @import { _Hooks, _Names, _Pass, _TypedNames, _Write, _Written } from './private.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { checkPlain } from '../check/module.f.js'
import { block, equal, get, inside, interfacesOf, isCopy, isOwn, leaves } from '../module.f.js'

// names

/** The names of the locals and the labels that a typed term binds. @type {(t: Typed) => readonly string[]} */
const bound = ([, t]) => [
    ...(t[0] === 'let' || t[0] === 'block' ? [t[1]]
        : t[0] === 'match' ? t[2].flatMap(([, binder]) => binder === null ? [] : [binder])
        : t[0] === 'loop' ? [t[1], ...t[2].map(([k]) => k)]
        : []),
    ...inside(t).flatMap(bound),
]

/**
 * The first prefix `#i<k>.`, from `k = n`, that no name of `taken` starts
 * with, and the number after it. No two prefixes start one another, so the
 * names of two copies never meet.
 *
 * @type {(taken: readonly string[], n: number) => readonly [string, number]}
 */
const fresh = (taken, n) => {
    const p = `#i${n}.`
    return taken.some(x => x.slice(0, p.length) === p) ? fresh(taken, n + 1) : [p, n + 1]
}

/** Each name as it is. @type {_Names} */
const asIs = { local: get, rename: x => x, loops: [] }

/** Names inside a region of the label `label`, a loop's or not, which hides any other region of that label. @type {(names: _Names, label: string, loop: boolean) => _Names} */
const within = (names, label, loop) => ({ ...names, loops: [...names.loops.filter(l => l !== label), ...(loop ? [label] : [])] })

/**
 * Whether a copy of `f`'s body needs a `block` around it: the body leaves
 * by a `br return`, or it is of a narrower type than `f`'s result, which a
 * caller may `match` on in full. A `block` lends the locals around it, so
 * a copy has none where it need not.
 *
 * @type {(f: CheckedFn) => boolean}
 */
const blocked = f => leaves(f.body).includes('return') || !equal(f.body[0], f.result)

/** Whether a term is a value already made, which a borrow may read in place: a local, a literal, a constant, a function's code, or a field of such a value. @type {(t: Term) => boolean} */
const made = t => t[0] === 'get' || t[0] === 'lit' || t[0] === 'constant' || t[0] === 'code' || (t[0] === 'field' && made(t[1]))

// terms

/**
 * Terms written in their order, from the prefix number `n`, and the number
 * after the last.
 *
 * @type {(write: _Write, pass: _Pass, names: _Names, ts: readonly Typed[], n: number) => readonly [readonly Term[], number]}
 */
const each = (write, pass, names, ts, n) => ts.reduce(
    /** @type {(r: readonly [readonly Term[], number], t: Typed) => readonly [readonly Term[], number]} */
    ([done, k], t) => {
        const [x, k1] = write(pass, names, t, k)
        return [[...done, x], k1]
    },
    [[], n],
)

/**
 * A copy of `f`'s body in place of a call of it, of the arguments `xs` as
 * the caller typed them and `args` as the pass wrote them.
 *
 * @type {(write: _Write, pass: _Pass, f: CheckedFn, xs: readonly Typed[], args: readonly Term[], n: number) => _Written}
 */
const copy = (write, pass, f, xs, args, n) => {
    const [p, n1] = fresh(pass.taken, n)
    const parts = f.params.map((param, j) => /** @type {const} */ ([param, xs[Number(j)][0], args[Number(j)]]))
    const inPlace = parts.flatMap(([param, type, a]) => !isOwn(param) && made(a) && equal(type, param[1]) ? [/** @type {const} */ ([param[0], a])] : [])
    /** @type {_Names} */
    const names = { local: x => inPlace.find(([k]) => k === x)?.[1] ?? get(`${p}${x}`), rename: x => `${p}${x}`, loops: [] }
    const [body, n2] = write(pass, names, f.body, n1)
    const bound = parts
        .filter(([[k]]) => !inPlace.some(([x]) => x === k))
        .reduceRight(
            /** @type {(b: Term, part: typeof parts[number]) => Term} */
            (b, [[k, t], type, a]) => ['let', `${p}${k}`, equal(type, t) ? a : block(p, t, a), b],
            body,
        )
    return [blocked(f) ? block(`${p}return`, f.result, bound) : bound, n2]
}

/**
 * A typed term as the plain stage writes it, with its names as `names`
 * reads them and each call that `pass` inlines replaced by a copy of the
 * function's body.
 *
 * @type {_Write}
 */
const write = (pass, names, [type, t], n) => {
    const { local, rename } = names
    /** @type {(x: Typed, k: number) => _Written} */
    const one = (x, k) => write(pass, names, x, k)
    switch (t[0]) {
        case 'get': { return [local(t[1]), n] }
        case 'let': {
            const [e, n1] = one(t[2], n)
            const [b, n2] = one(t[3], n1)
            return [['let', rename(t[1]), e, b], n2]
        }
        case 'op': {
            const [xs, n1] = each(write, pass, names, t[2], n)
            // The typed form keeps the type that `trunc_sat` saturates to, and that `seal` makes, as the operator's own.
            return [t[1] === 'trunc_sat' || t[1] === 'seal' ? ['op', t[1], xs, /** @type {Int | Sealed} */ (type)] : ['op', t[1], xs], n1]
        }
        case 'call': {
            const [, module, name, xs] = t
            const [args, n1] = each(write, pass, names, xs, n)
            const f = module === 'self' ? pass.inlined(name) : null
            return f === null ? [['call', module, name, args], n1] : copy(write, pass, f, xs, args, n1)
        }
        case 'call_ref': {
            const [c, n1] = one(t[1], n)
            const [args, n2] = each(write, pass, names, t[2], n1)
            return [['call_ref', c, args], n2]
        }
        case 'make': {
            const [xs, n1] = each(write, pass, names, t[1].map(([, x]) => x), n)
            return [['make', t[1].map(([k], j) => /** @type {const} */ ([k, xs[Number(j)]]))], n1]
        }
        case 'field': {
            const [e, n1] = one(t[1], n)
            return [['field', e, t[2]], n1]
        }
        case 'variant': {
            const [e, n1] = one(t[3], n)
            return [['variant', t[1], t[2], e], n1]
        }
        case 'match': {
            const [e, n1] = one(t[1], n)
            const [bodies, n2] = each(write, pass, names, t[2].map(([, , body]) => body), n1)
            return [['match', e, t[2].map(([, binder, , written], j) => /** @type {const} */ ([written, binder === null ? null : rename(binder), bodies[Number(j)]]))], n2]
        }
        case 'block': {
            const [e, n1] = write(pass, within(names, t[1], false), t[3], n)
            return [['block', rename(t[1]), t[2], e], n1]
        }
        case 'loop': {
            const [firsts, n1] = each(write, pass, names, t[2].map(([, , first]) => first), n)
            const [body, n2] = write(pass, within(names, t[1], true), t[3], n1)
            return [['loop', rename(t[1]), t[2].map(([k, x], j) => /** @type {const} */ ([rename(k), x, firsts[Number(j)]])), body], n2]
        }
        case 'br': {
            const [e, n1] = one(t[2], n)
            // A repeat names the loop's parameters, which are locals of the body.
            const next = e[0] === 'make' && names.loops.includes(t[1]) ? ['make', e[1].map(([k, x]) => /** @type {const} */ ([rename(k), x]))] : e
            return [['br', rename(t[1]), /** @type {Term} */ (next)], n1]
        }
        default: { return [t, n] }
    }
}

/**
 * The first call in a typed term, or in the copies that the pass writes of
 * it, that the pass cannot copy, as the reason, or `null`. A copy binds
 * what it does not pass in place to a `let` that owns it, so a call may
 * lend it no linear value narrower than its parameter; and a copy in a
 * `block` lends the caller's locals to the arguments, so a linear value
 * that the function owns may not move into one.
 *
 * @type {(inlined: _Pass['inlined'], linear: (t: Type) => boolean) => (t: Typed) => string | null}
 */
const uncopied = (inlined, linear) => {
    /** @type {(t: Typed) => string | null} */
    const go = ([, t]) => {
        const f = t[0] === 'call' && t[1] === 'self' ? inlined(t[2]) : null
        if (f === null || t[0] !== 'call') { return inside(t).map(go).find(x => x !== null) ?? null }
        const lent = f.params.find((param, k) => !isOwn(param) && linear(param[1]) && !equal(t[3][Number(k)][0], param[1]))
        const moved = blocked(f) ? f.params.find(param => isOwn(param) && linear(param[1])) : undefined
        return lent !== undefined ? `${t[2]} is inline always, and a call lends its ${lent[0]} a linear value narrower than its parameter, which a copy would own`
            : moved !== undefined ? `${t[2]} is inline always and owns its linear ${moved[0]}, which a copy in a block could not take over`
            : [...t[3], f.body].map(go).find(x => x !== null) ?? null
    }
    return go
}

/** A body or a constant's term, written from scratch: its own names as they are. @type {(inlined: _Pass['inlined'], taken: readonly string[], t: Typed) => Term} */
const top = (inlined, taken, t) => write({ inlined, taken }, asIs, t, 0)[0]

/**
 * A module's plain stage with each call of a function hinted `always`
 * replaced by a copy of its body, and each such function that it does not
 * export left out, or why the checker refuses the plain stage, among its
 * reasons a hint that the pass could not keep.
 *
 * @type {(m: Module) => Result<Module, string>}
 */
export const inline = m => {
    const typed = checkPlain(m)
    if (typed[0] === 'error') { return typed }
    const { functions, constants } = typed[1]
    const hooked = hooksOf(m)
    /** The hint of a function of the module, as the plain stage reads it: a hook's is the emitter's to keep. @type {(name: string) => Fn['inline']} */
    const hintOf = name => hooked.includes(name) ? undefined : assertNotNullish(m.functions.find(([k]) => k === name))[1].inline
    /** @type {_Pass['inlined']} */
    const inlined = name => hintOf(name) === 'always' ? assertNotNullish(functions.find(([k]) => k === name))[1] : null
    const imports = interfacesOf(m)
    /** Whether a type is a linear sealed type: one that names no `dup`, with a variant that is not copy. @type {(t: Type) => boolean} */
    const linear = t => {
        if (t[0] !== 'sealed') { return false }
        const def = assertNotNullish(assertNotNullish(imports.find(([k]) => k === t[1]))[1].types.find(([k]) => k === t[2]))[1]
        return def.dup === undefined && !isCopy(def, t)
    }
    // Only what the module keeps is written, with the copies that it holds: a function inlined everywhere goes, unread.
    const kept = functions.filter(([k]) => hintOf(k) !== 'always' || m.exports.includes(k))
    const why = [...kept.map(([, f]) => f.body), ...constants.map(([, c]) => c.value)].map(uncopied(inlined, linear)).find(x => x !== null)
    if (why !== undefined && why !== null) { return error(why) }
    /** @type {readonly (readonly [string, Fn])[]} */
    const written = m.functions.flatMap(([k, f], j) => {
        const { params, body } = functions[Number(j)][1]
        return hintOf(k) === 'always' && !m.exports.includes(k) ? []
            : [[k, { ...f, body: top(inlined, [...params.map(([x]) => x), ...bound(body)], body) }]]
    })
    /** @type {readonly (readonly [string, ConstantOf<Term>])[]} */
    const values = constants.map(([k, { type, value }]) => [k, { type, value: top(inlined, bound(value), value) }])
    return ok({ ...m, constants: values, functions: written })
}

// hooks

/** {@link made} of a typed term. @type {(t: Typed) => boolean} */
const madeTyped = ([, t]) => t[0] === 'get' || t[0] === 'lit' || t[0] === 'constant' || t[0] === 'code' || (t[0] === 'field' && madeTyped(t[1]))

/**
 * The hooks of the types that a module defines: each `kind`, `dup` and
 * `drop` that the lifetime pass and the emitter call.
 *
 * @type {(m: { readonly defines?: Module['defines'] }) => readonly string[]}
 */
const hooksOf = m => (m.defines?.types ?? []).flatMap(([, { kind, dup, drop }]) => [kind, dup, drop].flatMap(x => x === undefined ? [] : [x]))

/**
 * Typed terms written in their order, from the prefix number `n`, and the
 * number after the last.
 *
 * @type {(pass: _Hooks, names: _TypedNames, ts: readonly Typed[], n: number) => readonly [readonly Typed[], number]}
 */
const eachTyped = (pass, names, ts, n) => ts.reduce(
    /** @type {(r: readonly [readonly Typed[], number], t: Typed) => readonly [readonly Typed[], number]} */
    ([done, k], t) => {
        const [x, k1] = expand(pass, names, t, k)
        return [[...done, x], k1]
    },
    [[], n],
)

/**
 * A copy of a hook's checked body in place of a call of it, typed, of the
 * arguments `args` as the pass wrote them, in a `block` of the call's type
 * where {@link blocked} asks for one, as the plain pass writes a copy.
 *
 * @type {(pass: _Hooks, f: CheckedFn, type: Type, args: readonly Typed[], n: number) => readonly [Typed, number]}
 */
const copyTyped = (pass, f, type, args, n) => {
    const [p, n1] = fresh(pass.taken, n)
    const parts = f.params.map((param, j) => /** @type {const} */ ([param, args[Number(j)]]))
    const inPlace = parts.flatMap(([param, a]) => !isOwn(param) && madeTyped(a) && equal(a[0], param[1]) ? [/** @type {const} */ ([param[0], a])] : [])
    /** @type {_TypedNames} */
    const names = { local: (x, t) => inPlace.find(([k]) => k === x)?.[1] ?? [t, ['get', `${p}${x}`]], rename: x => `${p}${x}`, loops: [] }
    const [body, n2] = expand(pass, names, f.body, n1)
    const bound = parts
        .filter(([[k]]) => !inPlace.some(([x]) => x === k))
        .reduceRight(
            /** @type {(b: Typed, part: typeof parts[number]) => Typed} */
            (b, [[k, t], a]) => [b[0], ['let', `${p}${k}`, equal(a[0], t) ? a : [t, ['block', p, t, a]], b]],
            body,
        )
    return [blocked(f) ? [type, ['block', `${p}return`, type, bound]] : bound, n2]
}

/**
 * A typed term with its names as `names` reads them and each call of a
 * hook that `pass` inlines replaced by a typed copy of the hook's body.
 *
 * @type {(pass: _Hooks, names: _TypedNames, t: Typed, n: number) => readonly [Typed, number]}
 */
const expand = (pass, names, [type, t], n) => {
    const { local, rename } = names
    /** @type {(x: Typed, k: number) => readonly [Typed, number]} */
    const one = (x, k) => expand(pass, names, x, k)
    switch (t[0]) {
        case 'get': { return [local(t[1], type), n] }
        case 'let': {
            const [e, n1] = one(t[2], n)
            const [b, n2] = one(t[3], n1)
            return [[type, ['let', rename(t[1]), e, b]], n2]
        }
        case 'op': {
            const [xs, n1] = eachTyped(pass, names, t[2], n)
            return [[type, ['op', t[1], xs]], n1]
        }
        case 'call': {
            const [, module, name, xs] = t
            const [args, n1] = eachTyped(pass, names, xs, n)
            const f = module === 'self' ? pass.inlined(name) : null
            return f === null ? [[type, ['call', module, name, args]], n1] : copyTyped(pass, f, type, args, n1)
        }
        case 'call_ref': {
            const [c, n1] = one(t[1], n)
            const [args, n2] = eachTyped(pass, names, t[2], n1)
            return [[type, ['call_ref', c, args]], n2]
        }
        case 'make': {
            const [xs, n1] = eachTyped(pass, names, t[1].map(([, x]) => x), n)
            return [[type, ['make', t[1].map(([k], j) => /** @type {const} */ ([k, xs[Number(j)]]))]], n1]
        }
        case 'field': {
            const [e, n1] = one(t[1], n)
            return [[type, ['field', e, t[2]]], n1]
        }
        case 'variant': {
            const [e, n1] = one(t[3], n)
            return [[type, ['variant', t[1], t[2], e]], n1]
        }
        case 'match': {
            const [e, n1] = one(t[1], n)
            const [bodies, n2] = eachTyped(pass, names, t[2].map(([, , body]) => body), n1)
            return [[type, ['match', e, t[2].map(([variants, binder, , written], j) => /** @type {const} */ ([variants, binder === null ? null : rename(binder), bodies[Number(j)], written]))]], n2]
        }
        case 'block': {
            const [e, n1] = expand(pass, within(names, t[1], false), t[3], n)
            return [[type, ['block', rename(t[1]), t[2], e]], n1]
        }
        case 'loop': {
            const [firsts, n1] = eachTyped(pass, names, t[2].map(([, , first]) => first), n)
            const [body, n2] = expand(pass, within(names, t[1], true), t[3], n1)
            return [[type, ['loop', rename(t[1]), t[2].map(([k, x], j) => /** @type {const} */ ([rename(k), x, firsts[Number(j)]])), body]], n2]
        }
        case 'br': {
            const [e, n1] = one(t[2], n)
            // A repeat names the loop's parameters, which are locals of the body.
            /** @type {Typed} */
            const next = e[1][0] === 'make' && names.loops.includes(t[1]) ? [e[0], ['make', e[1][1].map(([k, x]) => /** @type {const} */ ([rename(k), x]))]] : e
            return [[type, ['br', rename(t[1]), next]], n1]
        }
        default: { return [[type, t], n] }
    }
}

/** Each name of a typed term as it is. @type {_TypedNames} */
const asIsTyped = { local: (x, t) => [t, ['get', x]], rename: x => x, loops: [] }

/**
 * A checked module with each call of a hook hinted `always` replaced by a
 * typed copy of the hook's body, which the emitter runs first: the lifetime
 * pass writes a hook's calls after the plain pass has run, and the checker
 * checks them in the form that the pass writes, `seal(t, self.dup(unseal(e)))`
 * and `self.drop(release(x))`, so a copy is written only once both have
 * run. The hooks stay, since the emitter calls them too.
 *
 * @template {Checked} M
 * @type {(m: M) => M}
 */
export const inlineHooks = m => {
    const hooked = hooksOf(m).filter(k => m.functions.find(([j]) => j === k)?.[1].inline === 'always')
    if (hooked.length === 0) { return m }
    /** @type {(name: string) => CheckedFn | null} */
    const inlined = name => hooked.includes(name) ? assertNotNullish(m.functions.find(([k]) => k === name))[1] : null
    /** @type {(taken: readonly string[], t: Typed) => Typed} */
    const top = (taken, t) => expand({ inlined, taken }, asIsTyped, t, 0)[0]
    return {
        ...m,
        constants: m.constants.map(([k, c]) => /** @type {const} */ ([k, { ...c, value: top(bound(c.value), c.value) }])),
        functions: m.functions.map(([k, f]) => /** @type {const} */ ([k, hooked.includes(k) ? f : { ...f, body: top([...f.params.map(([x]) => x), ...bound(f.body)], f.body) }])),
    }
}
