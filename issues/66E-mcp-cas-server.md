# 66E-mcp-cas-server. Design: an MCP server that exposes `fs/cas` as tools

**Priority:** P3
**Status:** done
**Blocked by:** ~~[i66E-mcp-stdio-transport](./66E-mcp-stdio-transport.md)~~ — stdio transport
has since landed (`fs/mcp/stdio`, byte-level stdin read effect in `fs/effects/node`),
unblocking this issue including the `cas mcp` CLI subcommand.

## Problem

`fs/cas/module.f.ts` already gives us a content-addressable store — a pure
`Cas<O>` facade (`read` / `write` / `list`) over a pluggable `KvStore<O>`, plus a
filesystem backing (`fileKvStore`) and a CLI (`cas add` / `get` / `list`). The
only way to drive it today is that CLI: one process per command, no session, no
discovery.

Separately, `fs/mcp/module.f.ts` has landed the protocol core — message schemas
and the `mcpStep` lifecycle/capability state machine (`initialize` →
`notifications/initialized` → `tools/list` / `tools/call`) — but with a
hello-world handler (`greet` → `"hello"`). It is wired to nothing real.

These two halves fit together: CAS is exactly the kind of capability MCP exists
to expose. An agent that speaks MCP should be able to `tools/call` to store a
blob and get back its hash, fetch a blob by hash, and enumerate what is stored —
without shelling out to the CLI. This issue is the design for that wiring: a
**CAS MCP server** = `fs/cas` (the capability) + `fs/mcp` (the protocol) + a
stdio transport (the missing plumbing).

The point is not new storage logic — `Cas<O>` is reused verbatim — but the
**adapter**: mapping three CAS operations onto three MCP tools, choosing how
binary `Vec` content crosses a text-oriented protocol, and closing the read loop.

## Proposal

### Where it lives

A new module `fs/cas/mcp/module.f.ts` (sibling to the CLI `main` in
`fs/cas/module.f.ts`), with `fs/cas/mcp/proof.f.ts`. It imports `Cas<O>` from
`../module.f.ts` and the protocol pieces from `../../mcp/module.f.ts`. The CAS
module stays transport-agnostic; the MCP adapter is an additional front end, the
same way the CLI is one.

### The three tools

One rtti schema per tool's arguments — declared once, used twice: `toJsonSchema`
(`fs/json/schema/module.f.ts`) derives the `inputSchema` advertised in
`tools/list`, and `validate` (`fs/types/rtti/validate`) decodes the `arguments`
object in `tools/call`. No drift between what we advertise and what we accept.

| Tool       | rtti args            | CAS call         | Result text         |
|------------|----------------------|------------------|---------------------|
| `cas_add`  | `{ content: string }`| `c.write(value)` | hash (cBase32)      |
| `cas_get`  | `{ hash: string }`   | `c.read(key)`    | content (cBase32)   |
| `cas_list` | `{}`                 | `c.list()`       | hashes, one per line|

```ts
const casAddArgs = { content: string } as const
const casGetArgs = { hash: string } as const
const casListArgs = {} as const
```

`tools/list` returns these three `Tool` descriptors; each `inputSchema` is
`toJsonSchema(record(args))` (the rtti struct → JSON Schema `object`).

### Content encoding — the one real design decision

`Cas<O>` deals in `Vec` (bit vectors); MCP's only content type modelled today is
`textContent` (a `string`). Hashes already have a canonical text form —
`vecToCBase32` / `cBase32ToVec` — and `fs/cas` uses exactly that for the CLI.

**Decision: encode both hash and content as cBase32**, reusing
`fs/cbase32/module.f.ts`. This keeps a single encoding across the whole CAS
surface (CLI and MCP agree), and `cBase32ToVec` already returns `null` on
malformed input, giving free input validation. The round-trip is symmetric:
`cas_add` takes cBase32 `content` → `Vec` → store → return cBase32 hash;
`cas_get` takes cBase32 `hash` → `Vec` key → read → return cBase32 content.

Alternatives considered (open question below): base64 (the MCP-idiomatic
encoding for binary, but a second encoding the project doesn't otherwise use), or
adding a `blob`/`resource` content type to `fs/mcp` so binary need not be
text-shoehorned. Both are follow-ups; cBase32 is the minimal, consistent start.

### Handler wiring

The adapter implements `McpHandlers<O>` against an injected `Cas<O>` — generic in
`O` exactly like `Cas` itself, so the same handlers run over `Fs` (production) or
memory (tests):

```ts
export const casMcpHandlers = <O extends Operation>(c: Cas<O>): McpHandlers<O> => ({
    toolsList: () => pure({ tools: [casAddTool, casGetTool, casListTool] }),
    toolsCall: ({ name, arguments: args }) => {
        switch (name) {
            case 'cas_add': /* validate casAddArgs, decode content, c.write, return hash */
            case 'cas_get': /* validate casGetArgs, decode hash,  c.read,  return content */
            case 'cas_list':/* c.list, join hashes */
            default:        /* unknown tool → isError result */
        }
    },
})
```

**Error convention.** MCP draws a line the dispatcher already respects:
*protocol* failures (unknown method, malformed params at the JSON-RPC layer) are
JSON-RPC errors — `mcpStep` handles those. *Tool* failures (bad cBase32, hash not
found, unknown tool name) are **not** JSON-RPC errors; they come back as a normal
`tools/call` result with `isError: true` and a text explanation, so the model can
read and react to them. So:

- malformed `content` / `hash` (`cBase32ToVec` → `null`) → `isError` result
- `cas_get` on an absent hash (`c.read` → `undefined`) → `isError` result
- unknown tool `name` → `isError` result

This mirrors the CLI's distinctions (`errorExit` for bad input vs. a real
result) but routed through MCP's in-band error channel.

