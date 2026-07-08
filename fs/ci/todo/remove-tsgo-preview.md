# Remove TSGO preview now that TypeScript 7.0.2 is released

**Priority:** P3
**Status:** open

### Problem

TypeScript 7.0.2 has been released, so we no longer need the
`@typescript/native-preview` (`tsgo`) preview package. `tsc` itself is now on
the native Go-based compiler, so we can drop the separate `tsgo` install/step
and just use `tsc` as the main compiler.

TSGO is currently wired in at:

- [`config/module.f.ts:53`](../config/module.f.ts) — pins the preview
  version: `export const tsgo = '7.0.0-dev.20260707.2'`
- [`node/module.f.ts:7,47,49`](../node/module.f.ts) — imports `tsgo`, adds an
  `npm install -g @typescript/native-preview@${tsgo}` step, and runs it as a
  separate `tsgo` test step
- `.github/workflows/ci.yml` (generated, node26 job) — currently has both the
  `npm install -g @typescript/native-preview@...` step and separate
  `npx tsc` / `tsgo` steps
- `package.json` — `"typescript": "6.0.3"` devDependency, which should be
  bumped to `7.0.2`
- `../../../tsconfig.json:38` — has a `/** To make TSGO happy: */`
  comment/workaround that should be reevaluated once native `tsc` is the
  compiler
- [`../README.md`](../README.md) — documents the `tsgo` step in the node26
  job description and file list
- `todo/116-tsgo-regression.md`, `todo/123-tsgo-types-node.md` (repo-root
  `todo/`) — existing TODOs tracking TSGO-specific regressions/quirks that
  may become obsolete or need re-verifying against 7.0.2

### Tasks

- [ ] Bump the `typescript` devDependency in `package.json` to `7.0.2`.
- [ ] Remove the `tsgo` config/version pin and the separate native-preview
      install/test steps from the CI generator (`config/module.f.ts`,
      `node/module.f.ts`).
- [ ] Regenerate `.github/workflows/ci.yml` via `fjs ci` so the node26 job
      only runs `npx tsc` (now backed by TS 7's native compiler) instead of
      installing and running `tsgo` separately.
- [ ] Update `../README.md` to drop references to the native preview step.
- [ ] Revisit the `tsconfig.json` "To make TSGO happy" workaround and the two
      existing TSGO-related todos (`todo/116-tsgo-regression.md`,
      `todo/123-tsgo-types-node.md`) to see if they're resolved by the 7.0.2
      release or need to be re-filed against `tsc` proper.
