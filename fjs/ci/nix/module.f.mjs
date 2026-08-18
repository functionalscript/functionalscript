/**
 * Generates one self-contained Nix flake per declared CI job.
 *
 * Each job gets its own `nix/generated/<id>/flake.nix` pinning the exact
 * Nixpkgs commit from `../config/module.f.mjs` and exposing a single
 * `devShells.<system>.default` development shell. The files are static and
 * readable on purpose: no job selection, no shared Nix modules, no helper
 * libraries.
 *
 * See `./types.ts` for the `NixJob` type-level API.
 *
 * @module
 *
 * @import { RawEffect } from '../../effects/types.ts'
 * @import { IoChannel, Mkdir, WriteFile } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/io/types.ts'
 * @import { Expression } from '../../media/nix/types.ts'
 * @import { MetaStep } from '../common/types.ts'
 * @import { NixJob } from './types.ts'
 */

import { pureOk } from '../../effects/io/module.f.mjs'
import { mkdir, writeUtf8File } from '../../effects/node/module.f.mjs'
import { forEachStep, step } from '../../effects/io/module.f.mjs'
import { nixToString } from '../../media/nix/module.f.mjs'
import { fromUndefined, unwrap as unwrapNullable } from '../../types/nullable/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { install, test, uses } from '../common/module.f.mjs'
import { nixpkgs } from '../config/module.f.mjs'

/** Directory owned by this generator. */
export const generatedDirectory = /** @type {const} */ ('nix/generated')

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

/** Runs one command inside a job's generated development shell. */
/** @type {(id: string, command: string) => string} */
export const nixDevelop = (id, command) => `nix develop ${flakePath(id)} --command ${command}`

/**
 * Wraps a string so a POSIX shell reproduces it exactly. Single quotes protect
 * every other character, so only the quote itself needs handling: leave the
 * literal, reopen it, and escape the quote outside (`'` becomes `'\''`).
 *
 * @type {(value: string) => string}
 */
const singleQuoted = value =>
    `'${value.replaceAll("'", "'\\''")}'`

/**
 * Runs a migrated job's whole command sequence in one development shell, so the
 * shell's packages and environment reach every command without exporting a
 * profile across GitHub Actions steps.
 *
 * The commands are a shell script, joined so a failure stops the rest, and are
 * quoted as one argument — a command may contain quotes of its own.
 *
 * @type {(id: string, commands: readonly string[]) => string}
 */
export const nixDevelopAll = (id, commands) =>
    nixDevelop(id, `bash -euo pipefail -c ${singleQuoted(commands.join(' && '))}`)

/**
 * Checks a job's generated flake end to end: the shell builds, and the Node it
 * puts on `PATH` is exactly the pinned version. The pinned Nixpkgs commit
 * already determines the version, so this is the only place the expectation
 * is stated — the generated flakes stay declarative instead of carrying an
 * `assert` that restates the commit they pin.
 *
 * @type {(id: string, version: string) => MetaStep}
 */
export const nixVersionCheckStep = (id, version) =>
    test({ run: `test "$(${nixDevelop(id, 'node --version')})" = v${version}` })
