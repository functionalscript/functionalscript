import { assertEq } from '../../asserts/module.f.mjs'
import { runBrowserProofs } from '../browser.mjs'

class ThrowingSpeciesPromise extends Promise {
    static get [Symbol.species]() { throw new Error('species') }
}

export const proof = {
    throwingSpecies: async () => {
        const promised = ThrowingSpeciesPromise.resolve({
            child: () => { throw 'boom' },
        })
        const report = await runBrowserProofs([['proof', {
            nested: () => promised,
        }]])
        assertEq(report.totals.tests, 2)
        assertEq(report.totals.failed, 1)
        assertEq(report.results[1]?.path, '.nested().child')
    },
}
