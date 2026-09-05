## cas-mcp-session-root. The MCP server's composition root is written three times

**Priority:** P4
**Status:** open

### Problem

"How a CAS+Evo MCP session is wired" — build the store, scan it into the
Evo cache, allocate the session slot, build the step — is one fact living
in three places:

- `module.f.mjs:85-92` — `casMcpServer`, feeding `stdioTransport`;
- `proof.f.mjs:84-88` — `runSessionVirtual`, feeding `feed(...)(msgs)`;
- `proof.f.mjs:146-153` — `runStdio`, a literal copy of `casMcpServer`'s
  body.

All three spell

```js
step(initEvo(fileCas(sha256)(home)),
    cacheKey => step(create(uninitializedState),
        sessionKey => <consumer>(mcpStep(casConfig)(casMcpHandlers(home)(cacheKey))(sessionKey))))
```

and differ only in the consumer of the built handle (and `ioStep` vs
`step`). Any change to the root — including the flattening
[casmcpserver-share-cas.md](./casmcpserver-share-cas.md) asks for — must be
replayed in both proof helpers, or the proofs stop exercising the shipped
wiring while still passing.

### Proposal

Parameterize the root by its consumer and export it once — **written
flat**, not by extracting today's nesting verbatim: the existing
`step(initEvo…, cacheKey => step(create…, sessionKey => …))` shape is the
nested form `fjs/AGENTS.md` §3.4 rules out, and the shared owner must not
codify it. The transport needs both keys, which is exactly what
`history`/`historyStep` exist for:

```js
export const casMcpSession = home => transport => {
    const cacheKey = history(initEvo(fileCas(sha256)(home)))
    const keys = historyStep(cacheKey, () => create(uninitializedState))
    return step(keys, ([sessionKey, cacheKey]) =>
        transport(mcpStep(casConfig)(casMcpHandlers(home)(cacheKey))(sessionKey)))
}

export const casMcpServer = home => casMcpSession(home)(stdioTransport)
```

`runStdio` becomes `casMcpSession(home)(stdioTransport)` and
`runSessionVirtual` becomes `casMcpSession(home)(h => feed(h)(msgs))`. The
`ioStep`/`step` split is a typing detail to resolve in the change (one of
the two suffices for both consumers, or the channel type generalizes).
This composes with, rather than conflicts with, the `share-cas`
flattening — that issue asks for the same `history`-based shape — so after
both, the wiring exists exactly once and flat.

### Tasks

- [ ] Export `casMcpSession`; express `casMcpServer` and both proof
      helpers through it.
- [ ] `tsc`, `fjs t`.

### Related

- [casmcpserver-share-cas.md](./casmcpserver-share-cas.md) — reshapes the
  same root; whichever lands first, the other becomes a one-site edit
  because of this issue.
