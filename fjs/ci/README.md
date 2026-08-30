# Continuous integration workflow generator

This directory contains the FunctionalScript source that defines the GitHub Actions
workflows for this repository. Running the generator writes
`.github/workflows/ci.yml` with the latest matrix of jobs and steps and
`.github/workflows/npm-publish.yml` with the release job, plus three Nix
development environments under `nix/`. One of those, `dev`, is the shell a
developer enters and the shell all but two canonical jobs run inside; the other
two exist for the two jobs that cannot share it. Which jobs have a flake and why
the rest do not is [`todo/65z-ci-nix.md`](./todo/65z-ci-nix.md), under "Jobs with
no flake".

## `fjs ci` is not stable

The generated output changes shape between releases: jobs appear and disappear,
steps are reordered, and generated files move or are renamed. None of that is
versioned, and the generator does not migrate a consumer's tree — it writes the
files it generates now and leaves anything an older version wrote where it is.
A project upgrading `functionalscript` is expected to regenerate, read the diff,
and delete whatever the new version stopped writing.

That is a deliberate position rather than an oversight, and it is the reason the
generator carries no migration code for its own past output. Who this command is
for, and whether that answer should change, is
[`todo/ci-generator-audience.md`](./todo/ci-generator-audience.md).

## Files

- `module.f.mjs` — the top-level pipeline definition. Exports `ci(setup: Setup)`
  (`Setup` in `types.ts`) which returns an `Effect<NodeOp, number>` that writes
  both workflow files. Rust support is detected automatically by checking for
  `Cargo.toml` at the repository root via the `access` effect.
- `proof.f.mjs` — property-based proofs for the CI generator (Rust/no-Rust job presence,
  per-OS extra steps).
- `common/module.f.mjs` — shared RTTI schemas and types (`Step`, `Job`, `Jobs`,
  `GitHubAction`, `MetaStep`, `Os`, `Architecture`), and step-builder helpers
  (`test`, `install`, `uses`).
- `config/module.f.mjs` — runner image matrix (OS × architecture → GitHub-hosted image name) and pinned tool/package versions, including the FunctionalScript package version used by generated smoke tests and the exact Nixpkgs commit the generated flakes pin.
- `nix/module.f.mjs` — writes one self-contained `nix/<job>/flake.nix`
  per declared job (`NixJob` in `types.ts`), using the Nix eDSL in `fjs/media/nix`.
- `node/module.f.mjs` — Node.js job steps: platform smoke tests, canonical
  per-version jobs, coverage, package checks, and the Node flake declarations.
  `proof.f.mjs` — its property-based proofs.
- `publish/module.f.mjs` — the npm publishing workflow, the one generated file
  that is not part of `ci.yml`. See "The publishing workflow" below.
  `proof.f.mjs` — its property-based proofs.
- `package/module.f.mjs` — the `package-check` job: downloads the tarball the
  Node job uploads, installs it under a fixed alias outside any checkout, and
  type-checks every declaration it ships. It is the one job built without
  `toSteps`, because that helper adds `actions/checkout` and the missing
  checkout is the point — with the repository on the runner there would be a
  `tsconfig.json` up the tree, a `node_modules` to resolve into, and sources
  standing in for declarations the tarball omits, so the check would pass on
  the repository rather than on the package.
  `proof.f.mjs` — its property-based proofs.
- `rust/module.f.mjs` — `cargo` build/test steps, the platform matrix's toolchain
  action, and the `wasm` job's steps and flake declaration. The two families get
  their toolchain from different places for a packaging reason: the matrix spans
  six runner images that one flake could not serve, and the WASM job needs three
  targets Nixpkgs builds no `std` for, so its flake takes the toolchain from
  `rust-overlay` instead. Both name `config/module.f.mjs`'s `rust`, so the
  version cannot differ between them.
- `deno/module.f.mjs` — the `deno` job's steps and its flake declaration.
  `proof.f.mjs` — its property-based proofs.
- `dev/module.f.mjs` — the developer environment: one shell carrying every
  runtime the canonical jobs use, on all four systems Nix runs on, generated
  from those jobs' own declarations so it cannot drift from them. The `dev` CI
  job enters it and asserts every version, which is the only thing that
  evaluates that flake at all.
