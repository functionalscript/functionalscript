## The host proofs copy their scaffolding

**Priority:** P4
**Status:** open

### Problem

The impure proofs beside the Node runner, [`proof.mjs`](../proof.mjs), and
beside the web server, [`fjs/web/proof.mjs`](../../../web/proof.mjs), need
the same few things, and each file has its own:

- `within(label, ms, p)` — a `Promise.race` against a rejecting timer,
  cleared in `finally` — is in each, body for body; the web copy's doc
  points at the node copy.
- `withServer` is in each: build the one `NodeProgram` that creates a
  server, hands the `http.Server` out through `asBase`, listens on port
  `0` on the loopback, and after the client runs destroys the connections
  and closes. The only difference is the listener the web copy builds from
  a root.
- The temporary-directory bracket — `mkdtemp(join(tmpdir(), prefix))`,
  then `rm(root, { recursive: true, force: true })` in `finally` — is a
  named `withTemporary` in the node proof, and inline several times across
  the web proof and
  [`virtual/readdir/proof.mjs`](../virtual/readdir/proof.mjs).
- The runtime guards repeat host checks: the web proof asks
  `'Bun' in globalThis`, and the node proof's `isNode()` excludes both Bun
  and Deno. [`module.mjs`](../module.mjs) repeats the Bun check when
  selecting `options.testContext`, without exporting it.

These proofs are `.mjs` by necessity — they reach through to the host's
`Server` — and that is the one reason given for the file; the scaffolding
around that reach-through is not host-specific and need not be written per
file. A change to the close order, or to how long a proof may wait, is made
in one copy today.

### Proposal

One host test library beside the runner, named after
[`fjs/git/testlib.f.mjs`](../../../git/testlib.f.mjs)'s precedent —
`testlib.mjs`, since it is impure — exporting `within`, `withServer(listener,
client)`, `withTemporary(prefix, check)`, `isBun` and `isNode`. The web proof
calls `withServer(respond(root), client)`; the inline brackets become calls.

`module.mjs` names and exports its existing `'Bun' in globalThis` check as
the boolean `isBun`, and uses it to select `options.testContext`.
`testlib.mjs` imports and re-exports `isBun`, and owns the exported
`isNode()` predicate `!isBun && !('Deno' in globalThis)` for Node-only guards.
The web proof uses `isBun`; the node proof uses `isNode()`, still excluding
Deno. The production runner keeps one selected `testContext` and has no
dependency on the test library.

### Tasks

- [ ] The library, with `within`, `withServer` and `withTemporary` moved
      rather than rewritten.
- [ ] Name and export the production `isBun` check, use it in
      `options.testContext`, and re-export it from the library.
- [ ] Move the Node-only `isNode()` guard to the library, using shared
      `isBun` and retaining its Deno exclusion; the web proof uses `isBun`
      and the node proof uses `isNode()`.
- [ ] Move the listed proof files onto it; `node --test` to exit 0.
