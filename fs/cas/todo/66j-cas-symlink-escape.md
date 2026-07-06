## 66J-cas-symlink-escape. Close symlink escape in `cas_add` path validation

**Priority:** P2
**Status:** open

### Problem

The `cas_add` `type:'url'` path validation checks if a path starts with `${home}/cas_upload/` and doesn't contain `..`. However, if `~/cas_upload` is writable by the agent or user, they can place a symlink within it to escape the sandbox:

```
/home/user/cas_upload/passwd-link -> /etc/passwd
```

When `readBytes` is called on this path, Node.js follows the symlink and reads `/etc/passwd`, despite the path passing the prefix check.

**Threat model**: this requires the attacker to already have write access to `~/cas_upload`. A more precise version of that premise turns out to matter a lot for the fix (see below): assume the attacker can create/replace **files** directly inside `cas_upload`, but does **not** control the `cas_upload` directory entry itself (that would require write access to `$HOME`, a strictly larger foothold — see "Out of scope").

### Design history: two fixes that looked sufficient and weren't

Getting to the final proposal took three iterations, each closing a gap the last one missed. Recorded here so a future implementer doesn't re-walk the same path.

**Attempt 1 — reject a symlinked leaf, allow nested directories.** Check the uploaded file itself (`lstat`, or open with `O_NOFOLLOW`) and reject if it's a symlink; otherwise allow any path under `cas_upload`, including subdirectories. This misses a symlinked **directory** earlier in the path:

```sh
ln -s /etc ~/cas_upload/x
# cas_add { content: "$HOME/cas_upload/x/passwd", type: "url" }
```

The string prefix/`..` check passes. `x` is a symlink but is *not* the trailing path component, and per POSIX `open(2)`, `O_NOFOLLOW` only blocks the *final* component from being a symlink — every earlier component is still resolved normally. The kernel follows `x` into `/etc` while resolving the rest of the path; `passwd` at that location is a genuine regular file, so the open succeeds and `/etc/passwd`'s contents are read and stored.

**Attempt 2 — `realpath`-based canonical containment, then a normal read.** Resolve the full input path with `realpath`, verify the resolved form is still under `cas_upload`, then stream from the resolved path. This closes the directory-symlink case above (`realpath` walks every component, not just the last one). But it opens a new gap: streaming reads the file a chunk at a time, and each chunk does its own fresh `open()` by path. Between the `realpath` check and any given chunk's open — and `cas_upload` is, by assumption, writable by the same caller this validates against — the file at the validated path can be replaced. A plain open re-resolves the path from scratch and follows whatever is there *now*, symlink or not. Making the read use `O_NOFOLLOW` looked like the fix for exactly this (reject if the thing being opened right now is a symlink) — but:

**Attempt 3 — `realpath` containment + `O_NOFOLLOW` on the read.** Same as attempt 2, except every chunk's open uses `O_NOFOLLOW`. This closes the case where the attacker swaps the *validated file itself* for a symlink. It does **not** close the case where the attacker swaps an *intermediate directory* in the validated path (the same `x` from attempt 1's example) between the `realpath` check and the read: `O_NOFOLLOW` never inspects `x`, because `x` is never the trailing component of the open — only `passwd` is, and `passwd` at the swapped location is (again) a genuine regular file. So `O_NOFOLLOW`, however it's wired in, only ever defends the trailing component; a validated path with more than one segment under `cas_upload` always leaves an un-defended earlier segment open to a race, no matter how the read is opened.

