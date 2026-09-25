## built-package-checks. Check the package this commit builds, in the package job

**Priority:** P3
**Status:** open

### Problem

Two CI jobs install `functionalscript` and run it. Both of them install it
**from the registry**, at a version that is not the commit under review:

| job | steps |
|-----|-------|
| the two Windows platform jobs (`job` in `../module.f.mjs`, where `o === 'windows'`), through `nodeMainSteps` → `platformNodeSteps` (`../node/module.f.mjs`) | `npm install -g functionalscript@<version>`, `fjs test` |

The four other platform jobs were four more, until they moved into the shared
Nix shell ([65Z-ci-nix](65z-ci-nix.md)) and lost the pair.

`deno` and `bun` were two more. Both lost their global install and the smoke test it
fed, for the reason this issue gives: they subjected a shipped release rather than
the commit under review. Each now runs its own lockfile install and its own coverage
command and nothing else, so the package check those two used to carry is one this
issue owes, from the tarball. Deno's `--minimum-dependency-age=0` went with its
install, as this issue predicted it would.

`node22` was another until it lost `fjs test` and the install feeding it. Those
were there because Node 22 could not run `node --test`, not to check a package,
and the job runs the suite directly now.

`<version>` is `functionalscript` in `../config/module.f.mjs`, and its comment
states the intent: a **published release**, deliberately not
`package.json`'s in-repo version.

So the check runs backwards. It can only fail when an already-shipped CLI stops
working against this repository's current proofs; a regression in the CLI *this
commit produces* is invisible until after it is published, and then only on the
next pull request. The one job that does look at what this commit builds —
`package-check` (`./module.f.mjs`), which downloads the `npm pack` artifact and
type-checks the declarations it ships — never runs it.

There is a second problem underneath: a job named for a runtime proves two
unrelated things, so "where does CI test the package?" has one right answer and
two other places that also claim to.

### Proposal

Two changes, independent in principle and worth doing together:

**1. Install the package this commit builds.** `node26` already runs `npm pack`
and uploads the tarball as the `package-tarball` artifact
(`packageArtifact`/`packageJobId` in `../node/module.f.mjs`); `package-check`
already downloads it and installs it as `packed@file:$(echo *.tgz)`. The checks
above install from that same artifact instead of from the registry. The subject
becomes the commit under review, which is the only version whose breakage this
pull request can still prevent.

**2. Put them in the package job family.** `fjs/ci/package` owns everything
whose subject is the built package. Its existing job keeps its deliberate
no-checkout property — the tarball's declarations must be type-checked as an
outsider sees them, with no repository up the tree to resolve into. The new
jobs need a checkout, because `fjs test` runs this repository's proofs with the
installed CLI. Same module, same artifact, different runner requirements.

#### What falls out

- **`functionalscript` in `../config/module.f.mjs` loses its last consumer.** It
  is now read only by `nodeMainSteps` → `platformNodeSteps`, which is the row
  above; `denoSteps` and `bunSteps` stopped reading it, and `nodeVersionJobs`
  stopped when Node 22 lost its global install. The constant, and the manual
  bump it needs after every release, go away with that row.
- **Deno's `--minimum-dependency-age=0` is already gone**, for exactly the reason
  this issue gave: the flag was there to install a package younger than 24 hours
  from the registry, and a tarball on disk has no dependency age.
- **The new jobs gain `needs: [node26]`**, as `package-check` already has, so
  they cannot start before the artifact exists. Today exactly one job orders
  itself, and `jobNeeds` in `../proof.f.mjs` pins that count deliberately —
  changing it is part of this work, not a surprise. The runtime jobs gain no
  ordering: the checks move out of them rather than making `node22` wait for
  `node26`.
- **Nothing checks the last published release any more.** That is the correct
  trade — a pull request cannot fix a shipped release — but if the check is
  wanted, it belongs in a scheduled run against `main`, not in per-commit CI.
  Out of scope here; file it separately if it is missed.

#### Decisions to make first

- **Platform coverage.** The CLI is exercised on the two Windows runners today;
  the four others stopped when they moved into the shared Nix shell.
  `actions/download-artifact` works on all six, so keeping the matrix is
  possible; consolidating into one Linux job is a reduction, and Windows and
  macOS are exactly where a CLI's path handling and shebang most plausibly
  break. Choose, and record the answer here.
- **What the two Windows jobs keep.** `platformNodeSteps` is *entirely* this
  check plus `npm ci`. Subtract it and those jobs are Rust-only where Rust is
  present; say what their Node half becomes, including whether `npm ci` still
  has a purpose there.
- ~~**Whether Deno and Bun move too.**~~ Settled by removal rather than by a
  move: both jobs dropped their smoke halves and kept the parts that test the
  working tree, so each reads coherently as "this repository under Deno/Bun".
  What they used to check is owed here, from the tarball, and the question left
  is only how many package jobs that takes.
- **How each runtime installs a tarball globally.** `npm install -g ./x.tgz`,
  `bun install -g ./x.tgz` and Deno's equivalent need checking against the
  pinned versions rather than assumed; Deno in particular installs from
  `npm:` specifiers today. Deno 2.8.3 — the version `../config/module.f.mjs`
  pins — was reported to break `deno run -A npm:functionalscript` when
  `deno install --frozen` runs first (`package.json … did not exist`), so a Deno
  check of the tarball must be tried in both orders before one is chosen.

### Tasks

- [ ] Decide the platform-coverage question and record the answer here before
      any code moves
- [ ] Decide what the two Windows jobs keep, and whether Deno and Bun move
- [ ] Confirm the global-install spelling for a local tarball on each runtime
- [ ] Generate the checks from `fjs/ci/package`, consuming `packageArtifact`
      with `needs: [packageJobId]`
- [ ] Remove the registry install from `platformNodeSteps` (`denoSteps` and
      `bunSteps` no longer have one)
- [ ] Delete `functionalscript` from `../config/module.f.mjs` once nothing reads
      it — `platformNodeSteps` is the last thing that does
- [x] Drop Deno's `--minimum-dependency-age=0` with its reason — done when that
      job's registry install went
- [x] Consider dropping the `shellHook` field — **no**: the shared shell declares
      one for `x86_64-linux`, pointing `cargo` at `pkgsi686Linux.stdenv.cc`. Node
      22's went with its global install, but the field now has a user of the kind
      it was for. It has since moved from the job to `NixJob.perSystem`, where a
      hook belongs to the system whose package it names
- [ ] Update `../proof.f.mjs`: the job count, the per-job assertions, and
      `jobNeeds`'s ordering count

### Related

- [65Z-ci-nix](65z-ci-nix.md) — the Node jobs, all three of which are now free of
  published-package steps
- An optional per-package self-test hook — `npm run ci:self-test --if-present`
  after installing the tarball — was proposed as `667-ci-self-test-script` and
  deleted: the package-name special case it was filed to replace is gone from
  the generator. If a package ever needs its own post-install check, it belongs
  to the jobs this issue adds.
- [66H-ci-npm-global-install](66h-ci-npm-global-install.md) — a factory for the
  `npm install -g` step shape; `fjsGlobalInstall` is one of its two call sites,
  so this issue either removes the case for it or concentrates it
- [package-check-unsupported-package-shapes](package-check-unsupported-package-shapes.md)
  — the sibling issue about what `package-check` can and cannot see
- [ci-integration-tests](ci-integration-tests.md) — its integration stage also
  installs the `package-tarball` artifact across a platform matrix. Open
  question: which of the two owns the per-platform install of the tarball.
