/**
 * @import { Job, MetaStep, Os, GitHubAction, Step } from './common/types.ts'
 * @import { Dir, State } from '../effects/node/virtual/types.ts'
 * @import { Unknown } from '../media/datajs/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { ci, ciPath, main } from './module.f.mjs'
import { actions, bun, deno, functionalscript, images, jobTimeout, node, spidermonkey, typescript, wasmer, wasmtime } from './config/module.f.js'
import { main as ownMain, packageConsumer } from './self/module.f.mjs'
import { installNode, major, packageJobId } from './node/module.f.mjs'
import { devNixJob } from './dev/module.f.mjs'
import { flakePath, flakeText, nixDevelop } from './nix/module.f.mjs'
import { consumerDirectory, packageCheckSteps } from './package/module.f.mjs'
import { npmPublishJobId, npmPublishPath, npmPublishWorkflow } from './publish/module.f.mjs'
import { rustPlatformCommands } from './rust/module.f.mjs'
import { utf8 } from '../text/module.f.mjs'
import { utf8ToString } from '../text/utf8/module.f.mjs'
import { empty as emptyVec } from '../types/bit_vec/module.f.mjs'
import { install, test, ubuntu, uses, parseGitHubAction } from './common/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.js'
import { virtualAt } from '../effects/node/virtual/module.f.mjs'
import { unwrap } from '../types/result/module.f.js'
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
 * Whether a job actually enters the shared shell through `sh ./gen.nix/run`.
 *
 * Deliberately not the same question as `installsNix`. A job could install Nix
 * and then run its commands on the runner's own toolchain: it would look
 * migrated, its flake would never be evaluated, and the runtime it tested would
 * be whatever the image happened to ship. Nothing else would notice, because
 * the version check is the step that would have caught it and it is one of the
 * steps that would be missing.
 *
 * The step's **command** is its first two fields, which is what a `run:` line
 * is: one command (root `AGENTS.md` §7), and `nixSteps` writes `sh` and the
 * script's path as that command. So this compares those fields rather than
 * searching the line — a step that merely names the path,
 * `echo ./gen.nix/run`, is not entry and is not counted. Neither is the
 * version check, whose command is `test` and which reaches the script inside
 * a substitution; a job whose only mention of its flake were that would fail
 * here, which is the right answer rather than a gap.
 *
 * @type {(job: Job | undefined) => boolean}
 */
const entersFlake = job =>
    job?.steps.some(step => step.run?.startsWith(nixDevelop('')) === true) === true

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
const injectedLine = nixDevelop('bash -e -c "$FJS_CI_RUN"')

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

