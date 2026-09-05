## 65Z-ci-nix. Generate simple CI flakes from official Nixpkgs

**Priority:** P3
**Status:** wip

### Progress

Flake generation is implemented and **every canonical job that can be is migrated** —
the three Node jobs, then `deno`, then `wasm`, then `bun`. Each installs Nix through the pinned action and runs its
command sequence one `nix develop` step per command. Nix runs in CI only where a job uses
a flake — the temporary `nix-flakes` job that instantiated them to check them is gone,
and every generated flake is now evaluated by the job that uses it. What needs no Nix is
established by proofs over the generator's output. See the progress note in
[66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md).

`setup-deno` is gone with the Deno migration, and `fjs/ci/config/module.f.mjs` no longer
records that action version; its `deno` pin now names what the snapshot provides — 2.8.3
— rather than deno.com's latest, exactly as the Node pins do. `nixJobs` in
`fjs/ci/module.f.mjs` composes the flakes of two families rather than aliasing the Node
list.

Separately from Nix, `deno` and `bun` both stopped installing and running a published
`functionalscript`, and the three platform jobs that moved into the shared shell
went the same way — `npm install -g` writes to the read-only store from inside a
shell, and the check tests a shipped release rather than the commit under review.
`ubuntu-intel` and the two Windows jobs still run it, so it survives on three
images rather than six. That is [built-package-checks](built-package-checks.md)'s
subject, not this issue's, but it is why those jobs are shorter than the
migration alone would leave them.

Deno brought one thing the Node jobs did not: `pkgs.deno` carries no version, so the
proof that ties `nodejs_24` to the configured Node has no counterpart for it. Its CI
version check is the whole tie, which is why that check is worth more there than it is
for Node.

#### `wasm`, and the second input

The WASM job needed something the other four did not, and getting it changed this
issue's scope rather than its implementation.

Nixpkgs builds **one** `rustc` and hard-codes the targets it builds `std` for —
`pkgs/development/compilers/rust/rustc.nix`, `--target=`: the host,
`wasm32-unknown-unknown`, `wasm32v1-none` and two BPF targets. Three of this job's
four — `wasm32-wasip1`, `wasm32-wasip2`, `wasm32-wasip1-threads` — are not among
them, on the pinned commit or on `master`, so 16 of its 23 commands would fail at
`E0463` before running anything. That list is not a package argument, so no version
reaches it: the constraint is which standard libraries the derivation was configured
to build, not which Rust it builds them with. `pkgsCross` models `wasm32-wasip1`
only, one target per package set, and a shell holds one `cargo`.

So the job's flake takes its toolchain from a **second input**,
`github:oxalica/rust-overlay`, and this issue's "one official Nixpkgs snapshot" scope
is widened by exactly that much. What the overlay does is not a different build; it is
a different acquisition. Rust publishes a manifest per release —
`channel-rust-1.98.0.toml`, every component and target with a URL and a hash — and the
overlay checks a generated Nix file per version into its own repository, so
`rust-bin.stable."1.98.0".minimal.override { extensions targets }` selects among the
same tarballs `rustup` would install, pinned by hashes that live in a flake input this
repository pins. Nixpkgs ignores that manifest and builds the compiler from source,
which is the whole of the difference.

The cost is a second upstream, recorded in `fjs/ci/config/module.f.mjs` beside the
Nixpkgs commit and updated on its own schedule.
`inputs.rust-overlay.inputs.nixpkgs.follows` keeps the flake resolving one snapshot
rather than two. The `minimal` profile plus the two components the job runs is
deliberate: `default` would add `rust-docs`, a download nothing here opens.

The two runtimes stay official: `pkgs.wasmtime` and `pkgs.wasmer`, whose attributes
carry no version, so the job checks both from inside the shell exactly as `deno` does.
Its Rust it does not check — `stable."1.98.0"` names the release in full, so a check
would restate the flake rather than test it. The snapshot's Wasmtime is 45.0.2, which
predates the wasi-threads removal in 47 that
[wasmtime-threads](../../../todo/blocked/wasmtime-threads.md) records, so the
Wasmer-only threads target now tests less than it could rather than something it
cannot; revisit when the snapshot moves past 47.

#### `bun`, and the one package the snapshot does not decide

Bun was attempted, reverted, and then migrated a third way. Nixpkgs ships 1.3.13 — on
the pin and on `master` — and two of this repository's proofs fail on it while passing
on 1.4.0. One is a real difference in when `Symbol.species` is read rather than a slow
machine, so no timeout or configuration change reaches it, and weakening a proof to
move a job to Nix was never a trade worth making.

