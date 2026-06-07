# Abandon Publishing to JSR

**Priority:** P3
**Status:** open

## Motivation

Deno can use NPM packages directly, so maintaining a JSR publish is redundant. We want a single source of truth for our package.

Prerequisite: before removing JSR publishing we must ensure that `deno doc` output is published to our website so that API documentation remains available and up to date. The JSR-hosted docs will go stale once we stop publishing there.

## Plan

- [ ] Publish `deno doc`-generated documentation to the website (see [#9](./009-generating-website.md)).
- [ ] Remove JSR publishing step from CI/CD.
- [ ] Remove JSR-specific fields from `deno.json` (version, exports regeneration) that exist solely for JSR.
- [ ] Close / archive [#13](./013-docs-for-jsr.md) (docs for JSR score) as no longer relevant.
- [ ] Update [#5](./005-publish.md) to reflect that JSR is dropped.
- [ ] Remove JSR badge/icon from `README.md`.
- [ ] Remove `deno.json` and associated scripts.

## Notes

- We still use Deno and Bun to test the package — only the JSR *publish* step is removed.
- Deno users will install via `npm:` specifier or directly from NPM.