/** @type {(rust: boolean, packageJson: string | undefined) => Dir} */
const makeRoot = (rust, packageJson) => ({
    ...(packageJson !== undefined ? { 'package.json': [utf8(packageJson)] } : {}),
    ...(rust ? { 'Cargo.toml': [emptyVec] } : {}),
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
const workflow = state => workflowFile(state, 'gen.ci.yml')

/** @type {(state: State) => string} */
const flake = state =>
    text(path(state.root, flakePath().slice('./'.length).split('/')), 'flake.nix')

// A compiler pin no configuration anywhere holds, written into the fixture
// project's `package.json` so that the generator can be shown to ignore it.
// The packed-package check installs `./config/module.f.js`'s version; an
// assertion that found this one instead would have found a generator reading
// the project's dependencies, which is what this change stopped doing.
const runPin = /** @type {const} */ ('=9.9.9')

const runPackageJson = `{"name":"other-package","devDependencies":{"typescript":"${runPin}"}}`

/** @type {(rust: boolean, nodeExtra?: (o: Os) => readonly MetaStep[]) => GitHubAction} */
const run = (rust, nodeExtra = () => []) => {
    const [state, result] = virtualAt(makeRoot(rust, runPackageJson))(ci({ nodeExtra }))
    assertEq(exitCode(result), 0)
    return workflow(state)
}

/** @type {(packageJson?: string) => GitHubAction} */
const runDefault = packageJson => {
    const [state, result] = virtualAt(makeRoot(false, packageJson))(main())
    assertEq(exitCode(result), 0)
    return workflow(state)
}

export const proof = {
    matrixShape: () => {
        const gha = run(true)
        assertEq(Object.keys(gha.jobs).length, 9, 'expected 9 CI jobs')
        assertEq(gha.permissions.contents, 'read', 'expected read-only contents permission')
        assertEq(Object.keys(gha.permissions).length, 1, 'expected least-privilege workflow permissions')
        // A push to a pull request cancels the run it supersedes.
        assertEq(gha.concurrency?.group, '${{ github.workflow }}-${{ github.ref }}')
        assertEq(gha.concurrency?.['cancel-in-progress'], true)
        // The 32-bit Linux checks, in the Intel Linux job, because that is the
        // one platform whose shell carries the target and the linker for it.
        // They had a job of their own while they needed a second environment;
        // what is asserted now is that folding it back in kept all four.
        assert(hasRunInJob('ubuntu-intel', 'cargo test --target i686-unknown-linux-gnu')(gha), 'expected 32-bit Linux check')
        assert(hasRunInJob('ubuntu-intel', 'cargo test --target i686-unknown-linux-gnu --release')(gha), 'expected 32-bit Linux release check')
        assert(hasRunInJob('ubuntu-intel', 'cargo clippy --target i686-unknown-linux-gnu -- -D warnings')(gha), 'expected 32-bit Linux lint')
        assert(hasRunInJob('ubuntu-intel', 'cargo clippy --target i686-unknown-linux-gnu --release -- -D warnings')(gha), 'expected 32-bit Linux release lint')
        // And in no other platform job: `pkgsi686Linux` throws on every system
        // but that one, so a 32-bit check anywhere else is a job whose shell
        // could not be built.
        for (const id of /** @type {const} */ (['ubuntu-arm', 'macos-intel', 'macos-arm'])) {
            assert(!hasRunInJob(id, '--target i686')(gha), `unexpected 32-bit check in ${id}`)
        }
        assert(hasRunInJob('ubuntu-arm', 'cargo test --release')(gha), 'expected native platform Rust release check')
        assert(hasRunInJob('ubuntu-arm', 'cargo clippy -- -D warnings')(gha), 'expected native platform Rust lint')
        assert(hasRunInJob('ubuntu-arm', 'cargo clippy --release -- -D warnings')(gha), 'expected native platform Rust release lint')
        // The WASM checks, in the ARM Linux job, which runs on the image and in
        // the shell the `wasm` job they used to be had. The formatting check
        // came with them, and is in no other job.
        assert(hasExactRunInJob('ubuntu-arm', nixDevelop('cargo fmt -- --check'))(gha), 'expected the formatting check')
        assert(hasRunInJob('ubuntu-arm', 'cargo test --target wasm32-wasip1 --release')(gha), 'expected target-specific WASM release check')
        assert(hasRunInJob('ubuntu-arm', 'cargo clippy --target wasm32-wasip1 -- -D warnings')(gha), 'expected target-specific WASM Rust lint')
        assert(hasRunInJob('ubuntu-arm', 'cargo clippy --target wasm32-wasip1 --release -- -D warnings')(gha), 'expected target-specific WASM release lint')
        for (const id of /** @type {const} */ (['ubuntu-intel', 'macos-intel', 'macos-arm', 'windows-intel', 'windows-arm'])) {
            assert(!hasRunInJob(id, 'wasm32')(gha), `unexpected WASM check in ${id}`)
            assert(!hasRunInJob(id, 'cargo fmt')(gha), `unexpected formatting check in ${id}`)
        }
        // Wasmtime 47 removed wasi-threads: the threads target must run under
        // Wasmer only, while Clippy (no runner) stays. The negative half
        // compares the whole `run` line, wrapper included: against the bare
        // `cargo` command it could not fail, since every step is wrapped.
        assert(hasRunInJob('ubuntu-arm', 'cargo test --target wasm32-wasip1-threads --config .cargo/config.wasmer.toml')(gha), 'expected Wasmer WASM threads check')
        assert(hasRunInJob('ubuntu-arm', 'cargo clippy --target wasm32-wasip1-threads -- -D warnings')(gha), 'expected WASM threads lint')
        assert(!hasExactRunInJob('ubuntu-arm', nixDevelop('cargo test --target wasm32-wasip1-threads'))(gha), 'unexpected Wasmtime WASM threads check')
        assert(!hasExactRunInJob('ubuntu-arm', nixDevelop('cargo test --target wasm32-wasip1-threads --release'))(gha), 'unexpected Wasmtime WASM threads release check')
        assertStructurallySame(
            Object.keys(gha.jobs).filter(id => id.startsWith('node')),
            [packageJobId])
        assert(hasRunInJob(packageJobId, 'npm pack')(gha), 'expected canonical Node package check')
        assert(hasRunInJob(packageJobId, 'npm run gen')(gha), 'expected canonical Node workflow regeneration')
        assert(hasRunInJob(packageJobId, 'git add -A && git diff --cached --exit-code')(gha), 'expected canonical Node generated-file drift check')
        assert(!hasRun('npm publish --dry-run')(gha), 'unexpected npm publish dry-run')
        // `npm ci` belongs to the jobs that need what it installs, and to no
        // others. The canonical Node job type-checks, packs and runs the suite;
        // the four working-checkout platform jobs run the suite too.
        // `deno` and `bun` install through their own package managers.
        for (const id of /** @type {const} */ ([
            packageJobId,
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
        // And in the three Nix platform jobs, in that order. The version check goes
        // first because `npm ci` runs `preinstall`/`install`/`postinstall`
        // hooks from the project and its dependencies — code that should not be
        // the thing that discovers which runtime it is on. `node --test` goes
        // last because it is what `npm ci` installs the tree for.
        for (const id of /** @type {const} */ ([
            'ubuntu-intel',
            'ubuntu-arm',
            'macos-arm',
        ])) {
            const check = runIndex(
                id,
                `test "$(${nixDevelop('node --version')})" = "v${node}"`)(gha)
            const install = runIndex(id, nixDevelop('npm ci'))(gha)
            const suite = runIndex(id, nixDevelop('node --test'))(gha)
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
            'macos-arm',
        ])) {
            assert(
                gha.jobs[id]?.steps.every(
                    step => step.uses?.startsWith('dtolnay/rust-toolchain@') !== true) === true,
                `unexpected runner toolchain in ${id}`)
        }
        // The direct-install jobs get Rust from the shared toolchain action.
        for (const id of /** @type {const} */ (['macos-intel', 'windows-intel', 'windows-arm'])) {
            assert(
                gha.jobs[id]?.steps.some(
                    step => step.uses?.startsWith('dtolnay/rust-toolchain@') === true) === true,
                `expected a runner toolchain in ${id}`)
        }
    },
    intelMacDirectTools: () => {
        for (const rust of [false, true]) {
            const gha = run(rust)
            const job = gha.jobs['macos-intel']
            assert(job !== undefined, 'expected the Intel macOS job')
            assertEq(job['runs-on'], images.macos.intel)
            assert(!installsNix(job), 'unexpected Intel macOS Nix installer')
            assert(!entersFlake(job), 'unexpected Intel macOS shell commands')
            assertStructurallySame(job.steps, [
                ...(rust ? [uses('dtolnay/rust-toolchain', { components: 'rustfmt,clippy' })] : []),
                installNode(),
                uses('actions/checkout'),
                { run: `test "$(node --version)" = "v${node}"` },
                { run: 'npm ci' },
                ...(rust ? rustPlatformCommands.map(run => ({ run })) : []),
                { run: 'node --test' },
            ])
            // ARM macOS retains both its Nix installer and shell commands.
            const arm = gha.jobs['macos-arm']
            assert(installsNix(arm), 'expected ARM macOS to keep Nix')
            assert(entersFlake(arm), 'expected ARM macOS shell commands')
            assertEq(arm?.['runs-on'], images.macos.arm)
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
        // while the `run` script's `--command "$@"` is an argv. Intel macOS and Windows keep commands on the
        // runner, where the pinned tools are installed directly.
        inTheSameShell: () => {
            const cmd = 'echo hello'
            const gha = run(false, () => [test({ run: cmd })])
            for (const [o, a] of /** @type {const} */ ([
                ['ubuntu', 'intel'], ['ubuntu', 'arm'], ['macos', 'arm'],
            ])) {
                assert(
                    hasInjected(`${o}-${a}`, cmd)(gha),
                    `expected the extra step in the shell in ${o}-${a}`)
            }
            for (const id of /** @type {const} */ ([
                'macos-intel', 'windows-intel', 'windows-arm',
            ])) {
                assert(
                    hasExactRunInJob(id, cmd)(gha),
                    `expected the extra step on the runner in ${id}`)
            }
        },
        // The two shapes a bare prefix would have broken, and broken
        // differently: an assignment would become a program name, and an `&&`
        // would split, running the first half in the shell and the second on
        // the runner with nothing said about it. Both survive whole.
        shellSyntaxSurvives: () => {
            for (const cmd of /** @type {const} */ ([
                'NODE_OPTIONS=--max-old-space-size=4096 node tool.mjs',
                'cd nanvm/lib && cargo doc',
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
        // here. On direct-install platforms nothing is wrapped, so an
        // `install` step keeps the pre-checkout position that type buys.
        injectedPosition: () => {
            const cmd = 'echo hello'
            const gha = run(false, () => [install({ run: cmd })])
            for (const [o, a] of /** @type {const} */ ([
                ['ubuntu', 'intel'], ['ubuntu', 'arm'], ['macos', 'arm'],
            ])) {
                const id = `${o}-${a}`
                const injected = injectedIndex(id)(gha)
                const checkout = checkoutIndex(id)(gha)
                const suite = runIndex(id, nixDevelop('node --test'))(gha)
                assert(injected !== -1 && checkout !== -1 && suite !== -1, id)
                assert(
                    injected > checkout,
                    `expected the injected step after the checkout in ${id}`)
                assert(
                    injected > suite,
                    `expected the injected step after the suite in ${id}`)
            }
            for (const id of /** @type {const} */ ([
                'macos-intel', 'windows-intel', 'windows-arm',
            ])) {
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
            for (const [o, a] of /** @type {const} */ ([
                ['ubuntu', 'intel'], ['ubuntu', 'arm'], ['macos', 'arm'],
            ])) {
                const id = `${o}-${a}`
                assert(
                    hasInjected(id, cmd)(gha),
                    `expected the install command moved into the shell in ${id}`)
                assert(
                    gha.jobs[id]?.steps.some(
                        step => step.uses?.startsWith('actions/cache@') === true) === true,
                    `expected the action step kept in ${id}`)
            }
            // Windows has no shell, so both keep their old shape there.
            assert(
                hasExactRunInJob('windows-arm', cmd)(gha),
                'expected the install step unwrapped on Windows')
            assert(hasExactRunInJob('macos-intel', cmd)(gha),
                'expected the install step unwrapped on Intel macOS')
            assert(gha.jobs['macos-intel']?.steps.some(
                step => step.uses?.startsWith('actions/cache@') === true) === true,
                'expected the action step kept on Intel macOS')
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
    // The shared flake lands at the path every shell step enters. Equality
    // reads the complete generated shell, including every tool and platform.
    nixFlake: () => {
        const [state, result] = virtualAt(makeRoot(false, undefined))(main())
        assertEq(exitCode(result), 0)
        assertEq(flake(state), flakeText(devNixJob))
        assertEq(devNixJob.packages[0], `nodejs_${major(node)}`)
        // No version-specific directories remain beside the shared shell.
        const files = Object.keys(path(state.root, flakePath().slice('./'.length).split('/')))
        assertEq(files.length, 3)
        for (const file of /** @type {const} */ (['flake.nix', 'lock-update.sh', 'run'])) {
            assert(files.includes(file), `expected ${file} in the shared shell`)
        }
    },
    // The canonical Node job enters the shared shell. The packed-package
    // check closes it behind setup-node, with a consumer's Node.
    migratedNodeJob: () => {
        const gha = run(false)
        const job = gha.jobs[packageJobId]
        assert(job !== undefined, 'expected the canonical Node job')
        assert(installsNix(job), 'expected a pinned Nix installer')
        const check = [installNode({ 'package-manager-cache': 'false' }), ...packageCheckSteps(undefined)]
        const own = job.steps.slice(0, job.steps.length - check.length)
        assertStructurallySame(job.steps.slice(own.length), check)
        assert(
            !own.some(step => step.uses?.startsWith('actions/setup-node@') === true),
            'unexpected setup-node before the consumer check')
        // Each tool command enters the shell separately. mkdir prepares the
        // consumer directory; the final git command compares the whole tree.
        assertStructurallySame(
            own.flatMap(step => step.run === undefined ? [] : [step.run]),
            [
                `test "$(${nixDevelop('node --version')})" = "v${node}"`,
                `test "$(${nixDevelop('tsc --version')})" = "Version ${typescript.version}"`,
                ...['npm ci', 'tsc', 'npm start compile', 'npm run cov'].map(nixDevelop),
                `mkdir ${consumerDirectory}`,
                nixDevelop(`npm pack --pack-destination ${consumerDirectory}`),
                nixDevelop('npm run gen'),
                'git add -A && git diff --cached --exit-code',
            ])
    },
    // Every job with a flake asserts the runtime it is about to use, read from
    // that flake — the three Nix platform jobs included, listed below.
    // The two Windows jobs are not: they run `run` steps under PowerShell,
    // where this POSIX command would not survive. Nothing else ties the
    // versions `fjs/ci/config/module.f.js` records to what a job really runs
    // — and for Deno and Bun nothing else could, since `pkgs.deno` and
    // `pkgs.bun` name no version.
    nixVersionChecks: () => {
        // With Rust, because the WASM runtimes are checked only where `cargo`
        // runs, and a project without a `Cargo.toml` runs none — while the
        // shell is generated whole either way.
        const gha = run(true)
        /**
         * Job and what it asserts before running anything.
         *
         * @type {readonly (readonly [string, readonly (readonly [string, string])[]])[]}
         */
        const checks = [
            // Two, because this is the job that type-checks the repository and
            // runs `npm pack`, whose `prepack` emits the declarations the
            // package ships with the same compiler. `typescript-go` names no
            // version, so this check is the whole tie.
            [packageJobId, [
                ['node --version', `v${node}`],
                ['tsc --version', `Version ${typescript.version}`],
            ]],
            // Deno prints three lines for `--version`, so it is asked for the
            // one field this repository configures.
            ['deno', [[`deno eval 'console.log(Deno.version.deno)'`, deno]]],
            // Bun prints the bare version, with no leading `v` and no program
            // name. Its check is also the only one confirming that an override
            // took effect rather than that a snapshot is what it claims: the
            // shell's Bun is not the snapshot's.
            ['bun', [['bun --version', bun]]],
            // The three Nix platform jobs, in the one shell. These are the only
            // place its two systems other than the canonical runner's are
            // built at all.
            // `ubuntu-intel` runs the 32-bit checks too, and asserts nothing
            // more for them: the tool they run is `cargo`, whose release the
            // flake names in full, so a check would restate the flake.
            ['ubuntu-intel', [['node --version', `v${node}`]]],
            // `ubuntu-arm` runs the WASM checks, so it asserts the two
            // runtimes `cargo` hands their binaries to as well — unversioned
            // attributes of the shell, unlike its Rust. It runs the suite on
            // SpiderMonkey too, whose attribute names only the major version.
            ['ubuntu-arm', [
                ['node --version', `v${node}`],
                ['wasmtime --version', `wasmtime ${wasmtime}`],
                ['wasmer --version', `wasmer ${wasmer}`],
                ['js --version', `JavaScript-C${spidermonkey.version}`],
            ]],
            ['macos-arm', [['node --version', `v${node}`]]],
        ]
        // Every job entering the shared shell checks the tools it depends on.
        const shellJobs = Object.keys(gha.jobs).filter(id => entersFlake(gha.jobs[id]))
        assertEq(shellJobs.length, checks.length)
        for (const id of shellJobs) {
            assert(checks.some(([checkedId]) => checkedId === id), `expected version checks in ${id}`)
        }
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
                    `test "$(${nixDevelop(command)})" = "${expected}"`))
        }
    },
    // Deno, step for step, with every command entering the shared shell.
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
                .map(command => nixDevelop(command)))
    },
    // Every job enters the shared shell except Intel macOS and the two Windows
    // jobs, which install tools directly. Keep these explicit so a new job
    // cannot silently use the runner's tools.
    nixCoverage: () => {
        const gha = run(true)
        const canonical = Object.keys(gha.jobs)
        // Bootstrapping Nix and entering the shell are separate facts, and a
        // job doing only the first is the one that would slip past a check
        // reading either alone. Requiring them to agree job by job is what
        // lets the split below mean what it says.
        for (const id of canonical) {
            const job = gha.jobs[id]
            assertEq(entersFlake(job), installsNix(job), id)
        }
        // The whole of what is left off Nix, named rather than counted. Each
        // entry is a fact about the job, and a third appearing here without a
        // reason is what this is for.
        const offNix = canonical.filter(id => !installsNix(gha.jobs[id]))
        /** @type {readonly string[]} */
        const expectedOffNix = [
            // Intel macOS needs only Node and native Rust, installed directly.
            'macos-intel',
            // Nix does not run natively on Windows.
            'windows-intel',
            'windows-arm',
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
        // The three jobs on the shared shell cover every system it declares.
        // `ubuntu-intel` is its `x86_64-linux`, ARM macOS its
        // Darwin system, and `ubuntu-arm` the `aarch64-linux` the canonical
        // jobs already built. Before this, two of the three were generated as
        // text and built nowhere.
        for (const id of /** @type {const} */ ([
            'ubuntu-intel',
            'ubuntu-arm',
            'macos-arm',
        ])) {
            assert(entersFlake(gha.jobs[id]), `expected ${id} to enter the shared shell`)
        }
    },
    // Bun enters the shared shell, whose Bun is pinned outside Nixpkgs.
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
                .map(command => nixDevelop(command)))
    },
    ubuntu: () => {
        const job = ubuntu([test({ run: 'echo hi' })])
        assert(job['runs-on'] !== undefined, 'expected runs-on')
        assert(job.steps.length > 0, 'expected steps')
    },
    // The packed-package check is the last steps of the job that packs, not a
    // job waiting on it: a waiting job is created only when the job it waits
    // for finishes, so behind a full runner queue it waited a second time. The
    // check's own shape is proved next to the module, in
    // `fjs/ci/package/proof.f.mjs`; what only the assembled job can show is
    // the order its steps need and that nothing hands the tarball across jobs.
    packageCheck: () => {
        // Both shapes: the built-in generator's check, which names no
        // consumer, and the one this repository ships, which does.
        const [own, ownResult] = virtualAt(makeRoot(false, runPackageJson))(ownMain())
        assertEq(exitCode(ownResult), 0)
        for (const gha of [run(false), workflow(own)]) {
            const job = gha.jobs[packageJobId]
            assert(job !== undefined, 'expected the canonical Node job')
            assertEq(packageJobId, `node${major(node)}`)
            /** @type {(f: (step: Step) => boolean) => number} */
            const at = f => job.steps.findIndex(f)
            const made = at(step => step.run === `mkdir ${consumerDirectory}`)
            const packed = at(step => step.run === nixDevelop(`npm pack --pack-destination ${consumerDirectory}`))
            const drift = at(step => step.run === 'git add -A && git diff --cached --exit-code')
            const setup = at(step => step.uses === `actions/setup-node@${actions['actions/setup-node']}`)
            assert(made !== -1 && packed !== -1 && drift !== -1 && setup !== -1, 'expected the directory made, the tarball packed into it, the drift check and the consumer\'s Node')
            // The directory exists before `npm pack` writes into it, which it
            // refuses to do otherwise; and the drift check, the last word on
            // the tree, comes before every step of the check — which all
            // start outside the tree, after the one that puts a consumer's
            // Node on `PATH`.
            assert(made < packed && packed < drift && drift < setup, 'expected mkdir, pack, drift check, then the check')
            // The consumer's Node is the pinned one, and `setup-node` is told
            // not to restore an npm cache: it would decide that from the
            // checkout's `package.json`, making the consumer's setup depend
            // on the repository it consumes.
            assertEq(job.steps[setup]?.with?.['node-version'], node)
            assertEq(job.steps[setup]?.with?.['package-manager-cache'], 'false')
            const check = job.steps.slice(setup + 1)
            assert(check.length !== 0, 'expected the check after its Node')
            for (const step of check) {
                assert(step['working-directory'] !== undefined, `expected the consumer directory: ${step.run}`)
            }
            // Nothing before the check starts outside the checkout.
            assert(
                job.steps.slice(0, setup).every(step => step['working-directory'] === undefined),
                'unexpected working-directory before the check')
            // The compiler is the CI configuration's — the same version the
            // shell provides, so the declarations in the tarball are read by
            // the compiler that emitted them. Its exactness is proved next to
            // the module, in `fjs/ci/package/proof.f.mjs`.
            assert(
                check.some(step => step.run?.includes(`"typescript@${typescript.version}"`) === true),
                'expected the configured compiler installed')
            // No artifact: the tarball never leaves the job that packed it.
            assert(
                !definedValues(gha.jobs).some(j => j.steps.some(step =>
                    step.uses?.startsWith('actions/upload-artifact@') === true
                    || step.uses?.startsWith('actions/download-artifact@') === true)),
                'unexpected artifact hand-off')
        }
    },
    // The consumer half of the check is the caller's, through `Setup`: a
    // project that names none gets the declaration check alone, since the
    // generator cannot know what another package publishes. The built-in
    // `fjs ci` is that generator, so its `main` names none; this repository's
    // own generation, `./self`, names its module. Proved on the assembled
    // workflow, because the wiring from `Setup` to `node26` is what only the
    // assembly shows.
    packageConsumerIsTheCallersToName: () => {
        /** @type {(job: Job | undefined) => boolean} */
        const hasConsumer = job => job?.steps.some(step => step.run?.includes(' good.mts') === true) === true
        assert(!hasConsumer(run(false).jobs[packageJobId]), 'expected no consumer step without a consumer in Setup')
        const [state, result] = virtualAt(makeRoot(false, runPackageJson))(ci({ nodeExtra: () => [], packageConsumer }))
        assertEq(exitCode(result), 0)
        assert(hasConsumer(workflow(state).jobs[packageJobId]), 'expected the consumer step when Setup names one')
        const [builtIn, builtInResult] = virtualAt(makeRoot(false, runPackageJson))(main())
        assertEq(exitCode(builtInResult), 0)
        assert(!hasConsumer(workflow(builtIn).jobs[packageJobId]), 'expected the built-in command to name no consumer')
        const [own, ownResult] = virtualAt(makeRoot(false, runPackageJson))(ownMain())
        assertEq(exitCode(ownResult), 0)
        assert(hasConsumer(workflow(own).jobs[packageJobId]), 'expected this repository\'s own generation to name its consumer')
    },
    // The check used to appear, as a job of its own, only when the project's
    // `package.json` pinned an exact compiler, and it is now generated for
    // every project — there is no longer anything about the project for it to
    // depend on. So the shapes that once removed it must not: a `package.json`
    // that is missing, unparseable, or says nothing about TypeScript still
    // gets the packed-package check, because the compiler no longer comes
    // from there.
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
            const [state, result] = virtualAt(makeRoot(false, packageJson))(ci({ nodeExtra: () => [] }))
            assertEq(exitCode(result), 0)
            const job = workflow(state).jobs[packageJobId]
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
        const [state, result] = virtualAt(makeRoot(true, runPackageJson))(main())
        assertEq(exitCode(result), 0)
        // The path is a constant of the module rather than a literal here, so
        // the two cannot name different files.
        assertEq(ciPath, '.github/workflows/gen.ci.yml')
        assertEq(npmPublishPath, '.github/workflows/gen.npm-publish.yml')
        assertStructurallySame(
            workflowFile(state, 'gen.npm-publish.yml'),
            npmPublishWorkflow)
        // Two workflows, kept apart. `gen.ci.yml` gates a pull request and must
        // never publish; the publish workflow runs one job and none of the
        // matrix. Both would be true of a single file that merged them, and
        // neither is what this generator writes.
        const gha = workflow(state)
        assert(!hasRun('npm publish')(gha), 'unexpected publish step in the CI workflow')
        assertEq(gha.jobs[npmPublishJobId], undefined)
        assertEq(npmPublishWorkflow.jobs[packageJobId], undefined)
    },
    /**
     * The jobs of the named platforms run in the merge queue only; every other
     * job, and every job by default, runs on a pull request too. Read back
     * through `workflow`, so the condition also survives the schema.
     */
    mergeQueueOnly: () => {
        const [state, result] = virtualAt(makeRoot(true, runPackageJson))(
            ci({ nodeExtra: () => [], mergeQueueOnly: ['macos', 'windows'] }))
        assertEq(exitCode(result), 0)
        const jobs = workflow(state).jobs
        /** @type {(id: string) => boolean} */
        const queued = id => id.startsWith('macos-') || id.startsWith('windows-')
        for (const [id, job] of Object.entries(jobs)) {
            assertEq(
                job?.if,
                queued(id) ? `github.event_name == 'merge_group'` : undefined,
                id)
        }
        assertEq(Object.keys(jobs).filter(queued).length, 4, 'expected two macOS and two Windows jobs')
        assertEq(definedValues(run(true).jobs).filter(job => job.if !== undefined).length, 0)
    },
    /**
     * Every job either workflow generates holds its runner for at most
     * `jobTimeout` minutes, rather than GitHub's six hours. Read back through
     * `workflow`, so the limit also survives the schema — which refuses a job
     * without one.
     */
    jobTimeout: () => {
        for (const gha of [run(true), npmPublishWorkflow]) {
            for (const [id, job] of Object.entries(gha.jobs)) {
                assertEq(job?.['timeout-minutes'], jobTimeout, id)
            }
        }
        assertEq(parseGitHubAction({
            name: 'test',
            on: {},
            permissions: { contents: 'read' },
            jobs: { check: { 'runs-on': 'ubuntu-latest', steps: [{ run: 'echo hi' }] } },
        })[0], 'error')
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
            pack: { 'runs-on': 'ubuntu-latest', 'timeout-minutes': 15, steps },
            check: { 'runs-on': 'ubuntu-latest', 'timeout-minutes': 15, needs: ['pack'], steps },
        })))
        assertEq(ordered.jobs.check?.needs?.[0], 'pack')
        assertEq(ordered.jobs.check?.needs?.length, 1)
        // Optional: the independent jobs, which is all of them today, still parse.
        assertEq(unwrap(parseGitHubAction(action({
            pack: { 'runs-on': 'ubuntu-latest', 'timeout-minutes': 15, steps },
        }))).jobs.pack?.needs, undefined)
        // Constrained, not merely accepted. GitHub also allows a bare scalar
        // (`needs: pack`); this generator emits the list form only, so the
        // scalar is drift rather than an alternative spelling — the same reason
        // these schemas are closed.
        assertEq(parseGitHubAction(action({
            check: { 'runs-on': 'ubuntu-latest', 'timeout-minutes': 15, needs: 'pack', steps },
        }))[0], 'error')
        // No job orders itself. The packed-package check did, and paid for
        // it: GitHub creates a waiting job only when the job it waits for has
        // finished, so whenever the runner queue was full it joined the back
        // and waited a second time. Its steps close the job that packs now.
        // Pinning the count keeps an ordering edge a deliberate change rather
        // than something that appears unnoticed — ordering is where a
        // workflow starts to have a shape that has to be reasoned about, and
        // where it starts paying for the queue twice.
        const orderedJobs = definedValues(run(false).jobs).filter(job => job.needs !== undefined)
        assertEq(orderedJobs.length, 0, 'unexpected job ordering in the generated workflow')
    },
}
