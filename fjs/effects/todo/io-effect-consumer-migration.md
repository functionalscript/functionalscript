## Migrate the remaining effect consumers to IoEffect

**Priority:** P3
**Status:** open
**Blocked by:** [io-effect-migration](./io-effect-migration.md) Stage 3 (done)

### Problem

Stage 4 of [io-effect-migration](./io-effect-migration.md) migrates consumers
module by module, one pull request each. The first tranche
([#1615](https://github.com/functionalscript/functionalscript/pull/1615)) took
`fjs/ci`, `fjs/ci/nix`, `fjs/nanvm/update`, `fjs/dev/update`, `fjs/cas` and
`cas list`, and landed the `history` / `historyStep` / `foldStep` /
`forEachStep` those needed.

The rest still state their failure policy per site instead of composing:

```sh
grep -rn unwrapStep --include='*.f.mjs' --include='*.mjs' fjs | grep -v effects/io/
```

Every hit is a consumer that has chosen "panic" because nothing better was
available at the time, not because panicking is the right answer there. A
server that cannot read its session state kills the process; a test runner that
cannot write a line does the same. `fjs/dev` is the same defect spelled with a
bare `unwrap` instead.

These modules were left out of the first tranche because each changes a
published type, not just a chain: the migration reaches their callers, so each
is its own review.

### Proposal

One pull request per module, in this order — later ones depend on the types
earlier ones settle.

**`fjs/emergent_testing`** (9 sites). The reporter's writes, `all`, `await`,
`sandbox` and `test`. `Reporter<O>`'s members return `Effect<O, void>`, and a
`void` return position accepts a `Result`-valued effect silently, so the type
has to change with the code or the discard just moves. The chain ends at
`main`, which already produces an exit code — `exitStep` is the tail.

**`fjs/dev`** (3 bare `unwrap`s + one `all`). `loadModuleMap` panics on a
`readdir` or `import` failure. Its consumer is `emergent_testing`'s `main`, so
this and the module above meet at the same tail.

**`fjs/cas/evo`** (5 sites). The cache slot behind `Evo<O>`. `list`, `head` and
`revision` are declared `Effect<MemOp, …>`; propagating makes them
`IoEffect<MemOp, …, NotImplemented>`, which every `fjs/mcp/evo` tool handler
then has to answer for — an MCP error response is the natural end, and
`add` already returns a domain `Result<Hash, string>` that must **not** be
collapsed into the effect's channel.

**`fjs/protocol/mcp` + `fjs/protocol/mcp/stdio`** (5 sites). Session state and
`readLine`. The transport loop's `void` result is the same hazard as the
reporter's, and the natural policy is a JSON-RPC error response for a session
failure and a clean loop exit at EOF.

**`fjs/mcp`** (1 site, plus proofs). Falls out of the two above.

Proof files migrate with their modules
(`fjs/effects/node/memory/proof.mjs`, `fjs/protocol/mcp/proof.f.mjs`,
`fjs/mcp/proof.f.mjs`, `fjs/emergent_testing/proof.f.mjs`).

Where a module genuinely has no answer to a failure, `unwrapStep` stays — the
goal is a *considered* policy at every site, not zero panics. Say so in a
comment when it stays.

### Tasks

- [ ] `fjs/emergent_testing` — reporter, `registerModule`, `runModuleMap`,
      `defaultTest`; `Reporter<O>` member types.
- [ ] `fjs/dev` — `loadModuleMap` and `allFiles`.
- [ ] `fjs/cas/evo` — the cache slot and the `Evo<O>` API, plus `fjs/mcp/evo`.
- [ ] `fjs/protocol/mcp` and its stdio transport.
- [ ] `fjs/mcp`.
- [ ] Delete this file once the grep above returns only considered, commented
      sites, and check off Stage 4 in
      [io-effect-migration](./io-effect-migration.md).
- [ ] `npx tsc`, `fjs t` and `npm run cov` after each pull request.

### Related

- [io-effect-migration](./io-effect-migration.md) — the parent plan; Stage 5
  cannot start until this is done, and it also inlines `okStep`, whose only
  remaining consumer is the Io `step`.
- [`../io/README.md`](../io/README.md) — the layer these consumers migrate to,
  including what `unwrapStep` is for and why it is one greppable name.