- `bun/module.f.mjs` — the `bun` job's steps and its flake declaration. The one
  job whose shell is not the pinned snapshot's: Nixpkgs ships a Bun two of this
  repository's proofs fail on, so the flake keeps that package's recipe and
  overrides the archive it unpacks with an exact upstream release.
  `proof.f.mjs` — its property-based proofs.

## Usage

1. Ensure dependencies are installed with `npm ci`.
2. Regenerate the workflow definitions and the Nix environments:
   ```
   fjs ci
   ```
3. Commit the updated `.github/workflows/ci.yml`,
   `.github/workflows/npm-publish.yml` and `nix/*/flake.nix` files if they have
   changed.

The generator is idempotent — rerunning it without modifying the source produces the
same files. It never runs Nix itself, so it stays Windows-compatible: the flakes are
plain text built from the pinned commit in `config/module.f.mjs`.

### Generated Nix environments

Each canonical job with a flake declares a system and its Nixpkgs package attributes
beside the steps that enter them — `nodeNixJobs` in `node/module.f.mjs`, `denoNixJob`
in its own module — and `module.f.mjs` composes them into `nixJobs`, the one place the
whole set is visible. `package-check` declares none — it runs with no checkout, so
 there is no file tree for a flake to be in.

A declaration names the systems it wants a shell for, and the generator writes
one explicit `devShells.<system>.default` per system rather than looping. The
two Node flakes name one each, since their jobs run on one runner image; the
shared shell names four, because a developer's machine is not a runner — which
is the reason that field is a list. `nix/module.f.mjs` writes each out as one
static `flake.nix` exposing `devShells.<system>.default`. A job may also declare a
job-local `shellHook`, run on every entry to the shell; none does today. See
[nix/README.md](../../nix/README.md) for how the generated files are meant to be
consumed.

`config/module.f.mjs` records the Node, Deno, Wasmtime and Wasmer versions the pinned
Nixpkgs snapshot provides — not each vendor's latest release, which the snapshot
usually trails. They feed the flakes' package attributes where the attribute is
versioned, as well as every `setup-node` step: the platform matrix,
`package-check`, and the publishing workflow. Bumping any of them therefore means moving the Nixpkgs commit first
and copying the versions it offers.

`bun` is not one of these, and it is the one package in any generated shell that the
snapshot does not decide. Nixpkgs ships 1.3.13, which two of this repository's proofs
fail on, so that job's flake keeps the snapshot's packaging — the unzip, the
`autoPatchelfHook`, the wrapper — and replaces only `src`, with the version and SRI
hash `config/module.f.mjs` records side by side. That works because Nixpkgs fetches
Bun as a prebuilt archive rather than building it, so the override moves bytes rather
than adopting a package definition. It is an exception with an expiry: both constants
go the day the snapshot carries a Bun this suite passes on.

`rust` is not one of them either, and for the opposite reason. The `wasm` job's flake
carries a second input, `rust-overlay`, pinned in `config/module.f.mjs` beside the
Nixpkgs commit. Nixpkgs builds one `rustc` and hard-codes the targets it builds `std`
for, and three of that job's four are not among them at any version; the overlay
unpacks the same release artifacts `rustup` would, so `rust` is an exact Rust release
the flake names in full. The platform matrix's `dtolnay/rust-toolchain` reads the same
constant, so the two cannot drift.

A generated `run` script sits beside every flake, and a workflow step reads as
the command it runs — `./nix/run npm run cov` — rather than as a `nix develop`
invocation repeated fifteen times. The script carries
`--no-write-lock-file` (leave the checkout untouched) and `--quiet` three times.
Nix's verbosity is one integer and each `--quiet` decrements it, so the first
drops the `copying N paths` substitution chatter and the other two are what it
takes to get below warnings — which silences every Nix warning, not just the
`not writing modified lock file` one they were added for. `-q` is not a spelling
Nix accepts; see [nix/README.md](../../nix/README.md), which has the arithmetic,
the cost, and the `flake.lock` that would let two of them come back off.

