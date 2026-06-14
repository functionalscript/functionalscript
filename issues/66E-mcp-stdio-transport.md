# 66E-mcp-stdio-transport. stdio transport for MCP

**Priority:** P3
**Status:** open
**Blocks:** [i66E-mcp-cas-server](./66E-mcp-cas-server.md)

## Problem

`fs/mcp/module.f.ts` has `mcpStep`: a pure function
`Unknown → Effect<MemOp | O, Response | null>` that drives the full MCP
lifecycle. Writing responses is already covered — `write('stdout', utf8(json +
'\n'))` from `fs/effects/node` — but **reading from stdin is not**.
`fs/effects/node` exposes `write` for stdout/stderr and HTTP primitives, but has
no effect for consuming stdin line by line.

Without a stdin read effect there is no way to wire `mcpStep` into a live
process: the transport loop (read a line → parse JSON → call `mcpStep` → write
response) cannot be expressed in the effect system, so every MCP server is
blocked at the I/O boundary.

## Proposal

### 1. Add a stdin read effect to `fs/effects/node`

A minimal new effect, parallel to the existing `write`:

```ts
export type ReadLine = readonly['readline', () => string | null]
export const readline: Func<ReadLine> = do_('readline')
```

Following the same tuple pattern as the existing node effects (e.g. `Write =
readonly['write', (stream, data) => void]`), so `ReadLine` is a valid
`Operation` that can appear in `NodeOp` and be emitted via `do_`. The
interpreter calls `process.stdin` and resolves to `string | null` (null = EOF).
The effect is deliberately narrow: one line at a time, no buffering policy in
the effect itself.

### 2. stdio transport loop

A pure-ish combinator that, given an `mcpStep`-shaped step function, produces an
`Effect<ReadLine | Write | MemOp | O, void>` representing the full server loop.
`Fs` (filesystem ops) is not included — the loop only uses `ReadLine` (stdin)
and `Write` (stdout), plus whatever `O` the step function needs:

```
loop:
  line ← readline()
  if line is null → return          // EOF, clean shutdown
  msg  ← JSON.parse(line)           // malformed JSON → skip or error response
  resp ← mcpStep(msg)
  if resp is not null → write('stdout', utf8(JSON.stringify(resp) + '\n'))
  goto loop
```

The loop is expressed as a recursive effect (or a small interpreter combinator)
so it stays in the pure effect model and remains testable without a real process.

### 3. `cas mcp` CLI subcommand (follow-on)

Once the transport exists, the live process assembly —
`cas(sha256)(fileKvStore('.'))`, `casMcpHandlers`, `create(uninitializedState)`,
`mcpStep`, and `stdioTransport` — is wired together in **`fs/cas/module.f.ts`**
as the `cas mcp` subcommand (see
[i66E-fjs-cas-mcp-subcommand](./66E-fjs-cas-mcp-subcommand.md)). The adapter
module `fs/cas/mcp/module.f.ts` ([i66E-mcp-cas-server](./66E-mcp-cas-server.md))
stays transport-agnostic: it only exports generic `casMcpHandlers(c: Cas<O>)` and
`casConfig`, so it remains fully testable in-memory without a real filesystem or
transport. This issue owns only the transport primitive.

## Tasks

- [x] Add `readline` effect type to `fs/effects/node/module.f.ts` and its Node.js
      interpreter (`process.stdin` / `readline` interface or async iterator).
- [x] Add `stdioTransport` (or equivalent combinator) that wraps a step function
      in the read-parse-dispatch-write loop (`fs/mcp/stdio/module.f.ts`).
- [x] Proof / tests: drive `stdioTransport` against a mock stdin sequence (list of
      lines) and assert the correct responses are written to a mock stdout — no
      real process needed (`fs/mcp/stdio/proof.f.ts`, plus a `readline` line source
      in `fs/effects/node/virtual`).
- [x] Handle edge cases: EOF mid-stream, malformed JSON lines, and `null` response
      from `mcpStep` (notifications that need no reply).

## Open questions

- **readline vs. async iterator.** Node's `readline` interface or iterating
  `process.stdin` directly? The effect should abstract the choice; pick whichever
  is simpler to interpret.
- **Malformed JSON.** Skip silently, or synthesize a JSON-RPC parse-error
  response? JSON-RPC 2.0 §5 says a parse error is a valid error response; prefer
  that over silent discard.
- **Back-pressure.** stdio is naturally sequential (one message at a time); no
  concurrency concern for the initial implementation.

## Related

- [i665-mcp](./665-mcp.md) — MCP roadmap; this delivers item 5 (stdio transport).
- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — blocked on this; will use the
  transport loop to expose `fs/cas` over MCP.
- `fs/effects/node/module.f.ts` — the effect interpreter this extends.
- `fs/mcp/module.f.ts` — `mcpStep`, the step function the transport drives.
