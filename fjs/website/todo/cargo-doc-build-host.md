## Where the site build runs `cargo doc`

**Priority:** P3
**Status:** open

### Problem

[publish-deno-doc-to-website](publish-deno-doc-to-website.md) asks for API
references on the website: `deno doc` for the FunctionalScript modules and
`cargo doc` for the Rust crates. Whatever generates them has to run those tools
as part of the site build.

The site is built by Cloudflare Workers Builds
([`../README.md`](../README.md#the-site-is-the-repository-served)), whose
build image has Node, Bun, Go, Python and Ruby but neither Rust nor Deno. So
neither the published site nor a branch preview can hold either reference
today; only a local build, inside the Nix shell, can.

This issue is where that build runs. How the output is placed on the site is
the other issue's. The options below name `cargo doc`; whatever is chosen
should answer `deno doc` as well.

### Option 1: install Rust in the Cloudflare build

The build command, set in the Cloudflare dashboard rather than in the
repository, installs a toolchain and runs `cargo doc` before
`npm run website`.

- **For:** the deploy model stays as it is — Cloudflare builds every branch,
  gives each its preview URL, and sets `WORKERS_CI_COMMIT_SHA` and
  `WORKERS_CI_BRANCH`, which the pages already use. No secrets in GitHub.
- **Against:** the toolchain is not the shell's. Its version is written in the
  dashboard command, apart from `rust` in `fjs/ci/config/module.f.js`, so the
  two can drift and nothing checks them.
- **Against:** `rustup` is an external tool fetched over the network on every
  build, which [`AGENTS.md` §6](../../../AGENTS.md#6-external-tools) asks
  approval for, and it adds its download and install time to every deploy.
- **Against:** the command lives outside the repository, so it is not
  reviewed in a pull request, and a change to it is invisible in the history.
  Deno would need a second installer.

### Option 2: build and deploy from CI, in the Nix shell

A job in the generated workflow (`fjs/ci`) runs `cargo doc` and
`npm run website` in the same shell every other job uses, and deploys the
result with `wrangler`. Cloudflare's own build is switched off.

- **For:** one environment. `cargo`, `deno` and Node are the pinned versions
  CI already tests with, and the steps are in the repository, generated and
  reviewed like the rest of the workflow.
- **For:** answers `deno doc` as well, with no further installer.
- **Against:** it changes the deploy model `../README.md` describes. The
  workflow needs a Cloudflare API token as a repository secret, and
  `wrangler` as a dependency.
- **Against:** branch previews have to be rebuilt by hand: a preview upload
  per branch, its URL reported on the pull request, and the commit and branch
  passed to the generator, which today reads Cloudflare's variables.
- **Against:** a pull request from a fork gets no secrets, so the job cannot
  upload a preview for it.

### Tasks

- [ ] Choose an option, or a third, with the owner.
- [ ] Record the decision in [`../README.md`](../README.md) and wire it.
