# Continuous integration workflow generator

This directory contains the FunctionalScript source that defines the GitHub Actions
workflow for this repository. Running the generator writes `.github/workflows/ci.yml`
with the latest matrix of jobs and steps, plus one Nix development environment under
`nix/` per canonical job that has one — every one but `bun`.

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
  the workflow file. Rust support is detected automatically by checking for
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
- `package/module.f.mjs` — the `package-check` job: downloads the tarball the
  Node job uploads, installs it under a fixed alias outside any checkout, and
  type-checks every declaration it ships. It is the one job built without
  `toSteps`, because that helper adds `actions/checkout` and the missing
  checkout is the point — with the repository on the runner there would be a
  `tsconfig.json` up the tree, a `node_modules` to resolve into, and sources
  standing in for declarations the tarball omits, so the check would pass on
  the repository rather than on the package.
  `proof.f.mjs` — its property-based proofs.
- `rust/module.f.mjs` — Rust toolchain setup and `cargo` build/test steps.
- `deno/module.f.mjs` — the `deno` job's steps and its flake declaration.
  `proof.f.mjs` — its property-based proofs.
- `bun/module.f.mjs` — the `bun` job's steps. The one canonical job still on a
  setup action, because Nixpkgs packages no Bun this repository's proofs pass
  on; [`todo/bun-nix-blocked-on-nixpkgs.md`](./todo/bun-nix-blocked-on-nixpkgs.md)
  owns that. `proof.f.mjs` — its property-based proofs.

## Usage

1. Ensure dependencies are installed with `npm ci`.
2. Regenerate the workflow definition and the Nix environments:
   ```
   fjs ci
   ```
3. Commit the updated `.github/workflows/ci.yml` and `nix/*/flake.nix`
   files if they have changed.

The generator is idempotent — rerunning it without modifying the source produces the
same files. It never runs Nix itself, so it stays Windows-compatible: the flakes are
plain text built from the pinned commit in `config/module.f.mjs`.

### Generated Nix environments

Each canonical job with a flake declares a system and its Nixpkgs package attributes
beside the steps that enter them — `nodeNixJobs` in `node/module.f.mjs`, `denoNixJob`
in its own module — and `module.f.mjs` composes them into `nixJobs`, the one place the
whole set is visible. `bun` declares none, and is the only canonical job that does
not. `nix/module.f.mjs` writes each out as one
static `flake.nix` exposing `devShells.<system>.default`. A job may also declare a
job-local `shellHook`, run on every entry to the shell; none does today. See
[nix/README.md](../../nix/README.md) for how the generated files are meant to be
consumed.

`config/module.f.mjs` records the Node and Deno versions the pinned Nixpkgs snapshot
provides — not each vendor's latest release, which the snapshot usually trails. They
feed the flakes' package attributes where the attribute is versioned, as well as the
`setup-node` steps left in the platform matrix and `package-check`. Bumping either
therefore means moving the Nixpkgs commit first and copying the versions it offers.
`bun` is not one of these: `setup-bun` installs it, so that pin is a released Bun.

No job checks the flakes; the jobs that use them check the runtime they get. Every
canonical job asserts, as its first command, that its own shell reports the version
`config/module.f.mjs` records for it:

```sh
test "$(nix develop --no-write-lock-file ./nix/node26 --command node --version)" = v26.7.0
test "$(nix develop --no-write-lock-file ./nix/deno --command deno eval 'console.log(Deno.version.deno)')" = 2.8.3
```

The runtimes disagree on both halves, which is why the check takes the command and
the expected string separately: `node --version` prints a leading `v` the configured
version does not carry, and `deno --version` prints three lines — the runtime, V8 and
TypeScript — so Deno is asked for the one field this repository configures.

That check is the *only* place the expectation is written: the generated flakes stay
purely declarative, since a flake pinning an exact Nixpkgs commit already determines
its package versions and an `assert` inside it would only restate that pin. For Deno
it is also the only tie there is — `pkgs.deno` names no version, so unlike
`pkgs.nodejs_26` the attribute cannot be checked against the configuration without
evaluating it.

What can be established about a generated flake without Nix is asserted by two proofs.
`proof.f.mjs` reads the file the pipeline wrote and requires it to equal the generator's
text for that job, and each Node job's package attribute to be the `nodejs_<major>` its
configured version implies. What that text must itself contain — the accepted commit,
the job's `devShells.<system>.default`, the shell's packages — is pinned character for
character by `nix/proof.f.mjs`'s literal fixtures. Every generated flake is also
evaluated for real, by the job that uses it.

### Expected package scripts

The generated platform jobs run `npm ci`, install the pinned FunctionalScript
package globally, and run `fjs test`; the `deno` job runs its own equivalent. Those
seven are where the published CLI is exercised — no canonical Node job does, and
`bun` stopped. Every canonical job runs on Ubuntu ARM, all but `bun` through a
flake:

- Node 22 runs `npm ci` and `node --test` through its generated flake.
- Node 24 runs the same pair through its own flake — one builder emits both
  jobs, which differ only in the version they name.
- Node 26 runs `npm ci`, `npx tsc`, `npm run cov`, `npm pack` and `npm run ci-update`
  through its flake the same way, then `git add -A && git diff --cached --exit-code`
  as a plain step — `git` is the runner's tool, and a step names the flake only when
  it needs something the flake pins.
- `deno` installs the pinned package, runs the smoke test, then `deno install
  --frozen` and `deno task cov`.
- `bun` runs `bun install --frozen-lockfile` and `bun test --coverage`, on a
  `setup-bun` runtime. It installs no published package: that check subjects a
  release rather than this commit, and
  [`todo/built-package-checks.md`](./todo/built-package-checks.md) owns moving it
  to the package job family.

Deno's global install enters the flake like every other command, so it is no longer
an `install`-typed step: those run before `actions/checkout`, and there is no flake
on disk to enter until the repository is. It only warms a cache for the `deno run`
after it, which names the same version itself.

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
only the workflow. `fjs ci` covers `.github/workflows/ci.yml` and the generated
Nix flakes; a project with other generators chains them into the same script, as
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

Keep `npx tsc` passing independently because the generated CI runs it as its own
step before coverage and package creation. Keep `test` as the fast local
correctness loop even though generated CI no longer calls `npm test` directly.

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

The built-in command reads `package.json` for one thing: `devDependencies.typescript`.
An exact version there — `=7.0.2`, not `^7.0.0` — generates the `package-check`
job and is the compiler that job installs, because a job with no checkout has no
lockfile to resolve a range against. Anything else, including no entry at all,
generates no `package-check` job.

Nothing else in `package.json` reaches the generated steps. The FunctionalScript
package version used by generated Node, Deno, and Bun smoke tests is pinned in
`config/module.f.mjs`, not read from `package.json`.

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
