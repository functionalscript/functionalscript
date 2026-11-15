/**
 * Object literals for slice 8: a record of floats, and Containers objects
 * of values of `any`. The lowering builds the latter with `begin_object`,
 * `push_property` and `seal`; float records stay products. A spread waits
 * for a later cut; L1's `objectSpread` is the subject that builds what
 * `{ ...v }` copies.
 *
 * @module
 */

/** A record of two floats. @type {(x: number, y: number) => { readonly x: number, readonly y: number }} */
const point = (x, y) => ({ x, y })

/** The product of a record's fields. @type {(x: number, y: number) => number} */
export const area = (x, y) => {
    const p = point(x, y)
    return p.x * p.y
}

/** An empty Containers object. @type {() => { readonly [k in string]: unknown }} */
export const empty = () => ({})

/** A Containers object of two values of `any`. @type {(a: unknown, b: unknown) => { readonly a: unknown, readonly b: unknown }} */
export const pair = (a, b) => ({ a, b })

/** A nested Containers object. @type {(v: unknown) => unknown} */
export const nested = v => ({ inner: { v } })
