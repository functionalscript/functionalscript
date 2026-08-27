import { assertEq } from '../../asserts/module.f.mjs'
import { runBrowserProofs } from '../browser.mjs'

export const proof = {
    throwingSpecies: async () => {
        const promised = Promise.resolve({
            child: () => { throw 'boom' },
        })
        const constructor = {}
        Object.defineProperty(constructor, Symbol.species, {
            get: () => { throw new Error('species') },
        })
        Object.defineProperty(promised, 'constructor', { value: constructor })
        const report = await runBrowserProofs([['proof', {
            nested: () => promised,
        }]])
        assertEq(report.totals.tests, 2)
        assertEq(report.totals.failed, 1)
        assertEq(report.results[1]?.path, '.nested().child')
    },
}
