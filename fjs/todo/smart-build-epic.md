## Smart build epic

**Priority:** P3
**Status:** open

### Problem

An FJS change currently triggers a full coverage run of roughly 14,000 tests,
taking about ten minutes. The goal of smart build and testing is to build and
test only modules affected by a change, using `build-cache`.

Saving to and loading from the `build-cache` branch is already implemented.
The `fjs cov` command uses the static dependency graph to cache successful
coverage for individual measured targets. Inputs the scanner cannot completely
resolve remain uncached while the remaining graph foundations are developed.

### Scope

This epic tracks the foundations. The dependency graph's build-cache consumer
is documented in [per-module coverage caching](../ci/cache/README.md#isolated-coverage-manifests).

### Tasks

- [x] Save to and load from the `build-cache` branch.
- [ ] Build a module dependency graph:
  - [ ] Provide a generic AST for FJS and JS, with some TypeScript support.
        Parse all `.f.js` and `.f.mjs` files, including those not yet ready
        to compile into EDAG, and all JavaScript files in the repository.
  - [x] Extract module dependencies from the AST.
  - [x] Implement the [dependency graph CLI command](./module-dependency-graph-command.md)
        with `_deps.json` output.
  - [ ] Draw the dependency graph on a website.
- [x] Integrate the dependency graph with `build-cache` through
      [per-module coverage](../ci/cache/README.md#isolated-coverage-manifests).

### Related

- [CI success cache](../ci/cache/README.md) — existing `build-cache` support.
- [Smart CI follow-ups](../ci/todo/smart-ci-follow-ups.md) — follow-ups to
  the existing cache implementation.
