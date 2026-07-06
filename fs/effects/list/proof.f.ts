import { assert } from '../../asserts/module.f.ts'
import { decode, match, pure, do_, type Effect } from '../module.f.ts'
import { error, ok, type Result } from '../../types/result/module.f.ts'
import { empty, foldStream, nonEmpty, type List } from './module.f.ts'

// Evaluates a fully pure effect (no operations) to its result.
const runPure = <T>(e: Effect<never, T>): T => {
    const d = decode(e)
    if (!d.done) { throw 'effect is not pure' }
    return d.result
}

// Asserts that two `Result` values match by tag and payload.
const assertResult = (actual: Result<string, unknown>, expected: Result<string, unknown>) => {
    const [at, av] = actual
    const [et, ev] = expected
    assert(at === et && av === ev, actual)
}

// Builds a stream from a sequence of `Result` items.
const stream = (...items: readonly Result<string, unknown>[]): List<never, Result<string, unknown>> =>
    items.reduceRight<List<never, Result<string, unknown>>>(
        (tail, item) => nonEmpty(item, tail),
        empty<never, Result<string, unknown>>())

// A pure `foldStream` step: appends the chunk to the accumulator.
const concatStep = (acc: string) => (chunk: string): Effect<never, Result<string, unknown>> =>
    pure(ok(acc + chunk))

// A pure `foldStream` step that fails on a `'!'` chunk.
const guardedStep = (acc: string) => (chunk: string): Effect<never, Result<string, unknown>> =>
    pure(chunk === '!' ? error('bad chunk') : ok(acc + chunk))

type AddOp = readonly['add', (a: string, b: string) => string]

// An effectful `foldStream` step: concatenation is delegated to an `add` operation.
const addStep = (acc: string) => (chunk: string): Effect<AddOp, Result<string, unknown>> =>
    do_<AddOp>('add')(acc, chunk).step(s => pure(ok(s)))

const addMatch = match<AddOp, string>({ add: (a, b) => a + b })

// Runs an effect over the `add` interpreter to its result.
const runAdd = <T>(e: Effect<AddOp, T>): T => {
    let r = addMatch(e)
    while (r[0] !== 'done') { r = addMatch(r[2](r[1])) }
    return r[1]
}

export const proof = {
    foldStream: {
        // End-of-stream finalizes as `ok` of the accumulator.
        empty: () =>
            assertResult(runPure(foldStream(concatStep)('init')(stream())), ok('init')),

        // Chunks are folded in stream order.
        folds: () =>
            assertResult(runPure(foldStream(concatStep)('')(stream(ok('a'), ok('b'), ok('c')))), ok('abc')),

        // An `error` item propagates unchanged, short-circuiting the rest.
        errorItem: () =>
            assertResult(
                runPure(foldStream(concatStep)('')(stream(ok('a'), error('boom'), ok('c')))),
                error('boom')),

        // An `error` step result short-circuits the fold.
        errorStep: () =>
            assertResult(
                runPure(foldStream(guardedStep)('')(stream(ok('a'), ok('!'), ok('c')))),
                error('bad chunk')),

        // An effectful step's operations are threaded through the fold.
        effectfulStep: () =>
            assertResult(runAdd(foldStream(addStep)('')(stream(ok('a'), ok('b')))), ok('ab')),
    },
}