What changed is the reading of the problem. Nixpkgs fetches Bun as a **prebuilt
archive** — `stdenvNoCC.mkDerivation`, `dontBuild = true`, unzip, `install -Dm 755`,
`autoPatchelfHook` — so the gap was a version on a download, not a component nobody
builds. The job's flake therefore keeps that recipe and replaces only `src`:

```nix
pinned = pkgs.bun.overrideAttrs {
    version = "1.4.0";
    src = pkgs.fetchurl { url = "…/bun-v1.4.0/bun-linux-aarch64.zip"; hash = "sha256-…"; };
};
```

The binding is the generator's name, not the package's — as `rust` is in the
`wasm` flake. A reference has to start with a Nix identifier while a selection
can be quoted, so naming it after the package would refuse to serialize names
that `pkgs."…"` handles without trouble.

No second input, and no third party: the archive is the vendor's own release and the
hash is this repository's, computed by downloading and hashing it. That is the whole
difference from `wasm`, where the missing piece was a `rust-std` Nixpkgs never builds
and an overlay was the only way in.

**Treat it as an exception with an expiry, not a pattern.** It works because the
package is a repackaged binary; a package built from source would make this repository
the maintainer of a package definition. `fjs/ci/config/module.f.mjs` carries the
version and the hash together, and both are deleted the day the snapshot carries a Bun
this suite passes on. The job's version check is what holds it: unlike every other
check, which confirms a snapshot provides what the configuration claims, this one
confirms the override took effect at all.

#### The shell

`dev` carries every tool the jobs use — Node 26, Deno, the pinned Bun,
TypeScript, the toolchain with its WASM targets, Wasmtime, Wasmer and `git`. It
is what a developer enters, and what all but two CI jobs run inside.

It is generated rather than hand-written for two reasons. It cannot drift from
the jobs, since it is built from their own declarations; and the drift check
covers it, which a hand-written `nix/flake.nix` would have escaped — verifying
one would mean pattern-matching Nix source, which root `AGENTS.md` §6 rules out.

**Sharing, and its one limit.** Each job started with a flake of its own, on the
reasoning that a shell with five runtimes would let a job pass on whichever
`node` reached `PATH` first. That risk is real and narrower than the rule it
produced: it applies only where a command resolves its runtime from `PATH`.
`deno task cov`, `bun test`, `cargo test` and `tsc` all name theirs, so what
else is installed cannot decide what runs them.

`npm ci` and `node --test` name nothing, and one shell holds one `node`. So
Node 22 and Node 24 keep a flake apiece, and everything else shares — which is
worth more than the uniformity: the environment CI proves is now the one people
work in, rather than a fifth arrangement nobody uses.

The cost is per-job download. A `deno` job that used to realise one package now
realises the whole closure, toolchain included, and there is no binary cache of
our own yet — `096-ci-caching.md` is where that goes.

**It is why a declaration names systems rather than a system.** A CI job runs on
one runner image; a developer environment has to work on Linux and macOS, on
both architectures.

Each system is its own named `devShells.<system>.default`, and past the first
they share the shell between them: the body is written once as a function, and
each entry calls it with the three things that differ — the system, and the
archive and hash a pinned package takes on it. That keeps `flake-utils` out
without keeping four copies of twenty lines in. The distinction worth holding
is *named entries versus a fold*: which systems a flake serves is still
something the file says, rather than something a loop over a list computes. A
single-system flake stays flat, byte for byte what it was, because a function
called once is indirection for nothing.

Nix does not run natively on Windows, so those four are all there are. A Windows
developer reaches the shell through WSL2 or works the way this repository has
always supported natively — nothing here requires Nix.

There is no `dev` CI job. There was one, and its only reason was that nothing
else evaluated this flake; eight jobs entering it on every pull request answers
that better than one job asserting six versions. Between them they still assert
all six — `node` and `tsc` from `node26`, `deno` from `deno`, `bun` from `bun`,
both WASM runtimes from `wasm`.

And all four shells are now built for real, which was not true when this was
written. The canonical jobs run on one runner, so they only ever exercised
`aarch64-linux`; the four platform jobs that joined cover `x86_64-linux` and
both Darwin systems, each asserting the Node its shell provides before running
anything.

