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

The literal stays where it is, and a check makes drift fail the build.
`casConfig` stays a static `McpConfig`, and `_casMcpSession` and
`casMcpServer` keep their signatures. A host proof beside this module,
`proof.mjs`, reads `package.json` from the repository root and asserts
that `casConfig.serverInfo.version` equals its `version`, so a release
that bumps `package.json` without this literal fails `node --test` at
once, and so does a bump here that `package.json` does not carry. Two
spellings remain, and one check keeps them equal.

Generating the version was considered and dropped. `fjs/module.f.mjs`,
the `fjs` CLI, imports this module for its `mcp` command, and `npm run
gen` runs through that CLI, which
[CONTRIBUTING.md](../../../CONTRIBUTING.md#naming-generated-files) says
imports nothing generated: after `gen:clean` the generator could not
start to recreate the module `casConfig` would need. A pure module
cannot read `package.json` either, and threading the version in from the
host would make `casConfig` a factory, or add a parameter to the session
and server, for a value that is a constant of the build.

### Tasks

- [ ] The host proof; the literal bumped to `package.json`'s version in
      the same change, so the proof passes.
- [ ] `node --test` to exit 0; `tsc`, `fjs test`.
