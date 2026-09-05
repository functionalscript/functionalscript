/**
 * @import { Job, MetaStep, Os, GitHubAction, Step } from './common/types.ts'
 * @import { Dir, State } from '../effects/node/virtual/types.ts'
 * @import { Unknown } from '../djs/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { ci, main, nixJobs } from './module.f.mjs'
import { actions, bun, deno, functionalscript, node, typescript, wasmer, wasmtime } from './config/module.f.mjs'
import { major, nodeNixJobs, packageArtifact, packageJobId } from './node/module.f.mjs'
import { flakePath, flakeText, nixDevelop, nixShell, runPath } from './nix/module.f.mjs'
import { packageCheckJobId } from './package/module.f.mjs'
import { i686JobId } from './rust/module.f.mjs'
import { npmPublishJobId, npmPublishPath, npmPublishWorkflow } from './publish/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { empty as emptyVec } from '../types/bit_vec/module.f.mjs'
import { install, test, ubuntu, uses, parseGitHubAction } from './common/module.f.mjs'
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

/**
 * Which declared flakes a job enters. Usually one; never, for a job with no
 * checkout.
 *
 * A job no longer enters the flake named after it — all but two share one — so
 * the question `entersFlake` answers for a known id has to be asked of every
 * declared id instead.
 *
 * @type {(job: Job | undefined) => readonly string[]}
 */
const flakesEntered = job =>
    nixJobs.map(({ id }) => id).filter(id => entersFlake(job, id))

/** @type {(jobId: string, cmd: string) => (gha: GitHubAction) => boolean} */
const hasRunInJob = (jobId, cmd) => gha =>
    gha.jobs[jobId]?.steps.some(step => step.run?.includes(cmd)) ?? false

/** @type {(jobId: string, cmd: string) => (gha: GitHubAction) => boolean} */
const hasExactRunInJob = (jobId, cmd) => gha =>
    gha.jobs[jobId]?.steps.some(step => step.run === cmd) ?? false

/**
 * The line every injected command is run by. It names the interpreter and the
 * variable and nothing else — the command itself is not in it, which is the
 * property {@link hasInjected} exists to check.
 */
const injectedLine = `${runPath(nixShell)} bash -e -c "$FJS_CI_RUN"`

/**
 * An injected command as it reaches the shell: that one fixed line, and the
 * command itself in the step's environment rather than quoted into it.
 *
 * @type {(jobId: string, cmd: string) => (gha: GitHubAction) => boolean}
 */
const hasInjected = (jobId, cmd) => gha =>
    gha.jobs[jobId]?.steps.some(step =>
        step.run === injectedLine && step.env?.['FJS_CI_RUN'] === cmd) ?? false

/**
 * An injected command present in a job at all, in either of the two shapes it
 * can take. `allOs` asks reach with this; `inTheSameShell` asks which shape.
 *
 * @type {(jobId: string, cmd: string) => (gha: GitHubAction) => boolean}
 */
const carriesInjected = (jobId, cmd) => gha =>
    hasInjected(jobId, cmd)(gha) || hasExactRunInJob(jobId, cmd)(gha)

/**
 * Where a step sits in its job, by whatever identifies it: `-1` for absent.
 *
 * Position is a fact the `run`-text assertions above cannot reach, and it is
 * the half of "the step moved into the shell" that actually matters. A wrapped
 * command emitted as an `install` step lands before `actions/checkout`, where
 * the `run` script it names does not exist yet — with the exact `run` text
 * these proofs otherwise ask for.
 *
 * @type {(jobId: string, match: (step: Step) => boolean) => (gha: GitHubAction) => number}
 */
const stepIndex = (jobId, match) => gha =>
    gha.jobs[jobId]?.steps.findIndex(match) ?? -1

/** @type {(jobId: string, cmd: string) => (gha: GitHubAction) => number} */
const runIndex = (jobId, cmd) => stepIndex(jobId, step => step.run === cmd)

/** @type {(jobId: string) => (gha: GitHubAction) => number} */
const checkoutIndex = jobId =>
    stepIndex(jobId, step => step.uses?.startsWith('actions/checkout@') === true)

