## 66J-cas-add-directory. `cas add` on a directory stores blobs + a JSON manifest

**Priority:** P4
**Status:** open

### Problem

`cas add <path>` only handles a single file. Storing a directory means invoking
it once per file by hand, and nothing records which files made up the
directory — the store ends up with loose blobs and no way to name "this whole
tree" by a single hash.

This was once proposed as a batch MCP `cas_upload_dir` tool, then as a separate
`cas add-dir` CLI command. Neither is needed:

- Per `remove-local-file-urls-mcp` (implemented, todo file deleted) the MCP
  server no longer opens local paths at all, so directory ingestion is a
  **CLI** concern — the CLI is run directly by the user, bounded by their own
  filesystem permissions; there is no sandboxed-caller trust boundary to
  defend.
- A separate command is redundant: `cas add <path>` can simply **detect** whether
  `<path>` is a file or a directory (`stat`) and act accordingly. One command,
  one mental model — same as `cp -r`-style tools that branch on the argument
  kind rather than making the user pick the right verb.

### Proposal

Follow the [blockset](https://github.com/datablockset/blockset) design: a
directory is stored as its files' blobs plus one JSON **manifest** blob mapping
relative paths to hashes.

`cas add <path>`:

1. If `<path>` is a **file** — exactly today's behavior: stream it into the
   store, print its hash.
2. If `<path>` is a **directory** — walk it recursively; store every file as an
   ordinary blob via the same streaming pipeline (`casAddFile`, no size limit);
   then build a JSON object with one property per file, `"<relative/path>":
   "<cBase32 hash>"`, store that JSON as a blob itself, and print **its** hash.
   That one hash now names the whole tree.

```sh
cas add ./export
# → prints the manifest hash

# manifest content (itself a stored blob):
# { "a.txt": "…hash…", "img/logo.png": "…hash…" }
```

Notes for the implementer:

- **Deterministic manifest bytes.** The same tree must always produce the same
  manifest hash: sort properties by path (byte order), fixed JSON serialization
  (no extra whitespace), paths POSIX-separated (`/`) and relative to the added
  directory. Otherwise identical directories dedup to different hashes and the
  content-addressing promise breaks.
- **The manifest is an ordinary blob.** No new store object kind, no special
  metadata — `cas get <manifest-hash>` returns the JSON like any other blob, and
  a future `cas get` on a directory manifest could optionally reconstruct the
  tree (out of scope here; worth its own issue when needed).
- **Nested directories** appear only as `/`-joined paths in the manifest keys —
  a flat map, not nested manifest objects (blockset's model). Empty
  directories therefore aren't representable; that matches content-addressing
  semantics (a directory *is* its files) and should just be documented.
- **Symlinked entries**: decide whether the walk follows or skips symlinks
  (files and directories) and document it. The CLI trust model permits
  following (the invoking user chose the tree), but a cycle guard is needed if
  directory symlinks are followed; skipping them is the simpler safe default.
- **Partial failure**: if any file fails to store, fail the whole `add` without
  printing a manifest hash — a manifest referencing blobs that never landed
  would be a lie. Already-stored blobs are harmless (content-addressed, inert).

### Tasks

- [ ] In the CLI `add` handler, `stat` the argument and branch: file → current
      path; directory → manifest flow
- [ ] Walk the directory recursively (`readdir`), storing each file via
      `casAddFile`
- [ ] Build the manifest: sorted keys, relative POSIX paths, fixed JSON
      serialization; store it as a blob; print its hash
- [ ] Decide and document symlinked-entry handling (skip vs. follow + cycle
      guard)
- [ ] Fail the whole command (no manifest printed) if any file fails to store
- [ ] Proof tests: single file unchanged; flat directory; nested directory
      (manifest keys are `/`-joined); determinism (same tree twice → same
      manifest hash); empty directory; a failing file aborts without a manifest
- [ ] Document the directory format (manifest JSON, determinism rules) in
      `fs/cas/README.md`

### Related

- `remove-local-file-urls-mcp` (implemented, todo file deleted) — removed MCP
  local-path upload, making filesystem ingestion (including directories) a
  CLI-only concern
- `casAddFile` / `fileCas.write` (`fs/cas/module.f.ts`) — the streaming pipeline
  every stored file rides on (formerly tracked as `66j-cas-large-file-support`,
  now implemented and deleted)
- [blockset](https://github.com/datablockset/blockset) — prior art for the
  directory-as-JSON-manifest model
