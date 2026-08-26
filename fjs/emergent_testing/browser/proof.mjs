import { assertEq } from '../../asserts/module.f.mjs'
import { runBrowserProofs } from '../browser.mjs'

/** @type {(proof: unknown) => ReturnType<typeof runBrowserProofs>} */
const run = proof => runBrowserProofs([['proof', proof]])

export const proof = {
    namedThrow: async () => {
        const named = { throw: () => { throw 'expected' } }.throw
        const report = await run({ extracted: named })
        assertEq(report.status, 'passed')
    },
    path: async () => {
        const report = await run({ 'a.b': () => undefined })
        assertEq(report.results[0]?.path, '["a.b"]')
    },
    arbitraryThrow: async () => {
        const report = await run({ fail: () => { throw Object.create(null) } })
        assertEq(report.status, 'failed')
        assertEq(report.results[0]?.message, 'Unknown thrown value')
    },
}
