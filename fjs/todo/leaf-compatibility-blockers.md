## Resolve the current leaf compatibility blockers

**Priority:** P2
**Status:** wip

### Problem

The current leaf modules still use native JSON serialization, implicit computed
indexes, callbacks capturing reassigned bindings, and prohibited property reads.
These spellings prevent otherwise functional code from compiling as FJS.

### Scope

Apply the existing FJS equivalents in the eight current leaves:
`compiler/graph`, `compiler/parser/grammar`, `edag/from_fast`,
`git/refstore/write`, `nanvm/demos/page`, `nanvm/demos/publish`,
`website/demo/versions`, and `website/mermaid`.

Use `media/json` for serialization, explicit numeric indexes or `entry` for
computed reads, immutable snapshots for callback captures, and `entry` for
prohibited own properties. Preserve value semantics, identity, and evaluation
order. Other unsupported constructs and compiler admission rules are unchanged.

### Tasks

- [ ] Replace the requested constructs in the current leaves.
- [ ] Check scoped proofs, fresh coverage, types, and affected consumers.
- [ ] Promote any modules the compiler accepts whole and update references.
- [ ] Regenerate affected outputs and verify authored `.f.js` compilation.
