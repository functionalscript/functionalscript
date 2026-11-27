/**
 * The terms that build an array or an object of parts, one or more of them
 * spread, as a program builds one: Containers' builder begun with the count
 * of all items, each part pushed in its order, an item that stands alone by
 * one push and a spread array or object item by item or in one call, then
 * the builder sealed. [The lowering](../module.f.js) settles the parts and
 * boxes them first; these only arrange the calls.
 *
 * @module
 *
 * @import { Term } from '../../types.ts'
 */

import { array, builder, object, string } from '../../l0/module.f.js'
import { add, call, cast, exact, f64, f64c, float, get, if_, let_, lit, loop, lt, next, u } from '../../module.f.js'

/**
 * A part of an array or an object: whether it is spread, and its term, a
 * value of `any` for one that stands alone and the array or object of the
 * spread for one that is.
 *
 * @typedef {readonly [many: boolean, x: Term]} Part
 */

/** The length of a spread array or object, as a float. @type {(x: Term) => Term} */
const spreadLength = x => float(call('Containers', 'length', [x]))

/**
 * A spread array or object pushed item by item, to the builder `b`: a
 * loop, labelled `at`, which pushes each of its items by `each`.
 *
 * @type {(each: (b: Term, x: Term, k: Term) => Term) => (b: Term, x: Term, at: string) => Term}
 */
const itemByItem = each => (b, x, at) => {
    const [lb, li, pushed] = ['b', 'i', 'pushed'].map(k => `${at}.${k}`)
    return loop(
        at,
        [[lb, builder, b], [li, f64, lit(f64c, 0)]],
        if_(
            lt(get(li), spreadLength(x)),
            exact(u(31), get(li), `${at}.k`, k => let_(pushed, each(get(lb), x, k), next(at, [[lb, get(pushed)], [li, add(get(li), lit(f64c, 1))]]))),
            get(lb),
        ),
    )
}

/**
 * An array or an object built of parts: `begin` of the count of their
 * items, the items that stand alone and the length of each spread array or
 * object, which must be an index, then each part in its order, an item by
 * `one` and a spread by `many`, given the label `label.j` for the part's
 * place, then `seal` of the builder.
 *
 * @type {(label: string, parts: readonly Part[], begin: (k: Term) => Term, one: (b: Term, x: Term, j: number) => Term, many: (b: Term, x: Term, at: string) => Term, seal: (b: Term) => Term) => Term}
 */
const builtOf = (label, parts, begin, one, many, seal) => {
    const total = parts.reduce((t, [spread, x]) => spread ? add(t, spreadLength(x)) : t, lit(f64c, parts.filter(([spread]) => !spread).length))
    /** @type {(j: number, b: Term) => Term} */
    const from = (j, b) => {
        if (j === parts.length) { return seal(b) }
        const [spread, x] = parts[Number(j)]
        const name = `${label}.b${j}`
        return let_(name, spread ? many(b, x, `${label}.${j}`) : one(b, x, j), from(j + 1, get(name)))
    }
    return exact(u(31), total, `${label}.n`, k => from(0, begin(k)))
}

/**
 * An array of parts, labelled `label`: an item by `push` and a spread
 * array by one `push_all`.
 *
 * @type {(label: string, parts: readonly Part[]) => Term}
 */
export const arrayBuilt = (label, parts) => builtOf(
    label,
    parts,
    k => call('Containers', 'begin_array', [k]),
    (b, x) => call('Containers', 'push', [b, x]),
    (b, x) => call('Containers', 'push_all', [b, x]),
    // `seal` answers array|object; `begin_array` makes an array alone, so narrow.
    b => cast(array, call('Containers', 'seal', [b]), 'array', a => a),
)

/** Each key and value of a spread object, pushed one by one. */
const pushEntries = itemByItem((b, x, k) => call('Containers', 'push_property', [b, call('Containers', 'key', [x, k]), call('Containers', 'item', [x, k])]))

/**
 * An object of parts, labelled `label`: a value that stands alone pushed
 * as the property that `names` names at its place, and each key and value
 * of a spread object pushed one by one. A repeated key keeps its first
 * place and its last value, as `seal` does.
 *
 * @type {(label: string, parts: readonly Part[], names: readonly string[]) => Term}
 */
export const objectBuilt = (label, parts, names) => builtOf(
    label,
    parts,
    k => call('Containers', 'begin_object', [k]),
    (b, x, j) => call('Containers', 'push_property', [b, lit(string, names[Number(j)]), x]),
    pushEntries,
    // `seal` answers array|object; `begin_object` makes an object alone, so narrow.
    b => cast(object, call('Containers', 'seal', [b]), 'object', o => o),
)