No job checks the flakes; the jobs that use them check the runtime they get. Every
canonical job asserts, as its first command, that its own shell reports the version
`config/module.f.mjs` records for it:

```sh
test "$(./nix/run node --version)" = "v26.7.0"
test "$(./nix/run deno eval 'console.log(Deno.version.deno)')" = "2.8.3"
test "$(./nix/node22/run node --version)" = "v22.23.2"
```

The runtimes disagree on both halves, which is why the check takes the command and
the expected string separately: `node --version` prints a leading `v` the configured
version does not carry, `deno --version` prints three lines — the runtime, V8 and
TypeScript — so Deno is asked for the one field this repository configures, and
Wasmtime and Wasmer print their own name first.

That check is the *only* place the expectation is written: the generated flakes stay
purely declarative, since a flake pinning an exact Nixpkgs commit already determines
its package versions and an `assert` inside it would only restate that pin. For Deno,
Wasmtime and Wasmer it is also the only tie there is — those attributes name no
version, so unlike `pkgs.nodejs_26` they cannot be checked against the configuration
without evaluating them.

The one runtime with no check is the `wasm` job's Rust, and for the reason that makes
the others worth checking: its flake says `rust-bin.stable."1.98.0"`, naming the
release in full rather than a major or nothing at all, so a check could only restate
the flake it was meant to test.

What can be established about a generated flake without Nix is asserted by two proofs.
`proof.f.mjs` reads the file the pipeline wrote and requires it to equal the generator's
text for that job, and each Node job's package attribute to be the `nodejs_<major>` its
configured version implies. What that text must itself contain — the accepted commit,
the job's `devShells.<system>.default`, the shell's packages — is pinned character for
character by `nix/proof.f.mjs`'s literal fixtures. Every generated flake is also
evaluated for real, by the job that uses it.

### Expected package scripts

The generated platform jobs run `npm ci`, install the pinned FunctionalScript
package globally, and run `fjs test`. Those six are now the only place the
published CLI is exercised: no canonical Node job does, and `deno` and `bun` both
stopped. Every canonical job runs on Ubuntu ARM, and all but `package-check`
through a flake:

- Node 22 runs `npm ci` and `node --test` through a flake of its own.
- Node 24 runs the same pair through its own — one builder emits both jobs,
  which differ only in the version they name. These two are the only jobs left
  with a flake to themselves: `npm ci` and `node --test` take whichever `node`
  reaches `PATH` first, and one shell holds one, so each needs a shell carrying
  the single release it exists to test.
- Node 26 runs `npm ci`, `tsc`, `npm run cov`, `npm pack` and `npm run ci-update`
  through the shared shell, then `git add -A && git diff --cached --exit-code`
  as a plain step — `git` is the runner's tool, and a step names the flake only when
  it needs something the flake pins. The release it wants is the shared shell's,
  so it needs no flake of its own. It asserts `tsc` alongside `node`, since
  `pkgs.typescript-go` names no version and this is the job whose `npm pack`
  emits the declarations the package ships.
- `deno` runs `deno install --frozen` and `deno task cov` in the shared shell.
- `bun` runs `bun install --frozen-lockfile` and `bun test --coverage` there
  too, on a Bun that is an overridden archive rather than the snapshot's.
- `wasm` runs `cargo fmt -- --check` and then tests and Clippy for four WASM
  targets in the shared shell, which provides the toolchain and both runtimes.
  `cargo` invokes `wasmtime` and `wasmer` itself, through the `runner` keys in
  `.cargo/config.toml`, so they have to share a `PATH` with the `cargo` that
  spawns them — which is why the whole toolchain moved rather than half of it.

Neither installs a published package any more. That check subjects a release rather
than this commit, so it belongs to the package job family, which already downloads
the `npm pack` artifact;
[`todo/built-package-checks.md`](./todo/built-package-checks.md) owns the move.
Deno's `--minimum-dependency-age=0` went with its install: the flag existed to let a
registry install take a package younger than Deno's 24-hour default, and no registry
install is left.

