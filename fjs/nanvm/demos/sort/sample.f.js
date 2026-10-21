/**
 * Sorts a long array of pseudo-random integers with a quicksort, then
 * writes a line to standard output saying what it sorted.
 *
 * The program is an effect: one `write` command, whose text is encoded to
 * UTF-8 bytes in a bit vector by {@link bytes} here, because `fjs compile`
 * cannot compile `log` and `utf8` yet.
 *
 * @module
 */

/** How many integers to sort. */
const count = 100_000

/**
 * The next state of the Park–Miller generator: every product stays below
 * 2^53, so it is exact in a `number`.
 *
 * @type {(seed: number) => number}
 */
const next = seed => seed * 48_271 % 2_147_483_647

/**
 * `n` pseudo-random integers from `seed`, and the state after them. Split
 * in halves rather than one call per element, so the depth is `log n`.
 *
 * @type {(n: number, seed: number) => readonly [readonly number[], number]}
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
 * then those above it, sorted. The pivot is the middle element, passed to
 * `around` rather than bound to a `const` past the guard, since a value read
 * only in one branch has no Rust spelling yet; and `around` is inside `sort`,
 * since a module `const` cannot name one declared after it.
 *
 * @type {(a: readonly number[]) => readonly number[]}
 */
const sort = a => {
    /** @type {(pivot: number) => readonly number[]} */
    const around = pivot => [
        ...sort(a.filter(x => x < pivot)),
        ...a.filter(x => x === pivot),
        ...sort(a.filter(x => x > pivot)),
    ]
    return a.length < 2 ? a : around(a[Number(a.length >> 1)])
}

/** Whether `a` is in ascending order. @type {(a: readonly number[]) => boolean} */
const ascending = a => a.every((x, i) => i === 0 || a[Number(i - 1)] <= x)

/**
 * ASCII text as the bit vector a `write` command carries: the bytes, most
 * significant bit first. An ASCII byte's first bit is `0`, so
 * `fjs/types/bit_vec` spells the vector negated, with that bit set to `1`
 * as the stop bit: the loop starts past it, with `1n`.
 *
 * @type {(text: string) => bigint}
 */
const bytes = text => {
    /** @type {readonly [number, bigint]} */
    let s = [1, 1n]
    while (s[0] < text.length * 8) {
        const i = s[0]
        s = [i + 1, s[1] * 2n + ((text.charCodeAt(i >> 3) >> (7 - i % 8)) & 1 ? 1n : 0n)]
    }
    return -s[1]
}

/** What the program writes, once it has sorted. @type {(a: readonly number[]) => string} */
const report = a => ascending(a)
    ? `sorted ${a.length} integers: smallest ${a[0]}, largest ${a.at(-1)}\n`
    : 'not sorted\n'

/**
 * The entry: everything happens in the call, none of it as the module loads,
 * so that the time the page shows holds the generating and the sorting.
 */
export default () => {
    const [input] = random(count, 1)
    return {
        command: 'write',
        payload: ['stdout', bytes(report(sort(input)))],
        continuation: () => () => ['ok', undefined],
    }
}
