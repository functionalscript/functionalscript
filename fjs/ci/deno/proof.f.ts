import { coverageInclude, denoSteps } from './module.f.ts'
import { toSteps } from '../common/module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

const coverageRuns = (version: string): readonly string[] =>
    toSteps(denoSteps(version))
        .flatMap(s => s.run !== undefined && s.run.includes('deno coverage') ? [s.run] : [])

export const proof = {
    // A regression guard: dropping either authored implementation extension
    // from the Deno coverage filter silently removes those modules from the
    // CI coverage report while CI still passes.
    coverageInclude: () => {
        assertEq(coverageInclude, '.*module\\.f\\.(ts|mjs)')
    },
    coverageStep: () => {
        const runs = coverageRuns('0.0.0')
        assertEq(runs.length, 1)
        const [run] = runs
        assert(run !== undefined)
        assert(run.includes(`deno coverage --include='${coverageInclude}'`))
    },
    installsPinnedVersion: () => {
        const runs = toSteps(denoSteps('1.2.3'))
            .flatMap(s => s.run !== undefined && s.run.includes('npm:functionalscript@') ? [s.run] : [])
        assertEq(runs.length, 2)
        assert(runs.every(r => r.includes('npm:functionalscript@1.2.3')))
    },
}
