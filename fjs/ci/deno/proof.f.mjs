import { denoSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** @type {(version: string) => readonly string[]} */
const coverageRuns = version =>
    toSteps(denoSteps(version))
        .flatMap(s => s.run !== undefined && s.run.includes('cov') ? [s.run] : [])

export const proof = {
    // A regression guard: the job must delegate coverage to `deno.json`'s `cov`
    // task. Inlining the command here instead would give the coverage filter a
    // second owner that can silently drift from `deno.json`.
    coverageStep: () => {
        const runs = coverageRuns('0.0.0')
        assertEq(runs.length, 1)
        const [run] = runs
        assertEq(run, 'deno task cov')
    },
    installsPinnedVersion: () => {
        const runs = toSteps(denoSteps('1.2.3'))
            .flatMap(s => s.run !== undefined && s.run.includes('npm:functionalscript@') ? [s.run] : [])
        assertEq(runs.length, 2)
        assert(runs.every(r => r.includes('npm:functionalscript@1.2.3')))
    },
}
