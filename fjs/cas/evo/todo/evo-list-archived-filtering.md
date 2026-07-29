# Filter archived subjects from `evo_list`

**Priority:** P2
**Status:** open

### Problem

`evo_list` currently returns every subject, including subjects whose current
revisions are archived. It has no filter parameter, so clients cannot request
active tasks by default while still opting into archived subjects.

A subject can have multiple current heads. Because each revision may carry an
optional `archived` flag, the API must define the subject's status when heads
disagree instead of relying on an arbitrary head.

### Proposal

Add an optional `archived?: true` parameter to the MCP server's `evo_list`
command. When the parameter is omitted, return only active subjects. When it
is `true`, return all subjects, including archived subjects.

A subject is active when at least one of its current heads is not archived.
It is archived only when every current head is archived. If heads disagree,
the subject remains active by default; `archived: true` still returns it.
The implementation must inspect the archived flag on each current head and
extend the Evo cache/API state as needed to make this classification explicit.

This changes the default result set and is therefore a breaking change.

### Tasks

- [ ] Add the optional `archived?: true` parameter to the MCP server command.
- [ ] Preserve all current heads in the Evo cache and evaluate each head's
      archived flag when classifying a subject.
- [ ] Return only subjects with at least one unarchived head when `archived`
      is omitted.
- [ ] Return all subjects when `archived: true` is provided.
- [ ] Add coverage for no heads, one active head, one archived head, and
      concurrent heads with both statuses.
- [ ] Document the breaking-change behavior in the MCP/Evo API documentation.

### Related

- [PR #1386](https://github.com/functionalscript/functionalscript/pull/1386)
- [fjs/cas/evo/README.md](../README.md) — Evo cache and current-head behavior.
- [fjs/cas/evo/mcp/](../mcp/) — MCP adapter for Evo commands.
