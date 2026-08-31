/**
 * Proofs for generated CI flakes.
 *
 * @import { NixJob, NixPin } from './types.ts'
 * @import { State } from '../../effects/node/virtual/types.ts'
 * @import { IoChannel } from '../../effects/node/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { nixpkgs, node, rustOverlay, typescript } from '../config/module.f.mjs'
import { devJobId, devSystems } from '../dev/module.f.mjs'
import { i686JobId } from '../rust/module.f.mjs'
import { nixJobs } from '../module.f.mjs'
import { nodeNixJobs } from '../node/module.f.mjs'
import {
    devScriptMarker,
    devScriptPath,
    devScriptStep,
    devScriptText,
    isDevScript,
    flakePath,
    flakeText,
    lockText,
    generatedDirectory,
    nixDevelop,
    nixFlakes,
    nixInstall,
    nixShell,
    nixSteps,
    nixSystem,
    nixVersionStep,
    runPath,
    runText,
} from './module.f.mjs'

const { commit } = nixpkgs

/** @type {NixJob} */
const plain = {
    id: 'node24',
    systems: ['aarch64-linux'],
    packages: ['nodejs_24'],
}

/**
 * A hook in both its halves: text, and a package it has to name.
 *
 * The interpolation is the half that cannot be written as a string. A store
 * path is not knowable when this file is generated, so a reference has to
 * reach the flake unescaped and be resolved by Nix — which is exactly what
 * `ubuntu-intel32` needs to point `cargo` at a 32-bit linker. The text around
 * it is escaped, so the `$HOME` below arrives as those five characters rather
 * than as anything Nix reads.
 *
 * The package named here is a fixture, not the one that job uses: this file
 * proves how a hook *renders*, and `../rust/proof.f.mjs` proves what the job
 * actually declares.
 *
 * @type {NixJob}
 */
const withShellHook = {
    ...plain,
    id: 'node22',
    packages: ['nodejs_22'],
    shellHook: [
        'export NPM_CONFIG_PREFIX="$HOME/.npm-global"\nexport CC=',
        ['ref', 'pkgs', 'gcc_multi'],
        '/bin/cc',
    ],
}

/**
 * A job whose targets Nixpkgs has no `std` for, so its toolchain comes from the
 * second input. Everything that input brings — the `url`, the `follows`, the
 * lambda argument, the overlay, the `rust` binding and its place at the head of
 * `packages` — appears only for a job that asks for it, which `plainFlake`
 * below is what holds.
 *
 * @type {NixJob}
 */
const withRust = {
    ...plain,
    id: 'wasm',
    packages: ['wasmtime'],
    rust: {
        version: '1.98.0',
        extensions: ['clippy'],
        targets: ['wasm32-wasip1', 'wasm32-wasip2'],
    },
}

/**
 * A job whose runtime the snapshot carries at a version its suite fails on. The
 * flake keeps the snapshot's packaging and replaces only the archive, so the
 * override is a `let` binding and the shell takes that binding rather than
 * `pkgs.<package>` — which is what keeps the snapshot's copy off `PATH` beside
 * it.
 *
 * @type {NixJob}
 */
const withPin = {
    ...plain,
    id: 'bun',
    packages: [],
    pin: {
        package: 'bun',
        version: '1.4.0',
        sources: {
            'aarch64-linux': {
                url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-aarch64.zip',
                hash: 'sha256-SxozLuhhmD65O8/m93D/+U4+MbLDiL2uo8jtNeWO7Q4=',
            },
        },
    },
}

const plainFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
        };
    };
}
`

const shellHookFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_22 ];
            shellHook = ''
                export NPM_CONFIG_PREFIX="$HOME/.npm-global"
                export CC=\${pkgs.gcc_multi}/bin/cc
            '';
        };
    };
}
`

const rustFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    inputs.rust-overlay.url = "github:oxalica/rust-overlay/${rustOverlay.commit}";
    inputs.rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
    outputs = { nixpkgs, rust-overlay, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
            rust = pkgs.rust-bin.stable."1.98.0".minimal.override {
                extensions = [ "clippy" ];
                targets = [ "wasm32-wasip1" "wasm32-wasip2" ];
            };
        in
        pkgs.mkShell {
            packages = [ rust pkgs.wasmtime ];
        };
    };
}
`

const pinFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.0";
                src = pkgs.fetchurl {
                    url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-aarch64.zip";
                    hash = "sha256-SxozLuhhmD65O8/m93D/+U4+MbLDiL2uo8jtNeWO7Q4=";
                };
            };
        in
        pkgs.mkShell {
            packages = [ pinned ];
        };
    };
}
`

