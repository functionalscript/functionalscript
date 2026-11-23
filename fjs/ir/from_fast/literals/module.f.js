/**
 * Boxed number literals made once, lever P2 of the perf demos: the lowering boxes a number literal as `any` with `Any.from_f64` where
 * it stands, so a loop that compares with `1` or passes `1` to L1 boxes
 * and drops it each round. This pass makes each such value a constant of
 * the module, `#n0` first, in the order that the functions box them, typed
 * `any.only(number)` as `Any.from_f64` answers so that it meets a narrowed
 * result or parameter as the literal did, which
 * `init` boxes once, and reads that constant where the value was boxed.
 * A constant is borrowed, so a read that only reads the value copies
 * nothing, and the lifetime pass copies it where the context takes it over.
 * The constants of the module box their own literals once already, so the
 * pass leaves them as they are. Two literals are one constant where they
 * are the same value, as `Object.is` says, so `0` and `-0` are two.
 *
 * @module
 *
 * @import { Module, Term } from '../../types.ts'
 */

import { any } from '../../l0/module.f.js'
import { call, constant, f64c, lit, only } from '../../module.f.js'
import { isFloat } from '../numbers/module.f.js'

/** The number that a term boxes, `Any.from_f64` of a float literal, or `null`. @type {(t: Term) => number | null} */
export const boxed = t => {
    if (t[0] !== 'call' || t[1] !== 'Any' || t[2] !== 'from_f64' || t[3].length !== 1) { return null }
    const [x] = t[3]
    return x[0] === 'lit' && isFloat(x[1]) && typeof x[2] === 'number' ? x[2] : null
}

/** The name of the constant of the `k`th number, of names that start with `prefix`. @type {(prefix: string) => (k: number) => string} */
export const namedBy = prefix => k => `${prefix}${k}`

/** The name of the constant of the `k`th number, where the module has no constant of its own that starts with `#n`. */
export const nameOf = namedBy('#n')

/**
 * The first of `#n`, `#nn`, `#nnn` and so on that no name of `names`
 * starts with, so that no constant that the pass makes is named as one of
 * the module's own.
 *
 * @type {(names: readonly string[]) => string}
 */
export const prefixOf = names => {
    /** @type {(p: string) => string} */
    const free = p => names.some(x => x.startsWith(p)) ? free(`${p}n`) : p
    return free('#n')
}

/**
 * A term with each boxed literal read from the constant of its number, and
 * the numbers so far, in their order, with those it boxes added, where the
 * constants are named by `name`.
 *
 * @type {(name: (k: number) => string) => (numbers: readonly number[], t: Term) => readonly [Term, readonly number[]]}
 */
export const replaceBy = name => {
    /** @type {(numbers: readonly number[], t: Term) => readonly [Term, readonly number[]]} */
    const replace = (numbers, t) => {
        const v = boxed(t)
        if (v !== null) {
            const k = numbers.findIndex(x => Object.is(x, v))
            return k === -1 ? [constant('self', name(numbers.length)), [...numbers, v]] : [constant('self', name(k)), numbers]
        }
        /** Each of a list of terms replaced, in their order. @type {(ns: readonly number[], ts: readonly Term[]) => readonly [readonly Term[], readonly number[]]} */
        const all = (ns, ts) => ts.reduce(
            /** @type {(acc: readonly [readonly Term[], readonly number[]], x: Term) => readonly [readonly Term[], readonly number[]]} */
            ([done, n], x) => {
                const [y, m] = replace(n, x)
                return [[...done, y], m]
            },
            [[], ns])
        switch (t[0]) {
            case 'let': {
                const [[value, body], ns] = all(numbers, [t[2], t[3]])
                return [['let', t[1], value, body], ns]
            }
            case 'op': {
                const [xs, ns] = all(numbers, t[2])
                // the range that `trunc_sat` saturates to stays
                return [t[3] === undefined ? ['op', t[1], xs] : ['op', t[1], xs, t[3]], ns]
            }
            case 'call': {
                const [xs, ns] = all(numbers, t[3])
                return [['call', t[1], t[2], xs], ns]
            }
            case 'call_ref': {
                const [[f, ...xs], ns] = all(numbers, [t[1], ...t[2]])
                return [['call_ref', f, xs], ns]
            }
            case 'make': {
                const [xs, ns] = all(numbers, t[1].map(([, x]) => x))
                return [['make', t[1].map(([k], i) => /** @type {const} */ ([k, xs[Number(i)]]))], ns]
            }
            case 'field': {
                const [x, ns] = replace(numbers, t[1])
                return [['field', x, t[2]], ns]
            }
            case 'variant': {
                const [x, ns] = replace(numbers, t[3])
                return [['variant', t[1], t[2], x], ns]
            }
            case 'block': {
                const [x, ns] = replace(numbers, t[3])
                return [['block', t[1], t[2], x], ns]
            }
            case 'match': {
                const [[x, ...bodies], ns] = all(numbers, [t[1], ...t[2].map(([, , b]) => b)])
                return [['match', x, t[2].map(([ks, binder], i) => /** @type {const} */ ([ks, binder, bodies[Number(i)]]))], ns]
            }
            case 'loop': {
                const [xs, ns] = all(numbers, [...t[2].map(([, , x]) => x), t[3]])
                const body = xs[Number(xs.length - 1)]
                return [['loop', t[1], t[2].map(([name, type], i) => /** @type {const} */ ([name, type, xs[Number(i)]])), body], ns]
            }
            case 'br': {
                const [x, ns] = replace(numbers, t[2])
                return [['br', t[1], x], ns]
            }
            default: { return [t, numbers] }
        }
    }
    return replace
}

/** {@link replaceBy} with the names of {@link nameOf}. */
export const replace = replaceBy(nameOf)

/**
 * The module with each number that its functions box made once, as a
 * constant before its own, which may read none of them. The constants are
 * named by {@link prefixOf} the module's own, so none is named as one of them.
 *
 * @type {(m: Module) => Module}
 */
export const literals = m => {
    /** @type {readonly number[]} */
    const start = []
    const name = namedBy(prefixOf((m.constants ?? []).map(([n]) => n)))
    const walk = replaceBy(name)
    const [functions, numbers] = m.functions.reduce(
        /** @type {(acc: readonly [Module['functions'], readonly number[]], f: Module['functions'][number]) => readonly [Module['functions'], readonly number[]]} */
        ([done, ns], [name, f]) => {
            const [body, next] = walk(ns, f.body)
            return [[...done, [name, { ...f, body }]], next]
        },
        [[], start])
    if (numbers.length === 0) { return m }
    /** @type {NonNullable<Module['constants']>} */
    const made = numbers.map((v, k) => [name(k), { type: only(any, 'number'), value: call('Any', 'from_f64', [lit(f64c, v)]) }])
    return { ...m, constants: [...made, ...(m.constants ?? [])], functions }
}
