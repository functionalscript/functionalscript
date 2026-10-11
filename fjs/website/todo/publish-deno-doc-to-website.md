## Publish `deno doc` to website

**Priority:** P3
**Status:** open

Before or after dropping JSR, publish `deno doc`-generated API documentation to the FunctionalScript website so users have an up-to-date reference.

- [ ] Run `deno doc --html **/module.f.mjs` and review the output.
- [ ] Integrate the `deno doc` build step into the website generation pipeline (see [Generate website](./generate-website.md)).
- [ ] Publish the generated docs alongside the existing website content.
- [x] The same for the Rust crates: `cargo doc`, published under
      `/cargo.doc/` ([`../README.md`](../README.md#the-rust-api-reference));
      where the site build runs it is
      [cargo-doc-build-host](cargo-doc-build-host.md).
