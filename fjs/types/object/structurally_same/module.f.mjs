/**
 * Structural comparison for FunctionalScript data.
 *
 * `structurallySame` answers "do these two independently constructed values
 * have the same shape and the same leaves?" — the question proofs really ask
 * when they compare a computed value against an expected one. It is scoped to
 * FunctionalScript data (primitives, arrays, and record-like objects) and
 * deliberately says nothing about dates, maps, sets, typed arrays, prototypes,
 * or property descriptors; see the README for what it does *not* promise.
 *
 * This module is a dependency-free leaf on purpose. `fjs/asserts` needs the
 * comparison for `assertStructurallySame`, and the public object module
 * (`../module.f.mjs`) reaches `fjs/asserts` through `types/nullable`, so
 * importing anything here would close the cycle
 * `asserts -> object -> nullable -> asserts`. Keep it importing nothing.
 *
 * @module
 */

const { entries, is } = Object

/**
 * Compares two values structurally.
 *
 * - `Object.is` decides first, so `NaN` equals itself, `0` and `-0` differ, and
 *   an object is trivially the same as itself.
 * - Anything else that is not a non-null object differs.
 * - Arrays match arrays of the same length whose elements match pairwise; an
 *   array never matches a non-array. Arrays are assumed dense — FunctionalScript
 *   cannot build a sparse one; see the README.
 * - Other objects match when their own enumerable string properties form the
 *   same set — order is irrelevant — and every property's value matches. A
 *   property whose value is `undefined` is a property: `{ a: undefined }` and
 *   `{}` differ.
 *
 * There is no cycle detection: a self-referential value recurses until the
 * stack runs out. FunctionalScript data is acyclic, and adding a seen-set would
 * cost every ordinary comparison for a case that cannot arise.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const structurallySame = (a, b) => {
    if (is(a, b)) { return true }
    if (
        typeof a !== 'object' || a === null ||
        typeof b !== 'object' || b === null
    ) { return false }
    if (a instanceof Array) {
        return b instanceof Array
            && a.length === b.length
            && a.every((v, i) => structurallySame(v, b[i]))
    }
    if (b instanceof Array) { return false }
    const ae = entries(a)
    /** @type {ReadonlyMap<string, unknown>} */
    const bm = new Map(entries(b))
    return ae.length === bm.size
        && ae.every(([k, v]) => bm.has(k) && structurallySame(v, bm.get(k)))
}
