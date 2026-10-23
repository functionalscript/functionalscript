# Center columns in large RTTI graphs

**Priority:** P3
**Status:** wip

## Problem

Large expanded RTTI graphs pack every column against the top, leaving small
columns far above the vertical middle of the definitions they connect to.

## Proposal

Try vertically centering each column within the tallest column. Move nodes
and intermediate routing lanes together to preserve their relative order,
spacing, and box clearance. Keep the existing parent/child centering of trees.
RTTI opts into the experiment; other graph demos keep their current layout.

## Tasks

- [ ] Add column centering with proofs for nodes and intermediate lanes.
- [ ] Check every RTTI schema for box crossings and compare browser previews.

## Related

Stacked on [PR #3216](https://github.com/functionalscript/functionalscript/pull/3216).
