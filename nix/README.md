# Nix environments

`flake.nix` and `flake.lock` here, and `<job>/` copies of both below them, are
**generated** by
[`fjs/ci/nix`](../fjs/ci/nix/module.f.mjs) — four self-contained flakes. Do not
edit them by hand: run `npm run ci-update` and commit the result. The Node 26 CI
job fails when the committed files no longer match the generator's output. This
README is the one file here that is written by hand.

The flake in *this* directory is the shell: the one a developer enters, and the
one eight of the fourteen CI jobs run inside. It has no directory of its own
because it belongs to no single job — `nix develop ./nix` is the whole of what
there is to remember. Three jobs have a flake to themselves and a directory
each: `node22` and `node24`, whose `node` is the thing under test, and
`ubuntu-intel32`, whose 32-bit package set is marked broken on every system the
shell serves but one. The sections below say why each has to be.

Each flake pins the exact Nixpkgs commit from
[`fjs/ci/config`](../fjs/ci/config/module.f.mjs) and exposes one development
shell per system:

```sh
./nix/node24/run node --version
```

The pinned commit determines the package versions: `pkgs.nodejs_24` at that
revision is one exact Node release, and the same number is recorded in
`fjs/ci/config`. The flakes do not restate it — the job checks it from inside
the shell instead (below), which also catches a shell that builds but provides
the wrong binary. `pkgs.deno` and `pkgs.typescript-go` name no version at all,
so for those the check is the only thing tying the recorded version to what the
shell provides.

The files stay static and readable on purpose — no job selection, no
`flake-utils`, no shared Nix modules. A job that later needs a second system
gets a second explicit `devShells.<system>.default` attribute rather than a
loop.

### `run`

A generated `run` script sits beside every flake, and that is what CI invokes:

```sh
./nix/run npm run cov          # the shared shell
./nix/node22/run node --test   # a flake of its own
```

Two lines, and the only thing that differs between copies is the path:

```sh
#!/bin/sh
exec nix develop --no-write-lock-file --quiet ./nix --command "$@"
```

The path is written in because the generator knows it. Leaving it out would not
work: `nix develop` with no installable defaults to `.`, and that is the
*process* working directory — the repository root, where there is no
`flake.nix` — rather than the script's own directory. So every caller runs from
the repository root, which CI and a developer both do anyway.

A generated script calls no external tool ([`AGENTS.md`](../AGENTS.md) §6), and
this one has nothing that could: no `dirname`, and no shell logic doing its work
either. `"$@"` passes the caller's argument vector through unsplit, which is what
lets a step keep quoting of its own —
`./nix/deno/run deno eval 'console.log(…)'` arrives as three arguments rather
than as text to re-parse. `exec` replaces the shell, so the command's exit
status is the script's.

The two flags live there rather than in every step.

`--no-write-lock-file` is a **guard, not a fix**. With a correct lock beside the
flake, Nix writes nothing whether or not the flag is passed: it compares the lock
it computes against the one on disk and only writes when they differ. What the
flag buys is the case where they do differ — the generator owns this file, and
without the flag every Nix step in every job becomes a writer of a tracked one.
Nothing is lost by that, since `npm run ci-update` regenerates the lock from
`fjs/ci/config` and would revert a rewrite anyway. A future Nix whose lock schema
moves past version 7 is where that would otherwise be churn on every step at once.

`--quiet` appears **once**, and it does one thing. Nix has a single global
verbosity integer: the levels run `lvlError = 0, lvlWarn = 1, lvlNotice = 2,
lvlInfo = 3`, a message prints when its own level is at most the current value,
the default is `lvlInfo`, and each `--quiet` decrements by one. One reaches
`notice`.

What that removes: `this path will be fetched (N MiB download)` and one
`copying path '…' from '…'` per store path, plus `this derivation will be built:`
and `building '…'`. All `lvlInfo`, all progress rather than outcome.

