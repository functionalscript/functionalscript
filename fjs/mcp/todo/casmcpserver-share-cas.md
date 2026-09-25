## Build the CAS MCP session root once, flat

**Priority:** P3
**Status:** open

### Problem

"How a CAS+Evo MCP session is wired" — build the store, scan it into the Evo
cache, allocate the session slot, build the step — is one fact written three
times, in the nested shape
[`fjs/AGENTS.md` §3.4](../../AGENTS.md#reaching-back-to-an-earlier-value-use-historystep)
rules out:

- `casMcpServer` in `module.f.mjs`, feeding `stdioTransport`;
- `runSessionVirtual` in `proof.f.mjs`, feeding `feed(...)(msgs)`;
- `runStdio` in `proof.f.mjs`, a literal copy of `casMcpServer`'s body.

All three spell

```js
step(initEvo(fileCas(sha256)(home)),
    cacheKey => step(create(uninitializedState),
        sessionKey => <consumer>(mcpStep(casConfig)(casMcpHandlers(home)(cacheKey))(sessionKey))))
```

and differ only in the consumer of the built handle (and `ioStep` vs `step`).
The second `step` nests only so the continuation can still see `cacheKey`,
which is the case `historyStep` exists for. And because the proof helpers copy
the root rather than calling it, any change to it must be replayed in both, or
the proofs stop exercising the shipped wiring while still passing.

Flattening also surfaces the real defect: `fileCas(sha256)(home)` is
constructed three times for one server — in `casMcpServer`, in
`casMcpHandlers`' `evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey))`, and
inside `casToolRegistry` (`fjs/mcp/cas/module.f.mjs`). It also exposes an
asymmetry between the sibling registries: `evoToolRegistry(e)` is injected with
a built `Evo<O>`, while `casToolRegistry(home)` takes a path and builds its own
store.

### Proposal

`casToolRegistry(cas)(cacheKey)` to mirror `evoToolRegistry`, with one
`const cas = fileCas(sha256)(home)` at the composition root, threaded through
`casMcpHandlers`, which takes the built store instead of `home`:

```js
export const casMcpHandlers = cas => cacheKey =>
    fromRegistry([...casToolRegistry(cas)(cacheKey), ...evoToolRegistry(evo(cas)(cacheKey))])
```

`casToolRegistry` uses `home` only to build that store, so nothing else it
does needs the path.

Parameterize the root by its consumer and export it once — **written flat**
with `history`/`historyStep`, not by extracting today's nesting verbatim
(`gcStage` in `fjs/cas/module.f.mjs` is the in-repo model). The transport needs
both keys, which is exactly what `history`/`historyStep` exist for:

```js
export const _casMcpSession = home => transport => {
    const cas = fileCas(sha256)(home)
    const cacheKeyEffect = history(initEvo(cas))
    const keys = historyStep(cacheKeyEffect, () => create(uninitializedState))
    return step(keys, ([sessionKey, cacheKey]) =>
        transport(mcpStep(casConfig)(casMcpHandlers(cas)(cacheKey))(sessionKey)))
}

export const casMcpServer = home => _casMcpSession(home)(stdioTransport)
```

The `_` prefix is deliberate: the factory is exported only so the proof
helpers can reuse the production wiring — module linkage, not a new
transport-injection API — per the private-runtime naming rule
(`fjs/AGENTS.md`), so it can be renamed or removed later without a
breaking change; `casMcpServer` stays the one public entry point.
`runStdio` becomes `_casMcpSession(home)(stdioTransport)` and
`runSessionVirtual` becomes `_casMcpSession(home)(h => feed(h)(msgs))`. The
`ioStep`/`step` split is a typing detail to resolve in the change (one of
the two suffices for both consumers, or the channel type generalizes).

### Tasks

- [ ] Inject a built `Cas` into `casToolRegistry` and `casMcpHandlers`;
      construct `fileCas` once at the root and pass that one instance to
      `initEvo`, `casToolRegistry` and `evo`.
- [ ] Export `_casMcpSession`, written flat with `historyStep`; express
      `casMcpServer` and both proof helpers through it.
- [ ] `tsc`, `fjs t`.

### Related

- [66k-cas-cli-mcp-shared-core](../../cas/todo/66k-cas-cli-mcp-shared-core.md)
  — CLI-vs-MCP sharing; this issue is the intra-server construction and the
  §3.4 shape.
