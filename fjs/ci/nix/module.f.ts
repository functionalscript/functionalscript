/**
 * Generates one self-contained Nix flake per declared CI job.
 *
 * Each job gets its own `nix/generated/<id>/flake.nix` pinning the exact
 * Nixpkgs commit from `../config/module.f.ts` and exposing a
 * `devShells.<system>.default` development shell, plus a
 * `packages.<system>.oci` image for the jobs that run in a container. The files
 * are static and readable on purpose: no job selection, no shared Nix modules,
 * no helper libraries.
 *
 * @module
 */
import { forEachStep, mapStep, pure, step, type Effect } from '../../effects/module.f.ts'
import { mkdir, writeUtf8File, type Mkdir, type WriteFile } from '../../effects/node/module.f.ts'
import { nixToString, type Expression } from '../../media/nix/module.f.ts'
import { fromUndefined, unwrap as unwrapNullable } from '../../types/nullable/module.f.ts'
import { unwrap } from '../../types/result/module.f.ts'
import { definedEntries, type StringMap } from '../../types/object/module.f.ts'
import { install, test, uses, type MetaStep } from '../common/module.f.ts'
import { nixpkgs } from '../config/module.f.ts'

/**
 * A value exported into the shell's environment: either a literal string, or a
 * Nixpkgs attribute path whose store path the shell exports (e.g.
 * `playwright-driver.browsers`).
 */
export type EnvValue =
    | readonly ['string', string]
    | readonly ['pkgs', string, ...string[]]

/** A Nixpkgs attribute path under `pkgs`, e.g. `['dockerTools', 'binSh']`. */
export type PkgsPath = readonly [string, ...string[]]

/**
 * The OCI image built from a job's environment, for a job that runs its
 * commands in a container instead of a development shell.
 *
 * The image carries the same `packages` and `env` as the shell — one
 * declaration, two ways of entering it — plus the parts a shell inherits from
 * the runner and an image has to provide itself.
 */
export type NixOci = {
    /** Repository name of the generated image. */
    readonly name: string
    /**
     * Nixpkgs attribute paths copied into the image root, on top of the job's
     * `packages`: the shell, its utilities, and the certificate bundle a
     * development shell inherits from the runner.
     */
    readonly contents: readonly PkgsPath[]
    /** Root-level directory the container starts in, where CI mounts the checkout. */
    readonly workDirectory: string
}

/** A CI job's development environment, one generated flake each. */
export type NixJob = {
    /** Generated directory name under `nix/generated`, matching the CI job id. */
    readonly id: string
    /** Nix system of the job's runner, e.g. `aarch64-linux`. */
    readonly system: string
    /** Nixpkgs attribute names made available in the job's shell. */
    readonly packages: readonly string[]
    /**
     * Environment variables the shell exports. `mkShell` turns any attribute it
     * does not recognize into one, so a Nixpkgs attribute path becomes that
     * package's store path without any string interpolation.
     */
    readonly env?: StringMap<string, EnvValue>
    /** Job-local shell initialization, when the job needs one. */
    readonly shellHook?: string
    /** The job's OCI image, when the job runs in a container. */
    readonly oci?: NixOci
}

/** Directory owned by this generator. */
export const generatedDirectory = 'nix/generated' as const

const { commit } = nixpkgs

const url = `github:NixOS/nixpkgs/${commit}`

/** Flake output attribute holding a job's OCI image. */
const ociAttribute = 'oci' as const

/**
 * `PATH` inside a generated image. `contents` links every package's `bin` into
 * the image's `/bin`, and `dockerTools.usrBinEnv` provides `/usr/bin/env` for
 * shebangs, so those two directories are the whole search path.
 */
const ociPath = 'PATH=/bin:/usr/bin' as const

/**
 * `HOME` inside a generated image. A development shell inherits the runner's
 * home directory; a container has none, and `npm` needs a writable one for its
 * cache.
 */
const ociHome = 'HOME=/tmp' as const

const envExpression = (value: EnvValue): Expression =>
    value[0] === 'string' ? value[1] : ['ref', 'pkgs', ...value.slice(1)]

const envEntries = (env: StringMap<string, EnvValue> | undefined) =>
    definedEntries<EnvValue>(env ?? {})

const pkgsReference = (path: PkgsPath) => ['ref', 'pkgs', ...path] as const

const devShell = ({ packages, env, shellHook }: NixJob): Expression => ['apply',
    ['ref', 'pkgs', 'mkShell'],
    ['set',
        ['=', ['packages'], ['list', ...packages.map(p => pkgsReference([p]))]],
        ...envEntries(env).map(([name, value]) => ['=', [name], envExpression(value)] as const),
        ...(shellHook === undefined
            ? []
            : [['=', ['shellHook'], ['indented-string', shellHook]] as const])
    ]
]

