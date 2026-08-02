## 65Z-ci-nix-playwright. Run the Playwright job in a generated Nix flake

**Priority:** P3
**Status:** wip

### Progress

The Playwright job is the **first job migrated to `nix develop`**, ahead of the
canonical Node jobs — its browser setup is what made it worth doing first.

`nix/generated/playwright/flake.nix` (from `playwrightNixJob` in
`fjs/ci/playwright/module.f.ts`) provides `nodejs_26` and points Playwright at
`pkgs.playwright-driver.browsers` through `mkShell` environment attributes. The job now
has three workflow steps — install Nix, check out, and one `nix develop … --command bash
-euo pipefail -c '…'` invocation carrying the whole sequence. `actions/setup-node`,
`actions/cache`, `npm install -g playwright`, `playwright install-deps`, and `playwright
install` are all gone.

`fjs/ci/config/module.f.ts`'s `playwright` (and `package.json`'s `@playwright/test`) are
pinned to `1.59.1` — the exact version `pkgs.playwright-driver` provides at the pinned
Nixpkgs commit. That match is what makes the Nix-provided browsers usable at all;
Playwright refuses browsers whose revision does not match its own.

Because the job runs through its own flake, it no longer appears in the temporary
`nix-flakes` job. It states its own guarantees inside the invocation instead: a Node
version check (the one the shared job used to make) and a
`npx playwright --version` check tying the Nixpkgs browsers to the `package.json` pin.

**Verified in CI.** All three browsers pass against the Nix-provided bundle. The whole
job takes roughly three minutes, nearly all of it the browser runs themselves (~42s per
browser); realizing the shell — including the browsers — is a small fraction, so the
store paths come from the binary cache rather than being built.

`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` is still unvalidated in the other direction: it was
set preemptively from `driver.nix`'s note about WebKit, and no run has tried removing
it. Whether it is load-bearing on `ubuntu-26.04-arm` is unknown.

### Problem

The `playwright` CI job was the slowest job in the matrix. Its wall-clock time was
dominated by two steps the Node flake work does not touch:

- `playwright install-deps`, which installs OS-level shared libraries (fonts, codecs,
  X11/Wayland libraries, etc.) via `apt-get`;
- `playwright install`, which downloads the Chromium, Firefox, and WebKit browser
  binaries matching the pinned `@playwright/test` version.

`actions/cache` already cached the downloaded browsers across runs keyed on the
Playwright version, so most of the remaining cost on a cache hit was `install-deps`
(`apt-get`) plus tooling startup — exactly the kind of setup a Nix devShell replaces
with a pinned, content-addressed store path instead of a fresh package-manager run.

### How the browsers are provided

Nixpkgs ships its own `playwright-driver` package (top-level `playwright-driver`, which
is `driver.nix`'s `playwright-core`; `.browsers` is a `linkFarm` of the Chromium,
Chromium-headless-shell, Firefox, WebKit, and ffmpeg builds). Those builds are already
patched for the Nix store — `autoPatchelfHook` and wrapper scripts supply the shared
libraries `playwright install-deps` would otherwise `apt-get`, which is why that step
goes away rather than being replaced by a package list.

The driver's Playwright version is baked into the Nixpkgs commit: at
`21ea275a7c46aef9d4d6ddc962e6d562e9d94183` (`nixos-26.05`),
`pkgs/development/web/playwright/driver.nix` pins `1.59.1`. `fjs/ci/config/module.f.ts`'s
`playwright` and `package.json`'s `@playwright/test` are pinned to that same version,
since Playwright refuses browsers whose revision does not match its own.

The flake wires them together with `mkShell` environment attributes rather than a
`shellHook`, so the store path is a Nix value and never a string interpolation:

```nix
PLAYWRIGHT_BROWSERS_PATH = pkgs.playwright-driver.browsers;
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = "ubuntu-24.04";
```

This couples the repo's Playwright version to whatever Nixpkgs pins at the chosen
commit: bumping one now means bumping the other. That is the accepted direction —
generated flakes should use Nixpkgs-sourced package versions throughout, not just for
Node — and the job's `npx playwright --version` check is what makes a drift fail loudly.

### Remaining work

- **Try dropping `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE`.** It was set preemptively, and the
  job passes with it; nothing shows whether it is actually needed on
  `ubuntu-26.04-arm`. Remove it in its own commit so a failure names the cause.
- **Compare wall-clock time** against the pre-migration job, using a run from before the
  migration. The migrated job is ~3 minutes and is dominated by the browser runs
  themselves, so there is little shell overhead left to remove — but the pre-migration
  number was never recorded, so the actual saving is still unquantified.
- **Automate the paired bump.** Bumping the pinned Nixpkgs commit must re-read the
  Playwright driver version and update `fjs/ci/config/module.f.ts`, `package.json`,
  `package-lock.json`, `deno.lock`, and `bun.lock` together. A Playwright bump that
  stops at `package.json` reds the `deno` and `bun` jobs on
  `deno install --frozen` / `bun install --frozen-lockfile`, which is exactly what
  happened while this task was in progress. Still manual — see the open
  `npm run ci-nix-update` command in `65Z-ci-nix`.

### Tasks

- [x] Generate `nix/generated/playwright/flake.nix` pinning the job's Node version.
- [x] Pin `fjs/ci/config/module.f.ts`'s `playwright` and `package.json`'s
      `@playwright/test` to the exact version the pinned Nixpkgs commit provides.
- [x] Add `pkgs.playwright-driver.browsers` and point `PLAYWRIGHT_BROWSERS_PATH` at it.
- [x] Drop `actions/setup-node`, `actions/cache`, `npm install -g playwright`,
      `playwright install-deps`, and `playwright install` from the job.
- [x] Run the job's whole sequence in one `nix develop --command` invocation, checking
      its own Node and Playwright versions inside it.
- [x] Confirm all three browsers pass in CI against the Nix-provided bundle.
- [ ] Check whether `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` is load-bearing.
- [ ] Compare the migrated job's wall-clock time against a pre-migration run.
- [ ] Fold the driver-version check, and the `deno.lock`/`bun.lock` updates a Playwright
      bump requires, into the Nixpkgs bump process.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture, task boundaries, and the explicit
  exclusion of Playwright package/browser synchronization from the first Node
  milestone.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — the Node flake
  implementation this task follows the shape of.
- [ci-package-aware-deno-bun-and-playwright-steps](ci-package-aware-deno-bun-and-playwright-steps.md)
  — separate, unrelated proposal to make the Playwright job conditional on
  `@playwright/test` presence.
