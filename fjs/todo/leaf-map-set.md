# Replace Map and Set in remaining leaf modules

**Status:** wip
**Priority:** P3

Eleven authored `module.f.mjs` leaves still construct JavaScript `Map` or
`Set`, which the FJS compiler rejects. Replace those collections with the
existing persistent map/set APIs, whose reference-key index uses `RefMap`,
or simpler immutable collections where their contracts fit.

Preserve identity, SameValueZero comparisons, first-insertion order,
duplicate-key replacement and persistence. Update public collection types
and their consumers when necessary. Common runtime admission is outside
this task.

## Tasks

- Replace Map/Set usage in the eleven current leaves and adapt consumers.
- Add shared collection helpers only where the replacements need them.
- Promote modules that the linked compiler accepts and update references.
- Verify scoped proofs, coverage, types, generation and affected demos.