/**
 * One `NAME=value` entry of the image's environment. A literal is written into
 * the string; a Nixpkgs attribute path is interpolated, which is what puts the
 * package's closure into the image — `streamLayeredImage` takes the image's
 * configuration as a closure root.
 */
const ociEnvEntry = ([name, value]: readonly [string, EnvValue]) => {
    if (value[0] === 'string') { return `${name}=${value[1]}` }
    const [, attribute, ...rest] = value
    return ['interpolated-string', `${name}=`, pkgsReference([attribute, ...rest])] as const
}

const ociImage = ({ packages, env }: NixJob, { name, contents, workDirectory }: NixOci): Expression => ['apply',
    ['ref', 'pkgs', 'dockerTools', 'streamLayeredImage'],
    ['set',
        ['=', ['name'], name],
        // The pinned snapshot and this repository's commit together determine
        // the image, and the job builds it rather than pulling it, so the
        // snapshot is the only identity it needs.
        ['=', ['tag'], commit],
        ['=', ['contents'], ['list',
            ...packages.map(p => pkgsReference([p])),
            ...contents.map(pkgsReference),
        ]],
        ['=', ['config'], ['set',
            ['=', ['Env'], ['list',
                ...envEntries(env).map(ociEnvEntry),
                ociPath,
                ociHome,
            ]],
            ['=', ['WorkingDir'], `/${workDirectory}`],
            // Only reached by `docker run` without a command, i.e. when someone
            // opens the image to look around.
            ['=', ['Cmd'], ['list', '/bin/sh']],
        ]],
        // A `dockerTools` image contains exactly what is declared, so the
        // directories the commands write to have to be created here.
        ['=', ['extraCommands'], ['indented-string',
            `mkdir -p tmp ${workDirectory}\nchmod 1777 tmp`]],
    ]
]

const flake = (job: NixJob): Expression => ['set',
    ['=', ['inputs', 'nixpkgs', 'url'], url],
    ['=', ['outputs'], ['lambda',
        ['open-set-pattern', 'nixpkgs'],
        ['let',
            [['=', ['pkgs'], ['apply',
                ['ref', 'import'],
                ['ref', 'nixpkgs'],
                ['set', ['=', ['system'], job.system]]
            ]]],
            ['set',
                ['=', ['devShells', job.system, 'default'], devShell(job)],
                ...(job.oci === undefined
                    ? []
                    : [['=',
                        ['packages', job.system, ociAttribute],
                        ociImage(job, job.oci)] as const]),
            ]
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
 * Builds a job's image and loads it into the runner's Docker daemon.
 *
 * `streamLayeredImage` builds a script that writes the archive to standard
 * output, so nothing but the layers themselves is ever stored twice. Building
 * with `--no-link` keeps `result` out of the checked-out tree, and
 * `--print-out-paths` names the script to run.
 */
export const ociLoad = (id: string): string =>
    `"$(nix build ${flakePath(id)}#${ociAttribute} --no-link --print-out-paths)" | docker load`

/** The `name:tag` a job's loaded image is addressed by. */
const ociImageReference = ({ name }: NixOci): string => `${name}:${commit}`

/**
 * Runs a job's whole command sequence in a container of its image, with the
 * checkout mounted at the image's working directory.
 *
 * `--ipc=host` gives the browsers the host's shared memory instead of Docker's
 * 64 MB default, which Chromium runs out of; Playwright recommends it for
 * exactly this reason. The commands are quoted the same way `nixDevelopAll`
 * quotes them.
 */
export const ociRunAll = (oci: NixOci, commands: readonly string[]): string =>
    `docker run --rm --ipc=host --volume "$PWD:/${oci.workDirectory}" ${ociImageReference(oci)} bash -euo pipefail -c ${singleQuoted(commands.join(' && '))}`

/** Asserts the Node a development shell puts on `PATH`, from inside that shell. */
export const nodeVersionCommand = (version: string): string =>
    `test "$(node --version)" = v${version}`

/**
 * Checks a job's generated flake end to end: the shell builds, and the Node it
 * puts on `PATH` is exactly the pinned version. The pinned Nixpkgs commit
 * already determines the version, so this is the only place the expectation
 * is stated — the generated flakes stay declarative instead of carrying an
 * `assert` that restates the commit they pin.
 */
export const nixVersionCheckStep = (id: string, version: string): MetaStep =>
    test({ run: `test "$(${nixDevelop(id, 'node --version')})" = v${version}` })
