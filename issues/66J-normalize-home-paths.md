# 66J-normalize-home-paths. Normalize `~/` to absolute paths and validate directory containment

**Priority:** P1
**Status:** open

## Problem

The current path validation in `cas_add` (line 109 in `fs/cas/mcp/module.f.ts`) checks if a path *starts with* the string `~/cas_upload/`:

```ts
if (!content.startsWith('~/cas_upload/')) {
    x = pure(`cas_add type:url paths must be within ~/cas_upload/ — got: ${content}`)
}
```

This is vulnerable to path traversal attacks:
- `~/cas_upload/../../etc/passwd` passes the prefix check but accesses files outside the directory
- `~/cas_upload/../secret.txt` similarly escapes the sandbox

**Proper fix**: Normalize the path (expand `~`, resolve `..` and `.`, remove symlinks) into an absolute path, then check if it lies within the approved directory.

## Proposal

1. **Add a Node effect** (e.g., `normalizePath`) that:
   - Expands `~` to the home directory (using `os.homedir()`)
   - Resolves relative components (`..`, `.`)
   - Returns the canonical absolute path

2. **Update `cas_add` path validation** to:
   - Normalize the input path
   - Compute the canonical approved directory path (e.g., `${HOME}/cas_upload`)
   - Check that the normalized path starts with the approved directory (with proper directory boundary checking, not just string prefix)
   - Reject if outside the directory

3. **Handle errors gracefully**:
   - If path normalization fails (e.g., EACCES), return an error
   - If the normalized path escapes the sandbox, return a clear security error

## Tasks

- [ ] Define `normalizePath` effect in `fs/effects/node/module.f.ts` or similar
- [ ] Implement path normalization: expand `~`, resolve `..`, get canonical path
- [ ] Update `cas_add` to use normalized paths with proper directory boundary check
- [ ] Add test cases for path traversal attacks: `~/cas_upload/..`, `~/cas_upload/../etc/passwd`, etc.
- [ ] Ensure the check is robust: compare normalized paths, not string prefixes

## Related

- [i66J-cas-add-path-restriction](./66J-cas-add-path-restriction.md) — current simple path validation (will be enhanced by this issue)
- [i66J-cas-periodic-stage-recovery](./66J-cas-periodic-stage-recovery.md) — will also need path normalization for staging directory