One consequence for a project that is not this one: `nixJobs` is a list rather
than a function of the project, so a project without a `Cargo.toml` gets no
`wasm` job and therefore nothing checking the two WASM runtimes in its shell.
That is the same trade `ci-generator-audience.md` describes for every job this
generator writes unconditionally.

#### Jobs with no flake

One canonical job has none. That the set is exactly this one is asserted by
`fjs/ci/proof.f.mjs`'s `nixCoverage`, so a job added later has to come here and say
which side of the line it falls on.

- **`package-check`** — not blocked: out of scope by construction. The job runs with
  no checkout, which is its whole point — with the repository on the runner there
  would be a `tsconfig.json` up the tree and a `node_modules` to resolve into, and
  the check would pass on the repository rather than on the package. A generated
  flake and its `run` script are files *in* the checkout, so entering one means
  putting the repository back. Its Node comes from `setup-node`, and the version it
  names is the one `node26`'s flake already checks.

Two of the six platform jobs are here too, and for one reason: **Nix does not
run natively on Windows**. `windows-intel` and `windows-arm` keep the runner's
toolchain, and are the last jobs in the workflow that install one.

The other four — `ubuntu-intel`, `ubuntu-arm`, `macos-intel`, `macos-arm` —
moved into the shared shell, all of them, so the matrix differs by platform and
by nothing else. They are also what makes `devSystems` mean anything: they are
the only place its `x86_64-linux`, `aarch64-darwin` and `x86_64-darwin` shells
are built rather than pinned as text.

32-bit Linux became a **job of its own**, `ubuntu-intel32`, which keeps the
one-shell-per-job property `../proof.f.mjs`'s `nixCoverage` asserts, lets the
two run in parallel, and makes a red result name 32-bit Linux rather than one of
nine things.

It had a flake of its own at first, because its linker is
`pkgsi686Linux.stdenv.cc` and that attribute throws on every system the shared
shell serves but `x86_64-linux` — so a job-wide `shellHook` would have broken
`nix develop ./nix` on both macOS systems and on ARM Linux. That is a fact about
the *system*, not about the job, and it is now declared as one: `NixJob`'s
`perSystem` gives one system extra toolchain targets and a hook of its own, the
flake writes them at that system's `devShells` entry, and the job enters the
shared shell like every other. A developer on Intel Linux therefore has the
whole of what that platform's CI runs, which was the point.
That replaced `apt-get install libc6-dev-i386` rather than joining it: the Nix
cc-wrapper keeps `/usr/include` and `/usr/lib` off its search paths, so a libc
from the runner's package manager is invisible to the compiler `cargo` invokes.

The linker is `pkgsi686Linux.stdenv.cc` — Nixpkgs built *for* `i686-linux`.
**`gcc_multi` was tried first and does not work**, which is worth keeping
because it is the obvious answer. It finds every 32-bit file correctly —
`glibc_multi`'s `lib/32/Scrt1.o`, gcc's `32/crtbeginS.o` — and the link still
fails with every object *"incompatible with elf64-x86-64"*, because the wrapper
is a 64-bit wrapper whose bintools inject `-m elf_x86_64`, outliving gcc's own
`-m32`. A wrapper that *is* i686 has no such flag to inject.

Its `shellHook` names that linker outright — `CARGO_TARGET_..._LINKER` — rather
than trusting `PATH`, because `stdenv`'s own `cc` is added to `PATH` before
`packages` and `addToSearchPath` appends. Naming a store path is what made
`indented-string` take parts: a `_Reference` part interpolates, a `string` part
is escaped. Interpolating the derivation is also what puts it in the closure, so
it needs no `packages` entry — and should not have one, since a 32-bit `cc` on
`PATH` would shadow the host one the untargeted `cargo test` needs.

What that cost is worth naming. Those jobs used to measure a stock runner image,
and now measure a pinned toolchain running *on* one. The distinction is smaller
than it sounds — `dtolnay/rust-toolchain` and `setup-node` were already pinned to
the same versions — but the system libraries a Nix build links against are Nix's,
so "builds with the distro's toolchain" is no longer something CI says. Windows
and `ubuntu-intel` still say it.

What remains here is the Nixpkgs update command and removing stale generated
directories, which waits on a recursive `rm` effect — the four directories this
change orphaned had to be deleted by hand. Every canonical job but
`package-check` now runs through a flake.

### Problem

The CI environments are currently assembled by workflow-specific setup steps rather than
small, readable, declarative Nix environments. A broad design also risks coupling the
first useful Node migration to unrelated dependency-updater, browser-testing, Rust, OCI,
and configuration-migration work.

