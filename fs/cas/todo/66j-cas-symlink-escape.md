## 66J-cas-symlink-escape. Close symlink escape in `cas_add` path validation

**Priority:** P2
**Status:** open

### Problem

The `cas_add` path validation checks if a path starts with `${home}/cas_upload/` and doesn't contain `..`. However, if `~/cas_upload` is writable by the agent or user, they can place a symlink within it to escape the sandbox:

```
/home/user/cas_upload/passwd-link -> /etc/passwd
```

When `readBytes` is called on this path, Node.js follows the symlink and reads `/etc/passwd`, despite the path passing the prefix check.

**Threat model**: This requires the attacker to already have write access to `~/cas_upload`. If they do, they have significant system access already. This is different from the arbitrary-read vulnerability (P1), which requires no pre-existing access.

### Why a single check isn't enough

Two narrower fixes were considered and rejected on their own:

- **Reject if the uploaded file itself is a symlink** (`lstat`/`O_NOFOLLOW` on the final path component only). This misses a **directory** symlink earlier in the path:

  ```sh
  ln -s /etc ~/cas_upload/x
  # cas_add { content: "$HOME/cas_upload/x/passwd", type: "url" }
  ```

  The string prefix/`..` check passes. `x` is a symlink but is *not* the trailing path component, so `O_NOFOLLOW` (which per POSIX `open(2)` only blocks the final component from being a symlink) does not fire — the kernel still follows `x` while resolving the rest of the path. `passwd` at the resolved location is a genuine regular file, so the open succeeds and `/etc/passwd`'s contents are read and stored, despite `O_NOFOLLOW` being in place.

- **`realpath`-based containment check alone** (resolve the full path, verify it's still under `cas_upload`, *then* read the original/resolved path with a plain, symlink-following open). This closes the directory-symlink case above, but leaves a TOCTOU window: `cas_upload` may be writable by the same caller this validates against, so a symlink can be swapped into the now-validated path between the `realpath` check and the read. Streaming reads a chunk at a time via repeated opens (one per chunk), so this window is real, not just theoretical, and it reopens on every chunk.

### Proposal

Combine both mechanisms — they close different gaps:

1. **`realpath`-based canonical containment**: resolve the full input path (`realpath`) *and* the canonical form of `$HOME/cas_upload` itself (also via `realpath`, in case `$HOME` or an ancestor is itself a symlink — otherwise a canonical-vs-literal comparison would reject legitimate uploads in that environment). Verify the resolved path is still under the resolved upload directory before reading. This is what defeats the directory-symlink case.
2. **`readBytes`/`readFile` always open with `O_NOFOLLOW`** — not a separate opt-in variant, the default and only behavior for these effects. This defeats the swap-after-validation race: whichever path is actually opened for the read, if its trailing component is a symlink at that moment, the open fails instead of following it. Every chunk's open re-checks this, not just the first.
3. Stream from the **resolved** path returned by step 1, not the original caller-supplied string — ties the read to exactly the path that was validated.

If a future caller genuinely needs to follow a symlink at a path it chose directly (e.g. the CLI's `cas add <path>`, run by a trusted local user — unlike `cas_add` `type:'url'`, which is driven by a sandboxed/untrusted MCP client), introduce an explicit opt-in (e.g. `readBytesFollow`) at that point rather than defaulting any read to following symlinks. Don't build that variant preemptively — YAGNI until a concrete need shows up.

### Tasks

- [ ] Add a `realpath` effect to `fs/effects/node/module.f.ts` (backed by `fs.promises.realpath` in the Node runner; the virtual test interpreter needs some way to model a symlink, since `Dir` has no symlink entity today)
- [ ] Change `readBytes` (and `readFile`, for consistency) to always open with `O_NOFOLLOW` — no follow-by-default variant
- [ ] Update `cas_add` `type:'url'` validation: resolve both `content` and `casUploadDir` via `realpath`, check containment against the resolved forms, then stream from the resolved path
- [ ] Add tests for:
  - a symlink planted directly in `cas_upload` pointing outside it (the original scenario)
  - a symlink **directory** inside `cas_upload` pointing outside it, with a non-symlink leaf (the case a leaf-only check misses)
  - a symlink that stays within `cas_upload` (should still succeed)
  - `$HOME`/`cas_upload` itself behind a symlink, with an otherwise-legitimate upload (should still succeed)
- [ ] Update `fs/cas/mcp/README.md` to document the two-part validation (canonical containment + `O_NOFOLLOW`)

### Related

- [i66J-normalize-home-paths](todo.md) — defense-in-depth path normalization (will subsume this issue)
- [i66K-cas-upload-reject-symlinks](todo.md) — narrower `lstat`-before-`rename` proposal for a different (non-streaming) upload pipeline shape; this issue's `O_NOFOLLOW`-by-default covers the same ground for the pipeline that actually exists today
