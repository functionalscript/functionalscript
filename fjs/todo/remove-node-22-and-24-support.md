## Remove Node 22 and Node 24 support

**Priority:** P3
**Status:** wip

### Problem

During prerelease, each FunctionalScript release should support and test one
exact version of each tool, chosen close to the latest stable release. Users
who need an older tool must use an older FunctionalScript release with a
suitable recorded toolset. Updating a tool pin replaces the supported version
rather than extending a compatibility matrix. Supporting old tools consumes
development and CI resources while the project is still changing quickly.

Node 22 was retained largely because an older OpenAI Codex version could not
run newer Node releases. That was a constraint of the agent environment. The
managed Codex environment used for this investigation ran the repository's
selected Node release through `./dev.sh` and passed the required checks, so
that former constraint does not apply here. Agent environments should use the
release's selected toolset; their historical limitations do not justify keeping
old-runtime compatibility in the current prerelease.

Node 22 and Node 24 support conflicts with that policy. It keeps compatibility
jobs, separate Nix shells, version parsing and test-registration choices that
the selected Node runtime does not need. The developer shell and primary Node
CI job already use the configured Node 26 release, but the package advertises
`engines.node: ">=22"` and the website selects the whole Node 26 major.

Make removing Node 22/24 the first application of the single-version policy.
This is a prerelease project: remove obsolete public parameters and exports
outright, update their importers, and add no deprecation period or compatibility
API. Bun and Deno each keep their own selected version.

### Proposal

#### One tested toolset per release

This is the prerelease policy. After release, support for additional tool
versions may be added if there is demand. Leave that future decision open;
do not retain current compatibility jobs, fallback code or API parameters in
anticipation of it. Any expansion would identify the requested versions and
the CI/testing work needed to support them at that time.

Use [`ci/config/module.f.js`](../ci/config/module.f.js) as the source of the
selected Node, Deno, Bun, Rust, TypeScript/TSGO, Wasmtime and Wasmer versions.
The supported set belongs to the FunctionalScript release, not to a moving
`latest` tag. Preserve the release's configuration and generated locks, and
record its tested tool versions in the release notes or a linked release
document. The release procedure must verify that record against the versions
actually used by the passing checks.

Choose recent stable versions that the project can build and test reliably.
Keep [`ci/update-versions.md`](../ci/update-versions.md)'s stable-channel,
binary-cache and acceptance checks: the newest fully usable snapshot may trail
upstream, and a failing update may retain or restore the accepted pin. CI uses
the accepted pins. During prerelease, keep no additional historical tool versions
in the current release's CI. An accepted pin update replaces the previous pin
for the next release; older release records preserve their original toolsets.

The same selected versions run on all supported OS/architecture combinations.
Keep platform, Rust build-mode, WASM-target and package-consumer coverage:
these exercise different behavior with the chosen tools. Reduce historical tool
versions and repeated setup or suite work through the related CI consolidation
plan. Distinct Node, Bun and Deno runtimes still each need their selected-version
checks.

Document how a user selects a FunctionalScript release with the needed toolset,
for example `npm install -g functionalscript@<release>`. Link the chosen release's
record rather than claiming that every older release supports every older tool.
Do not fabricate a historical compatibility table from today's pins.

#### Package and runtime contract

Set `engines.node` in [`package.json`](../../package.json) to the exact selected
Node patch, currently held in `node.default`, and synchronize the root metadata
in [`package-lock.json`](../../package-lock.json). Neither `>=26` nor a patch
lower bound expresses this policy: both advertise untested later versions.
Pin [`.node-version`](../../.node-version) to the same exact release instead of
`26`, so Cloudflare's website build cannot independently select another patch.
Keep these values synchronized whenever the Node pin changes. `@types/node`
is a separately pinned type package, not another supported Node runtime.

The exact pin defines the supported runtime for the CLI, development commands
and npm consumers. npm normally warns about an engine mismatch unless the
consumer enables strict engine checking. Do not replace deleted compatibility
selection with a new runtime version-refusal mechanism; installs outside the
recorded toolset have no support promise.

