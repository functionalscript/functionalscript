## Run `cargo doc` in the site build

**Priority:** P3
**Status:** wip

### Problem

[publish-deno-doc-to-website](publish-deno-doc-to-website.md) asks for API
references on the website: `deno doc` for the FunctionalScript modules and
`cargo doc` for the Rust crates. Whatever generates them has to run those tools
as part of the site build.

The site is built by Cloudflare Workers Builds, whose build image has Node but
neither Rust nor Deno. The decision on where the tools come from is taken and
recorded in [`../README.md`](../README.md#the-build-command): the build
command is a generated script, `gen.cloudflare/build.sh`, that installs the
pinned Rust and then runs `npm run website`, and it now runs `cargo doc`
too. What remains is `deno doc`.

### Tasks

- [x] Choose where the build gets Rust: installed by the build command, from
      the pin in `fjs/ci/config`.
- [x] Generate the build command and record the decision in `../README.md`.
- [x] Run `cargo doc --no-deps --workspace` in the build, with the header and
      footer flags that
      [`../README.md`](../README.md#the-rust-api-reference) describes.
- [ ] Run `deno doc` the same way, once
      [publish-deno-doc-to-website](publish-deno-doc-to-website.md) settles
      how its output is published.
