/**
 * @module
 *
 * @import { Accumulator, List } from '../types.ts'
 * @import { Nullable } from '../../nullable/types.ts'
 */

import { next, trampoline } from '../module.f.mjs'

/** @type {<T>(list: List<T>) => Iterable<T>} */
export const iterable = list => ({
    *[Symbol.iterator]() {
        let i = list
        while (true) {
            const r = next(i)
            if (r === null) { return }
            yield r.first
            i = r.tail
        }
    }
})

const { from } = Array

/** @type {<T>(list: List<T>) => readonly T[]} */
export const toArray = list => {
    const u = trampoline(list)
    return u instanceof Array ? u : from(iterable(u))
}

/**
 * Folds `input` with an {@link Accumulator}, short-circuiting to `null` the
 * moment `update` rejects an item; otherwise finalizes with `end`. This is the
 * list-level `try*` sibling of {@link fold} for accumulations that can fail
 * partway through (see the `try*`/`Nullable` convention in `doc/DESIGN.md` §6).
 *
 * @type {<I, T, R>({ init, update, end }: Accumulator<I, T, R>) => (input: List<I>) => Nullable<R>}
 */
export const tryFold = ({ init, update, end }) => input => {
    let state = init
    for (const i of iterable(input)) {
        const candidate = update(i, state)
        if (candidate === null) { return null }
        state = candidate
    }
    return end(state)
}
