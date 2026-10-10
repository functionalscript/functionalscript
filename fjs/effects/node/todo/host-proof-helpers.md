## The host proofs copy their scaffolding

**Priority:** P4
**Status:** open

### Problem

The impure proofs beside the Node runner, [`proof.mjs`](../proof.mjs), and
beside the web server, [`fjs/web/proof.mjs`](../../../web/proof.mjs), need
the same four things, and each file has its own:

- `within(label, ms, p)` — a `Promise.race` against a rejecting timer,
  cleared in `finally` — is in both, body for body; the web copy's doc
  points at the node copy.
- `withServer` is in both: build the one `NodeProgram` that creates a
  server, hands the `http.Server` out through `asBase`, listens on port
  `0` on the loopback, and after the client runs destroys the connections
  and closes. The only difference is the listener the web copy builds from
  a root.
- The temporary-directory bracket — `mkdtemp(join(tmpdir(), prefix))`,
  then `rm(root, { recursive: true, force: true })` in `finally` — is a
  named `withTemporary` in the node proof, and inline three times in the
  web proof and twice in
  [`virtual/readdir/proof.mjs`](../virtual/readdir/proof.mjs).
- Which engine is running is asked as `'Bun' in globalThis` in the web
  proof and as `isNode` in the node proof, while
  [`module.mjs`](../module.mjs) computes `engine` for itself and does not
  export it.

These proofs are `.mjs` by necessity — they reach through to the host's
`Server` — and that is the one reason given for the file; the scaffolding
around that reach-through is not host-specific and need not be written per
file. A change to the close order, or to how long a proof may wait, is made
in one copy today.

### Proposal

One host test library beside the runner, named after
[`fjs/git/testlib.f.mjs`](../../../git/testlib.f.mjs)'s precedent —
`testlib.mjs`, since it is impure — exporting `within`, `withServer(listener,
client)`, `withTemporary(prefix, check)` and `engine`. The web proof calls
`withServer(respond(root), client)`; the inline brackets become calls.

### Tasks

- [ ] The library, with the four helpers moved rather than rewritten.
- [ ] Move the three proof files onto it; `node --test` to exit 0.
