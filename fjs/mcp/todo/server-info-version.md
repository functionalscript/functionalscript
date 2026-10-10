## The MCP server reports a version copied from `package.json` long ago

**Priority:** P3
**Status:** open

### Problem

`casConfig` in [`module.f.mjs`](../module.f.mjs) advertises
`serverInfo: { name: 'functionalscript-cas', version: '0.30.0' }`.
[`package.json`](../../../package.json) is the single source of the package
version — [`fjs/ci/publish`](../../ci/publish/module.f.mjs) says so — and
at `d8a75b4` it is many releases past that. Nothing checks the two agree,
so what an MCP client is told keeps drifting from what it installed.

### Proposal

One source, and no change to the public API: `casConfig` stays a static
`McpConfig`, and `_casMcpSession` and `casMcpServer` keep their
signatures. `npm run gen` writes a generated module beside this one —
`gen.version.f.mjs`, under the `gen.` naming rule
([CONTRIBUTING.md](../../../CONTRIBUTING.md#naming-generated-files)) —
exporting the version read from `package.json`, and `casConfig` imports
it. The literal goes; the generated file is committed like every other
`gen.*` output, so a release that bumps `package.json` regenerates it and
the diff shows the version moving.

Reading `package.json` at startup and threading the version in was
considered and dropped: it would make `casConfig` a factory, or add a
parameter to the session and server, for a value that is a constant of
the build.

### Tasks

- [ ] The generator in `fjs/dev/gen`, the generated module, and
      `casConfig` importing it; the literal removed.
- [ ] `npm run gen`, then `tsc`, `fjs test`, `npm run cov` at 100%.
