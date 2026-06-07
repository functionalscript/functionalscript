# Publish deno doc to Website

**Priority:** P3
**Status:** open

Before or after dropping JSR (see [#667-abandon-jsr](./667-abandon-jsr.md)), publish `deno doc`-generated API documentation to the FunctionalScript website so users have an up-to-date reference.

## Plan

- [ ] Run `deno doc --html **/module.f.ts` and review the output.
- [ ] Integrate the `deno doc` build step into the website generation pipeline (see [#9](./009-generating-website.md)).
- [ ] Publish the generated docs alongside the existing website content.
