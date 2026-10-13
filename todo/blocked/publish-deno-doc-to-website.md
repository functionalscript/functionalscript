## Publish `deno doc` to website

**Priority:** P3
**Status:** blocked

### Problem

FunctionalScript's public API combines runtime exports whose types are
described through JSDoc with declarations in public `types.ts` entrypoints.
Some of those declaration modules, such as
[`fjs/types/phantom/types.ts`](../../fjs/types/phantom/types.ts), have no
runtime companion. Deno 2.8.3's HTML documentation does not render the JSDoc
types, so publishing its current output would present an incomplete API
reference.

### Trigger

Move this issue back next to the website when a Deno version accepted by the
repository renders JSDoc types from FunctionalScript modules in its HTML
output. Before resuming the website integration, verify the generated reference
on a runtime module, its `types.ts` companion, a standalone type-only module,
and their symbol pages.

### Work

Before or after dropping JSR, publish `deno doc`-generated API documentation
to the FunctionalScript website so users have an up-to-date reference.

- [ ] Run `deno doc --html` over every public FunctionalScript runtime module
      and `types.ts` entrypoint, including standalone type-only modules, and
      review the output.
- [ ] Integrate the `deno doc` build step into the website generation pipeline
      (see [Generate website](../../fjs/website/todo/generate-website.md)).
- [ ] Publish the generated docs alongside the existing website content.
- [x] The same for the Rust crates: `cargo doc`, published under
      `/cargo.doc/`
      ([`fjs/website/README.md`](../../fjs/website/README.md#the-rust-api-reference));
      where the site build runs it is
      [cargo-doc-build-host](../../fjs/website/todo/cargo-doc-build-host.md).

### Related

- [Prototype PR #2873](https://github.com/functionalscript/functionalscript/pull/2873)
  established the build and hosting path before the missing JSDoc types blocked
  publication.
