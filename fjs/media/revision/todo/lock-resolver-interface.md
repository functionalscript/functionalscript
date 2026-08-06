## Lock-aware revision processing

**Priority:** P3
**Status:** open

### Problem

`vnd.fjs.revision` now carries an optional `lock` map
([README](../README.md#lock-map)), and `fjs/cas/evo` stores and returns it
untouched. Nothing reads it yet. The format deliberately defines no
resolution algorithm, so a processor — the component that takes a revision and
produces a result from its snapshot and the other subjects that snapshot
references — is what turns a recorded lock map into reproducible processing.

There is no shape for "process this revision, here is a lock map, tell me what
you used". Without it a lock map is data nobody consumes, and the
reproducibility claim in the README has no implementation to point at.

### Proposal

A processor takes a revision (or its snapshot plus
starting binding `subject -> snapshot`) and an optional `LockMap`, and returns
its result together with an **updated** `LockMap` recording every resolution
choice it used or discovered. The updated map is what a caller stores on the
next revision to make the same operation repeatable under the same resolver
semantics; it is not a claim of universal completeness — another processor may
discover more dependencies or need different information.

Sufficiency is per invocation, not a property of the map (see the README), so
the return type must distinguish "resolved" from "insufficient for this
invocation" rather than "invalid lock": an ambiguous or missing binding is a
resolver outcome, never a format error. Ambiguity a processor may hit and must
be able to report:

- a subject bound both by the starting binding and by a lock entry, with no
  format-level precedence to appeal to;
- a nested map whose relationship to its enclosing map its policy cannot
  decide;
- a subject it needs and the map does not bind.

Whatever policy a processor picks — first-parent history walk, caller-provided
overlay, content inspection, consulting mutable heads, or outright rejection —
belongs to that processor and is documented with it, not in
`fjs/media/revision`.

### Out of scope

- Writing a `lock` through MCP `evo_add`. That is blocked on a JSON Schema
  producer limitation, not on any resolution question, and is tracked
  separately —
  [fjs/media/json/schema recursive-schema-defs](../../json/schema/todo/recursive-schema-defs.md).
  Reading a lock back through `evo_revision` already works.

### Tasks

- [ ] Design the processor input/output shape, with the updated lock map as an
      explicit part of the result.
- [ ] Distinguish "insufficient for this invocation" from "invalid lock" in the
      result type, and cover each ambiguity case above.
- [ ] Document the chosen resolution policy next to the processor, keeping
      `fjs/media/revision` free of it.

### Related

- [fjs/media/revision/README.md](../README.md) — the `lock` field, what the
  format refuses to decide, and per-invocation sufficiency
- [fjs/cas/evo/README.md](../../../cas/evo/README.md) — `RevisionData`, which
  carries `lock` through in both directions without interpreting it
