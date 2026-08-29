/**
 * Generates one self-contained Nix flake per declared CI job.
 *
 * Each job gets its own `nix/<id>/flake.nix` pinning the exact
 * Nixpkgs commit from `../config/module.f.mjs` and exposing a single
 * `devShells.<system>.default` development shell. The files are static and
 * readable on purpose: no job selection, no shared Nix modules, no helper
 * libraries.
 *
 * See `./types.ts` for the `NixJob` type-level API.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 * @import { IoChannel, Mkdir, WriteFile } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Expression } from '../../media/nix/types.ts'
 * @import { NixJob } from './types.ts'
 */

import { pureOk } from '../../effects/module.f.mjs'
import { mkdir, writeUtf8File } from '../../effects/node/module.f.mjs'
import { forEachStep, step } from '../../effects/module.f.mjs'
import { nixToString } from '../../media/nix/module.f.mjs'
import { fromUndefined, unwrap as unwrapNullable } from '../../types/nullable/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { install, test, uses } from '../common/module.f.mjs'
import { nixpkgs } from '../config/module.f.mjs'

/**
 * Directory holding the generated flakes, one subdirectory per job. The
 * generator owns those subdirectories, not everything here: `nix/README.md` is
 * written by hand.
 */
export const generatedDirectory = /** @type {const} */ ('nix')

const { commit } = nixpkgs

const url = `github:NixOS/nixpkgs/${commit}`

/** @type {(job: NixJob) => Expression} */
const flake = ({ system, packages, shellHook }) => ['set',
    ['=', ['inputs', 'nixpkgs', 'url'], url],
    ['=', ['outputs'], ['lambda',
        ['open-set-pattern', 'nixpkgs'],
        ['set',
            ['=', ['devShells', system, 'default'], ['let',
                [['=', ['pkgs'], ['apply',
                    ['ref', 'import'],
                    ['ref', 'nixpkgs'],
                    ['set', ['=', ['system'], system]]
                ]]],
                ['apply',
                    ['ref', 'pkgs', 'mkShell'],
                    ['set',
                        ['=', ['packages'], ['list', ...packages.map(p => /** @type {const} */ (['ref', 'pkgs', p]))]],
                        ...(shellHook === undefined
                            ? []
                            : [/** @type {const} */ (['=', ['shellHook'], ['indented-string', shellHook]])])
                    ]
                ]
            ]]
        ]
    ]]
]

/**
 * Serializes a job's flake.
 *
 * The serializer rejects invalid *identifiers*, and every identifier in a flake
 * is written here — a job only contributes attribute names and strings, which
 * are quoted when they are not identifiers. The unwrap is therefore a totality
 * assertion, not an input check.
 *
 * @type {(job: NixJob) => string}
 */
export const flakeText = job =>
    unwrapNullable(fromUndefined(nixToString(flake(job))))

/** @type {(job: NixJob) => Effect<Mkdir | WriteFile, void, IoChannel>} */
const writeFlake = job => {
    const directory = `${generatedDirectory}/${job.id}`
    const created = mkdir(directory, { recursive: true })
    return step(
        created,
        () => writeUtf8File(`${directory}/flake.nix`, flakeText(job)))
}

/**
 * Writes one generated flake per job, stopping at the first failure.
 *
 * @type {(jobs: readonly NixJob[]) => Effect<Mkdir | WriteFile, void, IoChannel>}
 */
export const nixFlakes = jobs =>
    forEachStep(pureOk(jobs), writeFlake)

/** Path a workflow passes to `nix develop`, for the job of the given id. */
/** @type {(id: string) => string} */
export const flakePath = id => `./${generatedDirectory}/${id}`

/** Installs Nix, with `nix-command` and `flakes` enabled by the action's defaults. */
export const nixInstall = install(uses('cachix/install-nix-action'))

/**
 * Runs one command inside a job's generated development shell.
 *
 * `--no-write-lock-file` keeps the invocation read-only against the checkout:
 * Nix otherwise writes a `flake.lock` beside the flake it enters. The pin in
 * `flake.nix` already determines every input, so that lock resolves nothing the
 * flake did not already say.
 *
 * It is not what keeps the Node 26 drift check honest: the root `.gitignore`
 * covers a per-job `flake.lock`, and `git add -A` does not stage an ignored
 * file, so that check never saw one. The ignore rule stays for a hand-run
 * `nix develop` without the flag.
 *
 * @type {(id: string, command: string) => string}
 */
export const nixDevelop = (id, command) =>
    `nix develop --no-write-lock-file ${flakePath(id)} --command ${command}`

/**
 * The Nix system of the runner every job with a flake uses. `ubuntuArm` picks
 * the image; this is the same machine named the way a flake names it.
 *
 * A job on another runner declares another system, and its flake gets another
 * explicit `devShells.<system>.default` — not a loop over systems.
 */
export const nixSystem = /** @type {const} */ ('aarch64-linux')

/**
 * One step per command, each entering the job's shell (root `AGENTS.md` §7).
 *
 * Re-entering per step is the point rather than a cost: the step is what CI
 * reports on, and a bundle would name the wrapper instead of the command that
 * failed. Only commands needing a tool the flake pins go through here — `git`
 * is the runner's, so the Node 26 drift check stays a plain step.
 *
 * @type {(id: string) => (commands: readonly string[]) => readonly MetaStep[]}
 */
export const nixSteps = id => commands =>
    commands.map(command => test({ run: nixDevelop(id, command) }))

/**
 * Asserts that the runtime a job is about to use is the version configured for
 * it, read from inside that job's own generated flake.
 *
 * The flake resolves its package from the pinned Nixpkgs commit, which
 * `../config/module.f.mjs` only *claims* provides that version. The claim does
 * not check itself, and a job quietly testing on another runtime reports a
 * green result about something nobody asked for. This is the one thing about a
 * generated flake that only CI can establish: `nix develop` has to resolve the
 * pin, build the shell, and put the binary on `PATH`.
 *
 * It runs before anything that executes project or dependency code — `npm ci`
 * and its lifecycle hooks, a `deno install`, a `bun install` — so nothing runs
 * on an unconfirmed runtime.
 *
 * `command` and `expected` are separate because the runtimes disagree on both
 * halves: `node --version` prints a leading `v` that `bun --version` does not,
 * and `deno --version` prints three lines, so Deno is asked for the one field
 * instead.
 *
 * @type {(id: string, command: string, expected: string) => MetaStep}
 */
export const nixVersionStep = (id, command, expected) =>
    test({ run: `test "$(${nixDevelop(id, command)})" = ${expected}` })
