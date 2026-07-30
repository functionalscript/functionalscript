## Replace npm-check-updates with an Internal Script

**Priority:** P3
**Status:** open

### Goal

Replace `npm-check-updates` with maintained FunctionalScript code and establish one
authoritative committed source for CI configuration.

### Required outcome

The chosen source must be shared by:

- dependency updating;
- native Windows setup;
- workflow generation;
- Nix snapshot updating;
- generated Nix environments.

Do not keep the same writable versions or job definitions in multiple files.

### Storage decision

The exact representation and location are intentionally undecided. A TypeScript
module, `ci-lock.json`, or another simple committed format may be used.

Choose the representation during implementation based on the smallest design that:

- is easy to review and update;
- works on native Windows without Nix;
- can be consumed deterministically by all generators;
- stores exact versions and the accepted Nixpkgs reference/commit;
- supports repository-specific CI configuration where needed.

After choosing it, migrate existing hardcoded CI values to that single source.

### Updater responsibilities

At a high level, the maintained updater should:

1. update ordinary dependencies such as TypeScript and `@types/node`;
2. update CI-managed versions through their appropriate authoritative sources;
3. coordinate coupled versions such as Playwright and its browser bundle;
4. regenerate every affected tracked dependency lockfile;
5. invoke ordinary CI generation from the committed shared source.

The Nix-specific update command may resolve a moving Nixpkgs reference, validate the
currently declared Nix jobs, and write the accepted commit and synchronized versions
to the same source.

Detailed registry clients, schema fields, rollback behavior, and command names should
be decided while implementing the smallest working version.

### Tasks

- [ ] Choose one authoritative CI configuration representation and location.
- [ ] Document its minimal schema.
- [ ] Migrate existing CI versions and job configuration to it.
- [ ] Make native, workflow, and Nix generators consume it.
- [ ] Implement maintained dependency updating without `npm-check-updates`.
- [ ] Preserve updates for ordinary dependencies outside CI configuration.
- [ ] Coordinate dependencies that must match CI tool versions.
- [ ] Regenerate all affected tracked lockfiles.
- [ ] Remove obsolete duplicate configuration after migration.