/**
 * A job exposing a shell for more than one system — the developer environment's
 * shape, at two systems rather than four.
 *
 * Both halves of a pinned archive vary with the system, so each shell carries
 * its own `url` and `hash`; everything else about the two is identical, written
 * out twice rather than abstracted over.
 *
 * @type {NixJob}
 */
const withSystems = {
    ...plain,
    id: 'dev',
    systems: ['aarch64-linux', 'x86_64-darwin'],
    packages: ['git'],
    pin: {
        package: 'bun',
        version: '1.4.0',
        sources: {
            'aarch64-linux': {
                url: 'https://example.test/bun-linux-aarch64.zip',
                hash: 'sha256-AAAA',
            },
            'x86_64-darwin': {
                url: 'https://example.test/bun-darwin-x64-baseline.zip',
                hash: 'sha256-BBBB',
            },
        },
    },
}

const systemsFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: let
        shell = { system, url, hash, ... }: let
            pkgs = import nixpkgs {
                system = system;
            };
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.0";
                src = pkgs.fetchurl {
                    url = url;
                    hash = hash;
                };
            };
        in
        pkgs.mkShell {
            packages = [ pinned pkgs.git ];
        };
    in
    {
        devShells.aarch64-linux.default = shell {
            system = "aarch64-linux";
            url = "https://example.test/bun-linux-aarch64.zip";
            hash = "sha256-AAAA";
        };
        devShells.x86_64-darwin.default = shell {
            system = "x86_64-darwin";
            url = "https://example.test/bun-darwin-x64-baseline.zip";
            hash = "sha256-BBBB";
        };
    };
}
`

/**
 * The same two systems with nothing pinned: the only thing that varies between
 * the two shells is then the system itself.
 *
 * That is the shape a project whose runtimes the snapshot carries at the right
 * versions would generate, and it is the one that keeps the shared function
 * honest — its argument list is what the shell reads, not a fixed three names
 * with two of them empty.
 *
 * @type {NixJob}
 */
const withSystemsUnpinned = {
    ...plain,
    systems: ['aarch64-linux', 'x86_64-darwin'],
}

const unpinnedSystemsFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: let
        shell = { system, ... }: let
            pkgs = import nixpkgs {
                system = system;
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
        };
    in
    {
        devShells.aarch64-linux.default = shell {
            system = "aarch64-linux";
        };
        devShells.x86_64-darwin.default = shell {
            system = "x86_64-darwin";
        };
    };
}
`

/**
 * `withPin`'s pin, without the optionality the type carries for jobs that
 * declare none.
 *
 * @type {(job: NixJob) => NixPin}
 */
const unwrapPin = ({ pin }) => {
    assert(pin !== undefined, 'expected a pinned release')
    return pin
}

/** @type {(jobs: readonly NixJob[], id: string, file: string) => string} */
const generatedFile = (jobs, id, file) => {
    // `flakePath` rather than a second spelling of it: the shared shell is the
    // generated directory itself, so a literal `nix/<id>/` here would read the
    // one path the generator never writes.
    const written = ioStep(
        nixFlakes(jobs),
        () => readUtf8File(`${flakePath(id).slice('./'.length)}/${file}`))
    const [, [tag, result]] = virtual(emptyState)(written)
    assert(tag === 'ok', result)
    return result
}

/** @type {(jobs: readonly NixJob[], id: string) => string} */
const generated = (jobs, id) => generatedFile(jobs, id, 'flake.nix')

/**
 * The generator run against a starting tree, so a proof can ask what it did to
 * a file that was already there.
 *
 * @type {(state: State) => readonly [State, Result<void, IoChannel>]}
 */
const runFlakes = state => virtual(state)(nixFlakes(nixJobs))

/**
 * One file out of a finished tree, as text. `undefined` for a path the
 * generator did not write, which is a distinct answer from an empty file.
 *
 * @type {(state: State, path: string) => string | undefined}
 */
const fileText = (state, path) => {
    const entity = state.root[path]
    // A file is the list of writes made to it, so a path present but empty is
    // not the same answer as a path absent — and neither is a directory.
    return entity instanceof Array && entity.length !== 0
        ? utf8ToString(entity[0])
        : undefined
}

/**
 * A file `nixFlakes` writes outside any job's directory. There is one.
 *
 * @type {(jobs: readonly NixJob[], path: string) => string}
 */
