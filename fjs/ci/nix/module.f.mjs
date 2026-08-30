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
 * @import { Expression, _Binding, _Reference } from '../../media/nix/types.ts'
 * @import { NixArchive, NixJob, NixPin, NixRust } from './types.ts'
 */

import { pureOk } from '../../effects/module.f.mjs'
import { mkdir, writeUtf8File } from '../../effects/node/module.f.mjs'
import { forEachStep, step } from '../../effects/module.f.mjs'
import { nixToString } from '../../media/nix/module.f.mjs'
import { fromUndefined, unwrap as unwrapNullable } from '../../types/nullable/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { install, test, uses } from '../common/module.f.mjs'
import { nixpkgs, rustOverlay } from '../config/module.f.mjs'

/**
 * Directory holding the generated environments, each a `flake.nix` and a `run`
 * script beside it.
 *
 * The shared shell is *this* directory rather than one below it — see
 * {@link nixShell} — and a job that needs a shell of its own gets a
 * subdirectory named after it. So the generator owns `flake.nix`, `run`, and
 * every subdirectory here; `nix/README.md` is written by hand.
 */
export const generatedDirectory = /** @type {const} */ ('nix')

const { commit } = nixpkgs

const url = `github:NixOS/nixpkgs/${commit}`

const rustOverlayUrl = `github:oxalica/rust-overlay/${rustOverlay.commit}`

/**
 * The toolchain expression a job with a `rust` declaration binds to `rust`.
 *
 * `minimal.override` rather than `default`: the default profile carries
 * `rust-docs`, and a job that names the components it runs downloads only
 * those. `stable."<version>"` names the release in full, which is why no
 * generated job checks its Rust version from inside the shell the way it checks
 * an unversioned attribute — there is nothing left for the check to establish.
 *
 * @type {(rust: NixRust) => Expression}
 */
const toolchain = ({ version, extensions, targets }) => ['apply',
    ['ref', 'pkgs', 'rust-bin', 'stable', version, 'minimal', 'override'],
    ['set',
        ['=', ['extensions'], ['list', ...extensions]],
        ['=', ['targets'], ['list', ...targets]],
    ]
]

/**
 * A pinned package's archive for one system, or empty strings for a job that
 * pins nothing — where the two are never read.
 *
 * A job that *does* pin has to give every system it declares an archive, and
 * nothing here can invent a missing one: the URL and the hash are both facts
 * about a published file. So the lookup is a totality assertion like
 * {@link flakeText}'s, and `../proof.f.mjs` holds every declared job to it.
 *
 * @type {(pin: NixPin | undefined, system: string) => NixArchive}
 */
const archive = (pin, system) =>
    pin === undefined
        ? { url: '', hash: '' }
        : unwrapNullable(fromUndefined(pin.sources[system]))

/** The `let` name a pinned package is bound to, whatever package it overrides. */
const pinName = /** @type {const} */ ('pinned')

/**
 * The package expression a job with a `pin` binds to {@link pinName}.
 *
 * That name is the generator's, not the job's, and deliberately: a reference's
 * root has to be a Nix identifier — `serializeReference` rejects anything else
 * — while an attribute *selection* is quoted when it needs to be. Binding to a
 * name the job supplied would make `flakeText` throw for a package like
 * `not an identifier`, where `pkgs."not an identifier".overrideAttrs` is
 * perfectly serializable. `rust` is named by the generator for the same reason.
 *
 * `overrideAttrs` rather than a package definition of our own: the snapshot's
 * recipe already unpacks this archive, patches its interpreter and wraps the
 * binary, and all of that stays. Only `src` moves, to a release the snapshot
 * does not carry, with the hash checked before anything is unpacked.
 *
 * `version` moves with it because the two are one fact. Leaving it behind
 * would name the derivation after a release it no longer contains — and the
 * package builds its own download URLs from `version`, so a mismatch there is
 * the kind that surfaces as a hash error in an unrelated place.
 *
 * @type {(pin: NixPin, source: Expression, hash: Expression) => Expression}
 */
const pinned = ({ package: name, version }, source, hash) => ['apply',
    ['ref', 'pkgs', name, 'overrideAttrs'],
    ['set',
        ['=', ['version'], version],
        ['=', ['src'], ['apply',
            ['ref', 'pkgs', 'fetchurl'],
            ['set',
                ['=', ['url'], source],
                ['=', ['hash'], hash],
            ]
        ]],
    ]
]

