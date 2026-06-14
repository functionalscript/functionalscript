# 66E-fjs-cas-mcp-subcommand. `fjs cas mcp` — start the stdio MCP server for CAS

**Priority:** P3
**Status:** blocked
**Blocked by:**
- [i66E-mcp-stdio-transport](./66E-mcp-stdio-transport.md) — readline effect and transport loop
- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — `casMcpHandlers` and `casConfig`

## Problem

`fjs cas` already dispatches `add` / `get` / `list` subcommands from
`fs/cas/module.f.ts`. Once `casMcpHandlers`
([i66E-mcp-cas-server](./66E-mcp-cas-server.md)) and the stdio transport loop
([i66E-mcp-stdio-transport](./66E-mcp-stdio-transport.md)) are in place, there
is no entry point to start the MCP server: no subcommand wires them together
into a running process. A user or agent wanting to connect to the CAS over MCP
has no way to launch it.

## Proposal

Add an `mcp` subcommand to the `cas` command group so that `fjs cas mcp`
starts the stdio MCP server:

```
fjs cas mcp
```

The handler assembles the three pieces:

```ts
{
    names: ['mcp', 'm'],
    description: 'Start the stdio MCP server for content-addressable storage',
    handler: () => {
        const c = cas(sha256)(fileKvStore('.'))
        const handlers = casMcpHandlers(c)
        return create(uninitializedState as McpSessionState).step(key =>
            stdioTransport(mcpStep(casConfig)(handlers)(key))
                .step(() => pure(0))
        )
    },
}
```

`mcpStep(casConfig)(handlers)` takes a `Key<McpSessionState>` before it becomes
the per-message step function, so the handler must first allocate a session key
via `create(uninitializedState)` (a `MemCreate` effect) and pass it in.
`stdioTransport` produces `Effect<..., void>`; `.step(() => pure(0))` maps EOF
completion to exit code `0`, satisfying the `Effect<O, number>` contract that
`Command.handler` requires.

### Where the change lives

`fs/cas/module.f.ts` — add the `mcp` entry to the existing `commands` array
alongside `add`, `get`, and `list`. No changes to `fs/fjs/module.f.ts` are
needed: `fjs` already delegates to `casMain`, which delegates to `dispatch`.

### Nested command help (optional, see i667-cli-nested-commands)

Currently `fjs help` cannot enumerate `cas mcp` because the nested structure
is opaque to the top-level dispatcher. That is a pre-existing limitation, not
introduced here. If i667-cli-nested-commands lands first, replace
`handler: casMain` in `fs/fjs/module.f.ts` with `commands: casCommands` and
export a `casCommands` constant from `fs/cas/module.f.ts`; otherwise the
flat delegation is sufficient for now.

## Tasks

- [ ] Import `casMcpHandlers`, `casConfig` from `fs/cas/mcp/module.f.ts` and
      `stdioTransport`, `mcpStep` from their respective modules in
      `fs/cas/module.f.ts`.
- [ ] Add `{ names: ['mcp', 'm'], description: '...', handler }` to the
      `commands` array in `fs/cas/module.f.ts`.
- [ ] Smoke-test: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | fjs cas mcp`
      produces a valid `initialize` response on stdout.

## Related

- [i66E-mcp-stdio-transport](./66E-mcp-stdio-transport.md) — `stdioTransport`
  and the `readline` effect this subcommand relies on.
- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — `casMcpHandlers`, `casConfig`,
  and `mcpStep` wiring this subcommand calls.
- [i667-cli-nested-commands](./667-cli-nested-commands.md) — would allow
  `fjs help cas` to enumerate `mcp` alongside `add` / `get` / `list`.
- `fs/cas/module.f.ts` — the `commands` array and `main` this extends.
- `fs/fjs/module.f.ts` — top-level dispatcher; delegates `cas` to `casMain`.
