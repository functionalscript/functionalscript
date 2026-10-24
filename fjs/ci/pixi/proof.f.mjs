/** @import { Dir } from '../../effects/node/virtual/types.ts' */
import { assert, assertEq } from '../../asserts/module.f.js'
import { ci } from '../module.f.mjs'
import { parseGitHubAction } from '../common/module.f.mjs'
import { virtualAt } from '../../effects/node/virtual/module.f.mjs'
import { utf8ToString } from '../../text/utf8/module.f.mjs'
import { empty } from '../../types/bit_vec/module.f.mjs'
import { parse } from '../../media/json/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { exitCode } from '../../effects/node/module.f.mjs'
import { pixiDevelop, pixiJobs } from './module.f.mjs'

/** @type {(hasRust: boolean, pixi: boolean, smart?: boolean) => import('../common/types.ts').Jobs} */
const jobs = (hasRust, pixi, smart = false) => {
    /** @type {Dir} */
    const root = hasRust ? { 'Cargo.toml': [empty] } : {}
    const [state, code] = virtualAt(root)(ci({ nodeExtra: () => [], smart, ...(pixi ? { environment: 'pixi' } : {}) }))
    assertEq(exitCode(code), 0)
    const github = state.root['.github']
    assert(typeof github === 'object' && !(github instanceof Array))
    const workflows = github['workflows']
    assert(typeof workflows === 'object' && !(workflows instanceof Array))
    const file = workflows['gen.ci.yml']
    assert(file instanceof Array && file.length !== 0)
    return unwrap(parseGitHubAction(unwrap(parse(utf8ToString(file[0]))))).jobs
}

export const proof = {
    lockedNativeProfile: () => {
        assertEq(pixiDevelop('node --version'), 'pixi run --locked --environment ci node --version')
        assertEq(Object.keys(pixiJobs({ absent: undefined }, false)).length, 0)
    },
    genericSmartKeepsItsSelfContainedEnvironment: () => {
        const generic = jobs(false, false, true)
        assert(generic.node26?.steps.some(s => s.uses?.startsWith('cachix/install-nix-action@') === true) === true)
        assert(!generic.node26?.steps.some(s => s.uses?.startsWith('prefix-dev/setup-pixi@') === true))
    },
    everyJobUsesPixiAndNoNix: () => {
        for (const hasRust of [true, false]) {
            const migrated = jobs(hasRust, true)
            assertEq(Object.keys(migrated).length, 9)
            for (const [id, job] of Object.entries(migrated)) {
                assert(job !== undefined)
                assert(job.steps.some(s => s.uses?.startsWith('prefix-dev/setup-pixi@') === true), id)
                assert(!job.steps.some(s => s.uses?.includes('install-nix') === true || s.run?.includes('gen.nix/run') === true), id)
                const checkout = job.steps.findIndex(s => s.uses?.startsWith('actions/checkout@') === true)
                const setup = job.steps.findIndex(s => s.uses?.startsWith('prefix-dev/setup-pixi@') === true)
                assert(checkout >= 0 && setup > checkout, id)
                assert(job.steps.some(s => s.run?.startsWith(pixiDevelop('')) === true), id)
            }
        }
    },
    preserveAllChecks: () => {
        const original = jobs(true, false)
        const migrated = jobs(true, true)
        for (const [id, job] of Object.entries(original)) {
            assert(job !== undefined)
            const runs = migrated[id]?.steps.flatMap(s => s.run === undefined ? [] : [s.env?.FJS_CI_RUN ?? s.run]) ?? []
            for (const step of job.steps) {
                if (step.run !== undefined) {
                    const command = step.run.split('sh ./gen.nix/run ').join(pixiDevelop(''))
                        .replace('Version 7.0.2', 'Version 6.0.2')
                        .replace('= "1.4.4"', '= "1.4.2"')
                        .replace('wasmer 7.1.0', 'wasmer 7.5.0')
                        .replace(pixiDevelop('wasmtime --version'), `${pixiDevelop('wasmtime --version')} | cut -d ' ' -f 1-2`)
                    assert(runs.includes(command) || runs.includes(pixiDevelop(command))
                        || (step.run === 'test "$(node --version)" = "v26.12.1"'
                            && runs.includes(`test "$(${pixiDevelop('node --version')})" = "v26.12.1"`)), step.run)
                }
            }
        }
    },
    crossTargetsAndSupplements: () => {
        const migrated = jobs(true, true)
        for (const id of ['ubuntu-intel', 'ubuntu-arm', 'macos-intel', 'macos-arm', 'windows-intel', 'windows-arm']) {
            assert(migrated[id]?.steps.some(s => s.uses?.startsWith('dtolnay/rust-toolchain@1.99.1') === true) === true, id)
        }
        assert(migrated['ubuntu-intel']?.steps.some(s => s.run?.includes('gcc-multilib') === true) === true)
        assert(migrated['ubuntu-intel']?.steps.some(s => s.with?.targets === 'i686-unknown-linux-gnu') === true)
        assert(migrated['windows-intel']?.steps.some(s => s.with?.targets === 'i686-pc-windows-msvc') === true)
        assert(migrated['ubuntu-arm']?.steps.some(s => s.with?.targets?.includes('wasm32-wasip1-threads') === true) === true)
        assert(migrated['ubuntu-arm']?.steps.some(s => s.run?.includes('install-supplements.sh wasmtime 45.0.2') === true) === true)
        assert(migrated['ubuntu-arm']?.steps.some(s => s.run?.includes('install-supplements.sh spidermonkey 140.14.0') === true) === true)
        assert(migrated['windows-arm']?.steps.some(s => s.env?.FJS_CI_RUN === 'npm install -g functionalscript@0.56.0') === true)
        assert(migrated['windows-arm']?.steps.some(s => s.env?.FJS_CI_RUN === 'fjs test') === true)
    },
    arbitraryInjectedScripts: () => {
        const scripts = ['FLAG=value node task.mjs', 'cd subdir && node task.mjs', 'printf hi | cat']
        for (const script of scripts) {
            const migrated = pixiJobs({
                'windows-arm': { 'runs-on': 'windows-11-arm', 'timeout-minutes': 30, steps: [
                    { run: script, env: { EXISTING: 'yes' } },
                ] },
            }, false)
            const injected = migrated['windows-arm']?.steps.find(s => s.env?.FJS_CI_RUN === script)
            assertEq(injected?.run, pixiDevelop('bash -e -c "$FJS_CI_RUN"'))
            assertEq(injected?.env?.EXISTING, 'yes')
            assertEq(injected?.shell, 'bash')
        }
    },
    consumerRemainsIsolated: () => {
        const steps = jobs(true, true).node26?.steps ?? []
        const setup = steps.findIndex(s => s.uses?.startsWith('actions/setup-node@') === true)
        assert(setup > 0)
        assert(steps.slice(setup + 1).every(s => s.run?.startsWith(pixiDevelop('')) !== true))
        assert(steps.slice(setup + 1).some(s => s['working-directory'] !== undefined))
    },
}
