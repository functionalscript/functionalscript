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
import { install, uses, type MetaStep } from '../common/module.f.ts'
import { nixpkgs } from '../config/module.f.ts'

/** A package the shell provides, pinned to the version the snapshot must give. */
export type NixPackage = {
    /** Nixpkgs attribute name, e.g. `nodejs_24`. */
    readonly attribute: string
    /** Version the snapshot is expected to provide, asserted by the flake. */
    readonly version: string
}

/** A CI job's development environment, one generated flake each. */
export type NixJob = {
    /** Generated directory name under `nix/generated`, matching the CI job id. */
    readonly id: string
    /** Nix system of the job's runner, e.g. `aarch64-linux`. */
    readonly system: string
    /** Packages made available in the job's shell. */
    readonly packages: readonly NixPackage[]
    /** Job-local shell initialization, when the job needs one. */
    readonly shellHook?: string
}

/** Directory owned by this generator. */
export const generatedDirectory = 'nix/generated' as const

const { commit } = nixpkgs

const url = `github:NixOS/nixpkgs/${commit}`

const shell = ({ packages, shellHook }: NixJob): Expression => ['apply',
    ['ref', 'pkgs', 'mkShell'],
    ['set',
        ['=', ['packages'], ['list',
            ...packages.map(({ attribute }) => ['ref', 'pkgs', attribute] as const)
        ]],
        ...(shellHook === undefined
            ? []
            : [['=', ['shellHook'], ['indented-string', shellHook]] as const])
    ]
]

/**
 * Guards the shell with one assertion per package, so a snapshot that moved on
 * fails evaluation instead of silently handing the job a different toolchain.
 * Nix asserts one condition each, and the last package ends up innermost.
 */
const asserted = (packages: readonly NixPackage[], body: Expression): Expression =>
    packages.reduceRight<Expression>(
        (inner, { attribute, version }) =>
            ['assert', ['==', ['ref', 'pkgs', attribute, 'version'], version], inner],
        body)

const flake = (job: NixJob): Expression => ['set',
    ['=', ['inputs', 'nixpkgs', 'url'], url],
    ['=', ['outputs'], ['lambda',
        ['open-set-pattern', 'nixpkgs'],
        ['set',
            ['=', ['devShells', job.system, 'default'], ['let',
                [['=', ['pkgs'], ['apply',
                    ['ref', 'import'],
                    ['ref', 'nixpkgs'],
                    ['set', ['=', ['system'], job.system]]
                ]]],
                asserted(job.packages, shell(job))
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

/** Path a workflow passes to `nix develop`. */
export const flakePath = ({ id }: NixJob): string => `./${generatedDirectory}/${id}`

/** Installs Nix, with `nix-command` and `flakes` enabled by the action's defaults. */
export const nixInstall: MetaStep = install(uses('cachix/install-nix-action'))

/** Runs one command inside a job's generated development shell. */
export const nixDevelop = (job: NixJob, command: string): string =>
    `nix develop ${flakePath(job)} --command ${command}`
