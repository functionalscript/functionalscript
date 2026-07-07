## 66K-cas-cli-mcp-shared-upload. CLI and MCP should share `cas_add`/`cas upload` logic

**Priority:** P3
**Status:** irrelevant

### Why this is superseded

This issue existed because *two* transports uploaded a file from the filesystem
via divergent implementations that would each need every future fix:

| Path | Implementation |
|------|---------------|
| `cas add <name>` (CLI) | streaming `casAddFile` / move-hash-move — no size limit |
| `cas_add { type:'url' }` (MCP) | `readFile` — capped at 128 KiB, and the source of the symlink-escape hole |

[remove-local-file-urls-mcp](../mcp/todo/remove-local-file-urls-mcp.md) removes
`cas_add type:'url'` from the MCP server entirely (the server no longer opens
caller-named local paths; large
blobs go through the CLI, and a future remote-`http(s)` fetch has no local-path
surface). With the MCP upload path gone, there is **no second implementation to
converge** — the CLI is the sole filesystem-upload surface. The cross-transport
duplication this issue was created to eliminate no longer exists.

Keeping the file (rather than deleting it now) only because the removal in
remove-local-file-urls-mcp is not yet implemented; **delete this file in the same
change that lands that removal.** If, once MCP `type:'url'` is gone, some
CLI-*internal* duplication turns out to be worth extracting (e.g. between
`cas add`'s streaming path and the `casUpload` move-hash-move helper), file that
as a new, narrower CLI-only issue rather than reviving this cross-transport one.

### Related

- [remove-local-file-urls-mcp](../mcp/todo/remove-local-file-urls-mcp.md) —
  removes the MCP upload path that this issue assumed; supersedes it
- `66k-cas-upload-reject-symlinks` — deleted: symlink rejection was only ever
  needed for the MCP path, and the CLI following a symlink the invoking user
  chose is ordinary `cat`/`cp` behavior, not a boundary violation
