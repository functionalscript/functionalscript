# Nix environments

One reproducible toolchain, shared by developers and CI, so that what passes on
your machine is what passes on the runners — except Intel macOS and the two
Windows platform jobs, which install their tools directly, the publishing workflow, on the Node `setup-node` installs, and
the packed-package check that closes `node26`, which installs the published
tarball as a consumer would.

[`dev.sh`](../../../dev.sh) opens the shell, or runs the one command given to
it; [`gen.nix/run`](../../../gen.nix/run) is the generated form of the latter,
and is what a CI step runs, through `sh`.

Everything the project builds and tests with lives in the shell
[`gen.nix/flake.nix`](../../../gen.nix/flake.nix) defines — the runtimes, the compilers, the WASM
tooling. It is not a convenience assembled alongside CI: every CI job but the
exceptions named above runs its commands inside this very shell, so it cannot
drift from them.

Everything else a job needs is here, including what only one platform can have.
The shell is not identical on every system — `x86_64-linux` carries a 32-bit
`rust-std` and the linker for it, from a package set that exists on x86 Linux
and throws anywhere else — and that is the point rather than an exception: the
shell a platform's developer enters runs everything that platform's CI does. A
system that carries more says so at its own `devShells.<system>.default`, so
what each one has is something you read rather than evaluate.

## Everything in `gen.nix/` is generated

The directory takes the `gen.` name every generated file has
([CONTRIBUTING.md](../../../CONTRIBUTING.md#naming-generated-files)), and
nothing handwritten lives in it — which is why this README sits beside the
generator instead. The shared `flake.nix` and `run` are written by
[`module.f.mjs`](./module.f.mjs) from
[`../config/module.f.js`](../config/module.f.js), which is also where tool
versions and pinned commits are chosen. Don't edit them by hand — change the
generator or the config, run `./dev.sh npm run gen`, and commit the result. CI fails when
the committed files no longer match what the generator produces, and
`gen:clean` empties the directory first, so a job the generator stopped
writing shows up as deletions.

Run generation directly, without standalone `gen:clean`: the existing lock is
needed to enter the shell before generation removes and recreates it. An
unsuccessful lock update is incomplete generation, so commit the resulting
shared lock only after generation succeeds.

`flake.lock` is generated too, but not by `fjs ci`, which never runs Nix: the
generator writes [`gen.nix/lock-update.sh`](../../../gen.nix/lock-update.sh),
which locks the shared flake from its pinned commit through real Nix, and
`npm run gen` ends by running it. So a committed lock that differs from what
the pinned commit produces is a drift-check failure like any other stale
generated file, and `gen` needs Nix. Forgetting is not silent either way — the
next CI job into the shell fails rather than quietly resolving a new lock.

`fjs ci` alone does not clean obsolete output in another project. Upgrades
from the older three-flake layout must delete `gen.nix/node22/` and
`gen.nix/node24/` themselves; this repository's integrated generation removes
them. The supported toolset is one exact accepted version per tool for each
prerelease, preserved in the release's configuration, locks and tested toolset
record. An older tool requires a FunctionalScript release whose record names
it; future additional-version support depends on actual demand.

The scripts carry no executable bit: a regeneration from nothing cannot set
one, so a step runs them as `sh ./gen.nix/run <command>` and the mode never
matters. [`dev.sh`](../../../dev.sh) at the repository root is the one script
that is not generated: nothing in it varies with a job, a pin or a system, and
generating it would mean writing into the repository root of every consuming
project.

## Why the shells look the way they do

The flake stays explicit — no job selection, no `flake-utils`, no
shared modules. A reader should be able to see what a shell provides without
evaluating anything, and a job that needs a second system gets a second
attribute rather than a loop.

The flake states pinned commits, not package versions. The version a pin
resolves to is asserted by the jobs that enter the shell, which also catches a
shell that builds but hands over the wrong binary — something a version restated
in the flake could never catch.

A check earns its place only where the flake does not already give the answer,
so a toolchain named by its exact version is not re-checked. The one check that
carries different weight is Bun's: Nixpkgs ships a release two of this
repository's proofs fail on, so its flake overrides the archive, and that check
is what confirms the override took effect.

The generated shell supports Linux and ARM macOS. Intel macOS installs the
pinned tools directly ([CONTRIBUTING.md](../../../CONTRIBUTING.md#direct-tools-on-intel-macos)).
Nix does not run natively on Windows; a Windows developer reaches this shell
through the repository's devcontainer or WSL2
([CONTRIBUTING.md](../../../CONTRIBUTING.md#the-nix-shell)), or works on bare
Windows with the tools installed by hand, as CI's Windows platform jobs do.
