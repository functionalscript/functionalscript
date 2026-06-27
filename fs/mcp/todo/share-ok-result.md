## Export `okResult` from `mcp` next to `errorResult`

**Priority:** P3
**Status:** open

### Problem

The single-text-block `ToolsCallResult` shape is constructed in two modules. The
MCP module owns and exports the error constructor
(`fs/mcp/module.f.ts:202-203`):

```ts
export const errorResult = (text: string): ToolsCallResult =>
    ({ content: [{ type: 'text', text }], isError: true })
```

but the success constructor lives privately in the CAS adapter
(`fs/cas/mcp/module.f.ts:263-264`):

```ts
const okResult = (text: string): ToolsCallResult =>
    ({ content: [{ type: 'text', text }] })
```

`cas/mcp` already imports `errorResult` from `mcp` and uses `okResult` heavily
(eight call sites). Both constructors build the same
`{ content: [{ type: 'text', text }] }` content shape; `errorResult` only adds
`isError: true`. The MCP content shape is an MCP-module concern, so its success
half should not have to be hand-rolled in the CAS adapter — that is a
separation-of-concerns smell, and the content literal is now written in two
places.

### Proposal

Move `okResult` into `fs/mcp/module.f.ts` and export it next to `errorResult`. A
second consumer already exists (`cas/mcp`), so this is not speculative. Express
`errorResult` in terms of `okResult` so the content shape lives in exactly one
place:

```ts
export const okResult = (text: string): ToolsCallResult =>
    ({ content: [{ type: 'text', text }] })

export const errorResult = (text: string): ToolsCallResult =>
    ({ ...okResult(text), isError: true })
```

Then `cas/mcp` imports `okResult` from `mcp` and drops its private definition.

### Tasks

- [ ] Add and export `okResult` in `fs/mcp/module.f.ts`; re-express `errorResult`
      in terms of it.
- [ ] Import `okResult` from `mcp` in `fs/cas/mcp/module.f.ts`; remove the local
      definition.
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/mcp/proof.f.ts` and
      `fs/cas/mcp/proof.f.ts` still pass.

### Related

- `fs/mcp/module.f.ts` — owner of `ToolsCallResult` and `errorResult`.
- `fs/cas/mcp/module.f.ts` — current private `okResult` consumer.
