/**
 * The inline pass: a function's body in place of each call of it that the
 * function's hint asks for, `inline: 'always'`, in the plain stage, after
 * the runtime modules are linked and before the
 * [lifetime pass](../lifetime/module.f.js), which then counts the copies
 * as it counts any other term, and whose answer the checker checks again.
 *
 * - **A copy is a `block`.** A call `self.f(a, b)` becomes
 *   `block #i0.return: R (let #i0.a = a in let #i0.b = b in body)`, `R`
 *   the result of `f`, every local and label of the body with the call's
 *   own prefix, `#i0.`, which no name of the function starts with, so
 *   nothing that the copy binds is bound twice, and a `br return` of the
 *   body leaves the block. The arguments are bound inside the block, in
 *   their order, so that the body consumes what it owns there.
 * - **A borrow of a value already made is passed in place.** A parameter
 *   that the function borrows, given a local, a literal, a constant, a
 *   function's code, or a field of one of those, of its own type, reads that term itself, so the copy
 *   lends it as the call did, and the lifetime pass writes no `dup` of it.
 * - **An argument narrower than its parameter is widened** by a `block` of
 *   the parameter's type, since the body was checked at that type, and a
 *   `match` of it may name variants that the argument does not hold.
 * - **A repeat of a loop of the body names the loop's parameters** with
 *   the prefix too.
 * - **A copy holds the copies of its own calls.** The pass writes the body
 *   of each function that it inlines with its calls inlined too, which ends
 *   since the checker refuses a hint that reaches itself.
 * - **A function inlined everywhere goes.** One hinted `always` that the
 *   module does not export has no call left, and the module has no use
 *   for it. One that it exports stays, for its importers.
 *
 * Which calls are inlined is one function's answer, `inlined`, which reads
 * the hints alone. A function hinted `never`, or not at all, keeps its
 * calls, until a later source of decisions, as a profile, answers for the
 * functions with no hint.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { CheckedFn, ConstantOf, Fn, Int, Module, Sealed, Term, Typed } from '../types.ts'
 * @import { _Names, _Pass, _Written } from './private.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { checkPlain } from '../check/module.f.js'
import { block, equal, get, inside, isOwn } from '../module.f.js'

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
const asIs = { local: get, bind: x => x, loops: [] }

/** Names inside a region of the label `label`, a loop's or not, which hides any other region of that label. @type {(names: _Names, label: string, loop: boolean) => _Names} */
const within = (names, label, loop) => ({ ...names, loops: [...names.loops.filter(l => l !== label), ...(loop ? [label] : [])] })

/** Whether a term is a value already made, which a borrow may read in place: a local, a literal, a constant, a function's code, or a field of such a value. @type {(t: Term) => boolean} */
const made = t => t[0] === 'get' || t[0] === 'lit' || t[0] === 'constant' || t[0] === 'code' || (t[0] === 'field' && made(t[1]))

// terms

/**
 * Terms written in their order, from the prefix number `n`, and the number
 * after the last.
 *
 * @type {(pass: _Pass, names: _Names, ts: readonly Typed[], n: number) => readonly [readonly Term[], number]}
 */
