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
pinned Rust and then runs `npm run website`. What remains is running
`cargo doc` with it.

### Tasks

- [x] Choose where the build gets Rust: installed by the build command, from
      the pin in `fjs/ci/config`.
- [x] Generate the build command and record the decision in `../README.md`.
- [ ] Run `cargo doc --no-deps --workspace` in the build, with the header and
      footer flags that
      [`../README.md`](../README.md#the-rust-api-reference) will describe
      once rustdoc's output is published, and `deno doc` the same way.
