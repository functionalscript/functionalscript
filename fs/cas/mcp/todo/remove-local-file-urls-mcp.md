# Remove local file URLs (type:'url') from the MCP server

**Priority:** P2
**Status:** open

### Problem

The MCP `cas_add` `type:'url'` branch takes a filesystem path from the (untrusted) MCP client and has the **server process** open it. The path is validated only as a string: it must start with `${home}/cas_upload/` and not contain `..`. If `~/cas_upload` is writable by the agent/user — the whole point of the feature is that they stage files there — they can plant a symlink and escape the sandbox:

```
/home/user/cas_upload/passwd-link -> /etc/passwd
```

`readBytes` follows the symlink and reads `/etc/passwd`, despite the path passing the prefix check.

**Threat model**: the attacker can create/replace entries inside `cas_upload` (that's the feature), and the MCP server opens paths there on their behalf.

Additionally, the CAS CLI does not need to guard against these symlink risks. When the CLI `add` command is run, it has the exact same filesystem access permissions as the user invoking it. It does not rely on a restricted `cas_upload` directory or act as a privileged intermediary opening files on behalf of an untrusted client, meaning symlink dereferencing is ordinary user behavior and not a security boundary violation.

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

#### The invariant this restores

State the boundary positively, as the rule every current and future MCP tool must satisfy:

> **The MCP server only ever touches paths under `~/.cas/`, and every such path is one the server derives itself — never a path supplied (in whole or in part) by the client.**

Concretely, after the removal every server file operation is on a self-derived path: `cas_add` writes via staging under `~/.cas/_stage/` then renames to the hash-sharded `~/.cas/<shard>`; `cas_get` reads `~/.cas/<shard>`; `cas_list` walks `~/.cas/`. The client contributes *content* (`text`/`base64` bytes) and *hashes* (which are validated cBase32 and only ever select a shard path, never escape the store), but never a filesystem path. `type:'url'` was the sole exception — it took a client-supplied path and opened it *outside* `~/.cas/` (in `~/cas_upload/`) — which is exactly why it was the whole vulnerability surface.

This invariant is the acceptance test for anything added later: a new tool is safe on this axis iff it doesn't open, read, write, or `rename` a path derived from client input. The future remote-URL fetch (below) satisfies it — it downloads *into* `~/.cas/_stage/`, a server-derived path, and the client-supplied part is a URL handed to the network stack, not the filesystem.

#### Future: remote-URL upload

If MCP clients later need to store large blobs without CLI access, add a `type` that fetches a **remote** `http(s)://…` URL server-side. That has no local-path/symlink surface by construction — the server pulls bytes over the network, never opens a local file by a caller-supplied name — so it doesn't reintroduce this issue. Out of scope here; noted so the removal isn't read as "large-file MCP upload is impossible forever."

#### Trade-offs

- **MCP-only clients temporarily lose >128 KiB storage.** Inline `text`/`base64` caps at one `Vec` (128 KiB); `type:'url'` was the only MCP route past that. Until remote-URL lands, an MCP-only workflow with no CLI access can't store a larger blob. This is judged acceptable because the clients that used `type:'url'` are exactly the file-writing agents that *do* have CLI access (they had to write into `cas_upload` somehow).
- **Large-file / streaming-upload work becomes CLI-only.** The move-hash-move pipeline (`casUpload`, streaming `readBytes`) stays — the CLI still needs it — it just no longer has an MCP caller. See knock-on scope below.

### Knock-on scope (other issues to reconcile)

- **[66k-cas-cli-mcp-shared-upload](file:///c:/Users/serge/fs/fs/cas/todo/66k-cas-cli-mcp-shared-upload.md)** directly proposes the *opposite*: unify CLI+MCP upload and add a `cas_upload` MCP tool. Its MCP half is mooted by this removal — update or close it so the two don't contradict. The CLI-side extraction it describes may still be worthwhile on its own.
- **[66k-cas-cli-mcp-shared-core](file:///c:/Users/serge/fs/fs/cas/todo/66k-cas-cli-mcp-shared-core.md)** proposes a shared `add` with a `url` file-path source for *both* transports (MCP restricted to `~/cas_upload/`). Its shared inline/hash/store plumbing is still wanted, but the file-path source must be scoped **CLI-only** or it reintroduces exactly the surface this issue removes.
- **[66j-cas-add-directory](file:///c:/Users/serge/fs/fs/cas/todo/66j-cas-add-directory.md)** (originally a batch `cas_upload_dir` MCP tool) assumed an MCP upload path exists — now reframed as CLI-only: `cas add` detects a directory and stores blobs + a JSON manifest, blockset-style.
- **[66k-cas-upload-reject-symlinks](file:///c:/Users/serge/fs/fs/cas/todo/66k-cas-upload-reject-symlinks.md)** is now irrelevant because the MCP server no longer opens client-supplied paths and the CLI does not need it (so it has been deleted).
- **[66j-cas-large-file-support](file:///c:/Users/serge/fs/fs/cas/todo/66j-cas-large-file-support.md)** (WIP) describes the streaming staged-move pipeline as applying to `cas upload` *or* `cas_add` with restricted paths — the latter would reintroduce the MCP local-path surface. Scope it CLI-only.
- **[66j-normalize-home-paths](file:///c:/Users/serge/fs/fs/cas/todo/66j-normalize-home-paths.md)** exists solely to harden the MCP `cas_add` client-path check — fully superseded (no client path remains). Mark `irrelevant`.
- `fs/cas/mcp/README.md` documents `type:'url'` extensively — must be updated.

### Tasks

- [ ] Drop `'url'` from `casAddArgs.type` in `fs/cas/mcp/module.f.ts` (leaves `or('text', 'base64', undefined)`)
- [ ] Remove the `type === 'url'` branch from the `cas_add` handler, plus now-unused imports/plumbing it pulled in (`casAddFile`, `rm`, the `Rm` op in the tool's effect type, `casUploadDir`)
- [ ] Update the `cas_add` tool description string (drop the "use type:url for large content" guidance; point large-content users at the CLI instead)
- [ ] Update the oversized/malformed-inline runtime error message (`fs/cas/mcp/module.f.ts` — currently `'too large or malformed — use type:"url" for large content'`, ~line 187): it still tells the user to use the removed mode. Point at the CLI instead. The `addBase64OverLimitIsError` / `addTextOverLimitIsError` / `addBase64AtLimitIsError` proofs assert on the `'too large or malformed'` substring (which survives), but update them to also match the new CLI guidance so the message doesn't silently drift back.
- [ ] In `fs/cas/mcp/proof.f.ts`, remove the **upload-specific** `type:'url'` tests (`addUrl*`, `addBigFileRoundtrip`, the path-rejection cases), but **do not delete the large-blob `cas_get` coverage** — `getMetaLargeMultiChunk*`, the `content:true` >128 KiB overflow error, and cross-chunk UTF-8 detection all exercise *retained* read behavior and currently just happen to seed the store via `type:'url'`. **Rewrite** those to seed a >128 KiB blob through the store directly (`c.write`/`casAddFile` on a virtual multi-chunk file, or a pre-populated shard) instead of the removed upload path, so large-blob read regressions still get caught. Keep the `text`/`base64` coverage.
- [ ] Update `fs/cas/mcp/README.md`: remove the `type:'url'` row/section, state large files go through the CLI, note remote-URL as a possible future addition, and record the **"server only touches self-derived paths under `~/.cas/`"** invariant (see "The invariant this restores") as a stated design rule, so a future tool that reintroduces a client-supplied path is caught in review
- [x] Reconcile the other upload-touching todos with this removal: [66k-cas-cli-mcp-shared-upload](file:///c:/Users/serge/fs/fs/cas/todo/66k-cas-cli-mcp-shared-upload.md) (marked `irrelevant` — superseded; delete when the removal lands), [66j-cas-add-directory](file:///c:/Users/serge/fs/fs/cas/todo/66j-cas-add-directory.md) (reframed: `cas add` detects a directory, no separate command), [66k-cas-cli-mcp-shared-core](file:///c:/Users/serge/fs/fs/cas/todo/66k-cas-cli-mcp-shared-core.md) (its shared `add` file-path source scoped CLI-only, not MCP), [66j-cas-large-file-support](file:///c:/Users/serge/fs/fs/cas/todo/66j-cas-large-file-support.md) (streaming staged-move pipeline scoped CLI-only, no `cas_add`-with-restricted-paths entry point), and [66j-normalize-home-paths](file:///c:/Users/serge/fs/fs/cas/todo/66j-normalize-home-paths.md) (marked `irrelevant` — its whole purpose was validating the removed client `cas_add` path)

### Related

- [66j-cas-symlink-escape](file:///c:/Users/serge/fs/fs/cas/todo/66j-cas-symlink-escape.md) — symlink escape vulnerability details
- [66k-cas-cli-mcp-shared-upload](file:///c:/Users/serge/fs/fs/cas/todo/66k-cas-cli-mcp-shared-upload.md) — proposed the opposite (unify + add `cas_upload` MCP tool); MCP half now moot
- [66k-cas-cli-mcp-shared-core](file:///c:/Users/serge/fs/fs/cas/todo/66k-cas-cli-mcp-shared-core.md) — shared CLI/MCP core; its file-path `add` source scoped CLI-only by this removal
- [66j-cas-add-directory](file:///c:/Users/serge/fs/fs/cas/todo/66j-cas-add-directory.md) — directory ingestion via `cas add` (CLI-only, blockset-style manifest)
- [66j-cas-large-file-support](file:///c:/Users/serge/fs/fs/cas/todo/66j-cas-large-file-support.md) — streaming staged-move pipeline; scoped CLI-only by this removal
- [66j-normalize-home-paths](file:///c:/Users/serge/fs/fs/cas/todo/66j-normalize-home-paths.md) — was about hardening the MCP `cas_add` path check; marked `irrelevant` (no client path to validate once `type:'url'` is gone)