### Assembling a session

`mcpStep` already threads session state through a memory `Key<McpSessionState>`,
producing effects in `MemOp | O`. Composing it with a filesystem-backed CAS
yields `MemOp | Fs`:

```ts
const c = cas(sha256)(fileKvStore('.'))           // Cas<Fs>
const handlers = casMcpHandlers(c)                 // McpHandlers<Fs>
const step = mcpStep(casConfig)(handlers)          // needs a Key<McpSessionState>
```

`casConfig: McpConfig` advertises `{ tools: {} }` capability, a `serverInfo` of
`{ name: 'functionalscript-cas', version }`, and a pinned `protocolVersion`.

### The transport (the blocking gap)

`mcpStep` is pure-ish: `Unknown → Effect<…, Response | null>`. To run a server we
need a loop that (1) reads newline-delimited JSON from stdin, (2) parses each
line, (3) feeds it to `step`, (4) JSON-serializes any non-`null` `Response` and
writes it to stdout with a trailing newline.

Step 4 is available: `write('stdout', utf8(json + '\n'))` from
`fs/effects/node`. **Step 1 is not** — `fs/effects/node` has `write` to
stdout/stderr but no stdin *read* effect. This is the single missing primitive,
and the reason this issue is blocked on i665's transport item. The transport
loop (framing + the stdin effect) is its own deliverable; this issue owns the
*adapter* and can be fully written and tested against in-memory message lists
before the live loop exists (the proof drives `step` directly, exactly as
`fs/mcp/proof.f.ts` does).

## Tasks

- [x] Add `fs/cas/mcp/module.f.ts`: `casAddArgs` / `casGetArgs` / `casListArgs`
      rtti schemas, the three `Tool` descriptors (`inputSchema` via
      `toJsonSchema`), and `casMcpHandlers(c: Cas<O>): McpHandlers<O>`.
- [x] Implement `tools/call` dispatch with per-tool `validate`, cBase32
      decode/encode, and the `isError` result convention for bad input / missing
      hash / unknown tool.
- [x] Add `casConfig: McpConfig` (capabilities `{ tools: {} }`, `serverInfo`,
      pinned `protocolVersion`).
- [x] `fs/cas/mcp/proof.f.ts`: drive `mcpStep(casConfig)(casMcpHandlers(c))` over
      an in-memory `Cas<MemOp>` through a full `initialize` →
      `notifications/initialized` → `tools/call` sequence; assert add→get
      round-trips, `cas_list` enumerates, and each error path returns `isError`.
- [x] Document the cBase32 content-encoding decision and the protocol-error vs.
      tool-error split in a new `fs/cas/mcp/README.md`.
- [x] stdio transport loop (now landed in `fs/mcp/stdio`, over the stdin read
      effect in `fs/effects/node`); added a `cas mcp` CLI subcommand
      (`casMcpServer`) that runs it.

## Open questions

- **Content encoding.** cBase32 (proposed, consistent with hashes) vs. base64
  (MCP-idiomatic for binary) vs. extending `fs/mcp` with a `blob`/`resource`
  content type so binary isn't forced through `text`. Start cBase32; revisit if a
  blob content type lands.
- **`cas_add` return shape.** Plain hash string in `text`, or a structured
  result? Keep it a bare cBase32 string for now, matching the CLI.
- **`cas_list` paging.** `tools/call` results have no cursor; a large store could
  overflow one text block. Out of scope initially (the CLI lists unbounded too);
  reconsider if it matters.
- **Transport ordering.** stdio first per i665; Streamable HTTP later — the
  adapter is transport-agnostic, so neither blocks the other.

## Related

- [i665-mcp](./665-mcp.md) — the MCP roadmap; this is its "concrete server" by
  way of CAS, and is gated on its stdio-transport item.
- [i66E-mcp-stdio-transport](./66E-mcp-stdio-transport.md) — the missing stdio
  transport this issue is blocked on.
- [i66D-mcp-validate-response-envelope](./66D-mcp-validate-response-envelope.md) —
  the `validated` / `toolMethod` helpers proposed there would also tidy the
  per-tool validate→error/ok envelope this adapter introduces.
- `fs/cas/module.f.ts` — the `Cas<O>` facade reused as-is; the CLI `main` is the
  precedent front end this adapter parallels.
- `fs/mcp/module.f.ts` — `mcpStep`, `McpHandlers`, `McpConfig`, the `Tool` /
  `textContent` schemas.
- `fs/json/schema/module.f.ts` — `toJsonSchema` for each tool's `inputSchema`.
- `fs/cbase32/module.f.ts` — `vecToCBase32` / `cBase32ToVec` for content/hash
  encoding.
- `fs/effects/node/module.f.ts` — `write` (stdout) for the transport; the stdin
  read effect it still lacks.
