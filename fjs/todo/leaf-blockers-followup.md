# Resolve the remaining leaf blockers

**Priority:** P3
**Status:** wip

Fix the current leaf modules' prohibited property reads, native Set use,
and forward references without changing their behavior. The grammar's
recursive rules also need a representation the current compiler accepts,
while retaining parsing and rewrite semantics.

## Tasks

- Replace prohibited own-property reads in `cas/git` and `nanvm`.
- Replace native Set usage in `edag/to_fast` with existing persistent collections.
- Resolve the `sameOutput` forward reference in `nanvm/demos/page`.
- Resolve the grammar's recursive-rule dependency with compatible rule mapping.
- Promote compiler-accepted modules and validate the affected behavior.
