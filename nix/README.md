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

Every canonical job with a flake runs through it — the three Node jobs, `deno`,
`wasm`, `bun`, and the `dev` job that keeps the developer environment honest. Each installs Nix, checks the runtime its shell provides, and then runs
its commands one `nix develop` step each, because a CI step runs one command. No
separate job makes that check — a flake is checked by the job that uses it, and
every generated flake has one.

One canonical job has no flake: `package-check` runs with no checkout, which is
the whole point of it, and a flake and its `run` script are files in a checkout.
`fjs/ci/todo/65z-ci-nix.md` says so.

### The developer environment

`dev` is the one flake here that is not a job's runtime under test. It carries
everything the canonical jobs use at once — Node 26, Deno, the pinned Bun, a
Rust toolchain with every WASM target, Wasmtime, Wasmer and `git` — so that one
shell is enough to work in:

```sh
nix develop ./nix/dev          # an interactive shell
./nix/dev/run npm run cov      # or one command in it
```

It is generated from the same declarations the jobs use, so it cannot drift from
them: the Node version is the one `node26` runs, the Bun override is the `bun`
job's, the toolchain and its targets are the `wasm` job's. `git` is declared
because `nix develop` builds an environment from what the shell asks for rather
than from what the machine has.

The CI jobs deliberately do **not** share it. Each exists to test one runtime,
and a shell with five would let a job pass on whichever `node` came first on
`PATH`.

It exposes four shells — `aarch64-linux`, `x86_64-linux`, `aarch64-darwin`,
`x86_64-darwin` — one named `devShells.<system>.default` each, and
`nix develop` picks the one matching the machine. The shell itself is written
once, as a function those four entries call with the three things that differ:
the system, and the archive and hash Bun publishes for it. The single-system
flakes keep their shell inline, since a function called once would be
indirection for nothing. Nix does not run natively on Windows, so a Windows
developer reaches it through WSL2 or works the way this repository has always
supported natively.

A `dev` CI job enters the shell and asserts all five runtime versions. Nothing
else would ever evaluate this flake — every other one is entered by the job that
owns it — so without that job it would rot until a developer's shell failed to
build. That job runs on one runner, so one of the four shells is evaluated for
real; the other three are generated from the same declaration and pinned as
text.

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
this job's four are not among them, at any Nixpkgs version, because that list is
compiled into the derivation rather than passed to it. So the flake takes its
toolchain from `github:oxalica/rust-overlay`:

```nix
rust = pkgs.rust-bin.stable."1.98.0".minimal.override {
    extensions = [ "clippy" "rustfmt" ];
    targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
};
```

That overlay is not a different build of Rust; it is a different way of getting
it. Rust publishes a manifest per release listing every component and target with
a URL and a hash, and the overlay checks a generated Nix file per version into its
own repository — so this expression selects among the same tarballs `rustup` would
install, pinned by hashes inside an input `fjs/ci/config` pins. Nixpkgs ignores
that manifest and compiles from source, which is the whole of the difference.

`inputs.rust-overlay.inputs.nixpkgs.follows = "nixpkgs"` keeps the flake resolving
one snapshot rather than two. `minimal` plus the two components the job runs
avoids `rust-docs`, which the `default` profile would download and nothing here
opens. Wasmtime and Wasmer stay ordinary Nixpkgs packages.

The check's shape follows the runtime rather than a convention: `node --version`
prints a leading `v` the configured version does not carry, while
`deno --version` prints three lines — the runtime, V8 and TypeScript — so Deno
is asked for `Deno.version.deno` instead of pinning two versions nobody
configured. `wasm` checks two runtimes rather than one, since its shell provides
two, and neither `pkgs.wasmtime` nor `pkgs.wasmer` names a version. `bun` prints
the bare version with no prefix at all.

Bun's check is the one that carries a different weight. Every other confirms that
a snapshot provides what the configuration claims; that one confirms an override
took effect — a failed `overrideAttrs` would leave 1.3.13 in the shell, and two
failing proofs would be how anyone found out.

It checks no Rust. That is the same rule read the other way: a check earns its
place where the flake does not already say the answer, and this one says
`stable."1.98.0"` in full.

Node 26's drift check is a plain step, not a `nix develop` one: `git` is the
runner's tool, and a step names the flake only when it needs something the flake
pins.

Nix runs nowhere else in CI. What a generated flake declares is asserted without
Nix by two proofs: `fjs/ci/proof.f.mjs` requires the written file to equal the
generator's text for that job, and each Node job's package attribute to follow
the configured version; `fjs/ci/nix/proof.f.mjs` pins that text character for
character, the pinned commit and `devShells.<system>.default` included.
