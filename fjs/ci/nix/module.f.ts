/**
 * Generates one self-contained Nix flake per declared CI job.
 *
 * Each job gets its own `nix/generated/<id>/flake.nix` pinning the exact
 * Nixpkgs commit from `../config/module.f.ts` and exposing a single
 * `devShells.<system>.default` development shell. The files are static and
 * readable on purpose: no job selection, no shared Nix modules, no helper
 * libraries.
 *
 * @module
 */
import { forEachStep, mapStep, pure, step, type Effect } from '../../effects/module.f.ts'
import { mkdir, writeUtf8File, type Mkdir, type WriteFile } from '../../effects/node/module.f.ts'
import { nixToString, type Expression } from '../../media/nix/module.f.ts'
import { fromUndefined, unwrap as unwrapNullable } from '../../types/nullable/module.f.ts'
import { unwrap } from '../../types/result/module.f.ts'
import { install, test, uses, type MetaStep } from '../common/module.f.ts'
import { nixpkgs } from '../config/module.f.ts'

/** A CI job's development environment, one generated flake each. */
export type NixJob = {
    /** Generated directory name under `nix/generated`, matching the CI job id. */
    readonly id: string
    /** Nix system of the job's runner, e.g. `aarch64-linux`. */
    readonly system: string
    /** Nixpkgs attribute names made available in the job's shell. */
    readonly packages: readonly string[]
    /** Job-local shell initialization, when the job needs one. */
    readonly shellHook?: string
}

/** Directory owned by this generator. */
export const generatedDirectory = 'nix/generated' as const

const { commit } = nixpkgs

const url = `github:NixOS/nixpkgs/${commit}`

const flake = ({ system, packages, shellHook }: NixJob): Expression => ['set',
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
                        ['=', ['packages'], ['list', ...packages.map(p => ['ref', 'pkgs', p] as const)]],
                        ...(shellHook === undefined
                            ? []
                            : [['=', ['shellHook'], ['indented-string', shellHook]] as const])
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
 */
export const flakeText = (job: NixJob): string =>
    unwrapNullable(fromUndefined(nixToString(flake(job))))

const writeFlake = (job: NixJob): Effect<Mkdir | WriteFile, void> => {
    const directory = `${generatedDirectory}/${job.id}`
    const created = mapStep(mkdir(directory, { recursive: true }), unwrap)
    const written = step(
        created,
        () => writeUtf8File(`${directory}/flake.nix`, flakeText(job)))
    return mapStep(written, unwrap)
}

/** Writes one generated flake per job. */
export const nixFlakes = (jobs: readonly NixJob[]): Effect<Mkdir | WriteFile, void> =>
    forEachStep(pure(jobs), writeFlake)

/** Path a workflow passes to `nix develop`, for the job of the given id. */
export const flakePath = (id: string): string => `./${generatedDirectory}/${id}`

/** Installs Nix, with `nix-command` and `flakes` enabled by the action's defaults. */
export const nixInstall: MetaStep = install(uses('cachix/install-nix-action'))

/** Runs one command inside a job's generated development shell. */
export const nixDevelop = (id: string, command: string): string =>
    `nix develop ${flakePath(id)} --command ${command}`

/**
 * Wraps a string so a POSIX shell reproduces it exactly. Single quotes protect
 * every other character, so only the quote itself needs handling: leave the
 * literal, reopen it, and escape the quote outside (`'` becomes `'\''`).
 */
const singleQuoted = (value: string): string =>
    `'${value.replaceAll("'", "'\\''")}'`

/**
 * Runs a migrated job's whole command sequence in one development shell, so the
 * shell's packages and environment reach every command without exporting a
 * profile across GitHub Actions steps.
 *
 * The commands are a shell script, joined so a failure stops the rest, and are
 * quoted as one argument — a command may contain quotes of its own.
 */
export const nixDevelopAll = (id: string, commands: readonly string[]): string =>
    nixDevelop(id, `bash -euo pipefail -c ${singleQuoted(commands.join(' && '))}`)

/**
 * Checks a job's generated flake end to end: the shell builds, and the Node it
 * puts on `PATH` is exactly the pinned version. The pinned Nixpkgs commit
 * already determines the version, so this is the only place the expectation
 * is stated — the generated flakes stay declarative instead of carrying an
 * `assert` that restates the commit they pin.
 */
export const nixVersionCheckStep = (id: string, version: string): MetaStep =>
    test({ run: `test "$(${nixDevelop(id, 'node --version')})" = v${version}` })
