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
import { install, uses } from '../common/module.f.mjs'
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
 * `--no-write-lock-file` keeps the invocation read-only against the checkout.
 * Nix otherwise writes a `flake.lock` beside the flake it enters, which is a
 * file CI created in a tree the Node 26 job then compares against the
 * generator's output. The pin in `flake.nix` already determines every input, so
 * the lock adds nothing to resolve — only something to ignore.
 *
 * @type {(id: string, command: string) => string}
 */
export const nixDevelop = (id, command) =>
    `nix develop --no-write-lock-file ${flakePath(id)} --command ${command}`