The selected Node release can always use the existing native `expectFailure`
path. Remove `nodeRelease` and `usesInlineTestContext` from
[`effects/node/module.f.mjs`](../effects/node/module.f.mjs), their startup
imports and calls in [`effects/node/module.mjs`](../effects/node/module.mjs),
and the `externalTestContext` compatibility proof in
[`effects/node/proof.f.mjs`](../effects/node/proof.f.mjs). Nightly/release-candidate
ordering and malformed-version cases existed to choose the old-Node fallback;
they need no replacement when the fallback disappears.

Remove the helper's `versionCmp` import, but retain
[`types/version/module.f.mjs`](../types/version/module.f.mjs) and its proof:
[`website/changelog/module.f.mjs`](../website/changelog/module.f.mjs) still uses
`cmp` and `tryParse` to filter and order releases. Dropping runtime version
detection does not make the general version utility obsolete.

#### NodeProgram options and test adapters

Pass a single, already-selected `testContext` to each `NodeProgram`. Runtime
detection and adapter selection belong in the host runner, rather than being
repeated by `emergent_testing.register`.

| Remove from `NodeProgramOptions` | Reason and replacement |
| --- | --- |
| `nodeVersion` | Only startup compatibility selection needs it; programs do not read it. |
| `bunTestContext` | Supply the Bun adapter as `testContext` on Bun. |
| `engine` | `register` no longer chooses between contexts; keep Bun detection local to the host. |
| `inlineTestContext` | Its only program consumer chooses the test-name suffix. Move that formatting into the Bun adapter. |

Update [`effects/node/types.ts`](../effects/node/types.ts), the host runner's
`options`, [`effects/node/virtual/module.f.mjs`](../effects/node/virtual/module.f.mjs)'s
`defaultNodeProgramOptions`, and explicit options in proofs and example programs.
The `Engine` type becomes unused with the compatibility helper and `engine`
field gone; remove it and update the layering TODO that currently lists it.
Keep `args`, `env`, `home`, `std` and `testContext`: these remain real inputs.

Simplify [`emergent_testing/module.f.mjs`](../emergent_testing/module.f.mjs)'s
`register` to use `o.testContext`, and remove the suffix/`star` arguments from
`registerModule` and `registerModuleMap`. Rewrite `registerSelectsContextAndStar`
and `registerSuffixes` in the co-located proof around the resulting interface.

Bun still lacks the nested-test behavior this registration path requires.
Keep `inlineTest`, `inlineContext` and `wrapInlineTest`, with the adapter selected
only for Bun. Preserve its ` ...` suffix on ordinary externally registered tests
and the absence of that suffix on expected-to-throw tests. Node and Deno continue
to use native registration. Validate actual failure inversion in each runtime:
passing an `expectFailure` option is insufficient proof that a runner honors it.
The pinned Deno runner was checked through `./dev.sh`: an expected throw passes,
and an expected throw that returns normally fails with "test was expected to
fail but passed".

#### CI and Nix

| Authored source | Cleanup |
| --- | --- |
| [`ci/config/module.f.js`](../ci/config/module.f.js) | Remove `node.node22` and `node.node24`; collapse the remaining `node.default` into one scalar Node pin, like the other tool pins, and update its consumers and version-update guidance. |
| [`ci/node/module.f.mjs`](../ci/node/module.f.mjs) | Remove the legacy entries from `nodeVersionJobs`, then delete `suiteNixSteps`, `nixJob`, `nodeNixJobs` and their imports. Keep the default Node job and its checks. |
| [`ci/module.f.mjs`](../ci/module.f.mjs) | Remove `nodeNixJobs` from `nixJobs`; all Nix-backed jobs can use `devNixJob`. Update the assembly's documentation. |
| [`ci/nix/module.f.mjs`](../ci/nix/module.f.mjs) | Delete unused `nixSystems`. Remove per-job shell selectors and subdirectory path branches that now have no production caller. |
| [`ci/proof.f.mjs`](../ci/proof.f.mjs), [`ci/dev/proof.f.mjs`](../ci/dev/proof.f.mjs), [`ci/nix/proof.f.mjs`](../ci/nix/proof.f.mjs) | Remove old-Node expectations/helpers and prove the surviving job set, shared shell, configured versions and consumer checks. Do not leave empty loops over deleted declarations. |

