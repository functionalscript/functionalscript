/**
 * Sorting for the IR / direct-to-WASM demo route: the same quicksort of
 * 100,000 integers as [`sample.f.js`](./sample.f.js), as a pure program
 * `from_fast` can lower in program mode — recursion, inlined `filter` /
 * `every`, spreads — with no `write` effect. The page's IR column runs the
 * exported entry and shows the string it answers. Containers stay on
 * NaNVM L0 imports.
 *
 * @module
 */

/** How many integers to sort. */
const count = 100_000

/**
 * The next state of the Park–Miller generator: every product stays below
 * 2^53, so it is exact in a `number`.
 *
 * @type {(seed: any) => any}
 */
const next = seed => seed * 48_271 % 2_147_483_647

/**
 * `n` pseudo-random integers from `seed`, and the state after them. Split
 * in halves rather than one call per element, so the depth is `log n`.
 *
 * @type {(n: any, seed: any) => any}
 */
const random = (n, seed) => {
    if (n === 1) { return [[seed], next(seed)] }
    const half = n >> 1
    const [left, middle] = random(half, seed)
    const [right, end] = random(n - half, middle)
    return [[...left, ...right], end]
}

/**
 * Quicksort: the elements below the pivot, sorted, then those equal to it,
 * then those above it, sorted.
 *
 * @type {(a: any) => any}
 */
const sort = a => {
    /** @type {(pivot: any) => any} */
    const around = pivot => [
        ...sort(a.filter(/** @type {(x: any) => any} */ (x => x < pivot))),
        ...a.filter(/** @type {(x: any) => any} */ (x => x === pivot)),
        ...sort(a.filter(/** @type {(x: any) => any} */ (x => x > pivot))),
    ]
    return a.length < 2 ? a : around(a[Number(a.length >> 1)])
}

/** Whether `a` is in ascending order. @type {(a: any) => any} */
const ascending = a => a.every(/** @type {(x: any, i: any) => any} */ ((x, i) => i === 0 || a[Number(i - 1)] <= x))

/** What the program answers once it has sorted. @type {(a: any) => any} */
const report = a => ascending(a)
    ? `sorted ${a.length} integers: smallest ${a[0]}, largest ${a.at(-1)}\n`
    : 'not sorted\n'

/**
 * The entry: generating and sorting happen in the call, as on the sample
 * page, so the timed interval holds that work alone.
 *
 * @type {() => any}
 */
export const run = () => {
    const [input] = random(count, 1)
    return report(sort(input))
}
