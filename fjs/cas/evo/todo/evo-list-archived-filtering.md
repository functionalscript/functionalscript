# Filter archived subjects from `evo_list`

**Priority:** P2
**Status:** open

### Problem

`evo_list` currently returns every subject, including subjects whose current
revisions are archived. It has no filter parameter, so clients cannot request
active or archived subjects selectively.

A subject can have multiple current heads. Because each revision may carry an
optional `archived` flag, the API must define the subject's status when heads
disagree instead of relying on an arbitrary head.

### Proposal

Add an optional `archived?: true` parameter to the core `Evo.list` API and
forward it unchanged from the MCP adapter. Preserve the existing effectful,
readonly return contract:

```ts
list(archived?: true): Effect<MemOp, readonly Subject[]>
```

Treat the parameter as a status filter:

- When omitted, return only active subjects.
- When `archived: true` is provided, return only archived subjects.

A subject is active when it has at least one derived current head that is not
archived. It is archived only when it has at least one derived current head and
every derived current head is archived. A subject with no derived heads is
excluded from both results: it is neither active nor archived. If heads
disagree, the subject is active by default and is excluded from the
archived-only result.

The cache must continue to store every revision hash and parent as it does
today. In addition, store each revision's archived flag keyed by its revision
hash. Derive the current heads from the complete revision/parent graph using
the existing `headsOf` logic; do not maintain or update a separate running head
set, because CAS hash order is not ancestry order and folding a child before
its parent can otherwise resurrect an obsolete parent as a head. Apply the
archived-state map only to the derived heads when classifying a subject.

There is intentionally no all-subjects mode in this initial API. This changes
the default result set and is therefore a breaking change.

### Tasks

- [ ] Add `archived?: true` to the core `Evo.list` API and forward it from
      the MCP adapter.
- [ ] Store each revision's archived flag by revision hash while retaining the
      existing complete revision/parent graph.
- [ ] Use `headsOf` over that graph when classifying subjects; do not cache a
      mutable running head set.
- [ ] Return only subjects with at least one unarchived derived head when
      `archived` is omitted.
- [ ] Return only subjects with at least one derived head and all derived heads
      archived when `archived: true` is provided.
- [ ] Exclude subjects with no derived heads from both filtered results.
- [ ] Add coverage for no heads, one active head, one archived head, and
      concurrent heads with both statuses.
- [ ] Document the breaking-change behavior in the MCP/Evo API documentation.

### Related

- [PR #1386](https://github.com/functionalscript/functionalscript/pull/1386)
- [fjs/cas/evo/README.md](../README.md) — Evo cache and current-head behavior.
- [fjs/mcp/evo/](../../../mcp/evo/) — MCP adapter for Evo commands.
