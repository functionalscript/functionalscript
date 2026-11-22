/**
 * The loops of `every` and `filter` of an array whose callback is an arrow
 * literal, which the lowering inlines into them (lever P6 of the perf
 * demos), as it inlines the callbacks of `buildArray`: no closure is made,
 * no array of arguments is built, and nothing is called per item. The
 * lowering makes the callback's term, `test`, a `bool`, of the locals that
 * {@link names} names: the item `x`, its index `i`, a float, and the array
 * itself, which `a` reads. Each item is read once, in order, as L1's
 * bodies read them.
 *
 * - **`every`** loops while `test` holds, and answers whether it held for
 *   every item: `true` for none.
 * - **`filter`** loops once over the items, pushing `Any.null` for an item
 *   that `test` keeps and `Any.undefined` for one that it drops onto a
 *   mask, an array as long as the array, and counting those it keeps; a
 *   copy value is neither copied nor dropped. Then a second loop pushes
 *   each kept item, read again, onto an array of that count.
 *
 * @module
 *
 * @import { Term, Type } from '../../types.ts'
 */

import { any, array, builder } from '../../l0/module.f.js'
import { add, call, cast, constant, exact, f64, f64c, false_, float, get, if_, let_, lit, loop, lt, match, next, true_, u } from '../../module.f.js'

/** The locals of the loops labelled `label`. @type {(label: string) => { readonly [k in 'n' | 'i' | 'k' | 'x' | 'b' | 'c' | 'keep' | 'pushed' | 'mask' | 'count' | 'kept' | 'j' | 'jk' | 'kb' | 'kp']: string }} */
export const names = label => ({
    n: `${label}.n`, i: `${label}.i`, k: `${label}.k`, x: `${label}.item`, b: `${label}.b`, c: `${label}.count`,
    keep: `${label}.keep`, pushed: `${label}.pushed`, mask: `${label}.mask`, count: `${label}.c`,
    kept: `${label}.kept`, j: `${label}.j`, jk: `${label}.jk`, kb: `${label}.kb`, kp: `${label}.kp`,
})

/** The locals that `test` may read, beside the array, for `every`, or with the builder and the count for `filter`. @type {(label: string, building: boolean) => readonly (readonly [string, Type])[]} */
export const locals = (label, building) => {
    const v = names(label)
    return [...(building ? [/** @type {const} */ ([v.b, builder]), /** @type {const} */ ([v.c, f64])] : []), [v.i, f64], [v.x, any]]
}

/** The length of `a`, bound, then `body` of it as a float. @type {(label: string, a: Term, body: (n: Term) => Term) => Term} */
const sized = (label, a, body) => {
    const { n } = names(label)
    return let_(n, call('Containers', 'length', [a]), body(get(n)))
}

/** One more. @type {(x: Term) => Term} */
const inc = x => add(x, lit(f64c, 1))

/**
 * `a.every(test)`: whether `test` of each item holds, as a `bool`.
 *
 * @type {(label: string, a: Term, test: Term) => Term}
 */
export const everyLoop = (label, a, test) => {
    const { i, k, x } = names(label)
    return sized(label, a, len => loop(label, [[i, f64, lit(f64c, 0)]], if_(
        lt(get(i), float(len)),
        exact(u(31), get(i), k, kk => let_(x, call('Containers', 'item', [a, kk]), if_(test, next(label, [[i, inc(get(i))]]), false_))),
        true_,
    )))
}

/**
 * `a.filter(keep)`: the items that `keep` holds for, in their order, as an
 * array of `any`.
 *
 * @type {(label: string, a: Term, keep: Term) => Term}
 */
export const filterLoops = (label, a, keep) => {
    const v = names(label)
    const kept = `${label}.kept`
    /** The next round of the first loop, after pushing `marker`, and the next count. @type {(marker: string, count: Term) => Term} */
    const round = (marker, count) => let_(v.pushed, call('Containers', 'push', [get(v.b), constant('Any', marker)]),
        next(label, [[v.b, get(v.pushed)], [v.i, inc(get(v.i))], [v.c, count]]))
    /** The second loop: each item that the mask keeps pushed onto an array of `count` items. @type {(len: Term, mask: Term) => Term} */
    const second = (len, mask) => exact(u(31), get(v.c), v.count, count => loop(kept, [[v.kb, builder, call('Containers', 'begin_array', [count])], [v.j, f64, lit(f64c, 0)]], if_(
        lt(get(v.j), float(len)),
        exact(u(31), get(v.j), v.jk, jk => match(call('Containers', 'item', [mask, jk]), [
            [['null'], null, let_(v.kp, call('Containers', 'push', [get(v.kb), call('Containers', 'item', [a, jk])]), next(kept, [[v.kb, get(v.kp)], [v.j, inc(get(v.j))]]))],
            [null, null, next(kept, [[v.kb, get(v.kb)], [v.j, inc(get(v.j))]])],
        ])),
        cast(array, call('Containers', 'seal', [get(v.kb)]), `${kept}.array`, r => r),
    )))
    return sized(label, a, len => loop(label, [[v.b, builder, call('Containers', 'begin_array', [len])], [v.i, f64, lit(f64c, 0)], [v.c, f64, lit(f64c, 0)]], if_(
        lt(get(v.i), float(len)),
        exact(u(31), get(v.i), v.k, k => let_(v.x, call('Containers', 'item', [a, k]), let_(v.keep, keep,
            if_(get(v.keep), round('null', inc(get(v.c))), round('undefined', get(v.c)))))),
        cast(array, call('Containers', 'seal', [get(v.b)]), v.mask, mask => second(len, mask)),
    )))
}
