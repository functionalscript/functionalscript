## 138. Implement a script that will update the lock file.

**Priority:** P3
**Status:** open

Implement a script that will update the lock file by reading the latest versions of tools from the internet.

### Related

This overlaps with the newer Nix-based tool-update proposals — check those first to avoid
duplicating effort:

- [65Z-ci-nix](65z-ci-nix.md) — the Nixpkgs update command (`npm run ci-nix-update`) covers
  updating pinned tool/package versions via Nix.
- [replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md)
  — a broader internal-script proposal (`ci-lock.json`) covering the same lock-file-update idea.
