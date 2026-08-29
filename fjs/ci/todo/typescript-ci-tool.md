## Move TypeScript from npm devDependencies to the CI toolchain

**Status:** open

### Problem

TypeScript is currently installed through the root `package.json` `devDependencies`, so every `npm ci` installs it even in CI jobs that do not run `tsc`.

TypeScript is a development/CI tool rather than a runtime package dependency. CI already has infrastructure for pinning and provisioning tool versions, so TypeScript should be owned there instead of by npm package metadata.

This task is intentionally limited to TypeScript. Keep `@types/node` in `devDependencies`.

### Goal

Provision a pinned TypeScript version through the CI/Nix tool environment and remove `typescript` from the root `package.json` `devDependencies`.

Only jobs that actually run TypeScript need the tool. In particular, do not install TypeScript merely because a job runs `npm ci`.

Developers using the Nix environment should get the pinned TypeScript automatically. Developer documentation must also explain that non-Nix development requires TypeScript to be installed globally so `tsc` is available on `PATH`.

### Tasks

- [ ] Add a pinned TypeScript version to the CI tool configuration.
- [ ] Make the canonical type-checking job provide that TypeScript version through its CI/Nix environment.
- [ ] Run `tsc` from `PATH` instead of relying on `npx tsc` / `node_modules/.bin/tsc`.
- [ ] Remove `typescript` from the root `package.json` `devDependencies` and update `package-lock.json`.
- [ ] Keep `@types/node` as a devDependency.
- [ ] Update developer documentation: Nix provides the pinned TypeScript; without Nix, install TypeScript globally and ensure `tsc` is on `PATH`.
- [ ] Verify jobs that do not run `tsc` no longer install TypeScript unnecessarily.
- [ ] Verify `npm test`, `npm pack`, and other scripts that invoke `tsc` run only in environments where the CI/development toolchain provides it.