The general, fully airtight fix for that class of race — pin each directory component to an already-open, symlink-checked file descriptor as you walk down (`openat()` + `O_NOFOLLOW` per component, or Linux's `openat2()` with `RESOLVE_NO_SYMLINKS`) — isn't reachable from Node.js (or Bun/Deno) without a native addon or raw syscalls, which is out of step with this project's portable-pure-TS runtime story.

### Proposal

Instead of policing an arbitrarily nested tree, remove the nesting: **`cas_upload` may only contain files directly — no subdirectories.**

1. Reject any `cas_add` `type:'url'` path whose remainder after `${casUploadDir}/` contains another `/`. A validated path is therefore always exactly `${casUploadDir}/<name>`, one segment, no exceptions.
2. Make `O_NOFOLLOW` the **default** (only) behavior of `readBytes` (and `readFile`, for consistency) — not a parallel opt-in effect.

Why this closes the whole class, not just the cases found so far: with nesting banned, `<name>` is the *only* thing an attacker can ever turn into a symlink, and it is always the trailing component of the single `open()` call that reads it. `O_NOFOLLOW` rejecting a symlink at the trailing component is a guarantee the kernel makes atomically as part of that one syscall — there is no separate "check, then read" step to race, because the trailing-component-is-a-symlink test *is* the open. No `realpath` call is needed for the security property at all; the fix is two cheap checks (a string check, plus a flag on `open`), not a filesystem walk.

### Trade-offs / out of scope

- **Removes existing behavior**: uploading from a subdirectory of `cas_upload` is currently supported (see `addUrlFromSubdirectorySucceeds` in `fs/cas/mcp/proof.f.ts`). Callers will need to write directly into `cas_upload` with a single-segment name. This is a deliberate trade for a design that's provably race-free instead of one more patch that might still have a gap.
- **`cas_upload` itself being a symlink is out of scope, and the design below does *not* fail closed for it.** `cas_upload` is the second-to-last component of `${casUploadDir}/<name>` — never the trailing one — so `O_NOFOLLOW` on the read never inspects it, and there is no `realpath`/containment check on `casUploadDir` in this design. If `$HOME/cas_upload` is a symlink (e.g. to `/etc`), the kernel follows it transparently while resolving `${casUploadDir}/<name>`, and `cas_add` reads and stores whatever `<name>` resolves to on the other side. This is a deliberate omission, not an oversight the implementation should silently paper over — implementers should keep this line in and not add a false sense of containment by half-checking it.

  It's left this way because closing it buys nothing: replacing the `cas_upload` *entry* itself (as opposed to writing files inside it) requires write access to `$HOME`, a strictly larger foothold than the stated threat model. An attacker who already has that access doesn't need the symlink trick at all — they can simply copy any file they can read (`/etc/passwd`, `~/.ssh/id_rsa`, ...) directly into `cas_upload` as a regular file and upload it through the normal, fully-permitted path. The symlink indirection adds no capability a straightforward `cp` doesn't already give them, so defending against it here wouldn't reduce their reach. (This is distinct from `$HOME`/`cas_upload` merely *being* a symlink for unrelated legitimate reasons — e.g. a chroot/NixOS profile — which is a compatibility question, not an escape; not handling it just means those uploads are read through the symlink rather than rejected, matching normal filesystem behavior everywhere else in the codebase.)

### Tasks

- [ ] Reject any `cas_add` `type:'url'` path whose remainder after `${casUploadDir}/` contains a `/` (no nested paths)
- [ ] Change `readBytes` (and `readFile`, for consistency) to always open with `O_NOFOLLOW` — no follow-by-default variant, no parallel opt-in effect
- [ ] Remove the subdirectory-upload support this supersedes, and update/replace its proof test (`addUrlFromSubdirectorySucceeds` in `fs/cas/mcp/proof.f.ts`) with a nested-path-is-rejected test
- [ ] Add tests for:
  - a symlink placed directly in `cas_upload` (the original scenario) — rejected
  - a nested path (`cas_upload/sub/file`) — rejected outright by the flat-namespace check, whether or not `sub` exists or is a symlink
  - a plain file directly in `cas_upload` — still succeeds
- [ ] Update `fs/cas/mcp/README.md` to document the flat-namespace restriction and the `O_NOFOLLOW` default
- [ ] If a future caller genuinely needs to follow a symlink at a path it chose directly (e.g. the CLI's `cas add <path>`, run by a trusted local user — unlike `cas_add` `type:'url'`, which is driven by a sandboxed/untrusted MCP client), introduce an explicit opt-in (e.g. `readBytesFollow`) at that point. Don't build it preemptively — YAGNI until a concrete need shows up.

### Related

- [i66J-normalize-home-paths](todo.md) — defense-in-depth path normalization (will subsume this issue)
- [i66K-cas-upload-reject-symlinks](todo.md) — narrower `lstat`-before-`rename` proposal for a different (non-streaming) upload pipeline shape; this issue's flat-namespace + `O_NOFOLLOW`-by-default covers the same ground for the pipeline that actually exists today
