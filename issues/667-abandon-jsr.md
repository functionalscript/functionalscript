# Abandon Publishing to JSR

**Priority:** P3
**Status:** closed

## Motivation

Deno can use NPM packages directly, so maintaining a JSR publish is redundant. We want a single source of truth for our package.

## Plan

- [X] Publish `deno doc`-generated documentation to the website — split to [#667-deno-doc-website](./667-deno-doc-website.md) (separate, not a blocker).
- [X] Remove JSR publishing step from CI/CD (`npm-publish.yml`).
- [X] Remove `deno.json` and associated scripts (`fs/dev/index/`, `fs/dev/version/`, `package.json` `index` script, `update` script).
- [X] Remove JSR badge/icon from `README.md`.
- [X] Remove `deno publish --dry-run` from generated CI (`fs/ci/module.f.ts`, `fs/ci/deno/module.f.ts`), replace `deno task` commands with direct `deno run`/`deno test` commands.
- [X] Close / archive [#13](./013-docs-for-jsr.md) (docs for JSR score) as no longer relevant.
- [X] Update [#5](./005-publish.md) to reflect that JSR is dropped.

## Notes

- Deno and Bun are still used for testing — only the JSR *publish* step is removed.
- Deno users install via `npm:` specifier or directly from NPM.
