## Flatten `casMcpServer` and build `fileCas` once

**Priority:** P3
**Status:** open

### Problem

`module.f.mjs:81-88` is the exact shape §6.4 forbids — the second `step`
nests only so the continuation can still see `cacheKey`, which is the case
`historyStep` exists for:

```js
export const casMcpServer = home => step(
    initEvo(fileCas(sha256)(home)),
    cacheKey => step(
        create(uninitializedState),
        sessionKey =>
            stdioTransport(mcpStep(casConfig)(casMcpHandlers(home)(cacheKey))(sessionKey)),
    ),
)
```

Flattening also surfaces the real defect: `fileCas(sha256)(home)` is
constructed three times for one server — here (`:82`), in
`casMcpHandlers`' `evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey))`
(`:57`), and inside `casToolRegistry`
(`fjs/mcp/cas/module.f.mjs:180-181`). It also exposes an asymmetry between
the sibling registries: `evoToolRegistry(e)` is injected with a built
`Evo<O>`, while `casToolRegistry(home)` takes a path and builds its own
store.

### Proposal

`casToolRegistry(cas)(cacheKey)` to mirror `evoToolRegistry`, with one
`const cas = fileCas(sha256)(home)` at the composition root, and the body
rewritten flat with `history`/`historyStep`/`step`
(`fjs/cas/module.f.mjs:142-143` is the in-repo model).

### Tasks

- [ ] Inject a built `Cas` into `casToolRegistry`
- [ ] Flatten `casMcpServer` with `historyStep`; construct `fileCas` once

### Related

- [66k-cas-cli-mcp-shared-core](../../cas/todo/66k-cas-cli-mcp-shared-core.md)
  — CLI-vs-MCP sharing; this issue is the intra-server construction and §6.4
  shape
