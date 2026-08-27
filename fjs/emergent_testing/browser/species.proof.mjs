import { assertEq } from '../../asserts/module.f.mjs'
import { runBrowserProofs } from '../browser.mjs'

/**
 * A genuine promise whose `then` always throws: the result promise is built
 * through `constructor[Symbol.species]`, and this `constructor` has none to
 * give. `configurable` decides whether the runner can shadow the property for
 * the length of one subscription.
 *
 * @type {(configurable: boolean) => Promise<unknown>}
 */
const throwingSpeciesPromise = configurable => {
    const promised = Promise.resolve({
        child: () => { throw 'boom' },
    })
    const constructor = {}
    Object.defineProperty(constructor, Symbol.species, {
        get: () => { throw new Error('species') },
    })
    Object.defineProperty(promised, 'constructor', { value: constructor, configurable })
    return promised
}

/** @type {(promised: Promise<unknown>) => ReturnType<typeof runBrowserProofs>} */
const run = promised => runBrowserProofs([['proof', { nested: () => promised }]])

export const proof = {
    throwingSpecies: async () => {
        // The intrinsic Promise shadows the hostile `constructor` while the
        // handlers are attached, so the resolved sub-tree still runs.
        const report = await run(throwingSpeciesPromise(true))
        assertEq(report.totals.tests, 2)
        assertEq(report.totals.failed, 1)
        assertEq(report.results[1]?.path, '.nested().child')
    },
    pinnedThrowingSpecies: async () => {
        // Nothing to shadow, so the promise can never be subscribed to. The
        // test that produced it fails, rather than passing on a result the
        // runner never observed.
        const report = await run(throwingSpeciesPromise(false))
        assertEq(report.totals.tests, 1)
        assertEq(report.totals.failed, 1)
        assertEq(report.results[0]?.message, 'species')
    },
}