We need to prove the smallest independent path:

```text
current CI config -> generated per-job flake.nix -> direct CI execution
```

### Proposal

Use one official Nixpkgs snapshot to generate a separate self-contained flake for each
selected CI job. Start only with Node 22, Node 24, and Node 26, and adopt each job
independently after its existing commands pass through direct Nix.

#### Scope

This task owns only:

- selecting and pinning an exact Nixpkgs commit;
- recording package versions provided by that snapshot;
- declaring simple Nix environments for selected Node CI jobs;
- generating and committing one `flake.nix` per job;
- validating and adopting those flakes in CI.

This task does not own:

- replacing `npm-check-updates`;
- designing a repository-wide CI lock format;
- browser-test application or Playwright adapter design;
- solving Rust target/toolchain composition;
- building OCI images from the generated flakes.

Those concerns evolve independently and must not block the first Node flakes.

#### Configuration

For this milestone, extend the existing `fjs/ci/config/module.f.mjs` configuration. It is
already consumed by CI generation and works on native Windows.

A future task may migrate CI configuration to another format. That migration is not a
prerequisite for Nix generation; it only needs to update the Nix generator to read the
new source when it happens.

Add only the data needed now:

- stable Nixpkgs update reference;
- exact accepted Nixpkgs commit;
- exact package versions copied from that snapshot where native CI needs them;
- simple per-job system and package declarations.

The runtime declarations are:

```text
node22: aarch64-linux, nodejs_22
node24: aarch64-linux, nodejs_24
node26: aarch64-linux, nodejs_26
deno:   aarch64-linux, deno
wasm:   aarch64-linux, wasmtime, wasmer, and a rust-overlay toolchain
bun:    aarch64-linux, bun overridden to an exact upstream release
dev:    four systems, everything above at once, plus git
```

`bun` is `aarch64-linux, bun`, with the package overridden to an exact upstream
release rather than taken from the snapshot.

`wasm` is the one job whose declaration is not only package names: it also names a
Rust release, the components it runs and the targets whose `rust-std` its shell must
carry. Those go to the second input rather than to Nixpkgs, for the reason above.

The Node attributes name a major version; Deno's names nothing. Where the attribute is
unversioned the configured version is a claim the flake cannot restate, so only the job's
own check can hold it.

A job may also declare tools required by its own work. Keep those additions job-local;
this TODO does not prescribe which non-Node tools a job needs.

#### Generated environments

Generate one self-contained file for each job:

```text
nix/flake.nix
nix/node22/flake.nix
nix/node24/flake.nix
```

The shared shell is `nix/` itself rather than a directory under it: it belongs
to no single job, and `nix develop ./nix` is the command a developer should have
to remember. The two that do belong to one job are named after it.

Each generated file should:

- pin the exact Nixpkgs commit;
- expose one `devShells.<system>.default` per system the declaration names — a
  job with a flake of its own declares the one ARM Linux runner it has, and the
  shared shell declares four. Past one, the shell body is written once as a function those
  entries call; the systems stay named bindings rather than a fold;
- use `pkgs.mkShell` with that job's declared packages;
- be readable without inspecting the generator;
- contain no job-selection logic;
- contain no unrelated platform branches;
- avoid helper libraries and shared generated Nix modules.

The minimal public contract is:

```nix
{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/<commit>";

  outputs = { nixpkgs, ... }: {
    devShells.aarch64-linux.default =
      let
        pkgs = import nixpkgs { system = "aarch64-linux"; };
      in
      pkgs.mkShell {
        packages = [ pkgs.nodejs_22 ];
      };
  };
}
```

The generator substitutes the job's packages. If another system is later required, emit
another explicit `devShells.<system>.default` attribute rather than adding a loop or
system-selection framework.

Node 22, Node 24, Node 26 and `deno` remain separate because they use different
runtimes and run different command sequences.

One shell declares a `shellHook`, for one of its systems: the shared shell on
`x86_64-linux`, pointing `cargo` at `pkgsi686Linux.stdenv.cc`. Node 22's, which
existed for a global install the job no longer makes, is gone. So the capability
has exactly one user, and it is the kind the field was for — a store path that
cannot be written as text, resolved on entry. It hangs off `perSystem` rather
than off the job, because a hook naming a package is a statement about the
platform that has it. Do not generalize either into a shell-configuration
framework unless a second job proves that abstraction useful.

#### Nixpkgs update

Add an explicit Nix-capable command, for example:

