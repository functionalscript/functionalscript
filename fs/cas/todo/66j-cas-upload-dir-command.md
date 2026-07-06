## 66J-cas-upload-dir-command. Add a `cas add-dir` CLI command for batch adds

**Priority:** P4
**Status:** open

### Problem

Storing many files means invoking `cas add <path>` once per file. A single
command that walks a directory and adds every file in it would be a convenience
for bulk ingestion (e.g. seeding a store from an export).

This was originally proposed as an MCP `cas_upload_dir` tool, but per
[i66J-cas-symlink-escape](todo.md) the MCP server no longer opens local paths at
all (`cas_add type:'url'` is removed). Batch-from-the-filesystem is therefore a
**CLI** concern: the CLI is run directly by the user, whose own filesystem
permissions bound what it can read — there is no sandboxed-caller trust boundary
to defend, so no symlink-containment problem.

### Proposal

Add a `cas add-dir <dir>` command that:

1. Walks `<dir>` (via `readdir`, recursively or one level — decide below) for
   files.
2. Streams each file through the same pipeline as `cas add` (`casAddFile` →
   `readBytes` chunk loop → `c.write`), so there is no size limit and no extra
   in-memory buffering.
3. Prints a summary: count of files added, total bytes, and any per-file errors
   (a failed file should not abort the whole run).

Usage:
```
cas add-dir ./export
# 42 files, 1234567 bytes, 0 errors
```

Open questions to settle when implementing:
- **Recursive or flat?** `cas add` itself follows symlinks (ordinary CLI
  `cat`-like behavior — see [i66J-cas-symlink-escape](todo.md), which keeps the
  CLI read path as-is). A recursive walk should decide whether to descend into
  symlinked directories or skip them, and whether to hash symlinked files or skip
  them, to avoid surprises / cycles.
- **Output**: print each hash as it's stored (like `cas add`), the summary only,
  or both.

### Tasks

- [ ] Add a `cas add-dir <dir>` command to `fs/cas/cli/module.f.ts`
- [ ] Walk the directory with `readdir` and add each file via `casAddFile`
- [ ] Return a structured summary (added count, total bytes, error list); don't
      abort on a single-file failure
- [ ] Decide and document recursive-vs-flat and symlinked-entry handling
- [ ] Add proof tests: empty directory, mixed file types/sizes, a missing/unreadable
      entry, and the recursion/symlink decision above
- [ ] Document the command in `fs/cas/README.md`

### Related

- [i66J-cas-symlink-escape](todo.md) — removes MCP local-path upload, making
  filesystem-batch ingestion a CLI-only concern
- [i66J-cas-large-file-support](todo.md) — the streaming pipeline `cas add`
  (and thus `cas add-dir`) rides on
