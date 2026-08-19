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

- Widen `McpConfig.protocolVersion` to accept a non-empty list of supported
  versions, latest first, keeping the single-string form working (either as an
  overload or by treating a string as a one-element list). The current field is
  public API; a breaking change is acceptable if the list form reads better.
- In the `initialize` branch, bind the validated params (`const [pr, pv] = …`),
  and answer with `pv.protocolVersion` when it is in the supported list, the
  first (latest) supported version otherwise.
- Leave the state transition where it is: `uninitialized → initializing` on any
  answered `initialize`, since a counter-proposal is a success frame and the
  client decides whether to continue.

### Tasks

- [ ] Widen `McpConfig` to a supported-version list.
- [ ] Bind the validated params and select the answer from that list.
- [ ] Proofs: requested version supported → echoed; not supported → latest
      supported; single-version config unchanged in behaviour.
- [ ] Update `casConfig` only if `fjs/mcp` gains a second supported revision.

### Related

- [lifecycle spec, version negotiation](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#version-negotiation)
  — the two MUSTs quoted above.
- `../module.f.mjs:310-341` — the `initialize` branch.
- `../../../mcp/module.f.mjs` — `casConfig`, the one in-repo `McpConfig`.