```sh
npm run ci-nix-update
```

At a high level it:

1. reads the latest commit from the configured official stable Nixpkgs reference;
2. verifies that `nodejs_22`, `nodejs_24`, `nodejs_26` and `deno` exist;
3. reads the package versions needed by the currently declared Nix jobs — for the
   unversioned attributes this is the only way to learn them, and today all five were
   read from the snapshot's package files by hand;
4. updates the Nixpkgs commit and relevant exact versions in
   `fjs/ci/config/module.f.mjs`;
5. runs ordinary CI generation (`npm run gen`) to regenerate the declared
   flakes' `flake.nix`;
6. runs `npm run lock-update` to refresh every `flake.lock` against the new
   commit — see "Generated flake locks" below, which this command needs Nix
   for and `gen` deliberately does not;
7. leaves all generated changes for review and commit.

Do not require the generic dependency updater to run this flow. Package-manager manifests
and lockfiles are changed only when a separately scoped task explicitly requires them.
Browser-runner and browser-package synchronization is outside this Node-only update flow.

#### Generated flake locks

A `flake.lock` is committed beside every `flake.nix`, but `npm run gen`
(`fjs ci`) never writes one — this issue requires that command stay
Nix-independent, and a lock's two facts on top of a pinned revision,
`narHash` and `lastModified`, are only real Nix's to establish.

So `fjs ci` also writes `nix/lock-update.sh`, one `nix flake lock <path>` per
generated directory, and a maintainer runs it — through `npm run lock-update`,
which needs Nix and is never run by ordinary contributors — only when a pin in
`../config/module.f.mjs` moves.

CI passes `--no-update-lock-file`, not the more tempting `--no-write-lock-file`:
the latter still resolves a mismatched input in memory and only skips the
write, so it would warn and proceed on a stale lock rather than fail — exactly
what let a forgotten `lock-update` merge silently. `--no-update-lock-file`
refuses the resolve itself, so that same mismatch is a loud failure instead.