/** The `let` name the shared shell function is bound to. */
const shellName = /** @type {const} */ ('shell')

/**
 * The parts of a shell that differ between one system and the next.
 *
 * Two ways to fill them, and that is the whole of the choice this module makes
 * about repetition. A flake with one shell passes the values themselves, and
 * reads with nothing to look up. A flake with several passes references to a
 * function's arguments, and the shell is written once.
 *
 * The archive halves are read only under a `pin`, so for a job that pins
 * nothing whatever fills them never reaches the file.
 *
 * @typedef {{
 *   readonly system: Expression
 *   readonly url: Expression
 *   readonly hash: Expression
 * }} PerSystem
 */

/**
 * One development shell: the `let` that builds it and the `mkShell` that is it.
 *
 * What varies with the system is not only its name — a pinned package names a
 * different archive, with a hash of its own — so all three arrive together
 * rather than being derived from each other here.
 *
 * @type {(job: NixJob, perSystem: PerSystem) => Expression}
 */
const shell = ({ packages, shellHook, rust, pin }, { system, url: source, hash }) => ['let',
    [
        ['=', ['pkgs'], ['apply',
            ['ref', 'import'],
            ['ref', 'nixpkgs'],
            ['set',
                ['=', ['system'], system],
                ...(rust === undefined ? [] : /** @type {readonly _Binding[]} */ ([
                    ['=', ['overlays'], ['list', ['ref', 'rust-overlay', 'overlays', 'default']]],
                ])),
            ]
        ]],
        ...(rust === undefined ? [] : /** @type {readonly _Binding[]} */ ([
            ['=', ['rust'], toolchain(rust)],
        ])),
        ...(pin === undefined ? [] : /** @type {readonly _Binding[]} */ ([
            ['=', [pinName], pinned(pin, source, hash)],
        ])),
    ],
    ['apply',
        ['ref', 'pkgs', 'mkShell'],
        ['set',
            ['=', ['packages'], ['list',
                ...(rust === undefined ? [] : /** @type {readonly _Reference[]} */ ([['ref', 'rust']])),
                ...(pin === undefined ? [] : /** @type {readonly _Reference[]} */ ([['ref', pinName]])),
                ...packages.map(p => /** @type {const} */ (['ref', 'pkgs', p])),
            ]],
            ...(shellHook === undefined
                ? []
                : [/** @type {const} */ (['=', ['shellHook'], ['indented-string', shellHook]])])
        ]
    ]
]

/**
 * The values one system passes to the shared function: its name, and the
 * archive a pinned package takes on it.
 *
 * @type {(job: NixJob, system: string) => readonly _Binding[]}
 */
const perSystemArguments = ({ pin }, system) => {
    const { url: source, hash } = archive(pin, system)
    return [
        ['=', ['system'], system],
        ...(pin === undefined ? [] : /** @type {readonly _Binding[]} */ ([
            ['=', ['url'], source],
            ['=', ['hash'], hash],
        ])),
    ]
}

/**
 * The `devShells` set, and — for a job with more than one system — the function
 * its entries share.
 *
 * The abstraction appears exactly where it pays. One shell written through a
 * function would be indirection for nothing, so a single-system flake stays the
 * flat text it has always been, byte for byte. Four shells written out is the
 * same twenty lines four times, so those share.
 *
 * It is a function rather than a loop on purpose: `devShells.<system>.default`
 * is still written once per system, so the systems a flake serves are a list
 * you can read, not a fold over one this file does not contain. That was
 * `../todo/65z-ci-nix.md`'s reason for refusing `flake-utils`, and it survives.
 *
 * @type {(job: NixJob) => Expression}
 */
const devShells = job => {
    const [system, ...rest] = job.systems
    if (rest.length === 0) {
        return ['set',
            ['=', ['devShells', system, 'default'], shell(job, {
                system,
                ...archive(job.pin, system),
            })],
        ]
    }
    return ['let',
        [
            ['=', [shellName], ['lambda',
                ['open-set-pattern', 'system', ...(job.pin === undefined ? [] : ['url', 'hash'])],
                shell(job, {
                    system: ['ref', 'system'],
                    url: ['ref', 'url'],
                    hash: ['ref', 'hash'],
                }),
            ]],
        ],
        ['set',
            ...job.systems.map(s => /** @type {_Binding} */ ([
                '=',
                ['devShells', s, 'default'],
                ['apply', ['ref', shellName], ['set', ...perSystemArguments(job, s)]],
            ])),
        ],
    ]
}

