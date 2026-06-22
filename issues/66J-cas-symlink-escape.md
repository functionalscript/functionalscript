# 66J-cas-symlink-escape. Close symlink escape in `cas_add` path validation

**Priority:** P2
**Status:** open

## Problem

The `cas_add` path validation checks if a path starts with `${home}/cas_upload/` and doesn't contain `..`. However, if `~/cas_upload` is writable by the agent or user, they can place a symlink within it to escape the sandbox:

```
/home/user/cas_upload/passwd-link -> /etc/passwd
```

When `readFile` is called on this path, Node.js follows the symlink and reads `/etc/passwd`, despite the path passing the prefix check.

**Threat model**: This requires the attacker to already have write access to `~/cas_upload`. If they do, they have significant system access already. This is different from the arbitrary-read vulnerability (P1), which requires no pre-existing access.

## Proposal

Validate the **canonical real path** (resolving symlinks, `..`, and `.`) before reading:

1. **Resolve the path** to its canonical absolute form using `realpath()` or equivalent
2. **Verify** that the canonical path is still within the approved directory
3. **Then** call `readFile()`

This ensures that symlinks and other filesystem tricks cannot escape the sandbox.

## Tasks

- [ ] Add `realpath` effect to `fs/effects/node/module.f.ts` (or `canonicalizePath`)
- [ ] Update `cas_add` validation to resolve the canonical path
- [ ] Add tests for symlink-escape attempts (e.g., `/home/user/cas_upload/link -> /etc/passwd`)
- [ ] Verify the canonical path is within the approved directory after resolution
- [ ] Update `fs/cas/mcp/README.md` to document the symlink handling

## Related

- [i66J-normalize-home-paths](./66J-normalize-home-paths.md) — defense-in-depth path normalization (will subsume this issue)
