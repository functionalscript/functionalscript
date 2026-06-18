# 66J-normalize-home-paths. Normalize `~/` to absolute paths and validate directory containment

**Priority:** P3
**Status:** open

## Problem

The current path validation in `cas_add` rejects paths with `..`, which blocks common directory escape attempts. However, this is a string-based check that doesn't account for:
- Symlinks that point outside the directory
- Case-insensitive filesystems where directory boundaries are ambiguous
- Relative paths like `./subdir/../../../etc/passwd` that contain `..` in a less obvious way
- Future edge cases with canonical path resolution

**Better approach**: Normalize the path (expand `~`, resolve `..` and `.`, handle symlinks) into a canonical absolute path, then verify containment using filesystem semantics rather than string matching.

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