/**
 * A job declaring neither `rust` nor `pin` generates exactly what it generated
 * before those declarations existed: one input, one lambda argument, no
 * overlay, one `let` binding. Everything either one brings is conditional on
 * the job asking for it, and a job declaring one system generates the one
 * `devShells` attribute it always did.
 *
 * @type {(job: NixJob) => Expression}
 */
const flake = job => ['set',
    ['=', ['inputs', 'nixpkgs', 'url'], url],
    ...(job.rust === undefined ? [] : /** @type {readonly _Binding[]} */ ([
        ['=', ['inputs', 'rust-overlay', 'url'], rustOverlayUrl],
        // The overlay's own Nixpkgs is only for its checks, and following ours
        // keeps one snapshot in the flake rather than two resolved revisions.
        ['=', ['inputs', 'rust-overlay', 'inputs', 'nixpkgs', 'follows'], 'nixpkgs'],
    ])),
    ['=', ['outputs'], ['lambda',
        ['open-set-pattern', 'nixpkgs', ...(job.rust === undefined ? [] : ['rust-overlay'])],
        devShells(job),
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

/**
 * The `run` script generated beside a job's flake. `./nix/node26/run npm run cov`
 * is what a workflow step says; this is what makes that a command.
 *
 * It resolves the flake from its own location rather than from the working
 * directory, so it behaves the same run from the repository root, from `nix/`,
 * or by absolute path. `"$@"` passes the caller's argument vector through
 * unsplit, which is what lets a step keep quoting of its own —
 * `./nix/deno/run deno eval 'console.log(Deno.version.deno)'` arrives as three
 * arguments, not as text to re-parse.
 *
 * That location comes from `case` and `${0%/*}`, which are shell syntax and
 * parameter expansion — not `dirname`, and not any other program. A generated
 * script calls no external tool (root `AGENTS.md` §6), and this one has no need
 * to: the `case` arm is what makes a `$0` with no `/` mean the current
 * directory, which is the one thing stripping a suffix cannot say by itself.
 *
 * What holds that is the proof pinning this text exactly, not a scan for tool
 * names — §6 rules out the scan, and the exact text already fails on any change
 * at all.
 *
 * `exec` replaces the shell, so the command's exit status is the script's and
 * no wrapper process sits between CI and the failure.
 *
 * The two flags live here rather than in every step. `--no-write-lock-file`
 * keeps the invocation read-only against the checkout: Nix otherwise writes a
 * `flake.lock` beside the flake it enters, and the pin in `flake.nix` already
 * determines every input, so that lock resolves nothing the flake did not
 * already say. `--quiet` drops Nix's own logging one level, from `info` to
 * `notice`, which removes the substitution chatter — `copying N paths`, started
 * at `lvlInfo` — while leaving warnings and errors, which sit below `notice`.
 *
 * `--quiet` is spelled long because Nix has no short form for it: `--verbose`
 * declares `.shortName = 'v'` and `--quiet` declares none, so `-q` is not an
 * option the `nix` CLI accepts. The one short flag nearby, `-Q`
 * (`--no-build-output`), belongs to `LegacyArgs` — `nix-build` and `nix-shell`,
 * not `nix develop`.
 *
 * Neither flag reaches the command being run: `--command` execs it with stdio
 * inherited, so a job's own output is exactly what it was.
 */
export const runText = `#!/bin/sh
case $0 in */*) d=\${0%/*} ;; *) d=. ;; esac
exec nix develop --no-write-lock-file --quiet "$d" --command "$@"
`

/**
 * Writes a job's flake and the `run` script beside it, stopping at the first
 * failure.
 *
 * The script's **content** is generated; its executable bit is not. Nothing in
 * `fjs/effects/node` can set a file mode, and `fs.writeFile` preserves the mode
 * of a file that already exists — so a script committed once as `100755` stays
 * executable through every regeneration, and only a job that has never been
 * generated needs `git update-index --chmod=+x` by hand. See
 * `../todo/generated-run-script-mode.md`.
 *
 * @type {(job: NixJob) => Effect<Mkdir | WriteFile, void, IoChannel>}
 */
const writeJob = job => {
    // `flakePath` is what a workflow step names, so it is relative; the effects
    // layer writes from the repository root, so the `./` comes off here rather
    // than being a second opinion about where these files go.
    const directory = flakePath(job.id).slice('./'.length)
    const created = mkdir(directory, { recursive: true })
    const flakeWritten = step(
        created,
        () => writeUtf8File(`${directory}/flake.nix`, flakeText(job)))
    return step(
        flakeWritten,
        () => writeUtf8File(`${directory}/run`, runText))
}

/**
 * Writes one generated environment per job, stopping at the first failure.
 *
 * @type {(jobs: readonly NixJob[]) => Effect<Mkdir | WriteFile, void, IoChannel>}
 */
export const nixFlakes = jobs =>
    forEachStep(pureOk(jobs), writeJob)

/**
 * The one generated environment jobs share, and the directory its flake is
 * written to.
 *
 * Most jobs name their runtime on the command line — `deno task cov`, `bun
 * test`, `cargo test`, `tsc` — so what else is on `PATH` cannot decide which
 * one runs, and a shell carrying all of them tests exactly what a narrower one
 * would. Those jobs share this, and it is the same shell a developer enters, so
 * the environment CI proves is the environment people work in.
 *
 * A job whose runtime is resolved from `PATH` rather than named cannot share
 * it, and the Node jobs are that case: `npm ci` and `node --test` run whichever
 * `node` comes first, so Node 22 and Node 24 keep a flake each carrying the one
 * release they exist to test. `../dev/module.f.mjs` has the rest of the
 * reasoning.
 *
 * The name is a label rather than a directory. This shell is written to
 * {@link generatedDirectory} itself — see {@link flakePath} — because it
 * belongs to no single job, and `nix develop ./nix` is the command a developer
 * should have to remember.
 */
export const nixShell = /** @type {const} */ ('dev')

/**
 * Directory holding the flake and `run` script for the environment of the given
 * id.
 *
 * The shared shell is the generated directory itself, so a developer types
 * `nix develop ./nix` — the repository's environment, named after nothing in
 * particular, because it belongs to no single job. The rest get a subdirectory
 * apiece.
 *
 * @type {(id: string) => string}
 */
export const flakePath = id =>
    id === nixShell
        ? `./${generatedDirectory}`
        : `./${generatedDirectory}/${id}`

/** The `run` script a workflow step invokes, for the job of the given id. */
/** @type {(id: string) => string} */
export const runPath = id => `${flakePath(id)}/run`

/** Installs Nix, with `nix-command` and `flakes` enabled by the action's defaults. */
export const nixInstall = install(uses('cachix/install-nix-action'))

/**
 * Runs one command inside a job's generated development shell, through that
 * job's `run` script.
 *
 * A step reads as the command it runs — `./nix/node26/run npm run cov` — with
 * the `nix develop` spelling and its flags in one generated place rather than
 * repeated fifteen times across the workflow. {@link runText} documents what
 * that spelling is and why.
 *
 * The `.gitignore` rule for a per-job `flake.lock` stays even though the script
 * passes `--no-write-lock-file`: it is there for a hand-run `nix develop` that
 * omits the flag, and never for CI, whose drift check could not have seen an
 * ignored file anyway.
 *
 * @type {(id: string, command: string) => string}
 */
export const nixDevelop = (id, command) => `${runPath(id)} ${command}`

/**
 * The Nix system of the runner every job with a flake uses. `ubuntuArm` picks
 * the image; this is the same machine named the way a flake names it.
 *
 * A job on another runner declares another system, and its flake gets another
 * explicit `devShells.<system>.default` — not a loop over systems.
 */
export const nixSystem = /** @type {const} */ ('aarch64-linux')

/**
 * What a CI job declares: the one runner it has, as a list of one.
 *
 * A job on another runner declares another system, and gets another explicit
 * `devShells.<system>.default` — not a loop. The developer environment is the
 * only declaration with more than one entry.
 *
 * @type {readonly [string, ...string[]]}
 */
export const nixSystems = [nixSystem]

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
    test({ run: `test "$(${nixDevelop(id, command)})" = "${expected}"` })