const generatedRootFile = (jobs, path) => {
    const written = ioStep(nixFlakes(jobs), () => readUtf8File(path))
    const [, [tag, result]] = virtual(emptyState)(written)
    assert(tag === 'ok', result)
    return result
}

export const proof = {
    flakeText: {
        plain: () => assertEq(flakeText(plain), plainFlake),
        shellHook: () => assertEq(flakeText(withShellHook), shellHookFlake),
        // The whole second input, pinned rather than described: the toolchain
        // is `minimal.override` with the job's own components and targets, the
        // overlay reaches `pkgs` through `import nixpkgs`, and the overlay's
        // own Nixpkgs follows ours so the flake resolves one snapshot.
        rust: () => assertEq(flakeText(withRust), rustFlake),
        // The override, pinned rather than described: no second input — this
        // needs none — and the archive's hash is in the flake, so the fetch is
        // checked before anything unpacks it.
        pin: () => assertEq(flakeText(withPin), pinFlake),
        // Two shells from one declaration, sharing the body that does not vary
        // and naming, per system, the three things that do. Still no loop and
        // no `flake-utils`: every system it serves is a `devShells.<system>`
        // binding you can read off the file, rather than a fold over a list the
        // file does not contain.
        systems: () => assertEq(flakeText(withSystems), systemsFlake),
        // The same, with nothing pinned: the shared function takes the system
        // and only the system. A flake that pins nothing has no `url` and no
        // `hash` anywhere in it, rather than two arguments the shell never
        // reads.
        unpinnedSystems: () =>
            assertEq(flakeText(withSystemsUnpinned), unpinnedSystemsFlake),
        // A package name reaches one quotable position and one binding the
        // generator owns, so an unusual one is escaped rather than rejected.
        // The `let` name is the generator's precisely so that it cannot be:
        // a reference's root must be an identifier, while a selection need not
        // be, and binding to the job's string would throw here instead.
        quotedPin: () => {
            const text = flakeText({
                ...withPin,
                pin: { ...unwrapPin(withPin), package: 'not an identifier' },
            })
            assert(
                text.includes('pinned = pkgs."not an identifier".overrideAttrs'),
                text)
            assert(text.includes('packages = [ pinned ]'), text)
        },
    },
    nixFlakes: {
        write: () => assertEq(generated([plain], plain.id), plainFlake),
        every: () => {
            for (const job of nixJobs) {
                assertEq(generated(nixJobs, job.id), flakeText(job))
            }
        },
        // The Node mapping only. Deno's and Bun's attributes are unversioned,
        // so there is no name to derive — their jobs' version checks carry
        // that tie instead.
        //
        // The runtime and nothing else. These two flakes exist only because
        // `npm ci` and `node --test` resolve `node` from `PATH`, so each holds
        // the one release its job proves this code runs on — anything more is
        // a build neither job ever opens, and a second `nodejs_*` would put two
        // on `PATH` with one winning silently.
        packages: () => {
            for (const { id, packages } of nodeNixJobs) {
                assertStructurallySame(
                    [...packages],
                    [`nodejs_${id.slice('node'.length)}`])
            }
            // The compiler is in the shared shell, which is where the job that
            // type-checks runs — see `../dev/proof.f.mjs`.
            assert(
                !nodeNixJobs.some(job => job.packages.includes(typescript.attribute)),
                'a job that only runs the suite needs no compiler')
        },
        // The `run` script is written beside every flake, naming that flake.
        // The only thing that varies between copies is the path.
        run: () => {
            for (const job of nixJobs) {
                assertEq(generatedFile(nixJobs, job.id, 'run'), runText(job.id))
            }
        },
        // `./dev.sh` is written once rather than per job, because it opens the
        // one shell a developer enters.
        devScript: () => {
            assertEq(
                generatedRootFile(nixJobs, devScriptPath),
                devScriptText)
            assertEq(devScriptPath, 'dev.sh')
        },
        // What it says, pinned. Three lines: the shebang, the line that says
        // who owns the file, and the command a person would otherwise have to
        // remember.
        devScriptText: () => {
            assertEq(devScriptText, `#!/bin/sh
# Generated by \`fjs ci\`. Edit fjs/ci/nix/module.f.mjs, not this file.
exec nix develop ./nix
`)
        },
        // The marker is what makes writing to the repository root safe for a
        // project that is not this one. `dev.sh` is a name a consumer may well
        // already have, and every other generated file lands in a directory
        // this generator owns.
        //
        // It is the marker rather than the whole text because the whole text is
        // the wrong question: an older generated `dev.sh` differs from the
        // current one and is still ours to replace, while a script that happens
        // to open a Nix shell is still theirs to keep.
        ownership: () => {
            assert(isDevScript(devScriptText), 'expected the generator to own its own output')
            // A plausible consumer script, and the same script with the marker
            // bolted on. Neither the command nor the shebang decides it.
            assert(
                !isDevScript('#!/bin/sh\nexec nix develop ./nix\n'),
                'expected an unmarked script to be left alone')
            assert(
                !isDevScript('#!/bin/bash\nnpm start\n'),
                'expected an unrelated dev.sh to be left alone')
            assert(!isDevScript(''), 'expected an empty file to be left alone')
            assert(
                isDevScript(`#!/bin/sh\n${devScriptMarker}\nanything at all\n`),
                'expected an older generated script to be replaceable')
            // Second line, because the first has to be the shebang.
            assert(
                !isDevScript(`${devScriptMarker}\n`),
                'expected the marker to be read on the line a shebang leaves free')
        },
        // The guard, run rather than described: the generator against a tree
        // that already has a `dev.sh`.
        //
        // This is the case the marker exists for. `fjs/README.md` offers
        // `fjs ci` to other projects, `dev.sh` is a name a project is likely to
        // have, and an unconditional write would truncate a consumer's build
        // script the first time they upgraded — silently, since nothing else
        // here reads that path.
        leavesAForeignDevScriptAlone: () => {
            const theirs = '#!/bin/bash\nnpm start\n'
            const [after] = runFlakes({
                ...emptyState,
                root: { [devScriptPath]: [utf8(theirs)] },
            })
            assertEq(fileText(after, devScriptPath), theirs)
            // And says so, rather than leaving a person to notice the shell
            // entry point never appeared.
            assert(
                after.stderr.includes(devScriptPath),
                'expected a line on stderr naming the file left alone')
        },
        // The two cases that do write: nothing there, and a file this
        // generator wrote. The second is what lets `devScriptText` ever change
        // — a lock on any existing file would freeze the first version shipped.
        writesItsOwn: () => {
            const [absent] = runFlakes(emptyState)
            assertEq(fileText(absent, devScriptPath), devScriptText)
            assertEq(absent.stderr, '')
            const [stale] = runFlakes({
                ...emptyState,
                root: {
                    [devScriptPath]: [utf8(`#!/bin/sh\n${devScriptMarker}\nan older one\n`)],
                },
            })
            assertEq(fileText(stale, devScriptPath), devScriptText)
            assertEq(stale.stderr, '')
        },
        // A read that fails for a reason other than "not there" writes nothing
        // and propagates. A file that cannot be read is not a file known to be
        // absent, and treating the two alike is how an unconditional write
        // sneaks back in wearing a check.
        //
        // Reached through `devScriptStep` rather than a fixture: the virtual
        // filesystem answers `ENOENT` for every shape a state can express — a
        // missing path and a directory alike — so this branch has no tree that
        // produces it.
        propagatesAnUnreadableFile: () => {
            /** @type {IoChannel} */
            const denied = ['ioError', { code: 'EACCES', message: 'permission denied' }]
            const [after, result] = virtual(emptyState)(devScriptStep(['error', denied]))
            assertEq(result[0], 'error')
            assertStructurallySame(result[1], denied)
            assertEq(fileText(after, devScriptPath), undefined)
            assertEq(after.stderr, '')
        },
        // It names the shared shell, and it names it the way the `run` script
        // beside that shell does — one source for `./nix`, so a flake that
        // moved could not leave this pointing at where it used to be.
        devScriptNamesTheSharedShell: () => {
            assert(
                devScriptText.includes(` ${flakePath(nixShell)}\n`),
                'expected ./dev.sh to name the shared shell')
        },
        // **No flags, and that is the difference from `run` rather than an
        // omission.** `--quiet` hides `copying path` and `building`, which are
        // noise in a CI log and the only sign of life at a terminal during a
        // first entry that fetches gigabytes. `--no-write-lock-file` stops CI
        // writing a tracked file; a developer's tree is not CI's, and a rewrite
        // there prints the hash `../config/module.f.mjs` is missing.
        //
        // A tidy-up that made this match the `run` script would be a
        // regression in both directions, so both absences are asserted.
        devScriptHasNoFlags: () => {
            assert(
                !devScriptText.includes('--quiet'),
                'unexpected --quiet: progress is what a person at a terminal wants')
            assert(
                !devScriptText.includes('--no-write-lock-file'),
                'unexpected --no-write-lock-file: a rewrite in a developer tree is useful')
            // And no `"$@"`: it opens a shell rather than running a command,
            // which is the whole of what separates it from `run`.
            assert(
                !devScriptText.includes('"$@"'),
                'unexpected argument pass-through in an interactive entry point')
        },
        // And so is the lock, which is the whole of why `--quiet` is back to
        // one. A flake with no lock beside it makes every `nix develop` compute
        // one, find it differs from nothing, and say so.
        lock: () => {
            for (const job of nixJobs) {
                assertEq(
                    generatedFile(nixJobs, job.id, 'flake.lock'),
                    lockText(job))
            }
        },
        // What a lock has to say, pinned rather than described — for a flake
        // with one input and for one with two.
        //
        // Every field is checked because every field is load-bearing to Nix:
        // drop `narHash` or `lastModified` and the lock is incomplete, so Nix
        // recomputes it and the warning this exists to remove comes back. The
        // revision appears twice on purpose. `original` is what the flake asked
        // for and `locked` is what that resolved to, and here they agree
        // because `github:owner/repo/<rev>` is already exact.
        lockText: () => {
            assertEq(lockText(plain), `{
  "nodes": {
    "nixpkgs": {
      "locked": {
        "lastModified": ${nixpkgs.lastModified},
        "narHash": "${nixpkgs.narHash}",
        "owner": "NixOS",
        "repo": "nixpkgs",
        "rev": "${commit}",
        "type": "github"
      },
      "original": {
        "owner": "NixOS",
        "repo": "nixpkgs",
        "rev": "${commit}",
        "type": "github"
      }
    },
    "root": {
      "inputs": {
        "nixpkgs": "nixpkgs"
      }
    }
  },
  "root": "root",
  "version": 7
}
`)
        },
        // The second input, and the `follows` that keeps one Nixpkgs revision
        // in the lock rather than two. Nix writes a redirected input as the
        // path to the node it follows — `["nixpkgs"]` — where a resolved one
        // gets `locked` and `original` of its own.
        lockTextFollows: () => {
            const text = lockText(withRust)
            assert(
                text.includes(`      "inputs": {
        "nixpkgs": [
          "nixpkgs"
        ]
      },`),
                'expected rust-overlay to follow the root nixpkgs')
            assert(
                text.includes(`"rev": "${rustOverlay.commit}"`),
                'expected the pinned rust-overlay revision')
            assert(
                text.includes(`"narHash": "${rustOverlay.narHash}"`),
                'expected the pinned rust-overlay hash')
            // One Nixpkgs, named once in each half of the one node that has it.
            assertEq(text.split(`"repo": "nixpkgs"`).length - 1, 2)
        },
        // What that script must say, pinned rather than described, for the
        // shared shell and for a flake with a directory of its own. `exec`
        // keeps the command's exit status; the path is written in rather than
        // derived, so there is no shell logic to read; `"$@"` passes the
        // caller's arguments through unsplit.
        //
        // This is also the whole of what holds the script to root `AGENTS.md`
        // §6, which forbids a generated script from calling an external tool:
        // the text is fixed, so reintroducing `dirname` — or anything else —
        // fails here. A separate guard scanning for tool names would add no
        // coverage this does not already have, and would be the kind of check
        // §6 describes: blind to any name it does not list, and tripped by one
        // appearing in a comment.
        runText: () => {
            assertEq(runText(nixShell), `#!/bin/sh
exec nix develop --no-write-lock-file --quiet ./nix --command "$@"
`)
            assertEq(runText(plain.id), `#!/bin/sh
exec nix develop --no-write-lock-file --quiet ./nix/node24 --command "$@"
`)
        },
        // One, and the count is arithmetic rather than taste. Nix has a single
        // verbosity integer: the default is `lvlInfo` (3), each `--quiet`
        // decrements it by one, and a message prints when its own level is at
        // most the current value. One reaches `lvlNotice` (2), which drops the
        // `copying N paths` chatter at `lvlInfo` and keeps every warning.
        //
        // There were three, and the second and third only existed to get below
        // `lvlWarn` (1) and hide `not writing modified lock file`. That took
        // every other Nix warning with them — a failing substituter, a dirty
        // tree, a deprecation notice — because global verbosity is the only
        // lever Nix has. `lockText` removed the cause, so a second `--quiet`
        // here would now buy nothing and cost the warning channel again.
        oneQuiet: () => {
            for (const job of nixJobs) {
                assertEq(
                    runText(job.id).split(' --quiet').length - 1,
                    1,
                    `expected one --quiet in ${job.id}'s run script`)
            }
        },
        // Two lines, and the second names a path. Omitting it would leave
        // `nix develop` defaulting to `.` — the *process* working directory,
        // which is the repository root, where there is no `flake.nix`.
        runNamesItsFlake: () => {
            for (const job of nixJobs) {
                const [shebang, command, ...rest] = runText(job.id).split('\n')
                assertEq(shebang, '#!/bin/sh')
                assert(
                    command?.includes(` ${flakePath(job.id)} `) === true,
                    `expected ${job.id}'s run script to name its flake`)
                assertStructurallySame([...rest], [''])
            }
        },
        // Every declared job runs on the one runner the flakes are generated
        // for. A second system would need its own `devShells.<system>.default`
        // rather than a loop, so a job that quietly declared another would
        // otherwise generate a shell no runner can enter.
        // Every job but the developer environment runs on one runner, and
        // declares the one system that runner is. Both exceptions are named
        // rather than exempted by a pattern: a job quietly declaring a second
        // system would otherwise generate a shell no runner enters.
        //
        // `dev` is the reason the list form exists — four systems, one per
        // machine a developer might have. `ubuntu-intel32` is the other, and
        // its one system is not the one every other job declares: it runs on
        // the Intel Linux runner, which is the one system where `pkgsi686Linux`
        // is not marked broken.
        systems: () => {
            for (const { id, systems } of nixJobs) {
                if (id === devJobId) {
                    assertStructurallySame([...systems], [...devSystems])
                } else if (id === i686JobId) {
                    assertStructurallySame([...systems], ['x86_64-linux'])
                } else {
                    assertStructurallySame([...systems], [nixSystem])
                }
            }
        },
        // Job data only ever reaches quotable positions, so an unusual package
        // name is escaped rather than rejected.
        quotedPackage: () => assert(
            flakeText({ ...plain, packages: ['not an identifier'] })
                .includes('pkgs."not an identifier"'),
            'expected a quoted attribute name'),
        multiplePackages: () => assert(
            flakeText({ ...plain, packages: ['nodejs_24', 'git'] })
                .includes('[ pkgs.nodejs_24 pkgs.git ]'),
            'expected both packages in the shell'),
    },
    workflow: {
        // The path a workflow passes to `nix develop` must be the directory the
        // generator wrote the flake into.
        flakePath: () => assertEq(flakePath(plain.id), `./${generatedDirectory}/node24`),
        // A step reads as the command it runs. The `nix develop` spelling and
        // its flags live in the generated script instead, once per job rather
        // than once per step.
        nixDevelop: () => assertEq(
            nixDevelop(plain.id, 'node --version'),
            './nix/node24/run node --version'),
        runPath: () => assertEq(runPath(plain.id), './nix/node24/run'),
        // The shared shell is the generated directory itself, not a `dev`
        // below it. `nix develop ./nix` is what a developer types, and the
        // name stays only as the label the declaration is found by.
        sharedShellIsTheDirectory: () => {
            assertEq(flakePath(nixShell), `./${generatedDirectory}`)
            assertEq(runPath(nixShell), `./${generatedDirectory}/run`)
            assert(
                !runPath(nixShell).includes(`/${nixShell}/`),
                `the shared shell must not sit under ./${generatedDirectory}/${nixShell}`)
        },
        // One step per command, each entering the shell itself (root
        // `AGENTS.md` §7) — never one invocation carrying the sequence.
        nixSteps: () => {
            const steps = nixSteps(plain.id)(['npm ci', 'node --test'])
            assertEq(steps.length, 2)
            assertStructurallySame(
                steps.map(s => s.type === 'test' ? s.step.run : undefined),
                ['./nix/node24/run npm ci', './nix/node24/run node --test'])
        },
        // The command and the expected string are independent: Node's output
        // carries a leading `v` that the configured version does not.
        nixVersionStep: () => {
            const step = nixVersionStep(plain.id, 'node --version', 'v24.19.0')
            assertEq(step.type, 'test')
            assertEq(
                step.type === 'test' ? step.step.run : undefined,
                'test "$(./nix/node24/run node --version)" = "v24.19.0"')
        },
        nixInstall: () => {
            assertEq(nixInstall.type, 'install')
            assert(
                nixInstall.type === 'install'
                && nixInstall.step.uses?.startsWith('cachix/install-nix-action@') === true,
                'expected the pinned Nix installer action')
        },
    },
}