The commands that must be provided by `package.json` for generated CI are `cov`
and `ci-update`. A typical FunctionalScript project can define them like this:

```json
{
  "scripts": {
    "test": "tsc && fjs test",
    "cov": "node --test --experimental-test-coverage --test-coverage-include=**/module.f.mjs",
    "ci-update": "fjs ci"
  }
}
```

`ci-update` must regenerate every generated file the project keeps in Git, not
only the workflows. `fjs ci` covers `.github/workflows/ci.yml`,
`.github/workflows/npm-publish.yml` and the generated Nix flakes; a project with other generators chains them into the same script, as
this repository does for `nanvm-lib/tests/test/generated.rs` (see
[`fjs/nanvm/README.md`](../nanvm/README.md)). Everything chained there is
covered by the drift check below for free.

The Node 26 job runs it last, after every other command, and fails via
`git add -A && git diff --cached --exit-code` when the committed tree no longer
matches the generator's output, so forgetting to regenerate after changing a
generator breaks the build instead of silently using stale files. Running it at the
end makes it the last word: every earlier step has finished writing, and nothing they
leave behind is tracked. Staging with `git add -A` before diffing makes the check
cover newly created and deleted generated files, not just modified ones — a plain
`git diff` never reports untracked files. Because the job runs `npm ci` first,
`fjs ci` resolves the project's own `functionalscript` devDependency; this repository
instead uses its checked-in sources (`node ./fjs/module.mjs ci`), so the check always
reflects the generator being reviewed, not the pinned published release.

Keep `tsc` passing independently because the generated CI runs it as its own
step before coverage and package creation. Keep `test` as the fast local
correctness loop even though generated CI no longer calls `npm test` directly.

Both scripts name `tsc` rather than `npx tsc`, and TypeScript is deliberately not
a `devDependency`. The compiler comes from the environment — the shared `dev`
shell for anyone with Nix, a global npm install otherwise — so the two jobs that
only run the suite do not install one. `npx tsc` would defeat that: with
nothing to resolve in `node_modules` it downloads the registry's latest, which
is the one version nothing here pins.

For `node --test` and `npm run cov` to execute FunctionalScript proofs, the
repository must include a Node test entry file, conventionally `all.test.ts`:

```ts
import 'functionalscript/fjs/emergent_testing/all.test.mjs'
```

Without that file, third-party test runners discover no FunctionalScript proofs
and will report zero tests. `fjs test` is the exception: it discovers proof modules
directly and does not need `all.test.ts`.

**Note,** `npm run ci-update` in this repository runs the same built-in command through the
checked-in Node entry point, which avoids relying on the package bin before the
package has been installed. Custom projects that need different runtime setup steps
should use `fjs run <custom-ci-module>` and call `ci(setup)` directly instead of
modifying the built-in command.

The built-in command does not read `package.json` at all. It used to, for one
thing — `devDependencies.typescript`, which decided whether the `package-check`
job was generated and which compiler it installed. That version is now
`config/module.f.mjs`'s, like every other version this generator names, so
`package-check` is generated for every project.

Two consequences worth knowing before you adopt this generator. The compiler the
packed-package check runs is the one **this** configuration pins, not the one
your project depends on; and a package that ships no declarations now fails that
check with `TS18003` rather than not being checked. See
[`todo/ci-generator-audience.md`](./todo/ci-generator-audience.md).

The FunctionalScript package version used by the platform matrix's smoke test is
pinned in `config/module.f.mjs` too — nothing about the project reaches the
generated steps except whether it has a `Cargo.toml`.

## The publishing workflow

`fjs ci` writes a second file, `.github/workflows/npm-publish.yml`. It is
generated by the same command rather than by one of its own: the two workflows
share every pin they name — the runner image, the Node version, the pinned
action refs, all of `config/module.f.mjs` — and the Node 26 drift check
(`npm run ci-update`, then `git add -A && git diff --cached --exit-code`) covers
whatever `fjs ci` writes for free. A separate command would have to be chained
into `ci-update` to reach the same place, and a consumer who forgot would keep a
publish workflow that silently stopped matching its CI.

