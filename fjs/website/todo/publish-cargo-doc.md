## Publish `cargo doc` to the website

**Priority:** P3
**Status:** wip

### Problem

The Rust crates — `nanvm-lib`, `nanvm-harness`, `nanvm-effects-node` — have
doc comments and no published reference. A reader on a crate's directory page
has the source and nothing that renders it.

Split from [publish-deno-doc-to-website](publish-deno-doc-to-website.md):
`cargo doc` output is good as it is, while `deno doc` does not read JSDoc
types and has its own open question.

### Decisions

- **One root, `/cargo.doc/`, holding rustdoc's output unchanged.** rustdoc
  writes one cross-crate search index and one `static.files/` for the whole
  workspace, so splitting it per crate would break search and the links
  between crates. Its pages are not restyled or wrapped: post-processing
  rustdoc's HTML is the machinery
  [source-and-doc-view](source-and-doc-view.md) declines for `deno doc`.
- **The generator copies `target/doc` into `cargo.doc/`; it does not run
  `cargo`.** Running a tool from the generator needs approval
  ([`AGENTS.md` §6](../../../AGENTS.md#6-external-tools)), and `cargo doc` has
  no option for where the docs alone go. Whoever builds the site runs
  `cargo doc --no-deps --workspace` first; without `target/doc` the build
  writes no `cargo.doc/` and no link to it. `target/` itself is never served:
  it holds build artifacts too.
- **`cargo.doc/index.html` is ours.** rustdoc on stable writes no root page
  (`--enable-index-page` is nightly), so the generator writes one in the
  site's frame, listing the documented crates: that is the way back to the
  rest of the site.
- **A crate's directory page links its docs.** A directory with a
  `Cargo.toml` links `/cargo.doc/<name>/`, its name with `-` read as `_` —
  rustdoc's spelling of the crate — when that crate was documented. The
  shared header gains nothing until there is one API entry for both
  languages.

### Open

- **Where `cargo doc` runs for the published site.** The site is built by
  Cloudflare Workers Builds, whose image has no Rust. Either the build installs
  a toolchain (not the pinned one, and an external tool in the build), or the
  site is built and deployed from CI inside the Nix shell, which already has
  `cargo` — a change to the deploy model `fjs/website/README.md` describes.
  Until this is decided, only a local build shows the docs.

### Tasks

- [ ] Generator: copy `target/doc` into `cargo.doc/`, write its index page,
      exclude it from the catalogue, and link each documented crate from its
      directory page.
- [ ] Decide and wire where the published site runs `cargo doc`.