Every invocation also passes `--quiet`, once, which is about the log rather than the
checkout: it drops Nix's logging from `info` to `notice`, removing the `copying N
paths` substitution chatter and leaving warnings and errors. There were briefly three,
to hide the `not writing modified lock file` warning a missing lock produced on every
step; that took every other Nix warning with it, and the lock removed the cause. Nix
has no short spelling — `--quiet` declares no short name, and the `-Q` that exists is
`--no-build-output` on the legacy commands — so `-q` is not available here.

#### Generated `run` scripts

Neither flag is written in a workflow step. Each job directory holds a generated
`run` script beside its flake, and a step invokes that:

```sh
./nix/node26/run npm run cov
```

The script differs between jobs only in the path it names — written in, since the
generator knows it — and `exec`s `nix develop … --command "$@"`, so the spelling
and its flags have one home instead of fifteen, and a step reads as the command it
runs. A generated script calls no external tool (§6), and this one has nothing that
could. Its executable bit is committed rather than generated, because nothing in
`fjs/effects/node` can set a file mode;
[generated-run-script-mode](generated-run-script-mode.md) owns closing that gap.

An earlier revision took the opposite trade — ignore the lock rather than add a flag to
every invocation — and added a scoped root `.gitignore` rule for `/nix/*/flake.lock`.
That rule is gone: the locks are generated and committed now, so ignoring them would
hide the very files the drift check exists to compare.

#### Validation and adoption

Adopt jobs independently. Each migrated workflow uses:

1. checkout;
2. a pinned Nix installer action;
3. one step per command of that job's existing sequence, each entering the job's shell:

```sh
./nix/<job>/run <command>
```

A CI step runs one command (root [`AGENTS.md`](../../../AGENTS.md) §7), so the sequence
is not bundled into a `bash -c` script: the step is what CI reports on, and a bundle
names the wrapper rather than the command that failed.

A step enters the shell only when it needs a tool the flake pins. `git` is the
runner's, so the Node 26 drift check stays a plain step:

```sh
./nix/node26/run npm run gen
git add -A && git diff --cached --exit-code
```

They read a workspace the previous step wrote, which is the same workspace either way.
This is also why no flake needs to declare `git`, and why it never matters whether
`nix develop` leaves the runner's `PATH` in place or replaces it with the shell's: only
commands that must run on the pinned toolchain go through it.

Re-entering the shell per step costs nothing the bundle was buying. `nix develop` runs
the shell's `shellHook` on every entry, so a job-local environment would be
re-established for each step rather than exported across them, and what such a hook puts
on disk persists across steps anyway. Each step still names the flake, so no step falls
back to the runner's preinstalled Node.

For each job:

1. verify the selected Node version, inside the flake, as the job's first real step;
2. run the existing commands in their current order;
3. verify there are no tracked or stageable checkout changes;
4. remove the old setup only after equivalent behavior is demonstrated.

Step 1 is a step of the job rather than a separate flake job: the version
`fjs/ci/config/module.f.mjs` records is a claim about what the pinned snapshot provides,
and the job that runs on it is where that claim is worth checking.

#### Independent follow-ups

Add other jobs only when useful:

- Deno, Rust and Bun are done;
- real browser execution is tracked by
  [browser-testing](../../emergent_testing/todo/browser-testing.md); the Node-only
  Playwright integration has already been removed;
- a future browser runner may use Nix-provided browsers, but that should be designed after
  the shared HTML/JavaScript browser application exists and must not restore the deleted
  Node-only Playwright job;
- an OCI image stays available as a later optimization, built from these flakes — see
  below.

A failure or unresolved design in one follow-up must not block unrelated flakes.

##### OCI images, and why no Dockerfile

Direct Nix is the reference behavior. An OCI image stays available as a later
optimization, and it would be built from these flakes, so that the image and the jobs
cannot come to describe different environments. Whether it improves total CI behavior is
unmeasured; design it from a measured bottleneck rather than in advance, and let the
design choose the builder, the image layout and the rest. Nothing here depends on the
answer.

Whatever that design turns out to be, an implementation must:

- publish only immutable identities;
- avoid exposing package-write credentials to pull-request code;
- validate before publishing;
- keep direct Nix as the fallback and reference path.

A Dockerfile is not one of the options: a hand-written recipe is a second declaration of
an environment these generated flakes already declare. The one this repository had was
removed; `git log -- docker/` has it.

### Tasks

- [x] Add the stable Nixpkgs reference and exact accepted commit to the current CI
      configuration, plus the exact Node versions that snapshot provides.
- [x] Add the Node job system and package declarations above.
- [ ] Add the explicit Nixpkgs update command.
- [x] Verify all required package attributes exist in the candidate snapshot —
      `nodejs_{22,24,26}` and `deno`, the last confirmed to carry `aarch64-linux`
      in `meta.platforms`. `bun` exists and carries it too, but the version it
      provides fails this repository's suite.
- [x] Generate one readable self-contained flake per job with
      `devShells.aarch64-linux.default`.
- [ ] Remove stale generated job directories.
- [x] Generate a `run` script per job, so a workflow step names a command rather
      than a `nix develop` invocation.
- [x] Generate and commit a `flake.lock` per flake, refreshed by a
      maintainer-run `npm run lock-update` (generated `nix/lock-update.sh`,
      real `nix flake lock`) rather than by `gen`, which needs no Nix to run.
- [x] Keep `npm run gen` Nix-independent and Windows-compatible.
- [x] Commit the generated flakes.
- [x] Bootstrap Nix through a pinned CI action in each migrated job.
- [x] Run each migrated job's complete command sequence through its flake, one
      `nix develop --command` step per command.
- [x] Validate each Node job independently with its existing commands and order.
- [x] Keep tracked checkout state unchanged.
- [x] Migrate jobs one at a time — Node 24, then Node 26, then Node 22, then `deno`.
- [x] Migrate `bun`, by overriding the snapshot's package with an exact upstream
      release rather than waiting for Nixpkgs to ship one.
- [x] Generate a developer environment carrying every runtime at once, on all
      four systems Nix runs on, checked by a job of its own.
- [x] Migrate `wasm`, which needed this issue's "official Nixpkgs only" scope
      widened by one input: Nixpkgs builds no `std` for three of its four targets,
      at any version.
- [ ] Create independent follow-up TODOs only when experiments expose concrete needs.
- [ ] Decide, from a measured bottleneck rather than in advance, whether CI produces an
      OCI image — see *OCI images, and why no Dockerfile* above. Deferred, not
      abandoned: nothing here waits on the answer.

### Related

- [`fjs/media/nix`](../../media/nix/module.f.mjs) — generic Nix eDSL used by the
  generated-flake code generator.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — the first Node
  implementation, whose shape every migrated job follows.
- [browser-testing](../../emergent_testing/todo/browser-testing.md) — replacement design
  for real browser execution and the optional external Playwright runner.