It keeps the file name it had while it was hand-written. A rename to
`npm-publishing.yml` would leave the old file behind — this generator does not
delete what an earlier version wrote (see "`fjs ci` is not stable" above) — and
two publish workflows on the same trigger is worse than an unremarkable name.

The generated workflow is:

- **triggered by a push to `main`, and by nothing else.** `pull_request` would
  hand a fork's branch the registry's trust, and `merge_group` would publish a
  merge that has not landed. The version in `package.json` is the single source
  of truth for what gets released, and it becomes real when it reaches the
  default branch.
- **granted `contents: read` and `id-token: write`, at the workflow level.**
  A publish reads the tree and writes nowhere in it. The `id-token` grant is the
  one addition and it is spent by the step below.
- **one job**, `publish-npm`, on the same Ubuntu ARM image the canonical jobs
  use, running `setup-node` (which writes the registry into the job's `.npmrc`),
  a global install of the configured TypeScript, `actions/checkout`, `npm ci`,
  and `npm publish --provenance`.

Neither install is optional the way both would be for a package that publishes
its sources unchanged: `prepack` emits the declarations the package ships and
type-checks them. The compiler is not a dependency of the package, so this job
installs it — and this is the one job in either workflow that needs a compiler
without a flake to take it from, because a publish wants the `.npmrc`
`setup-node` writes and a flake has nothing to say about a registry. `npm ci`
still runs, for the `@types/node` that compiler resolves against.

Being generated is what lets the step name `config/module.f.mjs`'s version as a
literal. A hand-written workflow would have to either restate the number, where
nothing would catch it drifting from the flakes, or read it back out at run
time.

There is no `NODE_AUTH_TOKEN` and no secret of any kind. `id-token: write` lets
npm's trusted publishing exchange the runner's OIDC token for the credential,
and `--provenance` is what makes that exchange worth having — npm records the
workflow, the commit and the repository that produced the tarball, and a
consumer can check the published package against them. This job takes its Node
from `setup-node` rather than from a flake, as `package-check` does and for a
related reason: it needs the `.npmrc` that action writes, and a flake has
nothing to say about a registry.

The publish step carries `continue-on-error: true`, the only step in either
generated workflow that does. Most pushes to `main` do not move the version, and
npm answers a republish of an existing version with a 403 — the expected outcome
rather than a failure. The flag cannot tell that 403 from a real one, so an
expired grant or a rejected attestation is swallowed just as quietly;
[`todo/publish-only-a-new-version.md`](./todo/publish-only-a-new-version.md)
owns making the two distinguishable. Until then `stepSchema` admits the field as
the literal `true` rather than as a boolean, because there is exactly one step
it is for.

Nothing in the publish workflow varies with the project: no job of it depends on
`Cargo.toml`, on the compiler pin, or on the caller's `Setup`. It is a constant
of the configuration, which is why `module.f.mjs` writes it rather than building
it.

Which is also the one thing to know before running `fjs ci` in a project that
does not want to publish: it is written unconditionally, like every other job
this generator emits, and deleting the file does not opt out — the next run
writes it back, and `ci-update`'s drift check then fails on its absence. There
is no way to decline it: `Setup` has no field for it, and
`fjs run <custom-ci-module>` is not the escape hatch it looks like — a custom module calls `ci(setup)`, which is the function that writes both
files. Assembling a workflow from this directory's parts instead is all that is
left. That is the standing question of
[`todo/ci-generator-audience.md`](./todo/ci-generator-audience.md), which this
workflow is the sharpest instance of.

## Customisation

`ci` accepts a `Setup` record to inject extra steps per runtime:

```ts
export type Setup = {
    readonly nodeExtra: (os: Os) => readonly MetaStep[]
}
```

`nodeExtra` receives the target OS so callers can conditionally add OS-specific steps.
Rust steps are included automatically when `Cargo.toml` is present; no flag is needed.

## Related

- [`packed-consumer-validation.md`](./packed-consumer-validation.md) — manual
  validation of the packed npm package against clean Node, Deno, and Bun
  consumers, until a CI fixture covers it.
