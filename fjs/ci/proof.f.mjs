/**
 * @import { Job, MetaStep, Os, GitHubAction } from './common/types.ts'
 * @import { Dir, State } from '../effects/node/virtual/types.ts'
 * @import { Unknown } from '../djs/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { ci, main, nixJobs } from './module.f.mjs'
import { actions, bun, deno, functionalscript, node, typescript, wasmer, wasmtime } from './config/module.f.mjs'
import { major, nodeNixJobs, packageArtifact, packageJobId } from './node/module.f.mjs'
import { flakeText, nixDevelop, runPath } from './nix/module.f.mjs'
import { packageCheckJobId } from './package/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { empty as emptyVec } from '../types/bit_vec/module.f.mjs'
import { architecture, os, test, ubuntu, parseGitHubAction } from './common/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
import { definedValues } from '../types/object/module.f.mjs'
import { parse as jsonParse } from '../media/json/module.f.mjs'

/** @type {(cmd: string) => (gha: GitHubAction) => boolean} */
const hasRun = cmd => gha =>
    definedValues(gha.jobs).some(job => job.steps.some(step => step.run?.includes(cmd)))

/**
 * Whether a job bootstraps Nix: the installer step every migrated job has and
 * no other job needs.
 *
 * @type {(job: Job | undefined) => boolean}
 */
const installsNix = job =>
    job?.steps.some(step => step.uses?.startsWith('cachix/install-nix-action@') === true) === true

/**
 * Whether a job actually *enters* its own generated shell — some step's command
 * is `nix/<id>/run`.
 *
 * Deliberately not the same question as `installsNix`. A job could install Nix
 * and then run its commands on the runner's own toolchain: it would look
 * migrated, its flake would never be evaluated, and the runtime it tested would
 * be whatever the image happened to ship. Nothing else would notice, because
 * the version check is the step that would have caught it and it is one of the
 * steps that would be missing.
 *
 * The step's **command** is its first field, which is what a `run:` line is:
 * one command (root `AGENTS.md` §7), and `nixSteps` writes the script's path
 * as that command. So this compares the first field rather than searching the
 * line — a step that merely names the path, `echo ./nix/deno/run`, is not
 * entry and is not counted. Neither is the version check, whose command is
 * `test` and which reaches the script inside a substitution; a job whose only
 * mention of its flake were that would fail here, which is the right answer
 * rather than a gap.
 *
 * @type {(job: Job | undefined, id: string) => boolean}
 */
const entersFlake = (job, id) =>
    job?.steps.some(step => step.run?.split(' ')[0] === runPath(id)) === true

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

