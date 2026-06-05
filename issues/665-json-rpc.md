# 665-json-rpc. JSON-RPC 2.0 layer (rtti-validated)

**Priority:** P3
**Status:** done

## Motivation

We want a pure, runtime-validated **JSON-RPC 2.0** layer — a reusable building
block for any JSON-RPC service. [MCP](https://modelcontextprotocol.io/) is one
motivating example: every MCP message (`initialize`, `tools/list`, `tools/call`,
`resources/list`, …) is a JSON-RPC request, notification, or response, so an MCP
server is just a method set layered on top of this. Other consumers (LSP-style
tooling, generic RPC endpoints) reuse the same envelopes — none of those method
sets belong in this module.

Because every message comes from an untrusted peer, the wire shapes must be
**validated at runtime**, not just typed. `fs/types/rtti` already gives us
exactly this: a schema is an ordinary value, and `validate(schema)(value)`
returns a `Result`. Describing the JSON-RPC envelopes as rtti schemas means the
same declaration produces both the static TypeScript type (`Ts<typeof schema>`)
and the runtime decoder — no drift between them.

## Proposal

A new pure module — proposed `fs/json/rpc/module.f.ts` (JSON-RPC is a JSON
dialect; MCP would later live under `fs/mcp/`) — that provides:

1. **rtti schemas** for the JSON-RPC 2.0 envelopes.
2. **decoders** built from those schemas (`validate` / `parse`).
3. a **pure dispatcher** mapping `method → handler`, producing spec-correct
   error responses.

Transport framing (stdio newline-delimited, HTTP, LSP `Content-Length`) is
**out of scope** here — this module is pure value→value. A follow-up wires it to
`fs/effects/node` (`createServer`/`listen` for HTTP, stdin/`write` for stdio).

### rtti schemas (sketch)

Using the existing rtti API — a struct is a plain object literal, a const is the
literal value itself, and `or` / `option` / `array` are combinators. Literal and
struct schemas carry `as const` (see the const-literal rule in [AGENTS.md](../AGENTS.md)):

```ts
import { number, string, or, option } from '../../types/rtti/module.f.ts'
import { unknown } from '../rtti/module.f.ts'    // fs/json/rtti — see i665-rtti-json-value
import type { Unknown } from '../module.f.ts'    // fs/json Unknown type

const jsonrpc = '2.0' as const

const id = or(string, number, null)

export const request = {
    jsonrpc,
    method: string,
    params: option(unknown),   // optional JSON value
    id: option(id),
} as const

export const error = {
    code: number,
    message: string,
    data: option(unknown),
} as const
```

`validate(request)(value)` / `parse(request)(value)` then decode untrusted input;
`Ts<typeof request>` gives the matching static type.

### Standard error codes

| Code | Meaning | When the dispatcher emits it |
|------|---------|------------------------------|
| `-32700` | Parse error | body is not valid JSON |
| `-32600` | Invalid Request | JSON is valid but fails the `request` schema |
| `-32601` | Method not found | no handler registered for `method` |
| `-32602` | Invalid params | `params` fails the handler's param schema |
| `-32603` | Internal error | handler threw |
| `-32000…-32099` | Server error | implementation-defined |

### Dispatcher (sketch)

```ts
type Handler = (params: Unknown | undefined) => Result<Unknown, RpcError>
type Handlers = { readonly [method: string]: Handler }

// pure: value -> response (or null for a notification)
export const dispatch = (handlers: Handlers) => (value: Unknown): Response | null => { ... }
```

- A notification (no `id`) never produces a response (return `null`).
- Each handler validates its own `params` with an rtti schema and returns
  `-32602` on mismatch.
- A batch maps `dispatch` over its members and drops `null`s; an empty batch is
  itself an invalid request (`-32600`).

## Scope

**In:** rtti schemas, decoders, the pure dispatcher, standard error
constructors, proofs covering valid/invalid envelopes and each error code.

**Out (follow-ups):**
- transports — stdio and HTTP framing over `fs/effects/node`
- the MCP method set (`initialize`, `tools/*`, `resources/*`, `prompts/*`) and
  capability negotiation, built on this dispatcher

## Decisions (resolved on implementation)

- **`id` representation.** Kept JSON's native `number` — `id = or(string, number, null)`.
  No `bigint` form; that would diverge from `fs/json`'s number handling and MCP
  ids are small.
- **Module location.** `fs/json/rpc/module.f.ts` (JSON-RPC is a JSON dialect).
- **Batch support.** Deferred — MCP doesn't need it, and rtti's open structs make
  it cheap to add later.
- **JSON value type.** `params`, `result`, and `data` use `unknown` from
  `fs/json/rtti` ([i665-rtti-json-value](./665-rtti-json-value.md)) — the JSON
  `unknown` mirroring `fs/json`'s `Unknown` (no `bigint`/`undefined`). Optionality
  is explicit: `option(unknown)` for `params`/`data`; `result: unknown` is required
  (the JSON `unknown` excludes `undefined`, so a field typed with it is required).
- **Response schema.** `Response` is a **TypeScript type**, not a runtime rtti
  schema: rtti structs are open (extra keys allowed), so "result XOR error" is not
  enforceable. Runtime response decoding is a client-side follow-up. See the
  `Response` JSDoc.

## Related

- [i665-rtti-json-value](./665-rtti-json-value.md) — `fs/json/rtti/module.f.ts`, the JSON rtti tier providing the `unknown` schema used here
- `fs/types/rtti/module.f.ts` — schema combinators; `validate` / `parse` decoders
- `fs/json/module.f.ts` — JSON `parse` / `stringify` for the wire bodies
- `fs/effects/node/module.f.ts` — `createServer` / `listen` (HTTP transport), stdin / `write` (stdio transport) for the follow-up
- [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification)
- [Model Context Protocol](https://modelcontextprotocol.io/)