const each = (pass, names, ts, n) => ts.reduce(
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
 * @type {(pass: _Pass, f: CheckedFn, xs: readonly Typed[], args: readonly Term[], n: number) => _Written}
 */
const copy = (pass, f, xs, args, n) => {
    const [p, n1] = fresh(pass.taken, n)
    const parts = f.params.map((param, j) => /** @type {const} */ ([param, xs[Number(j)][0], args[Number(j)]]))
    const inPlace = parts.flatMap(([param, type, a]) => !isOwn(param) && made(a) && equal(type, param[1]) ? [/** @type {const} */ ([param[0], a])] : [])
    /** @type {_Names} */
    const names = { local: x => inPlace.find(([k]) => k === x)?.[1] ?? get(`${p}${x}`), bind: x => `${p}${x}`, loops: [] }
    const [body, n2] = write(pass, names, f.body, n1)
    const bound = parts
        .filter(([[k]]) => !inPlace.some(([x]) => x === k))
        .reduceRight(
            /** @type {(b: Term, part: typeof parts[number]) => Term} */
            (b, [[k, t], type, a]) => ['let', `${p}${k}`, equal(type, t) ? a : block(p, t, a), b],
            body,
        )
    return [block(`${p}return`, f.result, bound), n2]
}

/**
 * A typed term as the plain stage writes it, with its names as `names`
 * reads them and each call that `pass` inlines replaced by a copy of the
 * function's body.
 *
 * @type {(pass: _Pass, names: _Names, t: Typed, n: number) => _Written}
 */
const write = (pass, names, [type, t], n) => {
    const { local, bind } = names
    /** @type {(x: Typed, k: number) => _Written} */
    const one = (x, k) => write(pass, names, x, k)
    switch (t[0]) {
        case 'get': { return [local(t[1]), n] }
        case 'let': {
            const [e, n1] = one(t[2], n)
            const [b, n2] = one(t[3], n1)
            return [['let', bind(t[1]), e, b], n2]
        }
        case 'op': {
            const [xs, n1] = each(pass, names, t[2], n)
            // The typed form keeps the type that `trunc_sat` saturates to, and that `seal` makes, as the operator's own.
            return [t[1] === 'trunc_sat' || t[1] === 'seal' ? ['op', t[1], xs, /** @type {Int | Sealed} */ (type)] : ['op', t[1], xs], n1]
        }
        case 'call': {
            const [, module, name, xs] = t
            const [args, n1] = each(pass, names, xs, n)
            const f = module === 'self' ? pass.inlined(name) : null
            return f === null ? [['call', module, name, args], n1] : copy(pass, f, xs, args, n1)
        }
        case 'call_ref': {
            const [c, n1] = one(t[1], n)
            const [args, n2] = each(pass, names, t[2], n1)
            return [['call_ref', c, args], n2]
        }
        case 'make': {
            const [xs, n1] = each(pass, names, t[1].map(([, x]) => x), n)
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
            const [bodies, n2] = each(pass, names, t[2].map(([, , body]) => body), n1)
            return [['match', e, t[2].map(([, binder, , written], j) => /** @type {const} */ ([written, binder === null ? null : bind(binder), bodies[Number(j)]]))], n2]
        }
        case 'block': {
            const [e, n1] = write(pass, within(names, t[1], false), t[3], n)
            return [['block', bind(t[1]), t[2], e], n1]
        }
        case 'loop': {
            const [firsts, n1] = each(pass, names, t[2].map(([, , first]) => first), n)
            const [body, n2] = write(pass, within(names, t[1], true), t[3], n1)
            return [['loop', bind(t[1]), t[2].map(([k, x], j) => /** @type {const} */ ([bind(k), x, firsts[Number(j)]])), body], n2]
        }
        case 'br': {
            const [e, n1] = one(t[2], n)
            // A repeat names the loop's parameters, which are locals of the body.
            const next = e[0] === 'make' && names.loops.includes(t[1]) ? ['make', e[1].map(([k, x]) => /** @type {const} */ ([bind(k), x]))] : e
            return [['br', bind(t[1]), /** @type {Term} */ (next)], n1]
        }
        default: { return [t, n] }
    }
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
    /** The hint of a function of the module. @type {(name: string) => Fn['inline']} */
    const hintOf = name => assertNotNullish(m.functions.find(([k]) => k === name))[1].inline
    /** @type {_Pass['inlined']} */
    const inlined = name => hintOf(name) === 'always' ? assertNotNullish(functions.find(([k]) => k === name))[1] : null
    /** @type {readonly (readonly [string, Fn])[]} */
    const written = m.functions.flatMap(([k, f], j) => {
        const { params, body } = functions[Number(j)][1]
        return f.inline === 'always' && !m.exports.includes(k) ? []
            : [[k, { ...f, body: top(inlined, [...params.map(([x]) => x), ...bound(body)], body) }]]
    })
    /** @type {readonly (readonly [string, ConstantOf<Term>])[]} */
    const values = constants.map(([k, { type, value }]) => [k, { type, value: top(inlined, bound(value), value) }])
    return ok({ ...m, constants: values, functions: written })
}
