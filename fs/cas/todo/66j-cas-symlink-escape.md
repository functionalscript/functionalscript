## 66J-cas-symlink-escape. Remove the local-path upload (`cas_add type:'url'`) from the MCP server

**Priority:** P2
**Status:** open

### Problem

The MCP `cas_add` `type:'url'` branch takes a filesystem path from the (untrusted) MCP client and has the **server process** open it. The path is validated only as a string: it must start with `${home}/cas_upload/` and not contain `..`. If `~/cas_upload` is writable by the agent/user — the whole point of the feature is that they stage files there — they can plant a symlink and escape the sandbox:

```
/home/user/cas_upload/passwd-link -> /etc/passwd
```

`readBytes` follows the symlink and reads `/etc/passwd`, despite the path passing the prefix check.

**Threat model**: the attacker can create/replace entries inside `cas_upload` (that's the feature), and the MCP server opens paths there on their behalf.

### Why patching this is the wrong shape

Several rounds of hardening were tried on this branch, each closing a gap the last one missed — the full analysis is in the PR discussion (#1224); condensed here:

1. **Reject a symlinked leaf** (`lstat` / `O_NOFOLLOW` on the final component) — misses a symlinked *directory* earlier in the path (`cas_upload/x -> /etc`, then read `cas_upload/x/passwd`, whose leaf is a real file). `O_NOFOLLOW` per POSIX only ever inspects the *trailing* component.
2. **`realpath`-based canonical containment** — closes the directory case, but streaming re-opens the path per chunk, so a symlink swapped in *after* the check (into a directory writable by the same caller) is followed on the next read: a TOCTOU race.
3. **`realpath` + `O_NOFOLLOW` on every read** — still loses to an *intermediate-directory* swap, because `O_NOFOLLOW` never inspects non-trailing components.

The only fully airtight fix for the race class is per-component fd pinning (`openat()` + `O_NOFOLLOW` per segment, or Linux `openat2()` with `RESOLVE_NO_SYMLINKS`), which isn't reachable from Node/Bun/Deno without a native addon — off the table for this project. A pure-TS alternative (ban nested paths so the validated path is always one segment, making `O_NOFOLLOW` on the sole trailing component atomic) works, but needs care around `\` on Windows, still special-cases `readBytes`/`readFile` to open with `O_NOFOLLOW`, and leaves a genuinely awkward primitive in place: *the server opens a local path named by an untrusted caller.* Every one of these fixes is scaffolding around that one questionable capability.

### Proposal

**Remove `type:'url'` from the MCP `cas_add` tool entirely.** Keep `type:'text'` and `type:'base64'`. The whole vulnerability class — leaf symlinks, directory symlinks, swap races, `\`-vs-`/` separators, and the "what if the server runs with more privilege than the caller" escalation concern — becomes *unaskable* once the server never opens a caller-named local path. No flat-namespace rule, no `O_NOFOLLOW`, no `realpath`, no per-component walking.

Nothing legitimate is stranded, because the clients split cleanly:

- **Clients that can write files** (agents with shell/file tools — the *only* clients that could ever stage something in `cas_upload`): small content already goes through `type:'text'`/`base64`; large files go through the **CLI** (`cas add <path>`), a local tool the user runs directly, where following a symlink to a file the invoking user chose is ordinary `cat`/`cp` behavior, not a sandbox escape. The trust boundary is completely different there — the person running the CLI *is* the user, not a sandboxed model.
- **Clients that can't touch the filesystem**: `type:'url'` was never usable by them (they can't stage a file), so they lose nothing.

### Future: remote-URL upload

If MCP clients later need to store large blobs without CLI access, add a `type` that fetches a **remote** `http(s)://…` URL server-side. That has no local-path/symlink surface by construction — the server pulls bytes over the network, never opens a local file by a caller-supplied name — so it doesn't reintroduce this issue. Out of scope here; noted so the removal isn't read as "large-file MCP upload is impossible forever."

### Trade-offs

- **MCP-only clients temporarily lose >128 KiB storage.** Inline `text`/`base64` caps at one `Vec` (128 KiB); `type:'url'` was the only MCP route past that. Until remote-URL lands, an MCP-only workflow with no CLI access can't store a larger blob. This is judged acceptable because the clients that used `type:'url'` are exactly the file-writing agents that *do* have CLI access (they had to write into `cas_upload` somehow).
- **Large-file / streaming-upload work becomes CLI-only.** The move-hash-move pipeline (`casUpload`, streaming `readBytes`) stays — the CLI still needs it — it just no longer has an MCP caller. See knock-on scope below.

### Knock-on scope (other issues to reconcile)

- **[i66K-cas-cli-mcp-shared-upload](todo.md)** directly proposes the *opposite*: unify CLI+MCP upload and add a `cas_upload` MCP tool. Its MCP half is mooted by this removal — update or close it so the two don't contradict. The CLI-side extraction it describes may still be worthwhile on its own.
- **[i66J-cas-upload-dir-command](todo.md)** (batch `cas_upload_dir` MCP tool) assumes an MCP upload path exists — becomes moot or CLI-only.
- **[i66K-cas-upload-reject-symlinks](todo.md)** still applies to the **CLI** `cas upload` pipeline (which moves a staged file), independent of this change — keep it.
- `fs/cas/mcp/README.md` documents `type:'url'` extensively — must be updated.

### Tasks

- [ ] Drop `'url'` from `casAddArgs.type` in `fs/cas/mcp/module.f.ts` (leaves `or('text', 'base64', undefined)`)
- [ ] Remove the `type === 'url'` branch from the `cas_add` handler, plus now-unused imports/plumbing it pulled in (`casAddFile`, `rm`, the `Rm` op in the tool's effect type, `casUploadDir`)
- [ ] Update the `cas_add` tool description string (drop the "use type:url for large content" guidance; point large-content users at the CLI instead)
- [ ] Remove the `type:'url'` proof tests in `fs/cas/mcp/proof.f.ts` (`addUrl*`, `getMetaLargeMultiChunk*`, and the large-blob paths that stage via `type:'url'`); keep the `text`/`base64` coverage
- [ ] Update `fs/cas/mcp/README.md`: remove the `type:'url'` row/section, state large files go through the CLI, and note remote-URL as a possible future addition
- [x] Reconcile [i66K-cas-cli-mcp-shared-upload](todo.md) (marked `irrelevant` — superseded; delete when the removal lands) and [i66J-cas-upload-dir-command](todo.md) (reframed as a `cas add-dir` CLI command) with this removal

### Related

- [i66K-cas-cli-mcp-shared-upload](todo.md) — proposed the opposite (unify + add `cas_upload` MCP tool); MCP half now moot
- [i66J-cas-upload-dir-command](todo.md) — batch MCP upload tool; moot or CLI-only
- [i66K-cas-upload-reject-symlinks](todo.md) — still relevant to the CLI upload pipeline
- [i66J-normalize-home-paths](todo.md) — string-based path normalization; no longer needed for the MCP path once `type:'url'` is gone
