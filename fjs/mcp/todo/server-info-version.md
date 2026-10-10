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

One source. Either generate a version constant from `package.json` under
`npm run gen`, so the pure module keeps a literal that cannot drift, or
have the host adapter read `package.json` at startup and pass the version
in. The first keeps `casConfig` pure and testable; the second avoids a
generated file.

### Tasks

- [ ] Pick one, implement it, and remove the literal.