The shared-shell simplification also reaches `nodeVersionStep`'s shell and
version arguments: its surviving callers all check the selected Node pin in
the shared shell. It also reaches the shell/id parameters of `nixDevelop`,
`nixSteps`, `nixVersionStep`, `flakePath`, `runPath` and `runText`. Simplify these
interfaces and their callers together instead of retaining parameters every
caller fills with the same value.
Collapsing `nixJobs`/`nixFlakes` and the lock-update generator to a single shared
declaration can follow in the same cleanup; remove synthetic labels such as
`NixJob.id` only after checking their remaining uses.

Regenerate [`.github/workflows/gen.ci.yml`](../../.github/workflows/gen.ci.yml)
and [`gen.nix/`](../../gen.nix/) from authored sources. The obsolete outputs are
`gen.nix/node22/` and `gen.nix/node24/`, including their `flake.nix`, `flake.lock`
and `run` files. Do not edit generated files by hand.

Run `./dev.sh npm run gen` directly. Its integrated clean removes generated
files, then the generators rewrite surviving outputs and run real Nix lock
generation. It also removes and recreates the shared lock; retain the resulting
`gen.nix/flake.lock`. Do not run standalone `gen:clean` first and remove the lock
needed to enter the shell. Failed lock regeneration is an incomplete generation,
not a reason to commit the shared lock's deletion. Bare `fjs ci` in another
project does not clean obsolete outputs; account for that when documenting the
generator change for consumers.

Keep the default Node job's coverage, type checking, compilation, generation
drift check, packing, emitted declarations and clean-consumer validation. Keep
Windows Node installation, npm publishing and the consumer's `setup-node` steps.
The published FunctionalScript version pin and `fjsGlobalInstall` are still used
by the Windows platform jobs; removing Node 22/24 does not remove that dependency.
Those jobs exercise an older FunctionalScript release on today's tools, rather
than establishing the current release's support contract. Coordinate their
replacement with `built-package-checks`: test the current tree or packed release
on Windows and then remove the old bootstrap dependency, preserving platform
coverage. Clean packed-consumer checks already install the selected Node and
TypeScript pins outside Nix; keep that package-boundary validation.

Keep the shared developer shell's supported systems, Bun pin, Rust overlay,
WASM tooling and Intel Linux `perSystem` linker hook/targets. Generic Nix/media
serializer proofs using old version names as fixtures are not compatibility
jobs; retain meaningful serializer coverage or replace those fixtures as the
generator API changes.

#### Required checks and existing plans