// A compiler pin no configuration anywhere holds, written into the fixture
// project's `package.json` so that the generator can be shown to ignore it.
// The packed-package check installs `../config/module.f.mjs`'s version; an
// assertion that found this one instead would have found a generator reading
// the project's dependencies, which is what this change stopped doing.
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
        assertEq(Object.keys(gha.jobs).length, 14, 'expected 14 CI jobs')
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
        },
        otherPackage: () => {
            const gha = runDefault('{"name":"other-package"}')
            // The platform matrix is the only family left running a published
            // CLI; `deno` and `bun` stopped, and no canonical Node job ever did.
            assert(hasRun('fjs test')(gha), 'expected canonical platform self-test')
        },
        configuredPackageVersion: () => {
            const gha = runDefault('{"name":"other-package","version":"1.2.3"}')
            assert(hasRun(`npm install -g functionalscript@${functionalscript}`)(gha), 'expected configured-version platform install')
            assert(hasRun('deno install --frozen')(gha), 'expected deno lock install')
            assert(hasRun('deno task cov')(gha), 'expected deno coverage task')
            assert(hasRun('bun install --frozen-lockfile')(gha), 'expected bun lock install')
            // Neither runtime job installs the published package any more, so
            // the configured version reaches only the platform matrix.
            assert(!hasRun('npm:functionalscript@')(gha), 'unexpected published-package step in deno')
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
        assertEq(nixJobs.length, 7)
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
            [node.default, ['npm ci', 'tsc', 'npm run cov', 'npm pack', 'npm run ci-update']],
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
                    `test "$(./nix/${id}/run node --version)" = "v${version}"`,
                    // Node 26 is the one that type-checks and packs, so it is
                    // the one whose shell carries a compiler — and the only one
                    // with a second version to assert before running anything.
                    ...(id === `node${major(node.default)}`
                        ? [`test "$(./nix/${id}/run tsc --version)" = "Version ${typescript.version}"`]
                        : []),
                    ...commands.map(command => `./nix/${id}/run ${command}`),
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
        // With Rust, because `wasm` is the one job here that a project without
        // a `Cargo.toml` does not get — while its flake is generated either
        // way, since `nixJobs` is a list rather than a function of the project.
        const gha = run(true)
        /** @type {readonly (readonly [string, readonly (readonly [string, string])[]])[]} */
        const checks = [
            [`node${major(node.node22)}`, [['node --version', `v${node.node22}`]]],
            [`node${major(node.node24)}`, [['node --version', `v${node.node24}`]]],
            // Two, because this is the job that type-checks the repository and
            // runs `npm pack`, whose `prepack` emits the declarations the
            // package ships with the same compiler. `typescript-go` names no
            // version, so this check is the whole tie.
            [`node${major(node.default)}`, [
                ['node --version', `v${node.default}`],
                ['tsc --version', `Version ${typescript.version}`],
            ]],
            // Deno prints three lines for `--version`, so it is asked for the
            // one field this repository configures.
            ['deno', [[`deno eval 'console.log(Deno.version.deno)'`, deno]]],
            // Two, because the shell provides two unversioned attributes. Its
            // Rust is the one thing it does not check: the flake names that
            // release in full, so a check would restate the flake.
            ['wasm', [
                ['wasmtime --version', `wasmtime ${wasmtime}`],
                ['wasmer --version', `wasmer ${wasmer}`],
            ]],
            // Bun prints the bare version, with no leading `v` and no program
            // name. Its check is also the only one confirming that an override
            // took effect rather than that a snapshot is what it claims: the
            // shell's Bun is not the snapshot's.
            ['bun', [['bun --version', bun]]],
            // The developer environment, which is checked more thoroughly than
            // any job's: it is the only flake no other job enters, so these
            // six are the whole of what keeps it from rotting. Its Rust goes
            // unchecked for the reason `wasm`'s does — the flake names the
            // release in full.
            ['dev', [
                ['node --version', `v${node.default}`],
                [`deno eval 'console.log(Deno.version.deno)'`, deno],
                ['bun --version', bun],
                ['tsc --version', `Version ${typescript.version}`],
                ['wasmtime --version', `wasmtime ${wasmtime}`],
                ['wasmer --version', `wasmer ${wasmer}`],
            ]],
        ]
        assertEq(checks.length, nixJobs.length)
        for (const [id, jobChecks] of checks) {
            const runs = (gha.jobs[id]?.steps ?? [])
                .flatMap(step => step.run === undefined ? [] : [step.run])
            // The job's first commands, with nothing exempted. `npm ci` in
            // particular runs lifecycle hooks from the project and its
            // dependencies — code executing on a runtime the check has not
            // confirmed yet — so it comes after, not before. `deno install` and
            // `cargo test`, which runs a build script, are the same case.
            assertStructurallySame(
                runs.slice(0, jobChecks.length),
                jobChecks.map(([command, expected]) =>
                    `test "$(${nixDevelop(id, command)})" = "${expected}"`))
        }
    },
    // Deno, step for step. It lost its setup action, and every command it runs
    // enters its own flake.
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
            ['deno install --frozen', 'deno task cov']
                .map(command => nixDevelop('deno', command)))
    },
    // Every job's Nix status, in one place. The platform matrix is excluded by
    // construction rather than by exception: those six jobs exist to run on
    // stock runner images across three operating systems and two
    // architectures, and four of them are not `aarch64-linux` at all. What is
    // left is the canonical set, and it splits in two — the jobs that enter a
    // generated flake, and the three that do not, each with an issue saying
    // why. `fjs/ci/todo/65z-ci-nix.md` holds those reasons together; this is
    // what makes a job added later come and declare which side it is on,
    // instead of joining the second list in silence.
    nixCoverage: () => {
        const gha = run(true)
        const matrix = os.flatMap(o => architecture.map(a => `${o}-${a}`))
        const canonical = Object.keys(gha.jobs).filter(id => !matrix.includes(id))
        // Bootstrapping Nix and entering the shell are separate facts, and a
        // job doing only the first is the one that would slip past a check
        // reading either alone. Requiring them to agree job by job is what
        // lets the split below mean what it says.
        for (const id of canonical) {
            const job = gha.jobs[id]
            assertEq(entersFlake(job, id), installsNix(job), id)
        }
        const onNix = canonical.filter(id => installsNix(gha.jobs[id]))
        const declared = nixJobs.map(job => job.id)
        // The declared flakes and the jobs that enter one are the same set:
        // a flake nothing enters is never evaluated, and a job entering one
        // that is not declared has no `flake.nix` to find.
        //
        // Both directions, because counting and one is not the same as
        // equality once a duplicate is possible: declaring `deno` twice while
        // a newly migrated job went undeclared would keep the counts level and
        // satisfy every declaration, and the generator would write no flake
        // for the job whose steps enter one. `onNix` comes from `Object.keys`
        // and cannot repeat, so the reverse containment is what closes that.
        assertEq(declared.length, onNix.length)
        for (const id of declared) {
            assert(onNix.includes(id), `expected ${id} to enter its own flake`)
        }
        for (const id of onNix) {
            assert(declared.includes(id), `expected a flake declared for ${id}`)
        }
        // And named directly, because a repeated declaration is a defect in
        // its own right — `nixFlakes` would write the same file twice — rather
        // than only the way the check above could be fooled.
        assert(
            declared.every((id, i) => declared.indexOf(id) === i),
            'duplicate flake declaration')
        assertStructurallySame(
            canonical.filter(id => !installsNix(gha.jobs[id])),
            // `package-check` runs with no checkout, so there is no file tree
            // for a flake or its `run` script to be in.
            [packageCheckJobId])
    },
    // Bun, step for step. It lost its setup action, and every command it runs
    // enters its own flake — whose Bun is the one thing in any generated shell
    // that does not come from the pinned snapshot.
    migratedBunJob: () => {
        const gha = run(false)
        const job = gha.jobs.bun
        assert(job !== undefined, 'expected the bun job')
        assert(
            job.steps.some(step => step.uses?.startsWith('cachix/install-nix-action@') === true),
            'expected a pinned Nix installer in bun')
        assert(
            !job.steps.some(step => step.uses?.startsWith('oven-sh/setup-bun@') === true),
            'unexpected setup-bun')
        assertStructurallySame(
            job.steps
                .flatMap(step => step.run === undefined ? [] : [step.run])
                .slice(1),
            ['bun install --frozen-lockfile', 'bun test --coverage']
                .map(command => nixDevelop('bun', command)))
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
            step => step.run === `./nix/node${major(node.default)}/run npm pack`)
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
        // The compiler is the CI configuration's — the same version the
        // `node26` shell provides, so the declarations in the tarball are read
        // by the compiler that emitted them. Its exactness is proved next to
        // the module, in `fjs/ci/package/proof.f.mjs`.
        assert(
            job.steps.some(step => step.run?.includes(`"typescript@${typescript.version}"`) === true),
            'expected the configured compiler installed')
    },
    // The job used to appear only when the project's `package.json` pinned an
    // exact compiler, and it is now generated for every project — there is no
    // longer anything about the project for it to depend on. So the shapes that
    // once removed it must not: a `package.json` that is missing, unparseable,
    // or says nothing about TypeScript still gets the packed-package check,
    // because the compiler no longer comes from there.
    //
    // This also covers a thing the generator stopped doing at all: reading
    // `package.json`. Every entry below would have failed that read or the
    // parse that followed it.
    packageCheckIgnoresPackageJson: () => {
        for (const packageJson of /** @type {const} */ ([
            undefined,                                  // no package.json at all
            'not json',                                 // unparseable
            '"a string"',                               // not an object
            '{"name":"p"}',                             // no devDependencies
            '{"devDependencies":{"typescript":"^7.0.0"}}',   // a range of its own
            '{"devDependencies":{"typescript":"=1.2.3"}}',   // a pin of its own
        ])) {
            const [state, result] = virtual(makeState(false, packageJson))(ci({ nodeExtra: () => [] }))
            assertEq(exitCode(result), 0)
            const job = workflow(state).jobs[packageCheckJobId]
            assert(job !== undefined, `expected the check for ${packageJson}`)
            // Not the project's pin, in the two cases that have one.
            assert(
                job.steps.some(step =>
                    step.run?.includes(`"typescript@${typescript.version}"`) === true),
                'expected the configured compiler rather than the project\'s')
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