What it leaves is everything that reports a problem. A warning survives it — only
the third `--quiet` reached below `lvlWarn` — and so does a failing build's log,
which arrives inside the error as `last N log lines`. The one real cost is that a
cache miss looks like a cache hit: Nix compiles from source in silence and the job
is only slower. That is bounded, because the store persists across a job's steps,
so substitution happens on the first `./nix/run` and no other.

**There used to be three.** With no committed `flake.lock`,
`--no-write-lock-file` made every step of every Nix job print `not writing
modified lock file` and list every input, five lines at a time. Global verbosity
is the only lever Nix offers — `--verbose`, `--quiet` and `--debug` are the whole
logging category, and verbosity is not a `nix.conf` setting, so `--option` cannot
reach it — so getting below `lvlWarn` to hide that one warning hid them all: a
failing substituter, a dirty tree, a deprecation notice. The lock removed the
cause, and the two flags came off with it.

Nix has no shorter spelling: `--verbose` declares a `v` short name and `--quiet`
declares none, so `-q` is not an option the `nix` CLI accepts, and the `-Q` that
exists is `--no-build-output` on `nix-build`/`nix-shell` rather than on this
command. No flag reaches the command being run — `--command` execs it with stdio
inherited — so a job's own output is unchanged.

### `../dev.sh`

`./nix/run` hands the shell a command: `../dev.sh`.

It is **not** generated — the one Nix-related script that is not. There is
nothing in it that varies with a job, a pin or a system, so generating it would
buy a drift check over two lines that have no reason to move, and would cost the
generator a write into the repository root, where a consuming project is quite
likely to have a `dev.sh` of its own. It is committed once, like this README.

It lives at the root because that is where a person types it, and it takes no
arguments — a shell is what it opens, so there is nothing to pass through.

### `flake.lock`

A lock is generated beside every flake, from `narHash` and `lastModified` in
[`fjs/ci/config`](../fjs/ci/config/module.f.mjs), and committed.

Nothing runs `nix flake lock` to produce it. `fjs ci` has to run wherever the
project is developed, including Windows, where Nix does not run at all — so the
two values a lock adds on top of the revision are **data**, the way `bunSources`'
archive hashes already are, and the generator writes the file the way it writes
`flake.nix`. That keeps `npm run ci-update` pure text generation on every
operating system, and keeps the lock inside the drift check: bump the Nixpkgs
pin without updating its hash and `node26` fails, where a hand-written lock would
simply rot.

Both values are facts about a published revision. `fjs/ci/config` records the two
ways to recompute them — `nix flake metadata` on a machine that has Nix, or a
CI log, which lists every input's `narHash` in exactly the warning a missing lock
produces. Getting one wrong is loud rather than silent: Nix recomputes,
disagrees, and warns on every step again.

The generator writes the script's **content**; its executable bit is committed
once and preserved by every regeneration, because `fs.writeFile` keeps the mode
of a file that already exists. A job generated for the first time needs
`git update-index --chmod=+x <path>` by hand —
[`fjs/ci/todo/generated-run-script-mode.md`](../fjs/ci/todo/generated-run-script-mode.md)
is about removing that step.

Every canonical job with a flake runs through it — the three Node jobs, `deno`,
`wasm` and `bun`. Each installs Nix, asserts the versions of the tools it is
about to use, and then runs its commands one `nix develop` step each, because a
CI step runs one command. No separate job makes those checks: a flake is checked
by the jobs that use it, and every generated flake has at least one.

One canonical job has no flake: `package-check` runs with no checkout, which is
the whole point of it, and a flake and its `run` script are files in a checkout.
`fjs/ci/todo/65z-ci-nix.md` says so.

### The developer environment

`dev` carries everything the canonical jobs use at once — Node 26, Deno, the
pinned Bun, TypeScript, a Rust toolchain with every WASM target, Wasmtime,
Wasmer and `git` — so that one shell is enough to work in:

```sh
nix develop ./nix          # an interactive shell
./nix/run npm run cov      # or one command in it
```

It cannot drift from what the jobs run, because it *is* what they run. Each tool
is declared beside the commands using it — the Bun override in `fjs/ci/bun`, the
toolchain and its targets in `fjs/ci/rust` — and this shell takes those
declarations rather than restating them. `git` is here for the developer alone:
`nix develop` builds an environment from what the shell asks for rather than
from what the machine has, so a shell without it is one you leave immediately.

