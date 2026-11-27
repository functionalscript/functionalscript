/**
 * Collatz for the IR / direct-to-WASM demo route: the same search as
 * [`sample.f.js`](./sample.f.js) (longest chain below 30,000), as a pure
 * program `from_fast` can lower — no `write` effect. State is records in a
 * linear `while` so the lowering admits the loop; the sample stays on
 * numbers alone so its JavaScript and Rust→WASM routes stay allocation-free.
 * The page's IR column runs the exported entry and shows the string it
 * answers.
 *
 * @module
 */

/** The search covers the starts from `1` up to, not including, this. */
const limit = 30_000

/** A start's place in a key: above every start below {@link limit}. */
const scale = 1_048_576

/**
 * How many steps `start` takes to reach `1`. State is a record so the
 * lowering admits the loop.
 *
 * @type {(start: any) => any}
 */
const steps = start => {
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
 * The start below {@link limit} with the longest Collatz chain, as the
 * report string the sample writes today.
 *
 * @type {() => any}
 */
export const run = () => {
    let s = { start: 1, best: 0 }
    while (s.start < limit) {
        const key = steps(s.start) * scale + s.start
        s = { start: s.start + 1, best: key > s.best ? key : s.best }
    }
    const best = s.best
    return `the longest Collatz chain below ${limit} starts at ${best % scale} and takes ${(best - best % scale) / scale} steps\n`
}
