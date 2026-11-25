/**
 * Finds the start below 30,000 with the longest Collatz chain, then writes
 * a line to standard output saying which it is.
 *
 * A computation on numbers alone, beside the sorting sample, which builds a
 * new array at every step: here nothing is allocated while it searches. A
 * chain's length and its start travel as one number, {@link key}, rather
 * than as a pair. The search uses the same linear `while` shape as
 * [`ir.f.js`](./ir.f.js), so the page's three routes time the same workload
 * (the IR route answers the report string directly; this sample still
 * encodes it for `write`).
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
 * How many steps `start` takes to reach `1`. State is a record so the IR
 * lowering and this sample stay the same shape.
 *
 * @type {(start: number) => number}
 */
const steps = start => {
    /** @type {{ readonly x: number, readonly count: number }} */
    let s = { x: start, count: 0 }
    while (s.x !== 1) {
        s = {
            x: s.x % 2 === 0 ? s.x / 2 : 3 * s.x + 1,
            count: s.count + 1,
        }
    }
    return s.count
}

/**
 * A start and its chain's length as one number, ordered by the length and
 * then by the start.
 *
 * @type {(start: number) => number}
 */
const key = start => steps(start) * scale + start

/**
 * The largest {@link key} of the starts below {@link limit}.
 *
 * @type {() => number}
 */
const longest = () => {
    /** @type {{ readonly start: number, readonly best: number }} */
    let s = { start: 1, best: 0 }
    while (s.start < limit) {
        const k = key(s.start)
        s = { start: s.start + 1, best: k > s.best ? k : s.best }
    }
    return s.best
}

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
    payload: ['stdout', bytes(report(longest()))],
    continuation: () => () => ['ok', undefined],
})