TypeScript is here for a reason the others are not: it is no longer an npm
dependency of this repository, so `npm ci` does not put a `tsc` in
`node_modules` and `npm test` or `npm pack` outside this shell needs one
installed globally. `fjs/ci/config/module.f.mjs` says which version, and why the
attribute is `typescript-go` rather than `typescript`.

**Why sharing is safe, and where it is not.** The jobs used to have a flake
each, on the reasoning that a shell with five runtimes would let a job pass on
whichever `node` came first on `PATH`. That risk is real and it is narrower than
the rule it produced: it applies only where a command resolves its runtime from
`PATH`. `deno task cov`, `bun test`, `cargo test` and `tsc` all name theirs, so
what else is installed cannot decide what runs them — those jobs share this
shell, and CI therefore proves the environment people actually work in.

`npm ci` and `node --test` name nothing. They run whichever `node` they find,
and one shell has one `node` — so `node22` and `node24` keep a flake apiece
holding the single release each exists to test. `node26` needs no such thing:
the release it wants is this shell's.

It exposes four shells — `aarch64-linux`, `x86_64-linux`, `aarch64-darwin`,
`x86_64-darwin` — one named `devShells.<system>.default` each, and
`nix develop` picks the one matching the machine. The shell itself is written
once, as a function those four entries call with the three things that differ:
the system, and the archive and hash Bun publishes for it. The single-system
flakes keep their shell inline, since a function called once would be
indirection for nothing. Nix does not run natively on Windows, so a Windows
developer reaches it through WSL2 or works the way this repository has always
supported natively.

There is no `dev` CI job. There was one, for exactly one reason — nothing else
evaluated this flake, so it would have rotted until a developer's shell failed
to build — and four jobs entering it on every pull request is a stronger answer
than one job asserting six versions. Between them they still assert all six:
`node` and `tsc` from `node26`, `deno` from `deno`, `bun` from `bun`, both WASM
runtimes from `wasm`.

Those jobs run on one runner, so one of the four shells is built for real; the
other three are generated from the same declaration and pinned as text.

### The `bun` flake's overridden package

Every package in every other flake comes from the pinned snapshot. Bun does not.
Nixpkgs ships 1.3.13, and two of this repository's proofs fail on it — one a real
difference in when JavaScriptCore reads `Symbol.species`, which no timeout
setting reaches. So that flake keeps the snapshot's recipe and replaces the
archive it unpacks:

```nix
pinned = pkgs.bun.overrideAttrs {
    version = "1.4.0";
    src = pkgs.fetchurl {
        url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-aarch64.zip";
        hash = "sha256-SxozLuhhmD65O8/m93D/+U4+MbLDiL2uo8jtNeWO7Q4=";
    };
};
```

Everything the snapshot does with that archive still happens — unzip,
`autoPatchelfHook`, the wrapper — and the hash is checked before any of it. The
shell takes the `let` binding rather than `pkgs.bun`, which is what keeps 1.3.13
off `PATH` beside it.

The binding is named `pinned` by the generator rather than after the package,
like `rust` in the `wasm` flake. A Nix reference has to start with an
identifier, while an attribute *selection* can be quoted — so naming it after
the package would fail to serialize for any package name Nix would need to
quote, in a flake where `pkgs."…"` is perfectly fine.

This is possible only because Nixpkgs fetches Bun as a prebuilt archive; a
package built from source would make this repository the maintainer of a package
definition. The archive name carries the system, so a job on another runner needs
another URL *and* another hash. Both constants in `fjs/ci/config` are deleted the
day the snapshot carries a Bun this suite passes on.

### The `wasm` flake's second input

`wasm` is the only flake with two inputs, and the extra one is why that job could
be migrated at all.

Nixpkgs builds a single `rustc` and hard-codes the targets it builds `std` for —
the host, `wasm32-unknown-unknown`, `wasm32v1-none` and two BPF targets. Three of
