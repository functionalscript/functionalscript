## Smart build epic

**Priority:** P3
**Status:** open

### Problem

An FJS change currently triggers a full coverage run of roughly 14,000 tests,
taking about ten minutes. The goal of smart build and testing is to build and
test only modules affected by a change, using `build-cache`.

Saving to and loading from the `build-cache` branch is already implemented.
The `fjs cov` command also supports running coverage for individual modules.
The next foundation is a module dependency graph.

### Scope

This epic tracks the foundations. How smart build uses them will be designed
later.

### Tasks

- [x] Save to and load from the `build-cache` branch.
- [ ] Build a module dependency graph:
  - [ ] Provide a generic AST for FJS and JS, with some TypeScript support.
        Parse all `.f.js` and `.f.mjs` files, including those not yet ready
        to compile into EDAG, and all JavaScript files in the repository.
  - [ ] Extract module dependencies from the AST.
  - [ ] Draw the dependency graph on a website.

### Related

- [CI success cache](../ci/cache/README.md) — existing `build-cache` support.
- [Smart CI follow-ups](../ci/todo/smart-ci-follow-ups.md) — follow-ups to
  the existing cache implementation.