/** @type {(jobId: string) => (gha: GitHubAction) => number} */
const injectedIndex = jobId => stepIndex(jobId, step => step.run === injectedLine)

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

/** @type {(state: State, file: string) => GitHubAction} */
const workflowFile = (state, file) => {
    const workflows = path(state.root, ['.github', 'workflows'])
    return unwrap(parseGitHubAction(unwrap(jsonParse(text(workflows, file)))))
}

/** @type {(state: State) => GitHubAction} */
const workflow = state => workflowFile(state, 'ci.yml')

/** @type {(state: State, id: string) => string} */
const flake = (state, id) =>
    text(path(state.root, flakePath(id).slice('./'.length).split('/')), 'flake.nix')

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
        // 32-bit Linux is a job of its own, because its linker is a package
        // broken on every system the shared shell serves but one. The four
        // checks are what it exists for.
        assert(hasRunInJob(i686JobId, 'cargo test --target i686-unknown-linux-gnu')(gha), 'expected 32-bit Linux check')
        assert(hasRunInJob(i686JobId, 'cargo test --target i686-unknown-linux-gnu --release')(gha), 'expected 32-bit Linux release check')
        assert(hasRunInJob(i686JobId, 'cargo clippy --target i686-unknown-linux-gnu -- -D warnings')(gha), 'expected 32-bit Linux lint')
        assert(hasRunInJob(i686JobId, 'cargo clippy --target i686-unknown-linux-gnu --release -- -D warnings')(gha), 'expected 32-bit Linux release lint')
        // And nowhere else: `ubuntu-intel` is now the same job as its three
        // siblings, differing by platform and by nothing else.
        assert(!hasRunInJob('ubuntu-intel', '--target i686')(gha), 'unexpected 32-bit check in ubuntu-intel')
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
        assert(hasRunInJob('node26', 'npm run gen')(gha), 'expected Node 26 workflow regeneration')
        assert(hasRunInJob('node26', 'git add -A && git diff --cached --exit-code')(gha), 'expected Node 26 generated-file drift check')
        assert(!hasRun('npm publish --dry-run')(gha), 'unexpected npm publish dry-run')
        // `npm ci` belongs to the jobs that need what it installs, and to no
        // others. The three Node jobs type-check, pack and run the suite; the
        // four platform jobs that moved into the shared shell run the suite
        // too. `deno` and `bun` install through their own package managers.
        for (const id of /** @type {const} */ ([
            'node22',
            'node24',
            'node26',
            // The four platform jobs that run `node --test` need it too, and
            // for a reason this repository cannot show: `node --test` runs a
            // project's test entry, and `./README.md` tells a consumer to
            // write that entry as a bare `functionalscript/…` import. Ours
            // live under `fjs/`, reached by path, so the failure would only
            // ever have appeared downstream.
            'ubuntu-intel',
            'ubuntu-arm',
            'macos-intel',
            'macos-arm',
        ])) {
            assert(hasRunInJob(id, 'npm ci')(gha), `expected npm ci in ${id}`)
        }
        for (const id of /** @type {const} */ ([
            'deno',
            'bun',
            // The two Windows jobs run a *published* CLI against this tree
            // through `fjs test`, which walks the tree for proof modules and
            // resolves nothing.
            'windows-intel',
            'windows-arm',
        ])) {
            assert(!hasRunInJob(id, 'npm ci')(gha), `unexpected npm ci in ${id}`)
        }
        // And in the four platform jobs, in that order. The version check goes
        // first because `npm ci` runs `preinstall`/`install`/`postinstall`
        // hooks from the project and its dependencies — code that should not be
        // the thing that discovers which runtime it is on. `node --test` goes
        // last because it is what `npm ci` installs the tree for.
        for (const id of /** @type {const} */ ([
            'ubuntu-intel',
            'ubuntu-arm',
            'macos-intel',
            'macos-arm',
        ])) {
            const check = runIndex(
                id,
                `test "$(${nixDevelop(nixShell, 'node --version')})" = "v${node.default}"`)(gha)
            const install = runIndex(id, nixDevelop(nixShell, 'npm ci'))(gha)
            const suite = runIndex(id, nixDevelop(nixShell, 'node --test'))(gha)
            assert(check !== -1 && install !== -1 && suite !== -1, id)
            assert(check < install, `expected the version check before npm ci in ${id}`)
            assert(install < suite, `expected npm ci before node --test in ${id}`)
        }
        // No `dtolnay/rust-toolchain` in any job that gets Rust from a flake.
        // A `{ type: 'rust' }` marker anywhere in those steps puts the action
        // back, silently, and the job would then run a runner toolchain while
        // every other assertion about it still held.
        for (const id of /** @type {const} */ ([
            'ubuntu-intel',
            'ubuntu-arm',
            'macos-intel',
            'macos-arm',
            i686JobId,
            'wasm',
        ])) {
            assert(
                gha.jobs[id]?.steps.every(
                    step => step.uses?.startsWith('dtolnay/rust-toolchain@') !== true) === true,
                `unexpected runner toolchain in ${id}`)
        }
        // The two Windows jobs still have it, because they have no shell.
        for (const id of /** @type {const} */ (['windows-intel', 'windows-arm'])) {
            assert(
                gha.jobs[id]?.steps.some(
                    step => step.uses?.startsWith('dtolnay/rust-toolchain@') === true) === true,
                `expected a runner toolchain in ${id}`)
        }
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
                    assert(carriesInjected(`${o}-${a}`, cmd)(gha), `missing extra step in ${o}-${a}`)
                }
            }
        },
        // An injected step runs where the job's own commands run. That is not
        // decoration: these jobs stopped installing Node with `setup-node`, so
        // an injected `node tool.mjs` left on the runner would find whatever
        // the image ships rather than the release every other step asserts.
        //
        // Through `bash -e -c`, because a GitHub `run:` is a shell script
        // while the `run` script's `--command "$@"` is an argv. Windows is the
        // exception, and has to be — there is no shell there to put anything
        // in.
        inTheSameShell: () => {
            const cmd = 'echo hello'
            const gha = run(false, () => [test({ run: cmd })])
            for (const o of /** @type {const} */ (['ubuntu', 'macos'])) {
                for (const a of /** @type {const} */ (['intel', 'arm'])) {
                    assert(
                        hasInjected(`${o}-${a}`, cmd)(gha),
                        `expected the extra step in the shell in ${o}-${a}`)
                }
            }
            for (const a of /** @type {const} */ (['intel', 'arm'])) {
                assert(
                    hasExactRunInJob(`windows-${a}`, cmd)(gha),
                    `expected the extra step on the runner in windows-${a}`)
            }
        },
        // The two shapes a bare prefix would have broken, and broken
        // differently: an assignment would become a program name, and an `&&`
        // would split, running the first half in the shell and the second on
        // the runner with nothing said about it. Both survive whole.
        shellSyntaxSurvives: () => {
            for (const cmd of /** @type {const} */ ([
                'NODE_OPTIONS=--max-old-space-size=4096 node tool.mjs',
                'cd nanvm-lib && cargo doc',
                'a | b > c',
            ])) {
                const gha = run(false, () => [test({ run: cmd })])
                assert(
                    hasInjected('ubuntu-arm', cmd)(gha),
                    `expected ${cmd} handed to a shell whole`)
            }
        },
        // `bash`, not `sh`, and `-e`, because that is what GitHub runs a
        // `run:` step as — `bash -e {0}`, from this repository's own job logs.
        //
        // Both halves are load-bearing. `sh` is `dash` on the Ubuntu images,
        // where `[[ … ]]` is not a command; and without `-e`, `false; echo
        // done` exits 0, so a step would be green while the work in it failed.
        // Not `-o pipefail`: that belongs to an explicit `shell: bash`, and
        // these steps declare none, so matching the default is the point.
        matchesTheRunnerShell: () => {
            const cmd = 'false; echo done'
            const gha = run(false, () => [test({ run: cmd })])
            assert(
                hasInjected('ubuntu-arm', cmd)(gha),
                'expected the runner\'s own interpreter and fail-fast flag')
            assert(
                !hasRunInJob('ubuntu-arm', 'sh -c')(gha),
                'unexpected sh: dash would reject bash-only syntax')
            assert(
                !hasRunInJob('ubuntu-arm', 'pipefail')(gha),
                'unexpected pipefail: the default shell does not set it')
        },
        // The command never appears in the line that runs it, so there is no
        // quoting for it to break out of.
        //
        // That is the whole point of the environment variable rather than a
        // nicety of it. GitHub substitutes `${{ … }}` into a step's `run` text
        // before any shell reads it, so a value substituted into a quoted
        // argument can close it — `echo "${{ matrix.name }}"` with a value of
        // `O'Reilly` — and no escape applied here can reach a value that does
        // not exist yet. A `${{ … }}` in the command is therefore *expected*
        // to pass through untouched: it is substituted into an `env` value,
        // which is data.
        //
        // Three commands that would each have needed different escaping, and
        // one line for all of them.
        outsideTheQuoting: () => {
            for (const cmd of /** @type {const} */ ([
                "echo 'hi'",
                'echo "${{ matrix.name }}"',
                'printf %s\\n "a\\"b"',
            ])) {
                const gha = run(false, () => [test({ run: cmd })])
                assert(
                    hasInjected('ubuntu-arm', cmd)(gha),
                    `expected ${cmd} carried as a value rather than as source`)
                assert(
                    !hasRunInJob('ubuntu-arm', cmd)(gha),
                    `unexpected ${cmd} in a command line`)
            }
        },
        // `nodeExtra` takes the OS, and `README.md` advertises that so a
        // caller can branch on it. Nothing else here would notice if the
        // generator stopped passing it: every other proof injects the same
        // step into every job, so `nodeExtra(o)` and `nodeExtra('ubuntu')`
        // would be indistinguishable.
        osSpecific: () => {
            const gha = run(false, o => [test({ run: `echo ${o}` })])
            for (const o of /** @type {const} */ (['ubuntu', 'macos', 'windows'])) {
                for (const a of /** @type {const} */ (['intel', 'arm'])) {
                    assert(
                        carriesInjected(`${o}-${a}`, `echo ${o}`)(gha),
                        `expected the ${o} spelling in ${o}-${a}`)
                }
            }
        },
        // Where an injected step lands, which is the half of "it moved into
        // the shell" that the `run` text cannot express — and which is not
        // symmetric, so both halves are stated.
        //
        // On a shell job it is a test step: after the checkout, because the
        // `run` script it names lives there, and therefore after the job's own
        // `node --test` too, since `toSteps` emits install steps, the checkout,
        // then tests. Declaring `install` no longer means "before the tests"
        // here. On Windows nothing is wrapped, so an `install` step keeps the
        // pre-checkout position that type buys.
        injectedPosition: () => {
            const cmd = 'echo hello'
            const gha = run(false, () => [install({ run: cmd })])
            for (const o of /** @type {const} */ (['ubuntu', 'macos'])) {
                for (const a of /** @type {const} */ (['intel', 'arm'])) {
                    const id = `${o}-${a}`
                    const injected = injectedIndex(id)(gha)
                    const checkout = checkoutIndex(id)(gha)
                    const suite = runIndex(id, nixDevelop(nixShell, 'node --test'))(gha)
                    assert(injected !== -1 && checkout !== -1 && suite !== -1, id)
                    assert(
                        injected > checkout,
                        `expected the injected step after the checkout in ${id}`)
                    assert(
                        injected > suite,
                        `expected the injected step after the suite in ${id}`)
                }
            }
            for (const a of /** @type {const} */ (['intel', 'arm'])) {
                const id = `windows-${a}`
                const declared = runIndex(id, cmd)(gha)
                const checkout = checkoutIndex(id)(gha)
                assert(declared !== -1 && checkout !== -1, id)
                assert(
                    declared < checkout,
                    `expected the injected install step before the checkout in ${id}`)
            }
        },
        // A step naming an action keeps its position and its shape: there is no
        // command to wrap, and an `actions/cache` declared as `install` still
        // runs before the checkout, which is where a cache restore belongs.
        // A command does not keep its position — `toSteps` puts an `install`
        // step before the checkout the flake lives in, which is the one place
        // its runtime is guaranteed wrong now that these jobs have no
        // `setup-node`.
        actionsStayPut: () => {
            const cmd = 'npm install -g something'
            const gha = run(false, () => [
                install({ run: cmd }),
                test(uses('actions/cache')),
            ])
            for (const o of /** @type {const} */ (['ubuntu', 'macos'])) {
                for (const a of /** @type {const} */ (['intel', 'arm'])) {
                    const id = `${o}-${a}`
                    assert(
                        hasInjected(id, cmd)(gha),
                        `expected the install command moved into the shell in ${id}`)
                    assert(
                        gha.jobs[id]?.steps.some(
                            step => step.uses?.startsWith('actions/cache@') === true) === true,
                        `expected the action step kept in ${id}`)
                }
            }
            // Windows has no shell, so both keep their old shape there.
            assert(
                hasExactRunInJob('windows-arm', cmd)(gha),
                'expected the install step unwrapped on Windows')
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
        // Every generated flake: `nixJobs` is what the generator was given, so
        // a family that declares an environment and never has it written fails
        // here. Three — the shared shell, and one apiece for the two Node
        // versions it cannot serve.
        assertEq(nixJobs.length, 3)
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
            [node.default, ['npm ci', 'tsc', 'npm run cov', 'npm pack', 'npm run gen']],
        ])) {
            const id = `node${major(version)}`
            // The two older versions run in a flake of their own, because
            // `npm ci` and `node --test` take whichever `node` reaches `PATH`
            // first and one shell holds one. Node 26's `node` is the shared
            // shell's, so it runs there.
            const shell = version === node.default ? nixShell : id
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
                    `test "$(${runPath(shell)} node --version)" = "v${version}"`,
                    // Node 26 is the one that type-checks and packs, so it is
                    // the one that also asserts a compiler before running
                    // anything.
                    ...(version === node.default
                        ? [`test "$(${runPath(shell)} tsc --version)" = "Version ${typescript.version}"`]
                        : []),
                    ...commands.map(command => nixDevelop(shell, command)),
                    ...(id === `node${major(node.default)}`
                        ? ['git add -A && git diff --cached --exit-code']
                        : []),
                ])
        }
    },
    // Every job with a flake asserts the runtime it is about to use, read from
    // that flake — the four platform jobs included, and they are listed below.
    // The two Windows jobs are not: they run `run` steps under PowerShell,
    // where this POSIX command would not survive. Nothing else ties the
    // versions `fjs/ci/config/module.f.mjs` records to what a job really runs
    // — and for Deno and Bun nothing else could, since `pkgs.deno` and
    // `pkgs.bun` name no version.
    nixVersionChecks: () => {
        // With Rust, because `wasm` is the one job here that a project without
        // a `Cargo.toml` does not get — while its flake is generated either
        // way, since `nixJobs` is a list rather than a function of the project.
        const gha = run(true)
        /**
         * Job, the shell it enters, and what it asserts before running
         * anything.
         *
         * @type {readonly (readonly [string, string, readonly (readonly [string, string])[]])[]}
         */
        const checks = [
            // The two jobs with a flake of their own, each holding the single
            // release its `node --test` resolves from `PATH`.
            [`node${major(node.node22)}`, `node${major(node.node22)}`,
                [['node --version', `v${node.node22}`]]],
            [`node${major(node.node24)}`, `node${major(node.node24)}`,
                [['node --version', `v${node.node24}`]]],
            // Two, because this is the job that type-checks the repository and
            // runs `npm pack`, whose `prepack` emits the declarations the
            // package ships with the same compiler. `typescript-go` names no
            // version, so this check is the whole tie.
            [`node${major(node.default)}`, nixShell, [
                ['node --version', `v${node.default}`],
                ['tsc --version', `Version ${typescript.version}`],
            ]],
            // Deno prints three lines for `--version`, so it is asked for the
            // one field this repository configures.
            ['deno', nixShell, [[`deno eval 'console.log(Deno.version.deno)'`, deno]]],
            // Two, because the shell provides two unversioned attributes. Its
            // Rust is the one thing nothing checks: the flake names that
            // release in full, so a check would restate the flake.
            ['wasm', nixShell, [
                ['wasmtime --version', `wasmtime ${wasmtime}`],
                ['wasmer --version', `wasmer ${wasmer}`],
            ]],
            // Bun prints the bare version, with no leading `v` and no program
            // name. Its check is also the only one confirming that an override
            // took effect rather than that a snapshot is what it claims: the
            // shell's Bun is not the snapshot's.
            ['bun', nixShell, [['bun --version', bun]]],
            // All four platform jobs, in the one shell. These are the only
            // place its three systems other than the canonical runner's are
            // built at all.
            ['ubuntu-intel', nixShell, [['node --version', `v${node.default}`]]],
            ['ubuntu-arm', nixShell, [['node --version', `v${node.default}`]]],
            ['macos-intel', nixShell, [['node --version', `v${node.default}`]]],
            ['macos-arm', nixShell, [['node --version', `v${node.default}`]]],
            // `ubuntu-intel32` asserts nothing, and is the one job entering a
            // flake that does not. The tool it runs is `cargo`, whose release
            // the flake names in full, so a check could only restate the file —
            // the same reason `wasm` does not check its Rust either.
            [i686JobId, nixShell, []],
        ]
        // Between them these name every declared flake, which is what replaced
        // the `dev` job: the shared shell used to be checked in one place
        // because nothing else entered it, and is now checked by each job that
        // does, for the tools that job depends on.
        assertStructurallySame(
            nixJobs.map(job => job.id).filter(id =>
                !checks.some(([, shell]) => shell === id)),
            [])
        for (const [id, shell, jobChecks] of checks) {
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
                    `test "$(${nixDevelop(shell, command)})" = "${expected}"`))
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
                .map(command => nixDevelop(nixShell, command)))
    },
    // Every job's Nix status, in one place — the platform matrix included,
    // which is the thing that changed. Those jobs used to be excluded by
    // construction, on the grounds that they exist to run on stock runner
    // images; five of the seven now enter a flake, so excluding them would
    // leave the half of the workflow this most recently changed unread.
    //
    // The whole set splits in two: the jobs that enter a generated flake, and
    // the three that do not, each with an issue saying why.
    // `fjs/ci/todo/65z-ci-nix.md` holds those reasons together; this is what
    // makes a job added later come and declare which side it is on, instead of
    // joining the second list in silence.
    nixCoverage: () => {
        const gha = run(true)
        const canonical = Object.keys(gha.jobs)
        // Bootstrapping Nix and entering the shell are separate facts, and a
        // job doing only the first is the one that would slip past a check
        // reading either alone. Requiring them to agree job by job is what
        // lets the split below mean what it says.
        for (const id of canonical) {
            const job = gha.jobs[id]
            assertEq(flakesEntered(job).length !== 0, installsNix(job), id)
        }
        const declared = nixJobs.map(job => job.id)
        // Exactly one shell per job. Two would mean a job whose commands ran in
        // different environments from one step to the next, which is the shape
        // sharing makes newly possible and which nothing else here would catch.
        for (const id of canonical.filter(id => installsNix(gha.jobs[id]))) {
            assertEq(flakesEntered(gha.jobs[id]).length, 1, id)
        }
        // Every declared flake is entered by some job. A flake nothing enters
        // is never evaluated, so it would rot unnoticed — which is exactly what
        // the deleted `dev` job used to prevent for the shell, and what every
        // job entering that shell now does instead.
        const entered = canonical.flatMap(id => flakesEntered(gha.jobs[id]))
        for (const id of declared) {
            assert(entered.includes(id), `expected some job to enter ${id}`)
        }
        // The reverse holds by construction — `flakesEntered` filters the
        // declared list — so what is left to state is that the list itself has
        // no repeats. A repeated declaration is a defect in its own right:
        // `nixFlakes` would write the same file twice.
        assert(
            declared.every((id, i) => declared.indexOf(id) === i),
            'duplicate flake declaration')
        // The split the whole arrangement rests on. Node 22 and Node 24 run
        // `npm ci` and `node --test`, which take whichever `node` reaches
        // `PATH` first, so each needs a shell holding exactly one release.
        // Every other job names its runtime and shares.
        assertStructurallySame(
            declared.filter(id => entered.filter(e => e === id).length > 1),
            [nixShell])
        for (const id of declared.filter(id => id !== nixShell)) {
            assertStructurallySame(
                canonical.filter(job => flakesEntered(gha.jobs[job]).includes(id)),
                [id],
                `expected only ${id} to enter its own flake`)
        }
        // The whole of what is left off Nix, named rather than counted. Each
        // entry is a fact about the job, and a fourth appearing here without a
        // reason is what this is for.
        const offNix = canonical.filter(id => !installsNix(gha.jobs[id]))
        /** @type {readonly string[]} */
        const expectedOffNix = [
            // Nix does not run natively on Windows. That is the whole of what
            // is left: every other job in this workflow enters a flake.
            'windows-intel',
            'windows-arm',
            // `package-check` runs with no checkout, so there is no file tree
            // for a flake or its `run` script to be in.
            packageCheckJobId,
        ]
        // Both directions rather than a list comparison: the workflow is read
        // back through `parseGitHubAction`, which does not promise to hand the
        // job names back in the order they were written, and this is a question
        // about which jobs rather than about their order.
        assertEq(offNix.length, expectedOffNix.length, offNix.join(' '))
        for (const id of expectedOffNix) {
            assert(offNix.includes(id), `expected ${id} off Nix`)
        }
        for (const id of offNix) {
            assert(expectedOffNix.includes(id), `unexplained job off Nix: ${id}`)
        }
        // The four that joined the shared shell cover every system it declares.
        // `ubuntu-intel` is its `x86_64-linux`, the two macOS jobs its two
        // Darwin systems, and `ubuntu-arm` the `aarch64-linux` the canonical
        // jobs already built. Before this, three of the four were generated as
        // text and built nowhere.
        for (const id of /** @type {const} */ ([
            'ubuntu-intel',
            'ubuntu-arm',
            'macos-intel',
            'macos-arm',
        ])) {
            assertStructurallySame(flakesEntered(gha.jobs[id]), [nixShell])
        }
        // And the 32-bit job enters the same shell, from the one system that
        // can carry what it needs. It used to have a flake of its own, on the
        // grounds that `pkgsi686Linux` throws everywhere else — which is a
        // reason for that system's shell to hold more, not for this job to
        // have an environment of its own. Asserted here because it is the
        // property that would rot silently: the job would still pass on a
        // flake that had quietly become a second environment.
        assertStructurallySame(flakesEntered(gha.jobs[i686JobId]), [nixShell])
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
                .map(command => nixDevelop(nixShell, command)))
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
            step => step.run === nixDevelop(nixShell, 'npm pack'))
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
    /**
     * The second file the pipeline writes. Its shape is proved beside the
     * module, in `fjs/ci/publish/proof.f.mjs`; what only the pipeline can show
     * is that the file lands at the declared path and survives the round-trip —
     * a workflow emitted past the schema would parse back to something else, or
     * not at all.
     */
    publishWorkflow: () => {
        const [state, result] = virtual(makeState(true, runPackageJson))(main())
        assertEq(exitCode(result), 0)
        // The path is a constant of the module rather than a literal here, so
        // the two cannot name different files.
        assertEq(npmPublishPath, '.github/workflows/npm-publish.yml')
        assertStructurallySame(
            workflowFile(state, 'npm-publish.yml'),
            npmPublishWorkflow)
        // Two workflows, kept apart. `ci.yml` gates a pull request and must
        // never publish; the publish workflow runs one job and none of the
        // matrix. Both would be true of a single file that merged them, and
        // neither is what this generator writes.
        const gha = workflow(state)
        assert(!hasRun('npm publish')(gha), 'unexpected publish step in the CI workflow')
        assertEq(gha.jobs[npmPublishJobId], undefined)
        assertEq(npmPublishWorkflow.jobs[packageCheckJobId], undefined)
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
