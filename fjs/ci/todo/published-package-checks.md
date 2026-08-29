## published-package-checks. Published-package checks belong in the package job

**Priority:** P3
**Status:** open

### Problem

Nine CI jobs install `functionalscript` from the registry and run it. In none of
them is that the job's subject:

| job | steps |
|-----|-------|
| the six platform jobs, through `nodeMainSteps` → `platformNodeSteps` (`../node/module.f.mjs`) | `npm install -g functionalscript@<version>`, `fjs test` |
| `node22`, through `node22Steps` (same module) | the same pair |
| `deno` (`../deno/module.f.mjs`) | `deno install -g -A --minimum-dependency-age=0 npm:functionalscript@<version>`, `deno run -A --minimum-dependency-age=0 npm:functionalscript@<version> test` |
| `bun` (`../bun/module.f.mjs`) | `bun install -g functionalscript@<version>`, `bunx functionalscript@<version> test` |

The version is `functionalscript` in `../config/module.f.mjs`, and its comment
says what it is: a **published release**, deliberately not `package.json`'s
in-repo version. So these steps do not test the commit under review. They check
that an already-released CLI still runs this repository's suite — a real check,
and the only kind in CI whose subject is a distributed artifact rather than the
working tree, except for the one job built for exactly that: `package-check`
(`./module.f.mjs`).

A job named for a runtime therefore proves two unrelated things, and a reader
asking "where does CI test the package?" gets one answer that is right
(`package-check`) and nine that are also right.

### What it costs the Nix migration

`nix/node22/flake.nix` is the one generated flake carrying a `shellHook`:

```nix
shellHook = ''
  export NPM_CONFIG_PREFIX="$HOME/.npm-global"
  export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
  mkdir -p "$NPM_CONFIG_PREFIX"
'';
```

It exists for one reason: so `npm install -g` has somewhere writable inside the
shell and the installed `fjs` is on `PATH` for a later step. Both halves of that
are the published-CLI check, not the Node 22 runtime. Move the check out and the
hook goes with it, which makes Node 22's migration as mechanical as Node 24's
was — and leaves `NixJob.shellHook` with no declared user.

That is the immediate reason to do this, but not the reason it is right: these
steps would be misplaced even if no job ever ran under Nix.

### Proposal

`fjs/ci/package` owns everything whose subject is a distributed package. Two
kinds, which cannot share a job because they need opposite things from the
runner:

1. **the tarball this pull request builds** — `package-check` unchanged: no
   checkout by design, downloads the `npm pack` artifact, type-checks every
   declaration it ships;
2. **the published release** — the steps in the table above, moved into a job
   this module generates. These *need* a checkout, because `fjs test` runs this
   repository's proofs with the released CLI.

Three decisions have to be made first, which is why this is a design task rather
than a patch:

- **Platform coverage.** The published CLI runs on six OS/arch runners today.
  Consolidating into one job reduces that to one. Either the new job family
  keeps the matrix — same coverage, the jobs re-homed and renamed — or the
  coverage is deliberately cut to one Linux runner. The second is a reduction in
  what CI checks, not a refactor, so it needs to be chosen rather than fallen
  into. Note what would be lost: Windows and macOS are where a published CLI's
  path handling and shebang most plausibly break.
- **What the platform jobs are left with.** `platformNodeSteps` is *entirely*
  the published-CLI check plus `npm ci`. Subtract it and the six jobs are
  Rust-only where Rust is present. Say what their Node half becomes — including
  whether `npm ci` still has a purpose there.
- **Deno and Bun.** Their smoke steps sit beside `deno task cov` and
  `bun test --coverage`, which do test the working tree. Moving only the smoke
  halves leaves those jobs coherent — "this repository under Deno/Bun" — at the
  cost of more package jobs. Decide whether all three runtimes move together.

### Tasks

- [ ] Decide the platform-coverage question and record the answer here before
      any code moves
- [ ] Decide what the six platform jobs keep
- [ ] Generate the published-release job(s) from `fjs/ci/package`
- [ ] Remove the published-CLI steps from `platformNodeSteps` and `node22Steps`
- [ ] Move the Deno and Bun smoke steps, if they move
- [ ] Drop `nix/node22`'s `shellHook`, and `NixJob.shellHook` with it if nothing
      else declares one
- [ ] Update the job-count and per-job assertions in `../proof.f.mjs`

### Related

- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) and
  [65Z-ci-nix](65z-ci-nix.md) — the Node 22 migration this unblocks the
  `shellHook` half of
- [66H-ci-npm-global-install](66h-ci-npm-global-install.md) — a factory for the
  `npm install -g` step shape; `fjsGlobalInstall` is its one surviving call
  site, so this issue may delete the case for it or concentrate it in one place
- [667-ci-self-test-script](667-ci-self-test-script.md) — a package self-test
  convention, which is what a moved check would eventually run
- [package-check-unsupported-package-shapes](package-check-unsupported-package-shapes.md)
  — the sibling issue about what `package-check` can and cannot see
