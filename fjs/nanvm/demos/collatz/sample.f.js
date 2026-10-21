/**
 * Finds the start below 30,000 with the longest Collatz chain, then writes
 * a line to standard output saying which it is.
 *
 * A computation on numbers alone, beside the sorting sample, which builds a
 * new array at every step: here nothing is allocated while it searches. A
 * chain's length and its start travel as one number, {@link key}, rather
 * than as a pair.
 *
 * The program is an effect: one `write` command, whose text is encoded to
 * UTF-8 bytes in a bit vector by {@link bytes} here, because `fjs compile`
 * cannot compile `log` and `utf8` yet.
 *
 * @module
 */

/** The search covers the starts from `1` up to, not including, this. */
const limit = 30_000

/** A start's place in a {@link key}: above every start below {@link limit}. */
const scale = 1_048_576

/**
 * How many steps `x` takes to reach `1`, plus `count`: halve an even number,
 * and triple an odd one and add one. Starts below {@link limit} take a few
 * hundred steps at most, so the recursion stays shallow.
 *
 * @type {(x: number, count: number) => number}
 */
const steps = (x, count) => x === 1 ? count : steps(x % 2 === 0 ? x / 2 : 3 * x + 1, count + 1)

/**
 * A start and its chain's length as one number, ordered by the length and
 * then by the start.
 *
 * @type {(start: number) => number}
 */
const key = start => steps(start, 0) * scale + start

/** @type {(a: number, b: number) => number} */
const larger = (a, b) => a > b ? a : b

/**
 * The largest {@link key} of the `n` starts from `lo`, found in halves, so
 * the depth is `log n`.
 *
 * @type {(lo: number, n: number) => number}
 */
const longest = (lo, n) => n === 1 ? key(lo) : larger(longest(lo, n >> 1), longest(lo + (n >> 1), n - (n >> 1)))

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

/** What the program writes, from the largest key. @type {(best: number) => string} */
const report = best =>
    `the longest Collatz chain below ${limit} starts at ${best % scale} and takes ${(best - best % scale) / scale} steps\n`

/**
 * The entry: everything happens in the call, none of it as the module loads,
 * so that the time the page shows holds the search.
 */
export default () => ({
    command: 'write',
    payload: ['stdout', bytes(report(longest(1, limit - 1)))],
    continuation: () => () => ['ok', undefined],
})
