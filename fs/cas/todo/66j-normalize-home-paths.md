## 66J-normalize-home-paths. Normalize `~/` to absolute paths and validate directory containment

**Priority:** P3
**Status:** irrelevant

### Why this is superseded

This issue's entire purpose was to harden the **MCP `cas_add` path validation**
— replace the string prefix/`..` check on a client-supplied path with canonical
normalization + directory-containment.
[remove-local-file-urls-mcp](../mcp/todo/remove-local-file-urls-mcp.md)
removes local-path upload (`cas_add type:'url'`) from the MCP server entirely:
the server no longer accepts a client-supplied filesystem path, so there is **no
`cas_add` path to normalize or contain**. Every remaining server file operation
is on a path the server derives itself under `~/.cas/` (see the invariant in
remove-local-file-urls-mcp), which needs no containment check against client input.

The path-traversal/symlink hardening this proposed is exactly the scaffolding
that issue concluded is the wrong shape — removing the capability makes the whole
check unnecessary rather than merely more robust.

Keeping the file only until the removal in remove-local-file-urls-mcp lands;
**delete it in the same change.** If some *internal* path handling (e.g.
normalizing the server-derived staging directory in
[66j-cas-periodic-stage-recovery](66j-cas-periodic-stage-recovery.md)) turns out to need canonicalization,
that is a separate, non-security concern — it operates on server-owned paths,
not client input — and should be filed narrowly rather than reviving this
client-path-validation issue.

### Related

- [remove-local-file-urls-mcp](../mcp/todo/remove-local-file-urls-mcp.md) —
  removes the client-supplied `cas_add`
  path this issue exists to validate; supersedes it
- [66j-cas-periodic-stage-recovery](66j-cas-periodic-stage-recovery.md) — any
  staging-path normalization it
  needs is over server-derived paths, not client input
