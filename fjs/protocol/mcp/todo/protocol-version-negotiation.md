## `McpConfig` supports one protocol version

**Priority:** P4
**Status:** open

### Problem

`McpConfig` (`../types.ts`) holds a single `protocolVersion: string`, and
`mcpStep`'s `initialize` branch (`../module.f.mjs:310-341`) answers with it
unconditionally:

```js
const [pr] = parse(initializeParams)(params)
if (pr === 'error') {
    return pureOk(_errResponse(id)(invalidParams))
}
/** @type {InitializeResult} */
const result = {
    protocolVersion,
    capabilities,
    serverInfo,
}
```

`initializeParams` requires the client's `protocolVersion` to be present and a
`string`, so it is checked as a shape and then dropped — nothing reads it.

**This is conformant for a server that supports exactly one version, which is
the only server `McpConfig` can describe.** The
[lifecycle spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#version-negotiation)
says:

> If the server supports the requested protocol version, it **MUST** respond
> with the same version. Otherwise, the server **MUST** respond with another
> protocol version it supports. This **SHOULD** be the *latest* version
> supported by the server.
>
> If the client does not support the version in the server's response, it
> **SHOULD** disconnect.

Echoing the one supported version satisfies both branches: it is *the same
version* when the client asked for it, and *another version the server
supports* when it did not. `casConfig` (`../../../mcp/module.f.mjs`) pins
`2024-11-05` and real clients that ask for a later revision are answered with
it and proceed, which is the counter-propose branch working as written.

What is missing is the **multi-version** case. A server that supports two or
more revisions cannot say so — it has one string — so it cannot honour the
first MUST (respond with the *same* version when it is supported) for any
version but the pinned one. It has to pick a single revision at configuration
time and counter-propose it to everyone else, which costs clients that would
have matched.

Two things are deliberately **not** the problem here:

- **Not a missing error path.** The negotiation rule prescribes a
  counter-proposal, not a JSON-RPC error, and puts the decision on the client
  (`SHOULD disconnect`). The spec's Error Handling section shows an
  `Unsupported protocol version` (`-32602`) example, so an error is a shape the
  ecosystem understands, but returning one where a counter-proposal is
  prescribed narrows what the server interoperates with rather than widening
  it. If a version-mismatch error is ever wanted it belongs behind an explicit
  strict-mode opt-in, not as the default.
- **Not a fix to be written against `pr`.** `parse` returns a `Result` tuple, so
  in `const [pr] = parse(initializeParams)(params)` the binding is the **tag** —
  the next line compares it to `'error'`. `pr.protocolVersion` is `undefined`
  for every input, and a guard written on it is unconditionally true: a
  "negotiation" that turns away every client, including a correct one. Any fix
  widens the destructuring first (`const [pr, pv] = …`) and reads
  `pv.protocolVersion`.

### Proposal

Only worth doing when a server here needs to support more than one revision.
When it does:

- **Replace** `McpConfig.protocolVersion: string` with one list-shaped field:
  `protocolVersions: readonly[string, ...readonly string[]]`, latest first,
  non-empty by construction. **One shape, not two.** Keeping the string form
  alongside the list — as an overload or as an accepted alternative — would make
  every consumer normalise a union and would leave a singular name responsible
  for several values, which is complexity bought to avoid a rename. AGENTS.md
  settles that trade directly: *"the API is the most important part of quality
  — breaking changes are the right call whenever they improve the API"*.
- **Move the in-repo producers in the same change**, not later. There is exactly
  one — `casConfig` (`../../../mcp/module.f.mjs:71`) — plus the `McpConfig`
  literals in `../proof.f.mjs`; each becomes a one-element list. This is a
  rename, so it is unconditional; it does not wait for a second revision.
- In the `initialize` branch, bind the validated params (`const [pr, pv] = …`),
  and answer with `pv.protocolVersion` when it is in the supported list, the
  first (latest) supported version otherwise.
- Leave the state transition where it is: `uninitialized → initializing` on any
  answered `initialize`, since a counter-proposal is a success frame and the
  client decides whether to continue.

### Tasks

- [ ] Replace `McpConfig.protocolVersion` with the non-empty `protocolVersions`
      list — the string form goes away rather than staying as an alternative.
- [ ] Move `casConfig` and the `McpConfig` literals in the proofs to the
      one-element list form, in the same PR as the type change.
- [ ] Bind the validated params and select the answer from that list.
- [ ] Proofs: requested version supported → echoed; not supported → latest
      supported; a one-element config answers exactly as the string field did.
- [ ] Changelog: the field rename is a breaking change to a public type.

### Related

- [lifecycle spec, version negotiation](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#version-negotiation)
  — the two MUSTs quoted above.
- `../module.f.mjs:310-341` — the `initialize` branch.
- `../../../mcp/module.f.mjs` — `casConfig`, the one in-repo `McpConfig`.
