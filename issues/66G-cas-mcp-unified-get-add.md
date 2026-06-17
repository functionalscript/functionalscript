# 66G-cas-mcp-unified-get-add. Unify `cas_add`/`cas_add_url` and `cas_get`/`cas_get_meta`

**Priority:** P3
**Status:** open

## Problem

The CAS MCP server exposes four tools where two pairs do closely related work:

| Pair | Tools |
|------|-------|
| Add  | `cas_add { content, type? }` and `cas_add_url { url }` |
| Get  | `cas_get { hash }` and `cas_get_meta { hash }` |

Having separate tools for what is logically one operation forces the model to
choose between them upfront, increases the tool surface the model must reason
about, and creates an inconsistency: adding already has a `type` discriminator,
but retrieving uses two entirely separate commands.

## Proposal

### Unify `cas_add` + `cas_add_url`

Extend the `type` field of `cas_add` to include `'url'`:

```ts
// before
casAddArgs    = { content: string, type?: 'text' | 'base64' }
casAddUrlArgs = { url: string }

// after
casAddArgs = { content: string, type?: 'text' | 'base64' | 'url' }
```

When `type === 'url'`, `content` is interpreted as a filesystem path. The server
reads the file at that path and stores it, exactly as `cas_add_url` does today.
`cas_add_url` is removed.

### Unify `cas_get` + `cas_get_meta`

Merge into a single `cas_get` that always returns metadata and optionally
returns content when the caller requests it:

```ts
// input
casGetArgs = { hash: string, content?: boolean }  // content defaults to false

// output
{
  length: number,       // byte count, always present
  mime_type: string,    // always present
  url?: string,         // present when toUrl resolver is available
  content?: string,     // present only when content: true was requested
  type?: 'text' | 'base64'  // present only alongside content
}
```

Default `content: false` matches the cheap path (HEAD-like): the model inspects
metadata first and decides whether to pay the token cost of fetching content.
Passing `content: true` gives the full inline payload in a single round-trip.
`cas_get_meta` is removed.

### Client decision protocol (unchanged)

1. Call `cas_get` (default `content: false`) to inspect `length` and `mime_type`.
2. If content is small and text-based → call `cas_get` again with `content: true`.
3. If content is large or binary → use `url` from the first call directly.

## Tasks

- [ ] Extend `casAddArgs` type to `'text' | 'base64' | 'url'` and handle the
      `'url'` branch in the `cas_add` tool handler (same logic as `cas_add_url`).
- [ ] Remove `casAddUrlArgs` and the `cas_add_url` tool handler.
- [ ] Extend `casGetArgs` with `content?: boolean`.
- [ ] Rewrite the `cas_get` handler to always return `{ length, mime_type, url? }`
      and include `{ content, type }` only when `content: true` is requested.
- [ ] Remove `casGetMetaArgs` and the `cas_get_meta` tool handler.
- [ ] Update `fs/cas/mcp/proof.f.ts` tests to cover `cas_add` with `type: 'url'`
      and `cas_get` with and without `content: true`.

## Related

- [i66G-cas-mcp-url-tools](./66G-cas-mcp-url-tools.md) — introduced `cas_add_url`
  and `cas_get_meta`; this issue supersedes the two-tool approach with a unified API.
- `fs/cas/mcp/module.f.ts` — all four handlers live here.
