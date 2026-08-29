/**
 * @import { MetaStep, Os, GitHubAction } from './common/types.ts'
 * @import { Dir, State } from '../effects/node/virtual/types.ts'
 * @import { Unknown } from '../djs/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { ci, main, nixJobs } from './module.f.mjs'
import { actions, deno, functionalscript, node } from './config/module.f.mjs'
import { major, nodeNixJobs, packageArtifact, packageJobId } from './node/module.f.mjs'
import { flakeText, nixDevelop } from './nix/module.f.mjs'
import { packageCheckJobId } from './package/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { empty as emptyVec } from '../types/bit_vec/module.f.mjs'
import { test, ubuntu, parseGitHubAction } from './common/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
import { definedValues } from '../types/object/module.f.mjs'
import { parse as jsonParse } from '../media/json/module.f.mjs'

/** @type {(cmd: string) => (gha: GitHubAction) => boolean} */
const hasRun = cmd => gha =>
    definedValues(gha.jobs).some(job => job.steps.some(step => step.run?.includes(cmd)))

/** @type {(jobId: string, cmd: string) => (gha: GitHubAction) => boolean} */
const hasRunInJob = (jobId, cmd) => gha =>
    gha.jobs[jobId]?.steps.some(step => step.run?.includes(cmd)) ?? false

/** @type {(jobId: string, cmd: string) => (gha: GitHubAction) => boolean} */
const hasExactRunInJob = (jobId, cmd) => gha =>
    gha.jobs[jobId]?.steps.some(step => step.run === cmd) ?? false

const makeState = (/** @type {boolean} */ rust, /** @type {string | undefined} */ packageJson) => ({
    ...emptyState,
    root: {
        '.github': { workflows: {} },
        ...(packageJson !== undefined ? { 'package.json': [utf8(packageJson)] } : {}),
        ...(rust ? { 'Cargo.toml': [emptyVec] } : {}),
    },
})

/** @type {(dir: Dir, name: string) => Dir} */
const subDir = (dir, name) => {
    const entity = dir[name]
    // `Array.isArray` narrows to `any[]`, which `readonly Vec[]` is not assignable
    // to, so its negative branch never removes a `readonly` array from a union.
    // `instanceof Array` does, so this `assert` narrows `entity` to `Dir`.
    assert(typeof entity === 'object' && !(entity instanceof Array), entity)
    return entity
}

/** @type {(dir: Dir, name: string) => string} */
const text = (dir, name) => {
    const file = dir[name]
    assert(!(!Array.isArray(file) || file.length === 0), file)
    return utf8ToString(file[0])
}

/** @type {(dir: Dir, names: readonly string[]) => Dir} */
const path = (dir, names) => names.reduce(subDir, dir)

/** @type {(state: State) => GitHubAction} */
const workflow = state => {
    const workflows = path(state.root, ['.github', 'workflows'])
    return unwrap(parseGitHubAction(unwrap(jsonParse(text(workflows, 'ci.yml')))))
}

/** @type {(state: State, id: string) => string} */
const flake = (state, id) =>
    text(path(state.root, ['nix', id]), 'flake.nix')

// The packed-package check is generated only when the project pins a compiler,
// so the shared fixture supplies one. A pin no configuration holds, so an
// assertion that finds it found the value that came from here.
const runPin = /** @type {const} */ ('=9.9.9')

const runPackageJson = `{"name":"other-package","devDependencies":{"typescript":"${runPin}"}}`

/**
 * The version the configuration records for a Node job, by job id — the one its
 * generated flake's package attribute has to agree with.
 *
 * @type {(id: string) => string}
 */
const configuredVersion = id =>
    id === `node${major(node.node22)}` ? node.node22
    : id === `node${major(node.node24)}` ? node.node24
    : node.default

/** @type {(rust: boolean, nodeExtra?: (o: Os) => readonly MetaStep[]) => GitHubAction} */
const run = (rust, nodeExtra = () => []) => {
    const [state, result] = virtual(makeState(rust, runPackageJson))(ci({ nodeExtra }))
    assertEq(exitCode(result), 0)
    return workflow(state)
}

