# Nix environments

`<job>/flake.nix` is **generated** by [`fjs/ci/nix`](../fjs/ci/nix/module.f.mjs)
— one self-contained flake per CI job, in a directory named after the job. Do
not edit these files by hand: run `npm run ci-update` and commit the result. The
Node 26 CI job fails when the committed files no longer match the generator's
output. This README is the one file here that is written by hand.

Each flake pins the exact Nixpkgs commit from
[`fjs/ci/config`](../fjs/ci/config/module.f.mjs) and exposes a single
development shell for the job's runner:

```sh
./nix/node24/run node --version
```

The pinned commit determines the package versions: `pkgs.nodejs_24` at that
revision is one exact Node release, and the same number is recorded in
`fjs/ci/config`. The flakes do not restate it — the job checks it from inside
the shell instead (below), which also catches a shell that builds but provides
the wrong binary. `pkgs.deno` names no version at all, so for that job the check
is the only thing tying the recorded version to what the shell provides.

The files stay static and readable on purpose — no job selection, no
`flake-utils`, no shared Nix modules. A job that later needs a second system
gets a second explicit `devShells.<system>.default` attribute rather than a
loop.

### `run`

Each job directory also holds a generated `run` script, and that is what CI
invokes:

```sh
./nix/node26/run npm run cov
```

It is the same two lines for every job:

```sh
#!/bin/sh
case $0 in */*) d=${0%/*} ;; *) d=. ;; esac
exec nix develop --no-write-lock-file --quiet "$d" --command "$@"
```

The `case` line resolves the flake from the script's own location, so it behaves
the same from the repository root, from `nix/`, or by absolute path. It is shell
syntax and parameter expansion rather than `dirname`, because a generated script
calls no external tool ([`AGENTS.md`](../AGENTS.md) §6); the second arm is what
makes a `$0` with no `/` mean the current directory, which stripping a suffix
cannot say by itself. `"$@"` passes the caller's argument vector through
unsplit, which is what lets a step keep quoting of its own —
`./nix/deno/run deno eval 'console.log(…)'` arrives as three arguments rather
than as text to re-parse. `exec` replaces the shell, so the command's exit
status is the script's.

The two flags live there rather than in every step. `--no-write-lock-file` keeps
the invocation read-only against the checkout: Nix otherwise writes a
`flake.lock` beside the flake it enters, and the pin already determines every
input, so that lock resolves nothing the flake did not already say. The root
`.gitignore` still ignores those files, for a hand-run `nix develop` that omits
the flag.

`--quiet` drops Nix's own logging from `info` to `notice`. That removes the
substitution chatter — the `copying N paths` lines that are most of what these
steps print and none of what they check — while leaving warnings and errors,
which sit below `notice`. Nix has no short spelling for it: `--verbose` declares
a `v` short name and `--quiet` declares none, so `-q` is not an option the `nix`
CLI accepts, and the `-Q` that exists is `--no-build-output` on
`nix-build`/`nix-shell` rather than on this command. Neither flag reaches the
command being run — `--command` execs it with stdio inherited — so a job's own
output is unchanged.

The generator writes the script's **content**; its executable bit is committed
once and preserved by every regeneration, because `fs.writeFile` keeps the mode
of a file that already exists. A job generated for the first time needs
`git update-index --chmod=+x nix/<job>/run` by hand —
[`fjs/ci/todo/generated-run-script-mode.md`](../fjs/ci/todo/generated-run-script-mode.md)
is about removing that step.

Every canonical job with a flake runs through it — the three Node jobs and
`deno`. Each installs Nix, checks the runtime its shell provides, and then runs
its commands one `nix develop` step each, because a CI step runs one command. No
separate job makes that check — a flake is checked by the job that uses it, and
every generated flake has one.

`bun` is the exception, and the only canonical job with no flake: Nixpkgs
packages no Bun this repository's proofs pass on, so that job still installs its
runtime with `oven-sh/setup-bun`. `fjs/ci/todo/bun-nix-blocked-on-nixpkgs.md`
records what has to change first.

The check's shape follows the runtime rather than a convention: `node --version`
prints a leading `v` the configured version does not carry, while
`deno --version` prints three lines — the runtime, V8 and TypeScript — so Deno
is asked for `Deno.version.deno` instead of pinning two versions nobody
configured.

Node 26's drift check is a plain step, not a `nix develop` one: `git` is the
runner's tool, and a step names the flake only when it needs something the flake
pins.

Nix runs nowhere else in CI. What a generated flake declares is asserted without
Nix by two proofs: `fjs/ci/proof.f.mjs` requires the written file to equal the
generator's text for that job, and each Node job's package attribute to follow
the configured version; `fjs/ci/nix/proof.f.mjs` pins that text character for
character, the pinned commit and `devShells.<system>.default` included.
