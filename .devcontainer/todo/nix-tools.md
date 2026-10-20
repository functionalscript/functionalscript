## Install Nix tools in the devcontainer

**Priority:** P2
**Status:** wip

### Problem

The devcontainer enters the Nix development shell only for integrated terminals.
VS Code extensions and other container processes cannot find that shell's tools.

### Proposal

Expose an installable `devTools` package from the same pinned tool definitions as
the development shell. Copy the generated flake and lock into the image and let
the existing Nix feature install the package into its global profile. Preserve
the native compiler and the x86 Linux 32-bit linker outside the shell.

### Tasks

- [ ] Generate the installable tool package and cover its platform-specific additions.
- [ ] Install it during the devcontainer build and document rebuild behavior.
- [ ] Check tool discovery and native/32-bit linking without entering `dev.sh`.

### Related

- [Nix environments](../../fjs/ci/nix/README.md) — shared pinned tool definitions.
