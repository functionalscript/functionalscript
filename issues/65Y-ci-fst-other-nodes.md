# 65Y-ci-fst-other-nodes. Run `npm run fst` on non-default Node versions in CI

**Priority:** P3
**Status:** done

## Problem

The CI matrix runs two sets of Node jobs:

- **default Node** (`nodeMainSteps`) — runs `npm t` + `npm run fst` + tsgo
- **other Nodes** (`nodeVersions`) — previously ran only `npm t`

`npm run fst` (the self-hosted `fjs t` runner) was missing from the non-default
Node jobs, so failures in the FunctionalScript test runner itself were only caught
on the primary version.

## Fix

Added `npm run fst` to `basicTests` and used it in both `nodeTests` (default) and
`nodeSteps` (others) in `fs/ci/node/module.f.ts`. All Node versions in the matrix
now run both `npm t` and `npm run fst`.
