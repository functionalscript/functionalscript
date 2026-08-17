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
cannot write a line does the same.

**That grep is necessary but not sufficient, and finishing this issue means
running two more.** `unwrapStep` is one greppable name precisely so the
un-migrated sites can be counted — but by construction it cannot see a site
that never used it:

```sh
grep -rn '\bunwrap(\|throw ' --include='*.f.mjs' fjs   # the same defect, spelled differently
```

`fjs/dev` was the first found that way; `fjs/cas`'s `list` and the `fjs run`
command are two more, and neither was on this list until someone looked. The
third sweep has no grep: an interface whose *type* has no error channel forces
every implementation to panic, however it is spelled. `Reporter` and `Cas.list`
were both that, and both were in modules this file had already ticked off. When
a module is migrated, read its published types and ask which of them can still
only answer by throwing.

These modules were left out of the first tranche because each changes a
published type, not just a chain: the migration reaches their callers, so each
is its own review.

### Proposal

One pull request per module, in this order — later ones depend on the types
earlier ones settle.

**`fjs/emergent_testing`** (8 sites). The reporter's writes, `all`, `await`,
`sandbox` and `test`. `Reporter<O>`'s `result` and `summary` return
`Effect<O, void>`, and a `void` return position accepts a `Result`-valued
effect silently, so those two types have to change with the code or the discard
just moves; `test` returns `Effect<O, SandboxResult<unknown>>` and is not
subject to that hazard. The chain ends at `main`, which already produces an exit
code — `exitStep` is the tail.

**`fjs/dev`** (4 bare `unwrap`s: a `readdir`, an `import`, and two `all`s).
`loadModuleMap` panics on any of them. Its consumer is `emergent_testing`'s
`main`, so this and the module above meet at the same tail.

**`fjs/cas/evo`** (5 sites). The cache slot behind `Evo<O>`. `list` and `head`
are declared `Effect<MemOp, …>` and read the slot, so propagating makes them
`IoEffect<MemOp, …, NotImplemented>`, which every `fjs/mcp/evo` tool handler
then has to answer for — an MCP error response is the natural end. `revision`
is `Effect<O | MemOp, Result<RevisionData, string>>` but is served by
`readRevision(cas)` and never reaches the slot, so it does not move until the
memoization its `MemOp` is reserved for arrives. Both it and `add` return a
domain `Result` that must **not** be collapsed into the effect's channel — it
is returned data, like `SandboxResult.result`.

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

### What the migrated modules settled

`fjs/emergent_testing`'s eight sites came down to one, and the three findings
generalize to the modules still queued:

- **`all` needed an `ok`-channel twin, and it is shared.** `all`'s envelope is
  the runner's, so handing it `IoEffect`s nests one `Result` inside another and
  the caller receives `readonly Result<T, E>[]` — the value-discarding hazard,
  one level in. `allOk` (`fjs/effects/node/module.f.mjs`) collapses that to the
  first error. `fjs/dev`'s two `all`s want the same combinator, so it is already
  where that migration needs it.
- **The panic that stayed is at a foreign boundary.** `Test` hands its callback
  to an external framework whose contract is a raw `Effect<…, void>`, so there
  is no channel to answer through and a throw is what that framework reports as
  a failed test. The remaining `unwrapStep` is there, with that reason in a
  comment; every other site now propagates.
- **A tail is not always `exitStep`.** That one answers `0` for every success,
  and `testAll`'s success value *is* the exit code (`1` when a test failed), so
  it needs a sibling that keeps the computed code and reports only the channel
  failure. `register`, whose success carries nothing, uses `exitStep` unchanged.
  Expect the same split wherever a program already computes a code.

`fjs/protocol/mcp` is where the "answer, don't panic" rule met a protocol that
already had a way to say so. A session slot the runner cannot reach becomes a
JSON-RPC `-32603`, not the `-32002` the gate would otherwise fall through to —
telling a client to re-run a handshake it has already run is a loop, and the
fault is the server's. A *notification* has no response frame at all, so there
the failure is silent and the session simply stays gated. The transport is the
opposite case: it has no frame either, but it does have a caller, so a stdin
that cannot be read ends the loop and propagates to whoever started the server.
Between them these are the three shapes a failure can take at a protocol edge —
report it, drop it, or hand it back — and which one applies is decided by what
the protocol gives you to answer with, not by preference.

`fjs/dev` then cost four `unwrap`s and no new vocabulary — `allOk` was already
there for its two `all`s, which is what the ordering was for. It confirms the
other half of that prediction too: `loadModuleMap` became fallible, so
`testAll` and `register` turned their raw `step` into the Io one, and the two
modules met at the tail exactly where this plan said they would. Discovery no
longer panics on a tree it cannot read; `fjs t` reports it and exits `1`.

### Tasks

- [x] `fjs/emergent_testing` — reporter, `registerModule`, `runModuleMap`,
      `defaultTest`; `Reporter<O>` member types.
- [x] `fjs/dev` — `loadModuleMap` and `allFiles`.
- [x] `fjs/cas/evo` — the cache slot and the `Evo<O>` API, plus `fjs/mcp/evo`.
- [x] `fjs/protocol/mcp` and its stdio transport.
- [x] `fjs/mcp` — its bootstrap migrated with `fjs/cas/evo`.
- [ ] `fjs` — the `run` command's bare `unwrap` of `import_`, which panics the
      CLI on a module that will not import. Found by the second sweep above,
      not by the `unwrapStep` grep.
- [ ] Delete this file once **all three** sweeps above come back clean, and
      check off Stage 4 in
      [io-effect-migration](./io-effect-migration.md).
- [ ] `npx tsc`, `fjs t` and `npm run cov` after each pull request.

### Related

- [io-effect-migration](./io-effect-migration.md) — the parent plan; Stage 5
  cannot start until this is done, and it also inlines `okStep`, whose only
  remaining consumer is the Io `step`.
- [`../io/README.md`](../io/README.md) — the layer these consumers migrate to,
  including what `unwrapStep` is for and why it is one greppable name.
