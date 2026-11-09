## Cache coverage by module dependencies

**Priority:** P2
**Status:** wip

### Problem

Coverage currently caches the whole check. Use the dependency graph to cache
successful coverage separately for each `module.f.js` and `module.f.mjs`,
including its sibling proofs and their transitive dependencies.

### Tasks

- [ ] Define the staged rollout, starting with a dedicated `cov` CI job.