The active [`main-2` ruleset](https://github.com/functionalscript/functionalscript/rules/20948497)
requires both `node22` and `node24`. Remove those required contexts **before the
implementation PR enters the merge queue**. Otherwise the removed jobs never
report and the queue can wait for checks that no longer exist. Keep the
surviving required checks. This is a repository setting change, not an output
of the CI generator.

Update current support claims in [`CONTRIBUTING.md`](../../CONTRIBUTING.md),
[`AGENTS.md`](../../AGENTS.md), [`ci/README.md`](../ci/README.md),
[`ci/nix/README.md`](../ci/nix/README.md) and the CI modules' JSDoc. Remove the
old test-runner compatibility paragraph and the Node 22/24 shell exceptions.
Replace CONTRIBUTING's "latest is the floor", "22 min." and `Node 22+` claims
with the exact release toolset. Update the version-update guidance alongside the
configuration and [`changelog/RELEASE.md`](../../changelog/RELEASE.md)'s release
procedure to record and verify each release's tested versions. Historical
measurements in [`ci/packed-consumer-validation.md`](../ci/packed-consumer-validation.md)
remain historical; update its current procedure to use the selected pins.

Reconcile the pending CI consolidation and documentation plans with the new
baseline: their future jobs no longer run Node 22/24, and the multiple-flake
constraint disappears. Remeasure any runner-time estimates rather than treating
old measurements as predictions for the new layout. Preserve migration history
and benchmarks explicitly recorded on older runtimes. A comment mentioning
Node 22 is not itself removable compatibility code: filesystem ordering,
byte-path handling, HTTP behavior and stack-safety fixes can still be necessary
on Node 26, Bun, Deno or another platform.

### Tasks

- [ ] Document one exact accepted version per tool during prerelease, the
      near-current stable selection policy and the requirement to use an older
      FunctionalScript release when an older tool is needed. Leave expanded
      support after release subject to actual demand.
- [ ] Pin the package's Node engine, lockfile metadata and `.node-version` to the
      selected exact Node release; keep their update procedure synchronized.
- [ ] Delete old-Node version detection and compatibility proofs; update imports
      and public declaration output while retaining the shared version utility.
- [ ] Reduce `NodeProgramOptions` to one selected test context, move Bun name
      formatting into its adapter, and remove obsolete fields/types/arguments.
- [ ] Remove legacy CI pins/jobs/flakes and simplify the now-constant shell
      selection APIs; preserve the surviving platform and consumer checks.
- [ ] Update the required-check ruleset before queuing the implementation.
- [ ] Regenerate outputs and locks; confirm old-Node outputs are deleted and
      the shared lock, shell and generated publishing workflow remain valid.
- [ ] Update current documentation and related plans without rewriting historical
      evidence or deleting behavior still needed by supported runtimes.
- [ ] Add the tested toolset record and its verification to the release procedure;
      ensure CI, website builds and clean consumers use the recorded pins.
- [ ] Run the repository's required checks in `./dev.sh`: `tsc`, the working-tree
      FunctionalScript suite, `npm start compile`, `node --test`, `cargo clippy`
      and `cargo fmt -- --check`; run `cargo test` if regeneration changes Rust.
      Also run `npm run cov`, `deno task cov`, `bun test` and the existing packed
      consumer checks for Node, Deno and Bun. Verify expected-throw success,
      expected-throw-without-throw failure, ordinary failure and nested tests;
      confirm generation leaves no uncommitted drift after its results are staged.
- [ ] Delete this TODO when the cutover is complete.

### Related

- [six-ci-jobs](../ci/todo/six-ci-jobs.md) — reconcile its proposed primary job,
  shell assumptions and ruleset changes with the removal.
- [readme-after-shell-consolidation](../ci/todo/readme-after-shell-consolidation.md)
  — overlapping CI documentation cleanup.
- [65z-ci-nix](../ci/todo/65z-ci-nix.md) and
  [096-ci-caching](../ci/todo/096-ci-caching.md) — update the current flake
  inventory and version-update requirements; retain their historical rationale.
- [built-package-checks](../ci/todo/built-package-checks.md) — the remaining
  published Windows CLI checks need replacement with current-release checks.
- [ci-generator-audience](../ci/todo/ci-generator-audience.md) — consumer-facing
  generator contract and obsolete-output cleanup.
- [spidermonkey-test-runner](../emergent_testing/todo/spidermonkey-test-runner.md)
  — reconcile its separate-flake plan and `nodeNixJobs` example if the generator
  interface becomes specific to the shared shell.
- [661-test-runner-behavior](../emergent_testing/todo/661-test-runner-behavior.md)
  — preserve the remaining Bun behavior and remove old-Node assumptions.
- [node-module-layering](../effects/todo/node-module-layering.md) — remove its
  obsolete `Engine` inventory entry without expanding this runtime cutover into
  an effects-layer reorganization.
