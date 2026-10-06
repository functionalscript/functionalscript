## Handle host BigInt allocation failures

**Priority:** P4
**Status:** open

### Problem

The existing NaNVM corpus includes `1n << 100000000000000000n` and
`1n >> -100000000000000000n`. Both grow a BigInt beyond the host's capacity.
The represented numeric dispatcher currently lets the host's allocation
exception escape. Corpus cases mark this resource boundary explicitly;
ordinary language failures are asserted as `error(['undefined'])`.

Host allocation failures are not yet converted into represented failures.
They need the same deferred boundary work as
[oversized string allocation](../../method/todo/string-allocation-failures.md).
Do not add arbitrary integer-size limits as part of the value migration.

### Tasks

- Define host resource-failure handling with the
  [interpreter resource work](../../../../compiler/todo/bound-edag-interpreter-resources.md).
- Preserve existing failure cases while keeping resource exhaustion distinct
  from specified failures such as BigInt division by zero.
- Remove the corpus's host-allocation exception markers when that boundary
  produces represented failures.