/** @type {(packageJson?: string) => GitHubAction} */
const runDefault = packageJson => {
    const [state, result] = virtual(makeState(false, packageJson))(main())
    assertEq(exitCode(result), 0)
    return workflow(state)
}

export const proof = {
    matrixShape: () => {
        const gha = run(true)
        assertEq(Object.keys(gha.jobs).length, 13, 'expected 13 CI jobs')
        assertEq(gha.permissions.contents, 'read', 'expected read-only contents permission')
        assertEq(Object.keys(gha.permissions).length, 1, 'expected least-privilege workflow permissions')
        assert(hasRunInJob('ubuntu-intel', 'cargo test --target i686-unknown-linux-gnu')(gha), 'expected Ubuntu Intel i686 check')
        assert(hasRunInJob('ubuntu-intel', 'cargo test --target i686-unknown-linux-gnu --release')(gha), 'expected Ubuntu Intel i686 release check')
        assert(hasRunInJob('ubuntu-intel', 'cargo clippy --target i686-unknown-linux-gnu -- -D warnings')(gha), 'expected Ubuntu Intel i686 lint')
        assert(hasRunInJob('ubuntu-intel', 'cargo clippy --target i686-unknown-linux-gnu --release -- -D warnings')(gha), 'expected Ubuntu Intel i686 release lint')
        assert(hasRunInJob('ubuntu-arm', 'cargo test --release')(gha), 'expected native platform Rust release check')
        assert(hasRunInJob('ubuntu-arm', 'cargo clippy -- -D warnings')(gha), 'expected native platform Rust lint')
        assert(hasRunInJob('ubuntu-arm', 'cargo clippy --release -- -D warnings')(gha), 'expected native platform Rust release lint')
        assert(hasRunInJob('wasm', 'cargo test --target wasm32-wasip1 --release')(gha), 'expected target-specific WASM release check')
        assert(hasRunInJob('wasm', 'cargo clippy --target wasm32-wasip1 -- -D warnings')(gha), 'expected target-specific WASM Rust lint')
        assert(hasRunInJob('wasm', 'cargo clippy --target wasm32-wasip1 --release -- -D warnings')(gha), 'expected target-specific WASM release lint')
        // Wasmtime 47 removed wasi-threads: the threads target must run under
        // Wasmer only, while Clippy (no runner) stays.
        assert(hasRunInJob('wasm', 'cargo test --target wasm32-wasip1-threads --config .cargo/config.wasmer.toml')(gha), 'expected Wasmer WASM threads check')
        assert(hasRunInJob('wasm', 'cargo clippy --target wasm32-wasip1-threads -- -D warnings')(gha), 'expected WASM threads lint')
        assert(!hasExactRunInJob('wasm', 'cargo test --target wasm32-wasip1-threads')(gha), 'unexpected Wasmtime WASM threads check')
        assert(!hasExactRunInJob('wasm', 'cargo test --target wasm32-wasip1-threads --release')(gha), 'unexpected Wasmtime WASM threads release check')
        // Node 22 runs the suite the way every other Node job does. `fjs test`
        // and the global install that fed it were there only because Node 22
        // could not run `node --test`.
        assert(hasRunInJob('node22', 'node --test')(gha), 'expected the Node 22 suite')
        assert(!hasRunInJob('node22', 'fjs test')(gha), 'unexpected published-CLI smoke test in node22')
        assert(!hasRunInJob('node22', 'npm install -g')(gha), 'unexpected global install in node22')
        assert(hasRunInJob('node26', 'npm pack')(gha), 'expected Node 26 package check')
        assert(hasRunInJob('node26', 'npm run ci-update')(gha), 'expected Node 26 workflow regeneration')
        assert(hasRunInJob('node26', 'git add -A && git diff --cached --exit-code')(gha), 'expected Node 26 generated-file drift check')
        assert(!hasRun('npm publish --dry-run')(gha), 'unexpected npm publish dry-run')
        for (const id of /** @type {const} */ ([
            'ubuntu-intel',
            'ubuntu-arm',
            'macos-intel',
            'macos-arm',
            'windows-intel',
            'windows-arm',
            'node22',
            'node24',
            'node26',
        ])) {
            assert(hasRunInJob(id, 'npm ci')(gha), `expected npm ci in ${id}`)
        }
        assert(!hasRunInJob('deno', 'npm ci')(gha), 'unexpected npm ci in deno job')
        assert(!hasRunInJob('bun', 'npm ci')(gha), 'unexpected npm ci in bun job')
    },
    rust: () => {
        assert(hasRun('cargo')(run(true)), 'expected Rust steps')
    },
    noRust: () => {
        assert(!hasRun('cargo')(run(false)), 'unexpected Rust steps')
    },
    extra: {
        allOs: () => {
            const cmd = 'echo hello'
            const gha = run(false, () => [test({ run: cmd })])
            for (const o of /** @type {const} */ (['ubuntu', 'macos', 'windows'])) {
                for (const a of /** @type {const} */ (['intel', 'arm'])) {
                    assert(hasRunInJob(`${o}-${a}`, cmd)(gha), `missing extra step in ${o}-${a}`)
                }
            }
        },
        osSpecific: () => {
            const gha = run(false, o => o === 'ubuntu' ? [test({ run: 'echo ubuntu-only' })] : [])
            for (const a of /** @type {const} */ (['intel', 'arm'])) {
                assert(hasRunInJob(`ubuntu-${a}`, 'echo ubuntu-only')(gha), `missing step in ubuntu-${a}`)
                assert(!hasRunInJob(`macos-${a}`, 'echo ubuntu-only')(gha), `unexpected step in macos-${a}`)
                assert(!hasRunInJob(`windows-${a}`, 'echo ubuntu-only')(gha), `unexpected step in windows-${a}`)
            }
        },
    },
    defaultSetup: {
        functionalscriptPackage: () => {
            const gha = runDefault('{"name":"functionalscript"}')
            assert(hasRun('fjs test')(gha), 'expected fjs self-test')
            assert(hasRun(`deno run -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript} test`)(gha), 'expected deno self-test')
        },
        otherPackage: () => {
            const gha = runDefault('{"name":"other-package"}')
            assert(hasRun(`deno run -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript} test`)(gha), 'expected canonical deno self-test')
        },
        configuredPackageVersion: () => {
            const gha = runDefault('{"name":"other-package","version":"1.2.3"}')
            assert(hasRun(`npm install -g functionalscript@${functionalscript}`)(gha), 'expected configured-version platform install')
            assert(hasRun(`deno install -g -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript}`)(gha), 'expected configured-version deno install cache')
            assert(hasRun('deno install --frozen')(gha), 'expected deno lock install')
            assert(hasRun(`deno run -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript} test`)(gha), 'expected configured-version deno install')
            assert(hasRun('deno task cov')(gha), 'expected deno coverage task')
            assert(hasRun('bun install --frozen-lockfile')(gha), 'expected bun lock install')
            // The `bun` job no longer installs the published package at all,
            // so no `bunx functionalscript@<version>` is expected here.
            assert(!hasRun('bunx functionalscript@')(gha), 'unexpected published-package step in bun')
        },
        missingPackageJson: () => {
            const gha = runDefault()
            assert(hasRun(`npm install -g functionalscript@${functionalscript}`)(gha), 'expected configured-version install')
        },
    },
    // Every generated flake is checked here rather than by a CI job: CI only
    // uses these files, and a proof reading the generator's own output can say
    // more about them than a shell can, without a Nix installation.
    nixFlakes: () => {
        const [state, result] = virtual(makeState(false, undefined))(main())
        assertEq(exitCode(result), 0)
        // Every generated flake, not just the Node ones: `nixJobs` is what the
        // generator was given, so a family that declares an environment and
        // never has it written fails here.
        assertEq(nixJobs.length, 4)
        for (const job of nixJobs) {
            // The pipeline wrote that job's flake, whole, at the path a
            // `nix develop` step names. Equality rather than a substring
            // search: a `pkgs.nodejs_24` occurring in a comment or an unrelated
            // binding would satisfy `includes` while the shell declared
            // something else. What the text itself must say — the pinned
            // commit, the shell, the packages — is pinned character for
            // character by `nix/proof.f.mjs`.
            assertEq(flake(state, job.id), flakeText(job))
        }
        for (const job of nodeNixJobs) {
            const [nodePackage] = job.packages
            // The package attribute the job declares, tied to the version the
            // configuration records for it: `node24` gets `nodejs_24`, so a job
            // renamed or repointed without its package following is a failure
            // here rather than a shell running the wrong Node. This is the
            // job's own data, not text scanned out of a file. Deno's and Bun's
            // attributes carry no version, so their checks are the only tie
            // they have — see `nixVersionChecks`.
            assertEq(nodePackage, `nodejs_${major(configuredVersion(job.id))}`)
        }
    },
    // Every canonical Node job, step for step, each running through its own
    // generated flake. None installs a runtime with `setup-node` any more.
    migratedNodeJobs: () => {
        const gha = run(false)
        for (const [version, commands] of /** @type {const} */ ([
            [node.node22, ['npm ci', 'node --test']],
            [node.node24, ['npm ci', 'node --test']],
            [node.default, ['npm ci', 'npx tsc', 'npm run cov', 'npm pack', 'npm run ci-update']],
        ])) {
            const id = `node${major(version)}`
            const job = gha.jobs[id]
            assert(job !== undefined, `expected the ${id} job`)
            assert(
                job.steps.some(step => step.uses?.startsWith('cachix/install-nix-action@') === true),
                `expected a pinned Nix installer in ${id}`)
            assert(
                !job.steps.some(step => step.uses?.startsWith('actions/setup-node@') === true),
                `unexpected setup-node in ${id}`)
            // One command per step (root `AGENTS.md` §7), each entering the
            // shell itself, in the order the job had them, behind the version
            // check. Node 26's drift check closes the list and is deliberately
            // not a Nix command: `git` is the runner's, and it compares a tree
            // every earlier step has finished writing.
            assertStructurallySame(
                job.steps.flatMap(step => step.run === undefined ? [] : [step.run]),
                [
                    `test "$(nix develop --no-write-lock-file ./nix/${id} --command node --version)" = v${version}`,
                    ...commands.map(command => `nix develop --no-write-lock-file ./nix/${id} --command ${command}`),
                    ...(id === `node${major(node.default)}`
                        ? ['git add -A && git diff --cached --exit-code']
                        : []),
                ])
        }
    },
    // Every job with a flake asserts the runtime it is about to use, read from
    // that flake. The platform matrix installs Node and is deliberately not
    // checked. Nothing else ties the versions `fjs/ci/config/module.f.mjs`
    // records to what a job really runs — and for Deno and Bun nothing else
    // could, since `pkgs.deno` and `pkgs.bun` name no version.
    nixVersionChecks: () => {
        const gha = run(false)
        /** @type {readonly (readonly [string, string, string])[]} */
        const checks = [
            [`node${major(node.node22)}`, 'node --version', `v${node.node22}`],
            [`node${major(node.node24)}`, 'node --version', `v${node.node24}`],
            [`node${major(node.default)}`, 'node --version', `v${node.default}`],
            // Deno prints three lines for `--version`, so it is asked for the
            // one field this repository configures.
            ['deno', `deno eval 'console.log(Deno.version.deno)'`, deno],
        ]
        assertEq(checks.length, nixJobs.length)
        for (const [id, command, expected] of checks) {
            const runs = (gha.jobs[id]?.steps ?? [])
                .flatMap(step => step.run === undefined ? [] : [step.run])
            // The job's first command, with nothing exempted. `npm ci` in
            // particular runs lifecycle hooks from the project and its
            // dependencies — code executing on a runtime the check has not
            // confirmed yet — so it comes after, not before. `deno install` is
            // the same case.
            assertEq(runs[0], `test "$(${nixDevelop(id, command)})" = ${expected}`, id)
        }
    },
    // Deno, step for step. It lost its setup action, and every command it runs
    // enters its own flake — the global install included, which is why that
    // step no longer sits ahead of the checkout.
    migratedDenoJob: () => {
        const gha = run(false)
        const job = gha.jobs.deno
        assert(job !== undefined, 'expected the deno job')
        assert(
            job.steps.some(step => step.uses?.startsWith('cachix/install-nix-action@') === true),
            'expected a pinned Nix installer in deno')
        assert(
            !job.steps.some(step => step.uses?.startsWith('denoland/setup-deno@') === true),
            'unexpected setup-deno')
        assertStructurallySame(
            job.steps
                .flatMap(step => step.run === undefined ? [] : [step.run])
                .slice(1),
            [
                `deno install -g -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript}`,
                `deno run -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript} test`,
                'deno install --frozen',
                'deno task cov',
            ].map(command => nixDevelop('deno', command)))
    },
    // Bun is the one canonical job left on a setup action, and the one with no
    // flake — `fjs/ci/todo/bun-nix-blocked-on-nixpkgs.md` says why. It also no
    // longer installs a published `functionalscript`, which is independent of
    // Nix and is why its two remaining commands are only about this repository.
    bunJob: () => {
        const gha = run(false)
        const job = gha.jobs.bun
        assert(job !== undefined, 'expected the bun job')
        assert(
            job.steps.some(step => step.uses?.startsWith('oven-sh/setup-bun@') === true),
            'expected setup-bun')
        assertStructurallySame(
            job.steps.flatMap(step => step.run === undefined ? [] : [step.run]),
            ['bun install --frozen-lockfile', 'bun test --coverage'])
    },
    ubuntu: () => {
        const job = ubuntu([test({ run: 'echo hi' })])
        assert(job['runs-on'] !== undefined, 'expected runs-on')
        assert(job.steps.length > 0, 'expected steps')
    },
    packageArtifact: () => {
        const gha = run(false)
        const job = gha.jobs[`node${major(node.default)}`]
        assert(job !== undefined, 'expected the canonical Node job')
        const packIndex = job.steps.findIndex(
            step => step.run === `nix develop --no-write-lock-file ./nix/node${major(node.default)} --command npm pack`)
        const uploadIndex = job.steps.findIndex(
            step => step.uses === `actions/upload-artifact@${actions['actions/upload-artifact']}`)
        assert(packIndex !== -1, 'expected npm pack')
        assert(uploadIndex !== -1, 'expected the artifact upload')
        // Uploading before packing would ship an empty artifact, and the
        // failure would then surface in the consuming job rather than here,
        // where the cause is.
        assert(uploadIndex > packIndex, 'expected the upload to follow npm pack')
        const upload = job.steps[uploadIndex]?.with
        // Producer and consumer share the exported name rather than repeating
        // a string literal that can drift apart.
        assertEq(upload?.name, packageArtifact)
        // The glob has to match what `npm pack` writes. `if-no-files-found`
        // catches a glob that matches *nothing*; a glob matching the *wrong*
        // files would upload them quietly, so pin it.
        assertEq(upload?.path, '*.tgz')
        // The action's default is to warn and upload nothing, which would make
        // a packing failure look like a consumer bug.
        assertEq(upload?.['if-no-files-found'], 'error')
        // One producer: a second upload under the same name is a race, not
        // redundancy.
        assertEq(
            definedValues(gha.jobs).filter(j =>
                j.steps.some(step => step.uses?.startsWith('actions/upload-artifact@') === true)).length,
            1,
            'expected exactly one job to upload the package')
    },
    packageCheck: () => {
        const gha = run(false)
        // The job's own shape is proved next to the module, in
        // `fjs/ci/package/proof.f.mjs`. What only the assembled workflow can
        // show is that it is wired in, and that the job it waits for is really
        // the one that produces the artifact — an edge pointing at a job that
        // never uploads would satisfy the ordering and still never run.
        const job = gha.jobs[packageCheckJobId]
        assert(job !== undefined, 'expected the packed-package check job')
        assertEq(job.needs?.[0], packageJobId)
        assert(
            gha.jobs[packageJobId]?.steps.some(
                step => step.uses?.startsWith('actions/upload-artifact@') === true) === true,
            'expected the needed job to be the one that uploads')
        // The compiler comes from the project's own package.json, not from a
        // constant here that could disagree with it silently.
        assert(
            job.steps.some(step => step.run?.includes(`"typescript@${runPin}"`) === true),
            'expected the compiler pin read from package.json')
    },
    // Without a pin the check cannot be run deterministically, so it is not
    // generated at all rather than run against a compiler nobody chose.
    packageCheckNeedsAPin: () => {
        for (const packageJson of /** @type {const} */ ([
            undefined,                                  // no package.json at all
            'not json',                                 // unparseable
            '"a string"',                               // not an object
            '{"devDependencies":"x"}',                  // devDependencies not an object
            '{"devDependencies":[]}',                   // nor an array
            '{"devDependencies":{"typescript":1}}',     // pin not a string
            '{"name":"p"}',                             // no devDependencies
            '{"name":"p","devDependencies":{}}',        // no typescript
            '{"devDependencies":{"typescript":"^7.0.0"}}',   // a range, not a pin
            '{"devDependencies":{"typescript":"7.0.2"}}',    // bare, still not exact
            '{"devDependencies":{"typescript":"=7.x"}}',     // `=` prefixing a range
            '{"devDependencies":{"typescript":"=7.0"}}',     // two segments is a range
            '{"devDependencies":{"typescript":"=7.0.2.1"}}', // four is not a version
            '{"devDependencies":{"typescript":"=7.0.2 || 8.x"}}', // a union
            '{"devDependencies":{"typescript":"=7.0.beta"}}',// a non-numeric segment
            '{"devDependencies":{"typescript":"=7..2"}}',    // an empty segment
            '{"devDependencies":{"typescript":"="}}',        // nothing after the sign
        ])) {
            const [state, result] = virtual(makeState(false, packageJson))(ci({ nodeExtra: () => [] }))
            assertEq(exitCode(result), 0)
            assertEq(workflow(state).jobs[packageCheckJobId], undefined)
        }
    },
    jobNeeds: () => {
        const steps = /** @type {const} */ ([{ run: 'echo hi' }])
        /** @type {(jobs: Unknown) => Unknown} */
        const action = jobs => ({
            name: 'test',
            on: {},
            permissions: { contents: 'read' },
            jobs,
        })
        // Modelled, so a job that waits for another survives the round-trip.
        // Without this a consuming job could only reach the workflow by being
        // emitted past the schema, which `parseGitHubAction` would then reject.
        const ordered = unwrap(parseGitHubAction(action({
            pack: { 'runs-on': 'ubuntu-latest', steps },
            check: { 'runs-on': 'ubuntu-latest', needs: ['pack'], steps },
        })))
        assertEq(ordered.jobs.check?.needs?.[0], 'pack')
        assertEq(ordered.jobs.check?.needs?.length, 1)
        // Optional: the independent jobs, which is all of them today, still parse.
        assertEq(unwrap(parseGitHubAction(action({
            pack: { 'runs-on': 'ubuntu-latest', steps },
        }))).jobs.pack?.needs, undefined)
        // Constrained, not merely accepted. GitHub also allows a bare scalar
        // (`needs: pack`); this generator emits the list form only, so the
        // scalar is drift rather than an alternative spelling — the same reason
        // these schemas are closed.
        assertEq(parseGitHubAction(action({
            check: { 'runs-on': 'ubuntu-latest', needs: 'pack', steps },
        }))[0], 'error')
        // Exactly one job orders itself: the packed-package check, which
        // cannot start before the artifact it consumes exists. Pinning the
        // count keeps a second ordering edge a deliberate change rather than
        // something that appears unnoticed — ordering is where a workflow
        // starts to have a shape that has to be reasoned about.
        const orderedJobs = definedValues(run(false).jobs).filter(job => job.needs !== undefined)
        assertEq(orderedJobs.length, 1, 'unexpected job ordering in the generated workflow')
    },
}
