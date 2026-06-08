# Replace npm-check-updates with an Internal Script

**Priority:** P3
**Status:** open

The `update` script currently uses `npx npm-check-updates -u` to bump dependency versions. Replace it with an internal FunctionalScript script so there is no runtime dependency on an external tool.

## Plan

- [ ] Implement a script (e.g. `fs/dev/update/module.f.ts`) that reads `package.json`, fetches the latest versions of each `devDependency` from the npm registry, and writes the updated versions back.
- [ ] Wire it into `fjs` as a subcommand (e.g. `fjs update-deps`) or run directly via `node ./fs/fjs/module.ts r ./fs/dev/update/module.f.ts`.
- [ ] Replace `npx npm-check-updates -u` in the `update` script with the new command.
