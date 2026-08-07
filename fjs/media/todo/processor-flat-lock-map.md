## Pass flat revision locks through processors

**Priority:** P3
**Status:** open

### Problem

Stage 1 of the revision lock map adds optional flat subject-to-content bindings
to `vnd.fjs.revision` and the Evo/MCP APIs. Future content processors that
resolve subject dependencies need to accept this resolver input and return the
bindings they actually used so callers can persist reproducible revisions.

### Proposal

Define a shared processor-facing flat lock-map input/output contract using
`LockMap` from `fjs/media/revision`. Keep dependency discovery, precedence,
ancestry inspection, conflict handling, and mutable-head fallback in each
resolver rather than assigning those semantics to the media format.

### Tasks

- [ ] Inventory processors that resolve mutable subjects.
- [ ] Add optional flat lock input to their shared API.
- [ ] Return the flat bindings used during processing.
- [ ] Add proofs for absent, sparse, complete, and cyclic flat maps.

### Related

- [Revision lock map](./revision-lock-map.md)
- [Revision format](../revision/README.md)
