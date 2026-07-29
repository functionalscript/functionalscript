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

Add an optional `archived?: true` parameter to the MCP server's `evo_list`
command. Treat the parameter as a status filter:

- When omitted, return only active subjects.
- When `archived: true` is provided, return only archived subjects.

A subject is active when at least one of its current heads is not archived. It
is archived only when every current head is archived. If heads disagree, the
subject is active by default and is excluded from the archived-only result.

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

- [ ] Add the optional `archived?: true` parameter to the MCP server command.
- [ ] Store each revision's archived flag by revision hash while retaining the
      existing complete revision/parent graph.
- [ ] Use `headsOf` over that graph when classifying subjects; do not cache a
      mutable running head set.
- [ ] Return only subjects with at least one unarchived derived head when
      `archived` is omitted.
- [ ] Return only subjects whose derived heads are all archived when
      `archived: true` is provided.
- [ ] Add coverage for no heads, one active head, one archived head, and
      concurrent heads with both statuses.
- [ ] Document the breaking-change behavior in the MCP/Evo API documentation.

### Related

- [PR #1386](https://github.com/functionalscript/functionalscript/pull/1386)
- [fjs/cas/evo/README.md](../README.md) — Evo cache and current-head behavior.
- [fjs/cas/evo/mcp/](../mcp/) — MCP adapter for Evo commands.
