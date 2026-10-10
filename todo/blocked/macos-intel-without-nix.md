## Run Intel macOS CI without Nix

**Priority:** P3
**Status:** wip

### Trigger

When upgrading the repository's pinned Nixpkgs from 26.05 to 26.11 or a later
revision that no longer supports `x86_64-darwin`, make this migration part of
that upgrade. The task owner has approved making the migration now, before
that upgrade, to reduce Intel macOS setup time by installing only the tools
its job needs. Updating the Nix executable alone does not require it.

### Problem

[Nixpkgs' release notes](https://nixos.org/manual/nixpkgs/stable/release-notes)
identify 26.05 as the last release supporting Intel macOS. Starting with 26.11,
Nixpkgs drops both binary builds and support for building packages from source
on that platform. Our flakes must stop declaring an unsupported system when
we adopt that package collection, but FunctionalScript's Intel macOS CI must
continue running.

### Proposal

Remove Intel macOS support from the flake definitions, not from CI. Keep the
`macos-intel` job and install its tools directly, following the existing
Windows CI approach. Reuse the centralized version pins and install the tools
that job actually needs. Preserve its existing checks against the working
checkout; adopting Windows' installation approach does not mean copying its
test commands. Other supported platforms continue to use Nix.

### Tasks

- [ ] Update the CI generators to remove `x86_64-darwin` from every generated
  flake and remove Intel-macOS-only Nix configuration that becomes unused.
- [ ] Keep the Intel macOS runner and job, replace Nix setup and shell wrappers
  with direct tool installation using the shared version pins, and retain its
  Node/npm and Rust checks as individually reported CI steps.
- [ ] Update generator proofs, the version-update/cache-check procedure, and
  contributor/agent documentation for Intel macOS as a non-Nix CI platform.
- [ ] Regenerate the flakes and workflows. Verify that no flake declares
  `x86_64-darwin`, that `macos-intel` runs without Nix, and that its checks and
  the remaining Nix jobs pass before completing the pin upgrade.

### Related

- [CI generator](../../fjs/ci/module.f.mjs) — platform jobs and the existing
  Windows direct-installation approach.
- [Shared shell generator](../../fjs/ci/dev/module.f.mjs) — flake platforms.
- [Version pins](../../fjs/ci/config/module.f.js) — Nixpkgs and tool versions.
- [Version-update procedure](../../fjs/ci/update-versions.md) — cache coverage
  checks that must follow the supported flake platforms.
